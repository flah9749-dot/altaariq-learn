// ============================================================
// اختبار حمل منصة الطارق التعليمية باستخدام k6
// ============================================================
// الهدف: محاكاة آلاف الطلاب يحلّون امتحاناً في نفس اللحظة
// لقياس تحمّل قاعدة البيانات + Realtime + Auth.
//
// طريقة التشغيل:
//   1) ثبّت k6:  https://k6.io/docs/get-started/installation/
//   2) عدّل الثوابت بالأسفل (SUPABASE_URL, ANON_KEY, EXAM_ID, STUDENTS)
//   3) شغّل:  k6 run load-tests/exam-load-test.js
//
// السيناريوهات المتاحة (اختر واحداً عبر --env SCENARIO=xxx):
//   - smoke   : 10 طلاب  (تجربة أولية للتأكد أن السكربت شغال)
//   - ramp    : تدرّج من 0 إلى 500 طالب خلال 5 دقائق
//   - stress  : ذروة 3000 طالب لمدة 10 دقائق
// ============================================================

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

// -------------------- إعدادات المشروع --------------------
const SUPABASE_URL = __ENV.SUPABASE_URL || 'https://zafilibrplthhqzoporw.supabase.co';
const ANON_KEY = __ENV.ANON_KEY || ''; // ضع anon key هنا أو مرّرها --env ANON_KEY=...
const EXAM_ID = __ENV.EXAM_ID || '';   // ID امتحان تجريبي (منشور) للاختبار
const APP_URL = __ENV.APP_URL || 'https://altaariq-learn.lovable.app';

// قائمة كودات طلاب تجريبيين (يُفضّل إنشاء 3000 حساب وهمي مسبقاً)
// أنشئ ملف students.json فيه: [{"code":"STD-XXX","password":"..."}]
const STUDENTS = JSON.parse(open('./students.json') || '[]');

// -------------------- مقاييس مخصصة --------------------
const loginTrend    = new Trend('login_duration');
const startExamTrend= new Trend('start_exam_duration');
const answerTrend   = new Trend('save_answer_duration');
const submitTrend   = new Trend('submit_exam_duration');
const errors        = new Rate('errors');
const totalRequests = new Counter('total_requests');

// -------------------- السيناريوهات --------------------
const scenarios = {
  smoke: {
    executor: 'constant-vus',
    vus: 10,
    duration: '1m',
  },
  ramp: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '1m', target: 100 },
      { duration: '2m', target: 300 },
      { duration: '2m', target: 500 },
      { duration: '1m', target: 0 },
    ],
  },
  stress: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '2m',  target: 500 },
      { duration: '3m',  target: 1500 },
      { duration: '5m',  target: 3000 },
      { duration: '10m', target: 3000 }, // ذروة
      { duration: '2m',  target: 0 },
    ],
  },
};

const selected = __ENV.SCENARIO || 'smoke';

export const options = {
  scenarios: { [selected]: scenarios[selected] },
  thresholds: {
    errors: ['rate<0.05'],                      // نسبة الأخطاء أقل من 5%
    login_duration: ['p(95)<2000'],             // 95% من عمليات الدخول أقل من 2 ثانية
    save_answer_duration: ['p(95)<1500'],       // 95% من حفظ الإجابات أقل من 1.5 ثانية
    submit_exam_duration: ['p(95)<3000'],
    http_req_failed: ['rate<0.05'],
  },
};

// -------------------- دوال مساعدة --------------------
function supaHeaders(token) {
  return {
    'Content-Type': 'application/json',
    'apikey': ANON_KEY,
    'Authorization': `Bearer ${token || ANON_KEY}`,
  };
}

function login(student) {
  const url = `${SUPABASE_URL}/auth/v1/token?grant_type=password`;
  const payload = JSON.stringify({
    email: `${student.code.toLowerCase()}@altaariq.local`, // نمط الإيميلات الوهمية
    password: student.password,
  });
  const t0 = Date.now();
  const res = http.post(url, payload, { headers: supaHeaders() });
  loginTrend.add(Date.now() - t0);
  totalRequests.add(1);
  const ok = check(res, { 'login 200': (r) => r.status === 200 });
  if (!ok) { errors.add(1); return null; }
  return res.json('access_token');
}

function startExam(token) {
  const url = `${SUPABASE_URL}/rest/v1/exam_attempts`;
  const payload = JSON.stringify({
    exam_id: EXAM_ID,
    started_at: new Date().toISOString(),
    status: 'in_progress',
  });
  const t0 = Date.now();
  const res = http.post(url, payload, {
    headers: { ...supaHeaders(token), 'Prefer': 'return=representation' },
  });
  startExamTrend.add(Date.now() - t0);
  totalRequests.add(1);
  const ok = check(res, { 'start exam 201': (r) => r.status === 201 });
  if (!ok) { errors.add(1); return null; }
  return res.json('0.id');
}

function saveAnswer(token, attemptId, questionId, answer) {
  const url = `${SUPABASE_URL}/rest/v1/student_answers`;
  const payload = JSON.stringify({
    attempt_id: attemptId,
    question_id: questionId,
    answer_text: answer,
  });
  const t0 = Date.now();
  const res = http.post(url, payload, { headers: supaHeaders(token) });
  answerTrend.add(Date.now() - t0);
  totalRequests.add(1);
  const ok = check(res, { 'save answer 2xx': (r) => r.status >= 200 && r.status < 300 });
  if (!ok) errors.add(1);
}

function submitExam(token, attemptId) {
  const url = `${SUPABASE_URL}/rest/v1/exam_attempts?id=eq.${attemptId}`;
  const payload = JSON.stringify({
    status: 'submitted',
    submitted_at: new Date().toISOString(),
  });
  const t0 = Date.now();
  const res = http.patch(url, payload, { headers: supaHeaders(token) });
  submitTrend.add(Date.now() - t0);
  totalRequests.add(1);
  const ok = check(res, { 'submit 2xx': (r) => r.status >= 200 && r.status < 300 });
  if (!ok) errors.add(1);
}

// -------------------- سيناريو الطالب الواحد --------------------
export default function () {
  if (!STUDENTS.length) {
    console.error('⚠️ students.json فاضي. أنشئ حسابات وهمية أولاً.');
    return;
  }
  const student = STUDENTS[Math.floor(Math.random() * STUDENTS.length)];

  let token, attemptId;

  group('1) تسجيل الدخول', () => {
    token = login(student);
  });
  if (!token) return;

  group('2) بدء الامتحان', () => {
    attemptId = startExam(token);
  });
  if (!attemptId) return;

  group('3) حل الأسئلة (محاكاة 10 أسئلة)', () => {
    // ⚠️ استبدل بأسئلة حقيقية من الامتحان
    const questionIds = (__ENV.QUESTION_IDS || '').split(',').filter(Boolean);
    for (const qId of questionIds) {
      sleep(Math.random() * 3 + 1); // الطالب يفكر 1-4 ثواني
      saveAnswer(token, attemptId, qId, 'answer-' + Math.random());
    }
  });

  group('4) تسليم الامتحان', () => {
    submitExam(token, attemptId);
  });

  sleep(1);
}

// -------------------- تقرير الملخص --------------------
export function handleSummary(data) {
  return {
    'stdout': textSummary(data),
    'load-tests/summary.json': JSON.stringify(data, null, 2),
  };
}

function textSummary(data) {
  const m = data.metrics;
  const line = (k, v) => `  ${k.padEnd(30)} ${v}`;
  return `
========================================
📊 نتائج اختبار الحمل - الطارق التعليمية
========================================
${line('المستخدمون الأقصى:',    m.vus_max?.values?.max || '-')}
${line('إجمالي الطلبات:',       m.http_reqs?.values?.count || '-')}
${line('نسبة الأخطاء:',         ((m.errors?.values?.rate || 0) * 100).toFixed(2) + '%')}
${line('متوسط زمن الاستجابة:',  (m.http_req_duration?.values?.avg || 0).toFixed(0) + 'ms')}
${line('P95 زمن الاستجابة:',    (m.http_req_duration?.values['p(95)'] || 0).toFixed(0) + 'ms')}
${line('P95 تسجيل دخول:',       (m.login_duration?.values['p(95)'] || 0).toFixed(0) + 'ms')}
${line('P95 حفظ إجابة:',        (m.save_answer_duration?.values['p(95)'] || 0).toFixed(0) + 'ms')}
${line('P95 تسليم:',            (m.submit_exam_duration?.values['p(95)'] || 0).toFixed(0) + 'ms')}
========================================
`;
}
