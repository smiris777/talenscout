import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { ingestArbeitsagenturSearch, ingestBatch, studentZieleToSearchTerms } from "@/lib/scraping/ingest";

export const runtime = "nodejs";
export const maxDuration = 300;

interface AdminScrapeBody {
  /** Wenn gesetzt: nur diesen Beruf suchen. Sonst: alle aktiven Studenten-Ziele durchgehen. */
  was?: string;
  wo?: string;
  umkreis?: number;
  size?: number;
  pages?: number;
  maxInserts?: number;
  /** 1=ARBEIT, 4=AUSBILDUNG, 34=ARBEIT+AUSBILDUNG */
  angebotsart?: number;
}

export async function POST(request: Request) {
  // 1. Admin-Auth
  const supabaseUser = await createClient();
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const supabase = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "administrator") {
    return NextResponse.json({ error: "Keine Admin-Berechtigung" }, { status: 403 });
  }

  // 2. Body parsen
  let body: AdminScrapeBody = {};
  try {
    body = (await request.json()) as AdminScrapeBody;
  } catch {
    // leerer Body → Default-Run über alle Ziele
  }

  const size = Math.min(Math.max(body.size ?? 25, 1), 50);
  const pages = Math.min(Math.max(body.pages ?? 1, 1), 5);
  const maxInserts = Math.min(Math.max(body.maxInserts ?? 50, 1), 200);

  const startedAt = Date.now();

  // 3a. Gezielte Einzel-Suche
  if (body.was && body.was.trim().length >= 3) {
    const stats = await ingestArbeitsagenturSearch(supabase, {
      was: body.was.trim(),
      wo: body.wo?.trim() || undefined,
      umkreis: body.umkreis,
      size,
      pages,
      maxInserts,
      angebotsart: body.angebotsart,
    });
    return NextResponse.json({
      mode: "single",
      durationMs: Date.now() - startedAt,
      stats,
    });
  }

  // 3b. Batch über alle Studenten-Ziele
  const { data: students } = await supabase
    .from("ausbildung_main_engine")
    .select(`"Ziel"`)
    .eq("student_active", true);

  const searchTerms = studentZieleToSearchTerms(
    (students ?? []).map((s) => (s as Record<string, unknown>).Ziel as string | null),
  );

  if (searchTerms.length === 0) {
    return NextResponse.json({
      mode: "batch",
      message: "Keine aktiven Studenten-Ziele gefunden",
      perSearch: [],
    });
  }

  const perTermBudget = Math.max(3, Math.floor(maxInserts / searchTerms.length));

  const { total, perSearch } = await ingestBatch(
    supabase,
    searchTerms.map((was) => ({
      was,
      wo: body.wo?.trim() || undefined,
      umkreis: body.umkreis,
      size,
      pages,
      maxInserts: perTermBudget,
      angebotsart: body.angebotsart,
    })),
  );

  return NextResponse.json({
    mode: "batch",
    durationMs: Date.now() - startedAt,
    terms: searchTerms.length,
    total,
    perSearch: perSearch.map((p) => ({
      was: p.was,
      inserted: p.stats.inserted,
      noEmail: p.stats.noEmail,
      duplicates: p.stats.duplicateInPool,
      alreadyLogged: p.stats.alreadyLogged,
      errors: p.stats.errors,
    })),
  });
}
