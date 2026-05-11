import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ingestBatch, studentZieleToSearchTerms } from "@/lib/scraping/ingest";

export const runtime = "nodejs";
export const maxDuration = 300;

// Default-Suchparameter für den nächtlichen Cron-Lauf
const DEFAULT_SIZE = 25;
const DEFAULT_PAGES = 2; // pro Beruf bis zu 50 Stellen pro Lauf
const MAX_INSERTS_PER_RUN = 200;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // 1. Distinct Ziele der aktiven Studenten holen
  const { data: students, error: studentsErr } = await supabase
    .from("ausbildung_main_engine")
    .select(`"Ziel"`)
    .eq("student_active", true);

  if (studentsErr) {
    return NextResponse.json(
      { error: "students query failed", detail: studentsErr.message },
      { status: 500 },
    );
  }

  const ziele = (students ?? [])
    .map((s) => (s as Record<string, unknown>).Ziel as string | null);
  const searchTerms = studentZieleToSearchTerms(ziele);

  if (searchTerms.length === 0) {
    return NextResponse.json({
      message: "Keine Such-Begriffe (keine aktiven Studenten mit Ziel)",
      perSearch: [],
    });
  }

  const startedAt = Date.now();
  const budget = MAX_INSERTS_PER_RUN;
  // Budget auf alle Berufe verteilen
  const perTermBudget = Math.max(5, Math.floor(budget / searchTerms.length));

  const { total, perSearch } = await ingestBatch(
    supabase,
    searchTerms.map((was) => ({
      was,
      size: DEFAULT_SIZE,
      pages: DEFAULT_PAGES,
      maxInserts: perTermBudget,
    })),
  );

  return NextResponse.json({
    message: "Scrape abgeschlossen",
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
