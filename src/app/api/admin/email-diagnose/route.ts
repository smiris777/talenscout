import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { getMatchingBereiche } from "@/lib/email/bereich-mapping";

export const runtime = "nodejs";

/**
 * Diagnose: warum gehen keine Emails raus?
 * Prüft die exakten Bedingungen, die der send-emails-Cron anwendet,
 * und meldet je Studenten, welche Bedingung scheitert.
 */
export async function GET() {
  // 1. Admin-Auth
  const supabaseUser = await createClient();
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const supabase = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "administrator") {
    return NextResponse.json({ error: "Keine Admin-Berechtigung" }, { status: 403 });
  }

  // 2. Globale Checks
  const cronSecretSet = !!process.env.CRON_SECRET;
  const supabaseUrlSet = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKeySet = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anthropicKeySet = !!process.env.ANTHROPIC_API_KEY;

  // 3. Pool-Größe
  const { count: poolSize } = await supabase
    .from("bewerbungen")
    .select("*", { count: "exact", head: true })
    .not("email", "is", null);

  // 4. Alle (sichtbaren) Studenten holen
  const { data: students } = await supabase
    .from("ausbildung_main_engine")
    .select(
      `id, "Namen", "Ziel", user_id, student_active, daily_email_enabled, gmail_app_password_set, monthly_credit, sichtbar`,
    )
    .eq("sichtbar", true);

  if (!students) {
    return NextResponse.json({ error: "Konnte Studenten nicht laden" }, { status: 500 });
  }

  // 5. Pro Student: warum kommt er durch den Cron-Filter oder warum nicht?
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Letzte 24h failed-Emails
  const last24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: recentFailures } = await supabase
    .from("email_send_log")
    .select("user_id, recipient_email, company_name, error_message, sent_at")
    .eq("status", "failed")
    .gte("created_at", last24h)
    .order("created_at", { ascending: false })
    .limit(20);

  // Pro Student durchgehen
  const perStudent = [];
  let blockedTotal = 0;
  let readyToSend = 0;

  for (const s of students) {
    type StudentRow = {
      id: number;
      Namen: string | null;
      Ziel: string | null;
      user_id: string | null;
      student_active: boolean | null;
      daily_email_enabled: boolean | null;
      gmail_app_password_set: boolean | null;
      monthly_credit: number | null;
    };
    const st = s as StudentRow;
    const blockers: string[] = [];

    if (!st.user_id) blockers.push("kein user_id (Auth-Account fehlt)");
    if (st.student_active === false) blockers.push("student_active = false");
    if (st.daily_email_enabled === false) blockers.push("daily_email_enabled = false");
    if (st.gmail_app_password_set === false) blockers.push("Gmail-App-Passwort nicht gesetzt");
    if ((st.monthly_credit ?? 0) <= 0) blockers.push("monthly_credit = 0");
    if (!st.Ziel || st.Ziel.trim().length < 3) blockers.push("kein Ziel gesetzt");

    // Wenn alle Vorbedingungen erfüllt → Pool-Match prüfen
    let poolMatches = 0;
    let bereicheSuchbegriffe: string[] = [];
    let monatlichGesendet = 0;
    let heuteGesendet = 0;

    if (blockers.length === 0 && st.user_id && st.Ziel) {
      bereicheSuchbegriffe = getMatchingBereiche(st.Ziel);

      if (bereicheSuchbegriffe.length === 0) {
        blockers.push(`Ziel "${st.Ziel}" ergibt 0 Such-Begriffe (bereich-mapping)`);
      } else {
        const orFilter = bereicheSuchbegriffe.map((b) => `bereich.ilike.%${b}%`).join(",");
        const { count: matchCount } = await supabase
          .from("bewerbungen")
          .select("*", { count: "exact", head: true })
          .not("email", "is", null)
          .or(orFilter);
        poolMatches = matchCount ?? 0;

        if (poolMatches === 0) {
          blockers.push(`0 Firmen im Pool matchen bereich (${bereicheSuchbegriffe.join(", ")})`);
        }
      }

      const { count: monatlich } = await supabase
        .from("email_send_log")
        .select("*", { count: "exact", head: true })
        .eq("user_id", st.user_id)
        .eq("status", "sent")
        .gte("sent_at", startOfMonth.toISOString());
      monatlichGesendet = monatlich ?? 0;

      if (monatlichGesendet >= (st.monthly_credit ?? 0)) {
        blockers.push(`Monats-Budget aufgebraucht (${monatlichGesendet}/${st.monthly_credit})`);
      }

      const { count: heute } = await supabase
        .from("email_send_log")
        .select("*", { count: "exact", head: true })
        .eq("user_id", st.user_id)
        .eq("status", "sent")
        .gte("sent_at", today.toISOString());
      heuteGesendet = heute ?? 0;

      // Tageslimit hängt von Gmail-Setup-Alter ab → wir nehmen pessimistisch 20
      if (heuteGesendet >= 20) {
        blockers.push(`Tageslimit erreicht (${heuteGesendet}/20)`);
      }
    }

    if (blockers.length === 0) readyToSend++;
    else blockedTotal++;

    perStudent.push({
      id: st.id,
      name: st.Namen,
      ziel: st.Ziel,
      ready: blockers.length === 0,
      blockers,
      poolMatches,
      bereicheSuchbegriffe,
      monatlichGesendet,
      heuteGesendet,
      monthlyCredit: st.monthly_credit ?? 0,
    });
  }

  // Häufigste Blocker zählen
  const blockerCounts: Record<string, number> = {};
  for (const s of perStudent) {
    for (const b of s.blockers) {
      // Normalisiere Zahlen weg, damit gleiche Ursache zusammen gezählt wird
      const key = b
        .replace(/\d+\/\d+/g, "X/Y")
        .replace(/\([^)]*\)/g, "")
        .trim();
      blockerCounts[key] = (blockerCounts[key] || 0) + 1;
    }
  }
  const topBlockers = Object.entries(blockerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  return NextResponse.json({
    environment: {
      cronSecretSet,
      supabaseUrlSet,
      serviceKeySet,
      anthropicKeySet,
    },
    summary: {
      totalStudents: students.length,
      readyToSend,
      blocked: blockedTotal,
      poolSize: poolSize ?? 0,
    },
    topBlockers: topBlockers.map(([reason, count]) => ({ reason, count })),
    recentFailures: (recentFailures ?? []).map((f) => ({
      company: f.company_name,
      email: f.recipient_email,
      error: f.error_message,
      at: f.sent_at,
    })),
    students: perStudent.sort((a, b) => (a.ready === b.ready ? 0 : a.ready ? 1 : -1)),
  });
}
