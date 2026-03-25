import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export function getLevelInfo(level: number): { name: string; badge: string; color: string } {
  if (level >= 16) return { name: "Elite", badge: "💎", color: "text-purple-600" };
  if (level >= 11) return { name: "Profi", badge: "🥇", color: "text-yellow-600" };
  if (level >= 6) return { name: "Fortgeschritten", badge: "🥈", color: "text-gray-500" };
  return { name: "Einsteiger", badge: "🥉", color: "text-orange-600" };
}

export async function getStudentStreak(studentId: string) {
  const admin = getAdmin();
  const { data } = await admin
    .from("student_streaks")
    .select("*")
    .eq("student_id", studentId)
    .single();

  return data;
}

export async function getRecentPoints(studentId: string, days: number = 7) {
  const admin = getAdmin();
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data } = await admin
    .from("student_points")
    .select("*")
    .eq("student_id", studentId)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false })
    .limit(20);

  return data || [];
}

export async function getLeaderboard(limit: number = 10) {
  const admin = getAdmin();
  const { data } = await admin
    .from("student_streaks")
    .select("student_id, total_points, level, current_streak, xp, xp_to_next_level")
    .order("total_points", { ascending: false })
    .limit(limit);

  return data || [];
}
