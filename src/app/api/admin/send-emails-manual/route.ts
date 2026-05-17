import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { decryptPassword } from "@/lib/email/crypto";
import { sendEmail } from "@/lib/email/sender";
import { personalizeEmail } from "@/lib/email/ai-personalize";
import { buildApplicationEmail } from "@/lib/email/template";
import { getGDriveThumbnailUrl } from "@/lib/utils/normalize";
import { createCallTaskIfPhoneAvailable } from "@/lib/tasks/generator";
import { getMatchingBereiche } from "@/lib/email/bereich-mapping";
import { awardXP } from "@/lib/rewards/engine";

function getDailyLimit(credCreatedAt: string): number {
  const daysSinceSetup = Math.floor(
    (Date.now() - new Date(credCreatedAt).getTime()) / 86400000
  );
  if (daysSinceSetup < 7) return 10;
  if (daysSinceSetup < 14) return 15;
  return 20;
}

export const runtime = "nodejs";
export const maxDuration = 300;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: Request) {
  // 1. Verify admin
  const supabaseUser = await createClient();
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const supabase = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "administrator") {
    return NextResponse.json({ error: "Keine Admin-Berechtigung" }, { status: 403 });
  }

  // 2. Parse body
  const body = await request.json();
  const { userId, count } = body as { userId: string; count: number };

  if (!userId || !count || count < 1 || count > 50) {
    return NextResponse.json({ error: "Ungültige Parameter" }, { status: 400 });
  }

  // 3. Load student
  const { data: student } = await supabase
    .from("ausbildung_main_engine")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!student) return NextResponse.json({ error: "Student nicht gefunden" }, { status: 404 });

  // 4. Load credentials
  const { data: creds } = await supabase
    .from("email_credentials")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .single();

  if (!creds) return NextResponse.json({ error: "Keine E-Mail-Zugangsdaten (Gmail App-Passwort fehlt)" }, { status: 400 });

  const appPassword = decryptPassword(creds.encrypted_password);

  // 5. Find companies not yet contacted
  const { data: alreadySent } = await supabase
    .from("email_send_log")
    .select("recipient_email")
    .eq("user_id", userId);

  const sentEmails = new Set((alreadySent || []).map((e) => e.recipient_email.toLowerCase()));

  const studentZiel = student.Ziel?.trim();
  if (!studentZiel) {
    return NextResponse.json({ error: "Student hat kein Ziel eingetragen — bitte erst Ziel setzen." }, { status: 400 });
  }

  // Debug log (visible in Vercel logs)
  console.log(`[manual-send] ${student.Namen} | Ziel: "${studentZiel}" | userId: ${userId}`);

  // Strategy 1: use pre-assigned Stellen (student_user_id match) — most reliable
  const { data: assignedCompanies, error: assignedErr } = await supabase
    .from("bewerbungen")
    .select("email, firmenname, telefonnummer, geschlecht, name, bereich")
    .eq("student_user_id", userId)
    .not("email", "is", null)
    .limit(3000);

  if (assignedErr) {
    console.error("[manual-send] assigned query error:", assignedErr.message);
  }

  // Filter assigned companies against already-sent emails
  const assignedFiltered = (assignedCompanies ?? []).filter(
    (c) => c.email && !sentEmails.has(c.email.toLowerCase())
  );

  let poolSource: typeof assignedFiltered = assignedFiltered;

  // Strategy 2: fallback to global pool if assigned pool is exhausted
  if (assignedFiltered.length === 0) {
    console.log(`[manual-send] No assigned Stellen, falling back to global content search`);
    const keywords = getMatchingBereiche(studentZiel);
    if (keywords.length === 0) {
      return NextResponse.json({ error: `Kein Bereich erkannt für Ziel: "${studentZiel}" — bitte Ziel anpassen.` }, { status: 400 });
    }

    // Search across bereich + firmenname + additional fields — broad match, not strict
    const orConditions = keywords.flatMap((kw) => [
      `bereich.ilike.%${kw}%`,
      `firmenname.ilike.%${kw}%`,
      `zusatzinfo.ilike.%${kw}%`,
      `caption.ilike.%${kw}%`,
    ]);

    const { data: globalCompanies, error: globalErr } = await supabase
      .from("bewerbungen")
      .select("email, firmenname, telefonnummer, geschlecht, name, bereich")
      .or(orConditions.join(","))
      .not("email", "is", null)
      .limit(5000);

    if (globalErr) {
      console.error("[manual-send] global query error:", globalErr.message);
      return NextResponse.json({ error: "Datenbankfehler: " + globalErr.message }, { status: 500 });
    }
    poolSource = globalCompanies ?? [];
    console.log(`[manual-send] Global pool returned ${poolSource.length} via keywords: [${keywords.join(", ")}]`);
  }

  console.log(`[manual-send] Pool size: ${poolSource.length}, already sent: ${sentEmails.size}`);

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

  const uniqueCompanies = new Map<string, typeof poolSource[0]>();
  for (const c of poolSource) {
    const email = c.email?.toLowerCase();
    if (email && isValidEmail(email) && !sentEmails.has(email) && !uniqueCompanies.has(email)) {
      uniqueCompanies.set(email, c);
    }
  }

  const targets = Array.from(uniqueCompanies.values()).slice(0, count);

  if (targets.length === 0) {
    return NextResponse.json({
      sent: 0,
      errors: 0,
      message: "Keine neuen Firmen gefunden — alle wurden bereits kontaktiert oder keine passenden Firmen in der DB.",
    });
  }

  // 6. Send emails
  let sentCount = 0;
  let errorCount = 0;
  const log: Array<{ company: string; email: string; status: "sent" | "failed"; error?: string }> = [];

  for (const target of targets) {
    try {
      // Personalize with 8s timeout — fall back to generic if AI is slow
      const personalized = await Promise.race([
        personalizeEmail({
          studentName: student.Namen || "",
          studentZiel: student.Ziel || "",
          deutschNiveau: student["Deutsch Niveau"] || "",
          motivationsschreiben: student.Motivationsschreiben || "",
          companyName: target.firmenname || "",
          contactName: target.name || undefined,
          contactGender: target.geschlecht || undefined,
        }),
        new Promise<Awaited<ReturnType<typeof personalizeEmail>>>((resolve) =>
          setTimeout(() => resolve({
            anrede: target.geschlecht === "w" ? "Sehr geehrte Damen und Herren" : "Sehr geehrte Damen und Herren",
            einleitung: `hiermit bewerbe ich mich um einen Ausbildungsplatz als ${student.Ziel || "Azubi"} in Ihrem Unternehmen.`,
            motivationAngepasst: student.Motivationsschreiben || "",
          }), 8000)
        ),
      ]);

      const fotoUrl = getGDriveThumbnailUrl(student.BewerbungsfotoLink);
      const driveFolderUrl = student.drive_folder_id
        ? `https://drive.google.com/drive/folders/${student.drive_folder_id}`
        : null;

      const html = buildApplicationEmail({
        anrede: personalized.anrede,
        einleitung: personalized.einleitung,
        motivationAngepasst: personalized.motivationAngepasst,
        studentName: student.Namen || "",
        studentEmail: creds.email,
        studentZiel: student.Ziel || "",
        deutschNiveau: student["Deutsch Niveau"] || "",
        art: student.Art || undefined,
        videoLink: student.BewerbungsVideoLink,
        fotoUrl,
        driveFolderUrl,
        sequenceStep: 1,
      });

      const subject = `Bewerbung als ${student.Ziel || "Azubi"} – ${student.Namen}`;

      await sendEmail({
        fromEmail: creds.email,
        fromName: student.Namen || "",
        appPassword,
        to: target.email,
        subject,
        html,
      });

      await supabase.from("email_send_log").insert({
        user_id: userId,
        recipient_email: target.email,
        recipient_name: target.name,
        company_name: target.firmenname,
        subject,
        status: "sent",
        sequence_step: 1,
        sent_at: new Date().toISOString(),
        body_html: html,
      });

      await awardXP(userId, "email_sent", `Bewerbung an ${target.firmenname || target.email}`, 15).catch(() => {});
      await createCallTaskIfPhoneAvailable(supabase, userId, target.firmenname || "Unbekannt", target.telefonnummer);

      log.push({ company: target.firmenname || "Unbekannt", email: target.email, status: "sent" });
      sentCount++;
      await sleep(600);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Unbekannter Fehler";
      await supabase.from("email_send_log").insert({
        user_id: userId,
        recipient_email: target.email,
        company_name: target.firmenname,
        subject: `Bewerbung als ${student.Ziel} – ${student.Namen}`,
        status: "failed",
        error_message: errMsg,
        sequence_step: 1,
      });
      log.push({ company: target.firmenname || "Unbekannt", email: target.email, status: "failed", error: errMsg });
      errorCount++;
    }
  }

  const warmupLimit = getDailyLimit(creds.created_at);
  const daysSinceSetup = Math.floor(
    (Date.now() - new Date(creds.created_at).getTime()) / 86400000
  );

  return NextResponse.json({
    sent: sentCount,
    errors: errorCount,
    total: targets.length,
    message: `${sentCount} E-Mail(s) gesendet, ${errorCount} Fehler`,
    warmup: {
      daysSinceSetup,
      currentDailyLimit: warmupLimit,
      info: daysSinceSetup < 7
        ? `Woche 1 — Limit: ${warmupLimit}/Tag`
        : daysSinceSetup < 14
        ? `Woche 2 — Limit: ${warmupLimit}/Tag`
        : `Woche 3+ — Limit: ${warmupLimit}/Tag`,
    },
    log,
  });
}
