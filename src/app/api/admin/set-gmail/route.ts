import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const runtime = "nodejs";

function encryptPassword(password: string): string {
  const key = Buffer.from(process.env.EMAIL_ENCRYPTION_KEY!, "hex");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(password, "utf8");
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), encrypted.toString("base64"), tag.toString("base64")].join(":");
}

export async function POST(request: Request) {
  // Secured with CRON_SECRET — one-time use
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId, gmailAddress, gmailAppPassword } = await request.json() as {
    userId: string;
    gmailAddress: string;
    gmailAppPassword: string;
  };

  if (!userId || !gmailAddress || !gmailAppPassword) {
    return NextResponse.json({ error: "userId, gmailAddress, gmailAppPassword required" }, { status: 400 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const cleanPassword = gmailAppPassword.replace(/\s+/g, "");
  const encrypted = encryptPassword(cleanPassword);

  const { data: existing } = await admin
    .from("email_credentials")
    .select("id")
    .eq("user_id", userId)
    .single();

  if (existing) {
    await admin.from("email_credentials").update({
      email: gmailAddress,
      encrypted_password: encrypted,
      is_active: true,
      updated_at: new Date().toISOString(),
    }).eq("user_id", userId);
  } else {
    await admin.from("email_credentials").insert({
      user_id: userId,
      email: gmailAddress,
      encrypted_password: encrypted,
      provider: "gmail",
      smtp_host: "smtp.gmail.com",
      smtp_port: 587,
      is_active: true,
    });
  }

  await admin.from("ausbildung_main_engine")
    .update({ gmail_app_password_set: true })
    .eq("user_id", userId);

  return NextResponse.json({ ok: true, message: `Credentials updated for ${gmailAddress}` });
}
