/**
 * Gmail IMAP Inbox fetch für einen einzelnen Studenten.
 *
 * Wird vom `/api/email/fetch-inbox` POST (User-Click "Posteingang aktualisieren")
 * UND vom `/api/cron/fetch-inboxes` GET (automatisch für alle aktiven Studenten)
 * verwendet.
 *
 * Holt die letzten 30 Tage Mails per IMAP, filtert auf Antworten von Firmen,
 * die der Student kontaktiert hat, und schreibt sie in `email_received_log`.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { ImapFlow } from "imapflow";
import { decryptPassword } from "@/lib/email/crypto";
import { classifyEmail } from "@/lib/email/classifier";

function decodeQuotedPrintable(str: string): string {
  let decoded = str.replace(/=\r?\n/g, "");
  decoded = decoded.replace(/=([0-9A-Fa-f]{2})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16)),
  );
  try {
    const bytes = new Uint8Array([...decoded].map((c) => c.charCodeAt(0)));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    try {
      const bytes = new Uint8Array([...decoded].map((c) => c.charCodeAt(0)));
      return new TextDecoder("iso-8859-1").decode(bytes);
    } catch {
      return decoded;
    }
  }
}

function decodeBase64Body(str: string, charset: string = "utf-8"): string {
  try {
    const cleaned = str.replace(/\r?\n/g, "");
    const bytes = Buffer.from(cleaned, "base64");
    return new TextDecoder(charset || "utf-8").decode(bytes);
  } catch {
    return str;
  }
}

function decodeEmailBody(source: string): string {
  const textRegex =
    /Content-Type:\s*text\/plain[^\r\n]*(?:;\s*charset="?([^";\s]+)"?)?[^]*?Content-Transfer-Encoding:\s*(\S+)[^]*?\r\n\r\n([^]*?)(?:\r\n--|\r\n\.\r\n|$)/i;
  const match = source.match(textRegex);

  if (match) {
    const charset = match[1] || "utf-8";
    const encoding = match[2]?.toLowerCase();
    const body = match[3];
    if (encoding === "quoted-printable") return decodeQuotedPrintable(body).substring(0, 2000);
    if (encoding === "base64") return decodeBase64Body(body, charset).substring(0, 2000);
    return body.substring(0, 2000);
  }

  // Fallback ohne Transfer-Encoding-Header
  const simpleRegex =
    /Content-Type:\s*text\/plain[^\r\n]*(?:;\s*charset="?([^";\s]+)"?)?[^]*?\r\n\r\n([^]*?)(?:\r\n--|\r\n\.\r\n|$)/i;
  const simpleMatch = source.match(simpleRegex);
  if (simpleMatch) return simpleMatch[2].substring(0, 2000);

  return source.substring(0, 2000);
}

export interface FetchResult {
  newEmails: number;
  error?: string;
}

export async function fetchInboxForUser(
  admin: SupabaseClient,
  userId: string,
): Promise<FetchResult> {
  const { data: creds } = await admin
    .from("email_credentials")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .single();

  if (!creds) return { newEmails: 0, error: "Keine Gmail-Credentials" };

  let appPassword: string;
  try {
    appPassword = decryptPassword(creds.encrypted_password);
  } catch (e) {
    return { newEmails: 0, error: `decrypt: ${e instanceof Error ? e.message : "unknown"}` };
  }

  const { data: sentEmails } = await admin
    .from("email_send_log")
    .select("recipient_email")
    .eq("user_id", userId)
    .eq("status", "sent");

  const sentToEmails = new Set(
    (sentEmails ?? [])
      .map((e: { recipient_email: string | null }) => e.recipient_email?.toLowerCase())
      .filter((e: string | undefined): e is string => !!e),
  );

  const { data: existingReceived } = await admin
    .from("email_received_log")
    .select("message_uid")
    .eq("user_id", userId);

  const existingUids = new Set(
    (existingReceived ?? [])
      .map((e: { message_uid: string | null }) => e.message_uid)
      .filter((e: string | null): e is string => !!e),
  );

  let newEmails = 0;
  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user: creds.email, pass: appPassword },
    logger: false,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      const since = new Date();
      since.setDate(since.getDate() - 30);

      const messages = client.fetch(
        { since },
        { envelope: true, uid: true, bodyStructure: true, source: { maxLength: 50000 } },
      );

      for await (const msg of messages) {
        const uid = String(msg.uid);
        if (existingUids.has(uid)) continue;

        const fromEmail = msg.envelope?.from?.[0]?.address?.toLowerCase() || "";
        if (!sentToEmails.has(fromEmail)) continue;

        const fromName = msg.envelope?.from?.[0]?.name || "";
        const subject = msg.envelope?.subject || "(Kein Betreff)";
        const receivedAt = msg.envelope?.date || new Date();

        let bodyText = "";
        if (msg.source) bodyText = decodeEmailBody(msg.source.toString());

        // AI-Klassifizierung (Haiku) - schreibt email_category + requires_action
        const cls = await classifyEmail(subject, bodyText, fromEmail);

        await admin.from("email_received_log").insert({
          user_id: userId,
          from_email: fromEmail,
          from_name: fromName,
          subject,
          body_text: bodyText || null,
          received_at: new Date(receivedAt).toISOString(),
          message_uid: uid,
          email_category: cls.category,
          requires_action: cls.requiresAction,
          action_status: cls.requiresAction ? "pending" : null,
        });

        newEmails++;
      }
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (error: unknown) {
    try {
      await client.logout();
    } catch {
      // ignore
    }
    return {
      newEmails,
      error: error instanceof Error ? error.message : "IMAP Fehler",
    };
  }

  return { newEmails };
}
