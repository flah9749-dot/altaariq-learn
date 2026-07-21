// سكربت مساعد لإنشاء N طالب وهمي في قاعدة البيانات لأغراض اختبار الحمل.
// شغّله من لوحة الأدمن أو حوّله لـ server function مؤقت.
// النتيجة: يولد ملف students.json فيه [{code, password}] لاستخدامه في k6.

// طريقة الاستخدام (Node):
//   SUPABASE_URL=... SERVICE_ROLE_KEY=... COUNT=3000 node load-tests/seed-test-students.mjs

import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';

const url = process.env.SUPABASE_URL;
const key = process.env.SERVICE_ROLE_KEY; // service role مطلوب لإنشاء مستخدمين
const count = parseInt(process.env.COUNT || '100', 10);

if (!url || !key) {
  console.error('SUPABASE_URL و SERVICE_ROLE_KEY مطلوبان');
  process.exit(1);
}

const supa = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const students = [];

for (let i = 0; i < count; i++) {
  const code = `LOAD-${String(i).padStart(5, '0')}`;
  const password = 'Test' + Math.random().toString(36).slice(2, 10) + '#';
  const email = `${code.toLowerCase()}@altaariq.local`;

  const { data, error } = await supa.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { code, is_load_test: true, name: `طالب اختبار ${i}` },
  });
  if (error) {
    console.error(i, error.message);
    continue;
  }
  // أنشئ صف الطالب المرتبط
  await supa.from('students').insert({
    user_id: data.user.id,
    code,
    full_name: `طالب اختبار ${i}`,
    grade: 'اختبار حمل',
    plaintext_password: password,
  });
  students.push({ code, password });
  if (i % 100 === 0) console.log(`✓ أنشأت ${i}/${count}`);
}

writeFileSync('load-tests/students.json', JSON.stringify(students, null, 2));
console.log(`✅ تم! ${students.length} طالب في load-tests/students.json`);
console.log('🧹 لحذفهم لاحقاً: DELETE من auth.users WHERE raw_user_meta_data->>\'is_load_test\' = \'true\'');
