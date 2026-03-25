import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptPassword } from "@/lib/email/crypto";
import { testConnection } from "@/lib/email/sender";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

    // Check admin role
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profile?.role !== "administrator") {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
    }

    const { userId } = await request.json();
    if (!userId) {
      return NextResponse.json({ error: "userId fehlt" }, { status: 400 });
    }

    // Get credentials from email_credentials table using service role
    const { createClient: createAdmin } = await import("@supabase/supabase-js");
    const admin = createAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: creds } = await admin
      .from("email_credentials")
      .select("email, encrypted_password")
      .eq("user_id", userId)
      .single();

    if (!creds) {
      return NextResponse.json({ success: false, status: "no_credentials", error: "Keine Gmail-Daten hinterlegt" });
    }

    // Decrypt and test
    const password = decryptPassword(creds.encrypted_password);
    await testConnection(creds.email, password);

    return NextResponse.json({ success: true, status: "connected", gmail: creds.email });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "SMTP-Test fehlgeschlagen";
    return NextResponse.json({ success: false, status: "failed", error: message });
  }
}
