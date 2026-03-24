import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://unhkiydnkidqaxtsiyre.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVuaGtpeWRua2lkcWF4dHNpeXJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNTExNDcsImV4cCI6MjA2NzkyNzE0N30.xCYg9frzPi6OQDzLmeYbopv53yD_mCPhls9o0KpCVHg";

const EMAIL = "vermittler@faqir-automation.de";
const PASSWORD = "Vermittler2026!";
const FULL_NAME = "Vermittler Test";
const ROLE = "vermittler";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 1. Benutzer registrieren
const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
  email: EMAIL,
  password: PASSWORD,
});

if (signUpError) {
  console.error("Fehler beim Erstellen des Auth-Users:", signUpError.message);
  process.exit(1);
}

const user = signUpData.user;
if (!user) {
  console.error("Kein User zurückgegeben – evtl. E-Mail-Bestätigung erforderlich.");
  process.exit(1);
}

console.log("Auth-User erstellt:", user.id);

// 2. user_profiles-Eintrag anlegen
const { error: profileError } = await supabase.from("user_profiles").insert({
  id: user.id,
  email: EMAIL,
  full_name: FULL_NAME,
  role: ROLE,
});

if (profileError) {
  console.error("Fehler beim Anlegen des Profils:", profileError.message);
  console.log(
    "Falls RLS das verhindert: Bitte manuell in Supabase Dashboard einfügen:",
    { id: user.id, email: EMAIL, full_name: FULL_NAME, role: ROLE }
  );
  process.exit(1);
}

console.log("Profil angelegt. Vermittler-Account fertig:");
console.log(`  E-Mail:  ${EMAIL}`);
console.log(`  Name:    ${FULL_NAME}`);
console.log(`  Rolle:   ${ROLE}`);
console.log(`  User-ID: ${user.id}`);
