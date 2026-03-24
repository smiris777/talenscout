import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptPassword } from "@/lib/email/crypto";
import { testConnection } from "@/lib/email/sender";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Nicht angemeldet" }, { status: 401 });
    }

    const { email, appPassword } = await request.json();

    if (!email || !appPassword) {
      return NextResponse.json({ success: false, error: "E-Mail und App-Passwort erforderlich" }, { status: 400 });
    }

    const cleanPassword = appPassword.replace(/\s/g, "");

    // Test connection first
    try {
      await testConnection(email, cleanPassword);
    } catch {
      return NextResponse.json({ success: false, error: "SMTP-Verbindung fehlgeschlagen. Bitte Zugangsdaten prüfen." }, { status: 400 });
    }

    // Encrypt and save
    const encrypted = encryptPassword(cleanPassword);

    const { error } = await supabase
      .from("email_credentials")
      .upsert(
        {
          user_id: user.id,
          email,
          encrypted_password: encrypted,
          provider: "gmail",
          smtp_host: "smtp.gmail.com",
          smtp_port: 587,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,provider" }
      );

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Update flag on student record
    await supabase
      .from("ausbildung_main_engine")
      .update({ gmail_app_password_set: true })
      .eq("user_id", user.id);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
