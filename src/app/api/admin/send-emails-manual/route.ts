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
  let companiesQuery = supabase
    .from("bewerbungen")
    .select("email, firmenname, telefonnummer, geschlecht, name, bereich")
    .not("email", "is", null);

  if (!studentZiel) {
    return NextResponse.json({ error: "Student hat kein Ziel eingetragen — bitte erst Ziel setzen." }, { status: 400 });
  }

  const bereiche = getMatchingBereiche(studentZiel);
  if (bereiche.length === 0) {
    return NextResponse.json({ error: `Kein Bereich erkannt für Ziel: "${studentZiel}" — bitte Ziel anpassen.` }, { status: 400 });
  }

  const orFilter = bereiche.map((b) => `bereich.ilike.%${b}%`).join(",");
  companiesQuery = companiesQuery.or(orFilter);

  // Debug log (visible in Vercel logs)
  console.log(`[manual-send] ${student.Namen} | Ziel: "${studentZiel}" | Bereiche: [${bereiche.join(", ")}]`);

  const { data: companies, error: companiesQueryError } = await companiesQuery.limit(500);
  if (companiesQueryError) {
    console.error("[manual-send] companies query error:", companiesQueryError.message);
    return NextResponse.json({ error: "Datenbankfehler: " + companiesQueryError.message }, { status: 500 });
  }

  const uniqueCompanies = new Map<string, any>();
  for (const c of companies || []) {
    if (c.email && !sentEmails.has(c.email.toLowerCase()) && !uniqueCompanies.has(c.email.toLowerCase())) {
      uniqueCompanies.set(c.email.toLowerCase(), c);
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
      const personalized = await personalizeEmail({
        studentName: student.Namen || "",
        studentZiel: student.Ziel || "",
        deutschNiveau: student["Deutsch Niveau"] || "",
        motivationsschreiben: student.Motivationsschreiben || "",
        companyName: target.firmenname || "",
        contactName: target.name || undefined,
        contactGender: target.geschlecht || undefined,
      });

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
      await sleep(1500);
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

  return NextResponse.json({
    sent: sentCount,
    errors: errorCount,
    total: targets.length,
    message: `${sentCount} E-Mail(s) gesendet, ${errorCount} Fehler`,
    log,
  });
}
