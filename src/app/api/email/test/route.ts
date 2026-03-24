import { NextResponse } from "next/server";
import { testConnection } from "@/lib/email/sender";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { email, appPassword } = await request.json();

    if (!email || !appPassword) {
      return NextResponse.json({ success: false, error: "E-Mail und App-Passwort erforderlich" }, { status: 400 });
    }

    // Remove spaces from app password (Google shows it as "xxxx xxxx xxxx xxxx")
    const cleanPassword = appPassword.replace(/\s/g, "");

    await testConnection(email, cleanPassword);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Verbindung fehlgeschlagen";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
