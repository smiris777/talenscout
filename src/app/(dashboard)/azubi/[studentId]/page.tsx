import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { normalizeAzubi } from "@/lib/utils/normalize";
import { AzubiRaw } from "@/types/database";
import { AzubiDetail } from "@/components/azubi-detail";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const AZUBI_COLUMNS = `
  id,
  "Student ID",
  "Namen",
  "Email",
  "Ziel",
  "Aktiv",
  "Deutsch Niveau",
  "Art",
  "BewerbungsVideoLink",
  "BewerbungsfotoLink",
  "Lebenslauf ",
  "Infos",
  "Motivationsschreiben",
  "Profil",
  "Foto in System",
  "Lebenslauf in System",
  "Mitarbeiter",
  "Gesamtscore",
  user_id,
  first_name,
  last_name,
  created_at,
  drive_folder_id,
  sichtbar
`;

export default async function AzubiPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const supabase = await createClient();
  const adminSupabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: rawAzubi, error } = await adminSupabase
    .from("ausbildung_main_engine")
    .select(AZUBI_COLUMNS)
    .eq("id", parseInt(studentId))
    .single();

  if (error || !rawAzubi) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-semibold text-gray-900">
          Kandidat nicht gefunden
        </h2>
        <Link href="/" className="mt-4 inline-block">
          <Button variant="outline">Zurück zur Übersicht</Button>
        </Link>
      </div>
    );
  }

  // Get application count
  let bewerbungenCount = 0;
  if ((rawAzubi as AzubiRaw).user_id) {
    const { count } = await adminSupabase
      .from("bewerbungen")
      .select("id", { count: "exact", head: true })
      .eq("student_user_id", (rawAzubi as AzubiRaw).user_id!);
    bewerbungenCount = count || 0;
  }

  // Get recent applications with contact details from bewerbungen
  let recentApplications: Array<{
    firmenname: string | null;
    email: string | null;
    name: string | null;
    telefonnummer: string | null;
    bewerbungsdatum: string | null;
    status: string | null;
    bereich: string | null;
    geschlecht: string | null;
  }> = [];
  if ((rawAzubi as AzubiRaw).user_id) {
    const { data } = await adminSupabase
      .from("bewerbungen")
      .select("firmenname, email, name, telefonnummer, bewerbungsdatum, status, bereich, geschlecht")
      .eq("student_user_id", (rawAzubi as AzubiRaw).user_id!)
      .order("bewerbungsdatum", { ascending: false })
      .limit(30);
    recentApplications = data || [];
  }

  const azubi = normalizeAzubi(rawAzubi as AzubiRaw, bewerbungenCount);

  return (
    <div>
      <Link href="/" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 mb-6">
        ← Zurück zur Übersicht
      </Link>
      <AzubiDetail azubi={azubi} recentApplications={recentApplications} />
    </div>
  );
}
