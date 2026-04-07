import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { normalizeAzubi } from "@/lib/utils/normalize";
import { AzubiRaw } from "@/types/database";
import { StatsBar } from "@/components/stats-bar";
import { AzubiDashboard } from "@/components/azubi-dashboard";

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

export default async function DashboardPage() {
  const supabase = await createClient();

  // Use service role to bypass RLS (admins + recruiters need to see all students)
  const adminSupabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch all azubis
  const { data: rawAzubis, error } = await adminSupabase
    .from("ausbildung_main_engine")
    .select(AZUBI_COLUMNS)
    .order("Namen", { ascending: true });

  if (error) {
    return (
      <div className="text-red-600 p-4">
        Fehler beim Laden: {error.message}
      </div>
    );
  }

  // Fetch application counts per user_id
  const { data: bewerbungenCounts } = await adminSupabase
    .from("bewerbungen")
    .select("student_user_id");

  // Count applications per user
  const countMap: Record<string, number> = {};
  if (bewerbungenCounts) {
    for (const row of bewerbungenCounts) {
      const uid = row.student_user_id;
      if (uid) {
        countMap[uid] = (countMap[uid] || 0) + 1;
      }
    }
  }

  const azubis = (rawAzubis as AzubiRaw[])
    .map((raw) =>
      normalizeAzubi(raw, raw.user_id ? countMap[raw.user_id] || 0 : 0)
    )
    .filter((a) => a.sichtbar);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold text-[#1d1d1f] tracking-tight">Azubi-Übersicht</h2>
        <p className="text-sm text-gray-400 mt-1.5 font-medium">
          {azubis.length} Kandidaten im System
        </p>
      </div>
      <StatsBar azubis={azubis} />
      <AzubiDashboard azubis={azubis} />
    </div>
  );
}
