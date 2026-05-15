import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient(
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

function dateRange(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function groupByDay(rows: Array<{ created_at?: string; sent_at?: string; received_at?: string }>, field: "created_at" | "sent_at" | "received_at", days: number): Record<string, number> {
  const result: Record<string, number> = {};
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    result[d.toISOString().slice(0, 10)] = 0;
  }
  for (const row of rows) {
    const val = row[field];
    if (val) {
      const day = val.slice(0, 10);
      if (day in result) result[day]++;
    }
  }
  return result;
}

export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const since30 = dateRange(30);
  const since14 = dateRange(14);

  const [
    studentsRes,
    emailsSentAllRes,
    emailsSent30Res,
    emailsReceivedAllRes,
    classificationRes,
    bewerbungenAllRes,
    bewerbungen14Res,
  ] = await Promise.all([
    admin.from("ausbildung_main_engine").select(`user_id, "Namen", "Aktiv", "Ziel", BewerbungsfotoLink, gmail_app_password_set, student_active`).eq("sichtbar", true),
    admin.from("email_send_log").select("user_id", { count: "exact", head: true }).eq("status", "sent"),
    admin.from("email_send_log").select("user_id, sent_at").eq("status", "sent").gte("sent_at", since30),
    admin.from("email_received_log").select("user_id, received_at, classification", { count: "exact" }).gte("received_at", since30),
    admin.from("email_received_log").select("classification, user_id").not("classification", "is", null),
    admin.from("bewerbungen").select("*", { count: "exact", head: true }),
    admin.from("bewerbungen").select("created_at").gte("created_at", since14),
  ]);

  const students = studentsRes.data ?? [];
  const userIds = students.map((s) => s.user_id).filter(Boolean) as string[];

  // Per-student pipeline data
  const [perStudentSentRes, perStudentReceivedRes, perStudentInterviewRes] = await Promise.all([
    admin.from("email_send_log").select("user_id").eq("status", "sent").in("user_id", userIds),
    admin.from("email_received_log").select("user_id").in("user_id", userIds),
    admin.from("email_received_log").select("user_id").in("classification", ["interview_invite", "offer"]).in("user_id", userIds),
  ]);

  const sentMap: Record<string, number> = {};
  const receivedMap: Record<string, number> = {};
  const interviewMap: Record<string, number> = {};
  for (const r of perStudentSentRes.data ?? []) sentMap[r.user_id] = (sentMap[r.user_id] || 0) + 1;
  for (const r of perStudentReceivedRes.data ?? []) receivedMap[r.user_id] = (receivedMap[r.user_id] || 0) + 1;
  for (const r of perStudentInterviewRes.data ?? []) interviewMap[r.user_id] = (interviewMap[r.user_id] || 0) + 1;

  // Classification breakdown (all time)
  const classificationCounts: Record<string, number> = {};
  for (const r of classificationRes.data ?? []) {
    const c = r.classification || "other";
    classificationCounts[c] = (classificationCounts[c] || 0) + 1;
  }

  // Time series: emails sent per day (last 30)
  const emailsSentTimeSeries = groupByDay(emailsSent30Res.data ?? [], "sent_at", 30);

  // Time series: emails received per day (last 30)
  const emailsReceivedTimeSeries = groupByDay(emailsReceivedAllRes.data ?? [], "received_at", 30);

  // Time series: bewerbungen scraped per day (last 14)
  const scrapingTimeSeries = groupByDay(bewerbungen14Res.data ?? [], "created_at", 14);

  // Pipeline funnel totals
  const totalSent = emailsSentAllRes.count ?? 0;
  const totalReceived = emailsReceivedAllRes.count ?? 0;
  const totalInterviews = classificationCounts["interview_invite"] ?? 0;
  const totalOffers = classificationCounts["offer"] ?? 0;
  const totalPool = bewerbungenAllRes.count ?? 0;

  const pipeline = [
    { label: "Bewerbungen gesendet", value: totalSent, color: "blue" },
    { label: "Antworten erhalten", value: totalReceived, rate: totalSent ? Math.round((totalReceived / totalSent) * 100) : 0, color: "indigo" },
    { label: "Vorstellungsgespräche", value: totalInterviews, rate: totalSent ? Math.round((totalInterviews / totalSent) * 100) : 0, color: "violet" },
    { label: "Zusagen", value: totalOffers, rate: totalSent ? Math.round((totalOffers / totalSent) * 100) : 0, color: "emerald" },
  ];

  const studentPipeline = students.map((s) => ({
    userId: s.user_id,
    name: s.Namen ?? "Unbekannt",
    ziel: s.Ziel ?? "",
    aktiv: s.Aktiv ?? "",
    fotoLink: s.BewerbungsfotoLink ?? null,
    gmailSet: s.gmail_app_password_set ?? false,
    studentActive: s.student_active ?? false,
    sent: s.user_id ? (sentMap[s.user_id] ?? 0) : 0,
    received: s.user_id ? (receivedMap[s.user_id] ?? 0) : 0,
    interviews: s.user_id ? (interviewMap[s.user_id] ?? 0) : 0,
  })).sort((a, b) => b.sent - a.sent);

  return NextResponse.json({
    pipeline,
    classificationCounts,
    emailsSentTimeSeries,
    emailsReceivedTimeSeries,
    scrapingTimeSeries,
    studentPipeline,
    totalPool,
    totalSent,
    totalReceived,
  });
}
