import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { decryptPassword } from "@/lib/email/crypto";
import { ImapFlow } from "imapflow";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  const adminSupabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get email credentials
  const { data: creds } = await adminSupabase
    .from("email_credentials")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .single();

  if (!creds) {
    return NextResponse.json({ error: "Gmail nicht konfiguriert" }, { status: 400 });
  }

  const appPassword = decryptPassword(creds.encrypted_password);

  // Get list of companies we've sent emails to
  const { data: sentEmails } = await adminSupabase
    .from("email_send_log")
    .select("recipient_email")
    .eq("user_id", user.id)
    .eq("status", "sent");

  const sentToEmails = new Set(
    (sentEmails || []).map((e) => e.recipient_email.toLowerCase())
  );

  // Get already fetched UIDs to avoid duplicates
  const { data: existingReceived } = await adminSupabase
    .from("email_received_log")
    .select("message_uid")
    .eq("user_id", user.id);

  const existingUids = new Set(
    (existingReceived || []).map((e) => e.message_uid).filter(Boolean)
  );

  let newEmails = 0;

  try {
    const client = new ImapFlow({
      host: "imap.gmail.com",
      port: 993,
      secure: true,
      auth: {
        user: creds.email,
        pass: appPassword,
      },
      logger: false,
    });

    await client.connect();

    const lock = await client.getMailboxLock("INBOX");

    try {
      // Fetch last 30 days of emails
      const since = new Date();
      since.setDate(since.getDate() - 30);

      const messages = client.fetch(
        { since },
        { envelope: true, uid: true, bodyStructure: true, source: { maxLength: 50000 } }
      );

      for await (const msg of messages) {
        const uid = String(msg.uid);
        if (existingUids.has(uid)) continue;

        const fromEmail = msg.envelope?.from?.[0]?.address?.toLowerCase() || "";
        const fromName = msg.envelope?.from?.[0]?.name || "";

        // Only save emails from companies we've contacted
        if (!sentToEmails.has(fromEmail)) continue;

        const subject = msg.envelope?.subject || "(Kein Betreff)";
        const receivedAt = msg.envelope?.date || new Date();

        // Extract text from source
        let bodyText = "";
        if (msg.source) {
          const source = msg.source.toString();
          // Simple text extraction from email source
          const textMatch = source.match(/Content-Type:\s*text\/plain[^]*?\r\n\r\n([^]*?)(?:\r\n--|\r\n\.\r\n|$)/i);
          if (textMatch) {
            bodyText = textMatch[1].substring(0, 2000);
          } else {
            // Try to extract from HTML
            const htmlMatch = source.match(/Content-Type:\s*text\/html[^]*?\r\n\r\n([^]*?)(?:\r\n--|\r\n\.\r\n|$)/i);
            if (htmlMatch) {
              bodyText = htmlMatch[1].replace(/<[^>]+>/g, "").substring(0, 2000);
            }
          }
        }

        await adminSupabase.from("email_received_log").insert({
          user_id: user.id,
          from_email: fromEmail,
          from_name: fromName,
          subject,
          body_text: bodyText || null,
          received_at: new Date(receivedAt).toISOString(),
          message_uid: uid,
        });

        newEmails++;
      }
    } finally {
      lock.release();
    }

    await client.logout();

    return NextResponse.json({
      success: true,
      newEmails,
      message: newEmails > 0
        ? `${newEmails} neue Antwort${newEmails === 1 ? "" : "en"} gefunden!`
        : "Keine neuen Antworten.",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "IMAP Fehler";
    return NextResponse.json({ error: `Posteingang konnte nicht abgerufen werden: ${message}` }, { status: 500 });
  }
}
