import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { studentZieleToSearchTerms } from "@/lib/scraping/ingest";

export const runtime = "nodejs";

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: profile } = await admin
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "administrator") return null;
  return admin;
}

function nextCronRuns(): string[] {
  // Cron: 03:00 and 14:00 UTC daily
  const scheduledHours = [3, 14];
  const now = new Date();
  const runs: Date[] = [];

  for (let dayOffset = 0; dayOffset <= 2 && runs.length < 2; dayOffset++) {
    for (const h of scheduledHours) {
      const t = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + dayOffset, h, 0, 0));
      if (t > now) runs.push(t);
      if (runs.length === 2) break;
    }
  }

  return runs.map((d) => d.toISOString());
}

export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).toISOString();
  const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000).toISOString();

  const [studentsRes, lastJobRes, recentJobsRes, todayBewRes, weekBewRes, recentPerTermRes] = await Promise.all([
    admin.from("ausbildung_main_engine").select(`"Ziel"`).eq("student_active", true),
    admin.from("scraped_jobs_log").select("created_at").order("created_at", { ascending: false }).limit(1),
    admin.from("scraped_jobs_log").select("created_at, bereich, had_email, skipped_reason").gte("created_at", tenMinAgo).order("created_at", { ascending: false }).limit(50),
    admin.from("bewerbungen").select("*", { count: "exact", head: true }).gte("created_at", todayStart),
    admin.from("bewerbungen").select("*", { count: "exact", head: true }).gte("created_at", weekStart),
    admin.from("scraped_jobs_log").select("bereich, had_email, skipped_reason, created_at").gte("created_at", new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()).order("created_at", { ascending: false }).limit(200),
  ]);

  const ziele = (studentsRes.data ?? []).map((s) => (s as Record<string, unknown>).Ziel as string | null);
  const activeTerms = studentZieleToSearchTerms(ziele);

  const lastRunAt = lastJobRes.data?.[0]?.created_at ?? null;
  const isLikelyRunning = recentJobsRes.data !== null && recentJobsRes.data.length > 0;

  // Per-term summary for last 24h
  const termStats: Record<string, { bereich: string; inserted: number; skipped: number }> = {};
  for (const row of recentPerTermRes.data ?? []) {
    const key = row.bereich || "Unbekannt";
    if (!termStats[key]) termStats[key] = { bereich: key, inserted: 0, skipped: 0 };
    if (!row.skipped_reason && row.had_email) termStats[key].inserted++;
    else termStats[key].skipped++;
  }

  return NextResponse.json({
    activeTerms,
    lastRunAt,
    isLikelyRunning,
    todayInserted: todayBewRes.count ?? 0,
    weekInserted: weekBewRes.count ?? 0,
    nextRunsUTC: nextCronRuns(),
    lastRunStats: Object.values(termStats).sort((a, b) => b.inserted - a.inserted).slice(0, 20),
    recentActivityCount: recentJobsRes.data?.length ?? 0,
  });
}
