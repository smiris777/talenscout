import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { classifyEmail } from "@/lib/email/classifier";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_RUN_MS = 270 * 1000;
const BATCH_SIZE = 100;

/**
 * Klassifiziert empfangene Emails, die noch keine AI-Kategorie haben
 * (email_category IS NULL oder 'general'). Pro Lauf bis zu BATCH_SIZE
 * oder bis MAX_RUN_MS erreicht.
 *
 * Wird automatisch täglich getriggert (vercel.json) und kann auch
 * manuell via CRON_SECRET aufgerufen werden für initiales Backfill.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: pending, error } = await admin
    .from("email_received_log")
    .select("id, subject, body_text, from_email")
    .or("email_category.is.null,email_category.eq.general")
    .order("received_at", { ascending: false })
    .limit(BATCH_SIZE);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const runStart = Date.now();
  let classified = 0;
  let urgent = 0;
  const errors: string[] = [];

  for (const row of pending ?? []) {
    if (Date.now() - runStart > MAX_RUN_MS) break;

    try {
      const cls = await classifyEmail(
        (row as { subject: string }).subject,
        ((row as { body_text: string | null }).body_text) ?? "",
        (row as { from_email: string }).from_email,
      );

      await admin
        .from("email_received_log")
        .update({
          email_category: cls.category,
          requires_action: cls.requiresAction,
          action_status: cls.requiresAction ? "pending" : null,
        })
        .eq("id", (row as { id: string }).id);

      classified++;
      if (cls.requiresAction) urgent++;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "unknown");
    }
  }

  return NextResponse.json({
    message: `${classified} klassifiziert, davon ${urgent} mit Action`,
    durationMs: Date.now() - runStart,
    remainingApprox: Math.max(0, (pending?.length ?? 0) - classified),
    errors: errors.slice(0, 5),
  });
}
