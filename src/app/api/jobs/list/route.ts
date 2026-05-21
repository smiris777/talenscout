import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { getMatchingBereiche } from "@/lib/email/bereich-mapping";

export const runtime = "nodejs";

const PAGE_SIZE = 24;

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const search = (searchParams.get("q") ?? "").trim();
  const maxAgeDays = parseInt(searchParams.get("maxAgeDays") ?? "0", 10) || 0;
  const onlyMyBereich = searchParams.get("onlyMine") === "1";
  const onlyNew = searchParams.get("onlyNew") === "1";

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Studenten-Ziel laden für Default-Bereich-Filter
  const { data: student } = await admin
    .from("ausbildung_main_engine")
    .select(`"Ziel"`)
    .eq("user_id", user.id)
    .single();

  const ziel = (student as Record<string, unknown> | null)?.["Ziel"] as string | undefined;

  // Bereich-Terms aus Studenten-Ziel ableiten (nur wenn Filter aktiv)
  let bereichTerms: string[] | null = null;
  if (onlyMyBereich && ziel) {
    const terms = getMatchingBereiche(ziel);
    if (terms.length > 0) {
      bereichTerms = terms;
    }
  }

  // Cleanup search input (Sonderzeichen, die SQL ILIKE stören könnten)
  const cleanSearch = search.length >= 2 ? search.replace(/[%_]/g, "") : null;

  // RPC: macht ALLES server-side — Filter, Dedup, Pagination, Count in einer Query.
  // Damit ist Seite 1 nicht mehr leer, wenn bereits beworbene rausgefiltert werden.
  const { data, error } = await admin.rpc("student_jobs", {
    p_user_id: user.id,
    p_search: cleanSearch,
    p_max_age_days: maxAgeDays > 0 ? maxAgeDays : null,
    p_bereich_terms: bereichTerms,
    p_only_new: onlyNew,
    p_offset: (page - 1) * PAGE_SIZE,
    p_limit: PAGE_SIZE,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as Array<{
    id: number;
    firmenname: string | null;
    email: string | null;
    telefonnummer: string | null;
    bereich: string | null;
    name: string | null;
    geschlecht: string | null;
    zusatzinfo: string | null;
    created_at: string | null;
    already_applied: boolean;
    total: number | string;
  }>;

  const total = rows.length > 0 ? Number(rows[0].total) : 0;

  const jobs = rows.map((r) => ({
    id: r.id,
    firmenname: r.firmenname,
    email: r.email,
    telefonnummer: r.telefonnummer,
    bereich: r.bereich,
    ansprechpartner: r.name,
    geschlecht: r.geschlecht,
    zusatzinfo: r.zusatzinfo,
    created_at: r.created_at,
    alreadyApplied: r.already_applied,
  }));

  return NextResponse.json({
    page,
    pageSize: PAGE_SIZE,
    total,
    totalPages: Math.ceil(total / PAGE_SIZE),
    studentZiel: ziel ?? null,
    jobs,
  });
}
