import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "administrator")
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });

  const adminSupabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + 1).toISOString();

  // Fetch all students with sichtbar = true
  const { data: students } = await adminSupabase
    .from("ausbildung_main_engine")
    .select(
      `id, "Student ID", "Namen", "Email", "Ziel", "Aktiv", "Deutsch Niveau", "Art", sichtbar, drive_folder_id, user_id, monthly_credit, credit_auto_refill, student_active, daily_email_enabled, gmail_app_password_set, max_daily_emails, BewerbungsfotoLink, last_login_at, login_count, whatsapp`
    )
    .eq("sichtbar", true)
    .order("Namen", { ascending: true });

  if (!students) return NextResponse.json({ students: [], stats: {} });

  // Gather per-student email counts
  const userIds = students.map((s) => s.user_id).filter(Boolean) as string[];

  // Global stats
  const [
    totalSentRes,
    sentTodayRes,
    sentWeekRes,
    totalReceivedRes,
    totalScansRes,
    interviewsRes,
  ] = await Promise.all([
    adminSupabase
      .from("email_send_log")
      .select("*", { count: "exact", head: true })
      .eq("status", "sent")
      .in("user_id", userIds),
    adminSupabase
      .from("email_send_log")
      .select("*", { count: "exact", head: true })
      .eq("status", "sent")
      .gte("sent_at", todayStart)
      .in("user_id", userIds),
    adminSupabase
      .from("email_send_log")
      .select("*", { count: "exact", head: true })
      .eq("status", "sent")
      .gte("sent_at", weekStart)
      .in("user_id", userIds),
    adminSupabase
      .from("email_received_log")
      .select("*", { count: "exact", head: true })
      .in("user_id", userIds),
    adminSupabase
      .from("job_listings")
      .select("*", { count: "exact", head: true })
      .in("student_id", userIds),
    adminSupabase
      .from("ausbildung_main_engine")
      .select("*", { count: "exact", head: true })
      .in("Aktiv", ["Vorstellungsgespräch", "Zusage Erhalten", "Vorzusage"])
      .eq("sichtbar", true),
  ]);

  const totalSent = totalSentRes.count || 0;
  const totalReceived = totalReceivedRes.count || 0;

  // Per-student email counts: sent today and total
  const perStudentStats: Record<string, { sentToday: number; sentTotal: number; scans: number }> = {};

  if (userIds.length > 0) {
    // Get total sent per user
    const { data: sentPerUser } = await adminSupabase
      .from("email_send_log")
      .select("user_id")
      .eq("status", "sent")
      .in("user_id", userIds);

    // Get sent today per user
    const { data: sentTodayPerUser } = await adminSupabase
      .from("email_send_log")
      .select("user_id")
      .eq("status", "sent")
      .gte("sent_at", todayStart)
      .in("user_id", userIds);

    // Get scans per user
    const { data: scansPerUser } = await adminSupabase
      .from("job_listings")
      .select("student_id")
      .in("student_id", userIds);

    // Count per user
    for (const uid of userIds) {
      perStudentStats[uid] = {
        sentToday: sentTodayPerUser?.filter((r) => r.user_id === uid).length || 0,
        sentTotal: sentPerUser?.filter((r) => r.user_id === uid).length || 0,
        scans: scansPerUser?.filter((r) => r.student_id === uid).length || 0,
      };
    }
  }

  const gmailConnected = students.filter((s) => s.gmail_app_password_set).length;

  const stats = {
    totalStudents: students.length,
    activeStudents: gmailConnected,
    emailsSentToday: sentTodayRes.count || 0,
    emailsSentWeek: sentWeekRes.count || 0,
    emailsSentTotal: totalSent,
    responseRate: totalSent > 0 ? Math.round((totalReceived / totalSent) * 100) : 0,
    interviews: interviewsRes.count || 0,
  };

  // Enrich students with per-student stats
  const enrichedStudents = students.map((s) => ({
    ...s,
    _sentToday: s.user_id ? perStudentStats[s.user_id]?.sentToday || 0 : 0,
    _sentTotal: s.user_id ? perStudentStats[s.user_id]?.sentTotal || 0 : 0,
    _scans: s.user_id ? perStudentStats[s.user_id]?.scans || 0 : 0,
  }));

  return NextResponse.json({ students: enrichedStudents, stats });
}
