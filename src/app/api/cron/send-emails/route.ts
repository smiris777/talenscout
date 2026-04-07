import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { decryptPassword } from "@/lib/email/crypto";
import { sendEmail } from "@/lib/email/sender";
import { personalizeEmail } from "@/lib/email/ai-personalize";
import { buildApplicationEmail } from "@/lib/email/template";
import { getGDriveThumbnailUrl } from "@/lib/utils/normalize";
import { createCallTaskIfPhoneAvailable } from "@/lib/tasks/generator";
import { getMatchingBereiche } from "@/lib/email/bereich-mapping";
import { awardXP } from "@/lib/rewards/engine";

export const runtime = "nodejs";

const MAX_DAILY_EMAILS = 12;
const DELAY_BETWEEN_SENDS_MS = 1500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Use service role for admin-level access
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const results: Array<{ student: string; sent: number; errors: number }> = [];

  // 1. Get all active students with email enabled
  const { data: students } = await supabase
    .from("ausbildung_main_engine")
    .select("*, user_id")
    .eq("student_active", true)
    .eq("daily_email_enabled", true)
    .eq("gmail_app_password_set", true)
    .gt("monthly_credit", 0);

  if (!students || students.length === 0) {
    return NextResponse.json({ message: "No active students", results: [] });
  }

  // Round-robin per hour: each run processes the student whose turn it is
  const now = new Date();
  const hourSlot = now.getUTCHours(); // 7–16
  const dayOfYear = Math.floor((Date.now() - new Date(now.getUTCFullYear(), 0, 0).getTime()) / 86400000);
  // Unique slot per run: combine day offset + hour offset
  const slotIndex = (dayOfYear * 10 + (hourSlot - 7)) % students.length;
  const rotated = [...students.slice(slotIndex), ...students.slice(0, slotIndex)];

  for (const student of rotated) {
    if (!student.user_id) continue;

    let sentCount = 0;
    let errorCount = 0;

    try {
      // 2. Check monthly credit
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { count: monthlyUsed } = await supabase
        .from("email_send_log")
        .select("*", { count: "exact", head: true })
        .eq("user_id", student.user_id)
        .eq("status", "sent")
        .gte("sent_at", startOfMonth.toISOString());

      const remaining = student.monthly_credit - (monthlyUsed || 0);
      if (remaining <= 0) continue;

      // 3. Check daily limit
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { count: todayUsed } = await supabase
        .from("email_send_log")
        .select("*", { count: "exact", head: true })
        .eq("user_id", student.user_id)
        .eq("status", "sent")
        .gte("sent_at", today.toISOString());

      const dailyRemaining = MAX_DAILY_EMAILS - (todayUsed || 0);
      if (dailyRemaining <= 0) continue;

      const toSend = Math.min(remaining, dailyRemaining);

      // 4. Get email credentials
      const { data: creds } = await supabase
        .from("email_credentials")
        .select("*")
        .eq("user_id", student.user_id)
        .eq("is_active", true)
        .single();

      if (!creds) continue;

      const appPassword = decryptPassword(creds.encrypted_password);

      // 5. Find companies not yet contacted by this student
      const { data: alreadySent } = await supabase
        .from("email_send_log")
        .select("recipient_email")
        .eq("user_id", student.user_id);

      const sentEmails = new Set((alreadySent || []).map((e) => e.recipient_email.toLowerCase()));

      // Get unique companies from bewerbungen matching student's field (bereich)
      const studentZiel = student.Ziel?.trim();
      let companiesQuery = supabase
        .from("bewerbungen")
        .select("email, firmenname, telefonnummer, geschlecht, name, bereich")
        .not("email", "is", null);

      // Smart matching: use bereich mapping for fuzzy matching
      if (studentZiel) {
        const bereiche = getMatchingBereiche(studentZiel)
          // Remove values with special chars that break PostgREST OR syntax
          .filter((b) => /^[a-zA-ZäöüÄÖÜß0-9\s\-]+$/.test(b));
        if (bereiche.length > 0) {
          const orFilter = bereiche.map((b) => `bereich.ilike.%${b}%`).join(",");
          companiesQuery = companiesQuery.or(orFilter);
        }
      }

      const { data: companies, error: companiesError } = await companiesQuery.limit(500);
      if (companiesError) {
        console.error("Companies query error:", companiesError.message);
      }

      const uniqueCompanies = new Map<string, any>();
      for (const c of companies || []) {
        if (c.email && !sentEmails.has(c.email.toLowerCase()) && !uniqueCompanies.has(c.email.toLowerCase())) {
          uniqueCompanies.set(c.email.toLowerCase(), c);
        }
      }

      const targets = Array.from(uniqueCompanies.values()).slice(0, toSend);

      // 6. Send emails
      for (const target of targets) {
        try {
          // AI personalization
          const personalized = await personalizeEmail({
            studentName: student.Namen || `${student.first_name} ${student.last_name}`,
            studentZiel: student.Ziel || "",
            deutschNiveau: student["Deutsch Niveau"] || "",
            motivationsschreiben: student.Motivationsschreiben || "",
            companyName: target.firmenname || "",
            contactName: target.name || undefined,
            contactGender: target.geschlecht || undefined,
          });

          // Build HTML
          const fotoUrl = getGDriveThumbnailUrl(student.BewerbungsfotoLink);
          const driveFolderUrl = student.drive_folder_id
            ? `https://drive.google.com/drive/folders/${student.drive_folder_id}`
            : null;

          const html = buildApplicationEmail({
            anrede: personalized.anrede,
            einleitung: personalized.einleitung,
            motivationAngepasst: personalized.motivationAngepasst,
            studentName: student.Namen || `${student.first_name} ${student.last_name}`,
            studentEmail: creds.email,
            studentZiel: student.Ziel || "",
            deutschNiveau: student["Deutsch Niveau"] || "",
            art: student.Art || undefined,
            videoLink: student.BewerbungsVideoLink,
            fotoUrl,
            driveFolderUrl,
            sequenceStep: 1,
          });

          const subject = `Bewerbung als ${student.Ziel || "Azubi"} – ${student.Namen || student.first_name}`;

          // Send
          await sendEmail({
            fromEmail: creds.email,
            fromName: student.Namen || `${student.first_name} ${student.last_name}`,
            appPassword,
            to: target.email,
            subject,
            html,
          });

          // Log success
          await supabase.from("email_send_log").insert({
            user_id: student.user_id,
            recipient_email: target.email,
            recipient_name: target.name,
            company_name: target.firmenname,
            subject,
            status: "sent",
            sequence_step: 1,
            sent_at: new Date().toISOString(),
            body_html: html,
          });

          // Award XP for email sent
          await awardXP(student.user_id, "email_sent", `Bewerbung an ${target.firmenname || target.email}`, 15).catch(() => {});

          // Create call task if phone available
          await createCallTaskIfPhoneAvailable(
            supabase,
            student.user_id,
            target.firmenname || "Unbekannt",
            target.telefonnummer
          );

          sentCount++;
          await sleep(DELAY_BETWEEN_SENDS_MS);
        } catch (err) {
          errorCount++;
          await supabase.from("email_send_log").insert({
            user_id: student.user_id,
            recipient_email: target.email,
            company_name: target.firmenname,
            subject: `Bewerbung als ${student.Ziel} – ${student.Namen}`,
            status: "failed",
            error_message: err instanceof Error ? err.message : "Unknown error",
            sequence_step: 1,
          });
        }
      }
    } catch {
      errorCount++;
    }

    results.push({
      student: student.Namen || student.first_name || "Unknown",
      sent: sentCount,
      errors: errorCount,
    });
  }

  return NextResponse.json({
    message: `Processed ${results.length} students`,
    results,
    timestamp: new Date().toISOString(),
  });
}
