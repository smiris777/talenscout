import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { decryptPassword } from "@/lib/email/crypto";
import { ImapFlow } from "imapflow";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 300;

function decodeQuotedPrintable(str: string): string {
  let decoded = str.replace(/=\r?\n/g, "");
  decoded = decoded.replace(/=([0-9A-Fa-f]{2})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
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

function decodeBase64Body(str: string, charset = "utf-8"): string {
  try {
    const bytes = Buffer.from(str.replace(/\r?\n/g, ""), "base64");
    return new TextDecoder(charset || "utf-8").decode(bytes);
  } catch {
    return str;
  }
}

function decodeEmailBody(source: string): string {
  const textRegex =
    /Content-Type:\s*text\/plain[^\r\n]*(?:;\s*charset="?([^";\s]+)"?)?[^]*?Content-Transfer-Encoding:\s*(\S+)[^]*?\r\n\r\n([^]*?)(?:\r\n--|\r\n\.\r\n|$)/i;
  let match = source.match(textRegex);
  if (match) {
    const charset = match[1] || "utf-8";
    const encoding = match[2]?.toLowerCase() || "";
    const body = match[3];
    if (encoding === "quoted-printable") return decodeQuotedPrintable(body).substring(0, 2000);
    if (encoding === "base64") return decodeBase64Body(body, charset).substring(0, 2000);
    return body.substring(0, 2000);
  }
  const simpleRegex =
    /Content-Type:\s*text\/plain[^\r\n]*\r\n\r\n([^]*?)(?:\r\n--|\r\n\.\r\n|$)/i;
  const simple = source.match(simpleRegex);
  if (simple) return simple[1].substring(0, 2000);

  const htmlRegex =
    /Content-Type:\s*text\/html[^\r\n]*(?:;\s*charset="?([^";\s]+)"?)?[^]*?Content-Transfer-Encoding:\s*(\S+)[^]*?\r\n\r\n([^]*?)(?:\r\n--|\r\n\.\r\n|$)/i;
  match = source.match(htmlRegex);
  if (match) {
    let body = match[3];
    if (match[2]?.toLowerCase() === "quoted-printable") body = decodeQuotedPrintable(body);
    else if (match[2]?.toLowerCase() === "base64") body = decodeBase64Body(body, match[1]);
    return body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().substring(0, 2000);
  }
  return "";
}

async function classifyEmail(subject: string, bodyText: string, fromEmail: string): Promise<{
  classification: string;
  snippet: string;
  company_name: string;
}> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { classification: "other", snippet: subject.slice(0, 120), company_name: "" };

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [{
        role: "user",
        content: `Analysiere diese Bewerbungs-Antwort-Email und klassifiziere sie.

Von: ${fromEmail}
Betreff: ${subject}
Text: ${(bodyText || "").slice(0, 600)}

Klassifiziere als EINES:
- interview_invite: Einladung zum Vorstellungsgespräch oder Telefoninterview
- offer: Zusage, Stellenangebot, Vertrag
- document_request: Anfrage nach Dokumenten (Zeugnis, Lebenslauf, etc.)
- rejection: Absage, leider nicht
- followup_request: Rückfrage zur Bewerbung
- other: Sonstiges, Bestätigung, automatisch

Firmenname: Extrahiere aus der Email-Domain oder Signatur (nur Name, keine GmbH etc.)

Antworte NUR in JSON:
{"classification":"...","snippet":"max 100 Zeichen Zusammenfassung","company_name":"..."}`
      }],
    });
    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const match = text.match(/\{[\s\S]*?\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return {
        classification: parsed.classification || "other",
        snippet: (parsed.snippet || subject).slice(0, 120),
        company_name: (parsed.company_name || "").slice(0, 100),
      };
    }
  } catch { /* ignore */ }
  return { classification: "other", snippet: subject.slice(0, 120), company_name: "" };
}

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: profile } = await admin
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "administrator") return null;
  return admin;
}

// GET: Alle empfangenen Emails aller Studenten laden
export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: emails } = await admin
    .from("email_received_log")
    .select("*, ausbildung_main_engine!email_received_log_user_id_fkey(Namen, Email)")
    .order("received_at", { ascending: false })
    .limit(500);

  // Fallback: join manuell wenn FK nicht klappt
  if (!emails || emails.some((e) => !e.ausbildung_main_engine)) {
    const { data: rawEmails } = await admin
      .from("email_received_log")
      .select("*")
      .order("received_at", { ascending: false })
      .limit(500);

    const { data: students } = await admin
      .from("ausbildung_main_engine")
      .select("user_id, Namen, Email");

    const studentMap = new Map(
      (students ?? []).map((s) => [s.user_id, { namen: s.Namen, email: s.Email }])
    );

    const enriched = (rawEmails ?? []).map((e) => ({
      ...e,
      student_name: studentMap.get(e.user_id)?.namen ?? "Unbekannt",
      student_email: studentMap.get(e.user_id)?.email ?? "",
    }));

    return NextResponse.json({ emails: enriched });
  }

  return NextResponse.json({ emails: emails ?? [] });
}

// POST: Posteingang aller Studenten mit Gmail-Credentials synchronisieren
export async function POST() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: students } = await admin
    .from("ausbildung_main_engine")
    .select("user_id, Namen")
    .eq("student_active", true)
    .eq("gmail_app_password_set", true);

  if (!students || students.length === 0) {
    return NextResponse.json({ message: "Keine Studenten mit Gmail gefunden", results: [] });
  }

  const results: Array<{ student: string; newEmails: number; error?: string }> = [];

  for (const student of students) {
    if (!student.user_id) continue;

    try {
      const { data: creds } = await admin
        .from("email_credentials")
        .select("*")
        .eq("user_id", student.user_id)
        .eq("is_active", true)
        .single();

      if (!creds) continue;

      const appPassword = decryptPassword(creds.encrypted_password);

      const { data: sentEmails } = await admin
        .from("email_send_log")
        .select("recipient_email")
        .eq("user_id", student.user_id)
        .eq("status", "sent");

      const sentToEmails = new Set(
        (sentEmails || []).map((e) => e.recipient_email.toLowerCase())
      );

      const { data: existingReceived } = await admin
        .from("email_received_log")
        .select("message_uid")
        .eq("user_id", student.user_id);

      const existingUids = new Set(
        (existingReceived || []).map((e) => e.message_uid).filter(Boolean)
      );

      let newEmails = 0;

      const client = new ImapFlow({
        host: "imap.gmail.com",
        port: 993,
        secure: true,
        auth: { user: creds.email, pass: appPassword },
        logger: false,
      });

      await client.connect();
      const lock = await client.getMailboxLock("INBOX");

      try {
        const since = new Date();
        since.setDate(since.getDate() - 60);

        const messages = client.fetch(
          { since },
          { envelope: true, uid: true, source: { maxLength: 50000 } }
        );

        for await (const msg of messages) {
          const uid = String(msg.uid);
          if (existingUids.has(uid)) continue;

          const fromEmail = msg.envelope?.from?.[0]?.address?.toLowerCase() || "";
          if (!sentToEmails.has(fromEmail)) continue;

          const bodyText = msg.source ? decodeEmailBody(msg.source.toString()) : "";
          const subject = msg.envelope?.subject || "(Kein Betreff)";
          const aiResult = await classifyEmail(subject, bodyText, fromEmail);

          await admin.from("email_received_log").insert({
            user_id: student.user_id,
            from_email: fromEmail,
            from_name: msg.envelope?.from?.[0]?.name || "",
            subject,
            body_text: bodyText || null,
            received_at: new Date(msg.envelope?.date || Date.now()).toISOString(),
            message_uid: uid,
            classification: aiResult.classification,
            snippet: aiResult.snippet,
            company_name: aiResult.company_name || null,
          });

          newEmails++;
        }
      } finally {
        lock.release();
      }

      await client.logout();
      results.push({ student: student.Namen || student.user_id, newEmails });
    } catch (err) {
      results.push({
        student: student.Namen || student.user_id,
        newEmails: 0,
        error: err instanceof Error ? err.message : "Unbekannter Fehler",
      });
    }
  }

  const totalNew = results.reduce((s, r) => s + r.newEmails, 0);
  return NextResponse.json({
    message: `${totalNew} neue Antworten von ${students.length} Studenten`,
    results,
  });
}
