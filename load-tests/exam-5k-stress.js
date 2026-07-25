// ============================================================
// سيناريو ضغط: محاكاة 5000 طالب متزامن على منصة الطارق التعليمية
// ============================================================
// الهدف الأساسي:
//   1) قياس زمن التسليم (submit) تحت ذروة 5000 VU
//   2) قياس حمل قاعدة البيانات (رحلة الطلب كاملة عبر PostgREST)
//   3) رصد نسب الأخطاء و429/503 من الـ Gateway
//
// طريقة التشغيل:
//   k6 run load-tests/exam-5k-stress.js \
//     --env ANON_KEY=xxx \
//     --env EXAM_ID=uuid \
//     --env QUESTION_IDS=uuid1,uuid2,...
//
// اختياري:
//   --env PEAK_VUS=5000     (افتراضي 5000)
//   --env PEAK_DURATION=10m (مدة الذروة)
//   --env DB_PROBE=1        (تفعيل استعلام خفيف لقياس زمن DB)
// ============================================================

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

const SUPABASE_URL = __ENV.SUPABASE_URL || 'https://zafilibrplthhqzoporw.supabase.co';
const ANON_KEY     = __ENV.ANON_KEY || '';
const EXAM_ID      = __ENV.EXAM_ID || '';
const QUESTION_IDS = (__ENV.QUESTION_IDS || '').split(',').filter(Boolean);
const PEAK_VUS     = parseInt(__ENV.PEAK_VUS || '5000', 10);
const PEAK_DUR     = __ENV.PEAK_DURATION || '10m';
const DB_PROBE     = __ENV.DB_PROBE === '1';

const STUDENTS = JSON.parse(open('./students.json') || '[]');

// -------------------- المقاييس --------------------
const loginTrend       = new Trend('login_duration', true);
const startExamTrend   = new Trend('start_exam_duration', true);
const saveAnswerTrend  = new Trend('save_answer_duration', true);
const submitTrend      = new Trend('submit_exam_duration', true); // 🎯 المقياس المحوري
const submitDbTrend    = new Trend('submit_db_write_duration', true);
const dbProbeTrend     = new Trend('db_probe_duration', true);    // 🎯 حمل DB
const errors           = new Rate('errors');
const rateLimited      = new Rate('rate_limited_429');
const serverErrors     = new Rate('server_errors_5xx');
const submitSuccess    = new Rate('submit_success');
const totalRequests    = new Counter('total_requests');

// -------------------- الخطة (Ramp → Peak → Cool-down) --------------------
export const options = {
  scenarios: {
    stress_5k: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m',       target: 1000 },      // إحماء
        { duration: '3m',       target: 3000 },      // تصاعد
        { duration: '3m',       target: PEAK_VUS },  // اقتراب الذروة
        { duration: PEAK_DUR,   target: PEAK_VUS },  // 🔥 الذروة الحقيقية
        { duration: '2m',       target: 0 },         // تهدئة
      ],
      gracefulRampDown: '30s',
    },
  },
  // Thresholds تفشل الاختبار إذا تجاوزنا الحدود المقبولة
  thresholds: {
    submit_exam_duration:   ['p(95)<3000', 'p(99)<6000'],
    save_answer_duration:   ['p(95)<1500'],
    login_duration:         ['p(95)<2500'],
    submit_success:         ['rate>0.98'],
    errors:                 ['rate<0.02'],
    rate_limited_429:       ['rate<0.01'],
    server_errors_5xx:      ['rate<0.005'],
    http_req_duration:      ['p(95)<3000'],
  },
  // منع k6 من الانفجار على TCP في مرحلة الـ 5000
  batch: 20,
  batchPerHost: 20,
  noConnectionReuse: false,
  discardResponseBodies: false,
};

// -------------------- Helpers --------------------
function h(token) {
  return {
    'Content-Type': 'application/json',
    'apikey': ANON_KEY,
    'Authorization': `Bearer ${token || ANON_KEY}`,
  };
}

function login(s) {
  const t0 = Date.now();
  const res = http.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    JSON.stringify({
      email: `${s.code.toLowerCase()}@altaariq.local`,
      password: s.password,
    }),
    { headers: h(), tags: { op: 'login' } },
  );
  loginTrend.add(Date.now() - t0);
  totalRequests.add(1);
  trackStatus(res);
  if (res.status !== 200) { errors.add(1); return null; }
  return res.json('access_token');
}

function startExam(token) {
  const t0 = Date.now();
  const res = http.post(
    `${SUPABASE_URL}/rest/v1/exam_attempts`,
    JSON.stringify({
      exam_id: EXAM_ID,
      started_at: new Date().toISOString(),
      status: 'in_progress',
    }),
    { headers: { ...h(token), Prefer: 'return=representation' }, tags: { op: 'start' } },
  );
  startExamTrend.add(Date.now() - t0);
  totalRequests.add(1);
  trackStatus(res);
  if (res.status !== 201) { errors.add(1); return null; }
  return res.json('0.id');
}

// يستخدم Batch Upsert ليطابق المسار الإنتاجي الحقيقي (طلب واحد لكل الإجابات)
function batchSaveAnswers(token, attemptId) {
  if (!QUESTION_IDS.length) return;
  const rows = QUESTION_IDS.map((qId) => ({
    attempt_id: attemptId,
    question_id: qId,
    answer_text: 'load-' + Math.random().toString(36).slice(2, 8),
  }));
  const t0 = Date.now();
  const res = http.post(
    `${SUPABASE_URL}/rest/v1/attempt_answers`,
    JSON.stringify(rows),
    {
      headers: { ...h(token), Prefer: 'resolution=merge-duplicates' },
      tags: { op: 'save' },
    },
  );
  saveAnswerTrend.add(Date.now() - t0);
  totalRequests.add(1);
  trackStatus(res);
  if (res.status < 200 || res.status >= 300) errors.add(1);
}

function submitExam(token, attemptId) {
  const t0 = Date.now();
  const res = http.patch(
    `${SUPABASE_URL}/rest/v1/exam_attempts?id=eq.${attemptId}`,
    JSON.stringify({
      status: 'submitted',
      submitted_at: new Date().toISOString(),
    }),
    { headers: h(token), tags: { op: 'submit' } },
  );
  const dur = Date.now() - t0;
  submitTrend.add(dur);
  submitDbTrend.add(res.timings.waiting); // زمن انتظار DB الفعلي (TTFB)
  totalRequests.add(1);
  const ok = res.status >= 200 && res.status < 300;
  submitSuccess.add(ok ? 1 : 0);
  trackStatus(res);
  if (!ok) errors.add(1);
  return ok;
}

// استعلام قراءة خفيف جداً لقياس حمل DB الحقيقي (باستخدام index)
function dbProbe(token) {
  if (!DB_PROBE || !EXAM_ID) return;
  const t0 = Date.now();
  const res = http.get(
    `${SUPABASE_URL}/rest/v1/exams?id=eq.${EXAM_ID}&select=id,title,duration_minutes`,
    { headers: h(token), tags: { op: 'db_probe' } },
  );
  dbProbeTrend.add(res.timings.waiting);
  totalRequests.add(1);
  trackStatus(res);
}

function trackStatus(res) {
  if (res.status === 429) rateLimited.add(1); else rateLimited.add(0);
  if (res.status >= 500)  serverErrors.add(1); else serverErrors.add(0);
}

// -------------------- سيناريو الطالب --------------------
export default function () {
  if (!STUDENTS.length) {
    console.error('⚠️ students.json فارغ. أنشئ حسابات وهمية أولاً.');
    return;
  }
  const s = STUDENTS[Math.floor(Math.random() * STUDENTS.length)];

  let token, attemptId;

  group('1) دخول', () => { token = login(s); });
  if (!token) return;

  group('2) بدء', () => { attemptId = startExam(token); });
  if (!attemptId) return;

  group('3) قياس DB', () => { dbProbe(token); });

  group('4) حل الأسئلة', () => {
    // محاكاة تفكير الطالب (تُوزَّع الحمل بدل انفجار فوري)
    sleep(Math.random() * 8 + 4); // 4-12 ثانية
    batchSaveAnswers(token, attemptId);
  });

  // محاكاة "لحظة التسليم الجماعي" (ذروة الضغط الحقيقي)
  group('5) تسليم', () => {
    sleep(Math.random() * 2); // 0-2 ثانية → 5000 طالب يسلمون خلال 2ث
    submitExam(token, attemptId);
  });
}

// -------------------- التقرير --------------------
export function handleSummary(data) {
  const m = data.metrics;
  const fmt = (v) => (v == null ? '-' : Number(v).toFixed(0) + 'ms');
  const pct = (v) => ((v || 0) * 100).toFixed(2) + '%';
  const s = m.submit_exam_duration?.values || {};
  const dbw = m.submit_db_write_duration?.values || {};
  const probe = m.db_probe_duration?.values || {};

  const text = `
============================================================
🔥 اختبار ضغط 5000 طالب متزامن - الطارق التعليمية
============================================================
VUs الأقصى              : ${m.vus_max?.values?.max || '-'}
إجمالي الطلبات          : ${m.http_reqs?.values?.count || '-'}
معدل الطلبات/ث          : ${(m.http_reqs?.values?.rate || 0).toFixed(1)}

--- زمن التسليم (submit) 🎯 ---
  المتوسط              : ${fmt(s.avg)}
  P50 (median)         : ${fmt(s.med)}
  P95                  : ${fmt(s['p(95)'])}
  P99                  : ${fmt(s['p(99)'])}
  الأقصى               : ${fmt(s.max)}
  نسبة نجاح التسليم    : ${pct(m.submit_success?.values?.rate)}

--- حمل قاعدة البيانات 🗄 ---
  Submit DB write P95  : ${fmt(dbw['p(95)'])}
  Submit DB write P99  : ${fmt(dbw['p(99)'])}
  DB read probe P95    : ${fmt(probe['p(95)'])}
  DB read probe P99    : ${fmt(probe['p(99)'])}

--- الأخطاء ---
  إجمالي الأخطاء       : ${pct(m.errors?.values?.rate)}
  429 (Rate limited)   : ${pct(m.rate_limited_429?.values?.rate)}
  5xx (Server errors)  : ${pct(m.server_errors_5xx?.values?.rate)}
  http_req_failed      : ${pct(m.http_req_failed?.values?.rate)}

--- مراحل الرحلة ---
  Login       P95      : ${fmt(m.login_duration?.values['p(95)'])}
  Start exam  P95      : ${fmt(m.start_exam_duration?.values['p(95)'])}
  Save answer P95      : ${fmt(m.save_answer_duration?.values['p(95)'])}
============================================================
`;
  return {
    stdout: text,
    'load-tests/summary-5k.json': JSON.stringify(data, null, 2),
    'load-tests/summary-5k.txt': text,
  };
}
