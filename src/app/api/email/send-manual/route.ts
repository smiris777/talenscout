import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { decryptPassword } from "@/lib/email/crypto";
import { sendEmail } from "@/lib/email/sender";
import { personalizeEmail } from "@/lib/email/ai-personalize";
import { buildApplicationEmail } from "@/lib/email/template";
import { getGDriveThumbnailUrl } from "@/lib/utils/normalize";

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

    const subject = `Bewerbung als ${student.Ziel || "Azubi"} - ${student.Namen || student.first_name}`;

    await sendEmail({
      fromEmail: creds.email,
      fromName: student.Namen || `${student.first_name} ${student.last_name}`,
      appPassword,
      to: recipientEmail,
      subject,
      html,
    });

    // Log the email
    await adminSupabase.from("email_send_log").insert({
      user_id: user.id,
      recipient_email: recipientEmail,
      company_name: firmenname,
      subject,
      status: "sent",
      sequence_step: 1,
      sent_at: new Date().toISOString(),
      body_html: html,
    });

    return NextResponse.json({ success: true, message: `Bewerbung an ${firmenname} gesendet!` });
  } catch (e: any) {
    // Log failed attempt
    await adminSupabase.from("email_send_log").insert({
      user_id: user.id,
      recipient_email: recipientEmail,
      company_name: firmenname,
      subject: `Bewerbung - ${student.Namen}`,
      status: "failed",
      error_message: e.message,
      sequence_step: 1,
      sent_at: new Date().toISOString(),
    });

    return NextResponse.json({ error: `Senden fehlgeschlagen: ${e.message}` }, { status: 500 });
  }
}
