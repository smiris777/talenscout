import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchInboxForUser } from "@/lib/email/imap-fetcher";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_RUN_MS = 270 * 1000;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Alle aktiven Studenten mit Gmail-Setup holen
  const { data: students, error } = await admin
    .from("ausbildung_main_engine")
    .select(`user_id, "Namen"`)
    .eq("student_active", true)
    .eq("gmail_app_password_set", true)
    .not("user_id", "is", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const runStart = Date.now();
  const results: Array<{ student: string; newEmails: number; error?: string }> = [];

  for (const s of students ?? []) {
    if (Date.now() - runStart > MAX_RUN_MS) {
      results.push({
        student: (s as Record<string, string>).Namen ?? "?",
        newEmails: 0,
        error: "time-budget",
      });
      continue;
    }

    const userId = (s as Record<string, string>).user_id;
    if (!userId) continue;

    try {
      const r = await fetchInboxForUser(admin, userId);
      results.push({
        student: (s as Record<string, string>).Namen ?? "?",
        newEmails: r.newEmails,
        ...(r.error ? { error: r.error } : {}),
      });
    } catch (e) {
      results.push({
        student: (s as Record<string, string>).Namen ?? "?",
        newEmails: 0,
        error: e instanceof Error ? e.message : "unknown",
      });
    }
  }

  const totalNew = results.reduce((sum, r) => sum + r.newEmails, 0);

  return NextResponse.json({
    message: `IMAP-Sync abgeschlossen: ${totalNew} neue Antworten`,
    durationMs: Date.now() - runStart,
    studentsProcessed: results.length,
    totalNewEmails: totalNew,
    results,
  });
}
