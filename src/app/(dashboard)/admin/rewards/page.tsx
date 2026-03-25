import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { RewardRulesManager } from "@/components/reward-rules-manager";

export default async function AdminRewardsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "administrator") redirect("/");

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: rules } = await admin
    .from("reward_rules")
    .select("*")
    .order("rule_type");

  // Leaderboard
  const { data: leaderboard } = await admin
    .from("student_streaks")
    .select("student_id, total_points, level, current_streak, xp, xp_to_next_level")
    .order("total_points", { ascending: false })
    .limit(20);

  // Get student names
  let leaderboardWithNames: any[] = [];
  if (leaderboard && leaderboard.length > 0) {
    const userIds = leaderboard.map((l) => l.student_id);
    const { data: profiles } = await admin
      .from("user_profiles")
      .select("id, full_name")
      .in("id", userIds);

    leaderboardWithNames = leaderboard.map((l) => ({
      ...l,
      name: profiles?.find((p) => p.id === l.student_id)?.full_name || "Unbekannt",
    }));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Anreizsystem & Gamification</h1>
        <p className="text-gray-500 mt-1">Belohnungsregeln verwalten und Leaderboard</p>
      </div>

      <RewardRulesManager rules={rules || []} leaderboard={leaderboardWithNames} />
    </div>
  );
}
