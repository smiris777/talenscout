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

  // Get all visible students
  const { data: students } = await adminSupabase
    .from("ausbildung_main_engine")
    .select(`id, "Namen", "Ziel", user_id, BewerbungsfotoLink, student_active, gmail_app_password_set`)
    .eq("sichtbar", true);

  if (!students || students.length === 0) {
    return NextResponse.json({ leaderboard: [] });
  }

  const userIds = students.map((s) => s.user_id).filter(Boolean) as string[];

  // Get streaks for all students
  const { data: streaks } = await adminSupabase
    .from("student_streaks")
    .select("student_id, current_streak, longest_streak, total_points, level, xp, xp_to_next_level, last_activity_date")
    .in("student_id", userIds);

  // Get email counts per student
  const { data: emailCounts } = await adminSupabase
    .from("email_send_log")
    .select("user_id")
    .eq("status", "sent")
    .in("user_id", userIds);

  // Build leaderboard
  const streakMap = new Map((streaks || []).map((s) => [s.student_id, s]));
  const emailCountMap: Record<string, number> = {};
  for (const e of emailCounts || []) {
    emailCountMap[e.user_id] = (emailCountMap[e.user_id] || 0) + 1;
  }

  const leaderboard = students
    .map((s) => {
      const streak = s.user_id ? streakMap.get(s.user_id) : null;
      return {
        id: s.id,
        userId: s.user_id,
        name: s.Namen || "Unbekannt",
        ziel: s.Ziel || "",
        fotoLink: s.BewerbungsfotoLink || null,
        studentActive: s.student_active,
        gmailSet: s.gmail_app_password_set,
        level: streak?.level || 1,
        xp: streak?.xp || 0,
        xpToNext: streak?.xp_to_next_level || 100,
        totalPoints: streak?.total_points || 0,
        currentStreak: streak?.current_streak || 0,
        longestStreak: streak?.longest_streak || 0,
        lastActive: streak?.last_activity_date || null,
        emailsSent: s.user_id ? (emailCountMap[s.user_id] || 0) : 0,
      };
    })
    .sort((a, b) => b.totalPoints - a.totalPoints);

  return NextResponse.json({ leaderboard });
}
