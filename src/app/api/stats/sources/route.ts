import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Bewerbungs-Statistiken nach Quelle (auto/scan/manual) × Zeitraum (heute/woche/monat/gesamt).
 *
 * Verhalten:
 *  - Admin: aggregiert über alle Studenten
 *  - Student: nur eigene Daten
 *
 * Antwort:
 *  {
 *    scope: 'admin' | 'student',
 *    today:  { auto, scan, manual, total },
 *    week:   { auto, scan, manual, total },
 *    month:  { auto, scan, manual, total },
 *    all:    { auto, scan, manual, total }
 *  }
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: profile } = await admin
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "administrator";

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // Woche beginnt Montag
  const dayOfWeek = (now.getDay() + 6) % 7; // 0=Mo, 6=So
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const buckets = ["today", "week", "month", "all"] as const;
  const sources = ["auto", "scan", "manual"] as const;

  type Bucket = (typeof buckets)[number];
  type Source = (typeof sources)[number];
  type Counts = Record<Source, number> & { total: number };

  const result: Record<Bucket, Counts> = {
    today: { auto: 0, scan: 0, manual: 0, total: 0 },
    week: { auto: 0, scan: 0, manual: 0, total: 0 },
    month: { auto: 0, scan: 0, manual: 0, total: 0 },
    all: { auto: 0, scan: 0, manual: 0, total: 0 },
  };

  function startFor(bucket: Bucket): string | null {
    if (bucket === "today") return todayStart.toISOString();
    if (bucket === "week") return weekStart.toISOString();
    if (bucket === "month") return monthStart.toISOString();
    return null;
  }

  // 12 parallele count-Queries (4 buckets × 3 sources)
  const queries = buckets.flatMap((bucket) =>
    sources.map((source) => {
      let q = admin
        .from("email_send_log")
        .select("*", { count: "exact", head: true })
        .eq("status", "sent")
        .eq("source", source);
      if (!isAdmin) q = q.eq("user_id", user.id);
      const since = startFor(bucket);
      if (since) q = q.gte("sent_at", since);
      return q.then((res) => ({ bucket, source, count: res.count ?? 0 }));
    }),
  );

  const rows = await Promise.all(queries);
  for (const { bucket, source, count } of rows) {
    result[bucket][source] = count;
    result[bucket].total += count;
  }

  return NextResponse.json({
    scope: isAdmin ? "admin" : "student",
    today: result.today,
    week: result.week,
    month: result.month,
    all: result.all,
  });
}
