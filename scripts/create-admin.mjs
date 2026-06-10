/**
 * Legt einen Admin-Account an (Auth-User + user_profiles role=administrator).
 * Credentials werden per ENV übergeben.
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://unhkiydnkidqaxtsiyre.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EMAIL = process.env.NEW_ADMIN_EMAIL;
const PASSWORD = process.env.NEW_ADMIN_PASSWORD;
const FULL_NAME = process.env.NEW_ADMIN_NAME || "Admin";

if (!SERVICE_KEY || !EMAIL || !PASSWORD) {
  console.error("Need SUPABASE_SERVICE_ROLE_KEY, NEW_ADMIN_EMAIL, NEW_ADMIN_PASSWORD");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: created, error: createErr } = await admin.auth.admin.createUser({
  email: EMAIL,
  password: PASSWORD,
  email_confirm: true,
});

if (createErr || !created.user) {
  console.error("Auth-User Fehler:", createErr?.message);
  process.exit(1);
}

const userId = created.user.id;

const { error: profErr } = await admin.from("user_profiles").upsert({
  id: userId,
  email: EMAIL,
  full_name: FULL_NAME,
  role: "administrator",
});

if (profErr) {
  console.error("Profil-Fehler:", profErr.message);
  process.exit(1);
}

console.log("OK admin angelegt:", EMAIL, "| user_id:", userId);
