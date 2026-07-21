import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { decryptPassword } from "@/lib/email/crypto";
import { sendEmail } from "@/lib/email/sender";
import { personalizeEmail } from "@/lib/email/ai-personalize";
import { buildApplicationEmail } from "@/lib/email/template";
import { getGDriveThumbnailUrl } from "@/lib/utils/normalize";
import { getCleanZiel } from "@/lib/email/bereich-mapping";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  const { firmenname, email: recipientEmail, ansprechpartner, geschlecht } = await request.json();
  if (!recipientEmail || !firmenname) {
    return NextResponse.json({ error: "Firmenname und E-Mail sind erforderlich" }, { status: 400 });
  }

  const adminSupabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get student data
  const { data: student } = await adminSupabase
    .from("ausbildung_main_engine")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!student) {
    return NextResponse.json({ error: "Studentenprofil nicht gefunden" }, { status: 404 });
  }

  // Get email credentials
  const { data: creds } = await adminSupabase
    .from("email_credentials")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .single();

  if (!creds) {
    return NextResponse.json({ error: "Gmail nicht konfiguriert. Gehe zu E-Mail Setup." }, { status: 400 });
  }

  // Daily-Limit-Schutz: Gesamtlimit pro Tag (auto + manuell) = 100.
  // Der Cron-Job belegt davon max. max_daily_emails (Standard 20),
  // der Rest steht dem Studenten für manuelle Bewerbungen zur Verfügung.
  const dailyLimit = 100;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { count: todayUsed } = await adminSupabase
    .from("email_send_log")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "sent")
    .gte("sent_at", todayStart.toISOString());

  if ((todayUsed ?? 0) >= dailyLimit) {
    return NextResponse.json({
      error: `Tageslimit erreicht (${todayUsed}/${dailyLimit}). Versuche es morgen wieder — schützt deine Gmail-Adresse vor Blocking.`,
    }, { status: 429 });
  }

  // Monatsbudget-Check
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const { count: monthUsed } = await adminSupabase
    .from("email_send_log")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "sent")
    .gte("sent_at", monthStart.toISOString());

  if ((monthUsed ?? 0) >= (student.monthly_credit ?? 0)) {
    return NextResponse.json({
      error: `Monatsbudget aufgebraucht (${monthUsed}/${student.monthly_credit}). Wende dich an den Admin.`,
    }, { status: 429 });
  }

  try {
    const appPassword = decryptPassword(creds.encrypted_password);

    // AI personalization
    const personalized = await personalizeEmail({
      studentName: student.Namen || `${student.first_name} ${student.last_name}`,
      studentZiel: student.Ziel || "",
      deutschNiveau: student["Deutsch Niveau"] || "",
      motivationsschreiben: student.Motivationsschreiben || "",
      companyName: firmenname,
      contactName: ansprechpartner || "",
      contactGender: geschlecht === "w" ? "Frau" : geschlecht === "m" ? "Herr" : "",
    });

    const fotoUrl = getGDriveThumbnailUrl(student.BewerbungsfotoLink);
    const driveFolderUrl = student.drive_folder_id
      ? `https://drive.google.com/drive/folders/${student.drive_folder_id}`
      : null;

    const html = buildApplicationEmail({
      anrede: personalized.anrede,
      einleitung: personalized.einleitung,
      motivationAngepasst: personalized.motivationAngepasst,
      videoLink: student.BewerbungsVideoLink || null,
      fotoUrl,
      driveFolderUrl,
      studentName: student.Namen || `${student.first_name} ${student.last_name}`,
      studentZiel: student.Ziel || "",
      studentEmail: creds.email,
      deutschNiveau: student["Deutsch Niveau"] || "",
      sequenceStep: 1,
    });

    // Sauberer Subject ohne doppeltes „Ausbildung als …"-Präfix
    const cleanZiel = getCleanZiel(student.Ziel);
    const studentDisplay = (student.Namen || `${student.first_name} ${student.last_name}`).trim();
    const subject = `Bewerbung als ${cleanZiel} – ${studentDisplay}`;

    await sendEmail({
      fromEmail: creds.email,
      fromName: student.Namen || `${student.first_name} ${student.last_name}`,
      appPassword,
      to: recipientEmail,
      subject,
      html,
    });

    // Log the email — source: "manual" damit es im EmailInbox als ✍️ Manuell
    // erscheint und der Student seinen Klick wiederfindet
    const { error: logErr } = await adminSupabase.from("email_send_log").insert({
      user_id: user.id,
      recipient_email: recipientEmail,
      company_name: firmenname,
      subject,
      status: "sent",
      sequence_step: 1,
      source: "manual",
      sent_at: new Date().toISOString(),
      body_html: html,
    });

    if (logErr) {
      console.error("[send-manual] log insert failed:", logErr.message);
    }

    return NextResponse.json({
      success: true,
      message: `Bewerbung an ${firmenname} gesendet!`,
      logged: !logErr,
    });
  } catch (e: any) {
    // Log failed attempt
    await adminSupabase.from("email_send_log").insert({
      user_id: user.id,
      recipient_email: recipientEmail,
      company_name: firmenname,
      subject: `Bewerbung als ${getCleanZiel(student.Ziel)} – ${(student.Namen || "").trim()}`,
      status: "failed",
      error_message: e.message,
      sequence_step: 1,
      source: "manual",
      sent_at: new Date().toISOString(),
    });

    return NextResponse.json({ error: `Senden fehlgeschlagen: ${e.message}` }, { status: 500 });
  }
}
