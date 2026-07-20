// Deterministic synthetic-email mapping for username / student-code login.
// Auth is Supabase Auth (which requires emails). Users never see these strings.
export const ADMIN_EMAIL_DOMAIN = "admin.altareq.local";
export const STUDENT_EMAIL_DOMAIN = "student.altareq.local";

const sanitize = (v: string) =>
  v
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_\-\.]/g, "-");

export const adminEmailFromUsername = (username: string) =>
  `${sanitize(username)}@${ADMIN_EMAIL_DOMAIN}`;

export const studentEmailFromCode = (code: string) =>
  `${sanitize(code)}@${STUDENT_EMAIL_DOMAIN}`;
