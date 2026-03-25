import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function getRewardRules() {
  const admin = getAdmin();
  const { data } = await admin
    .from("reward_rules")
    .select("*")
    .eq("is_active", true);
  return data || [];
}

export async function awardXP(studentId: string, source: string, description: string, xpOverride?: number) {
  const admin = getAdmin();

  // Get XP from rules if not overridden
  let xp = xpOverride;
  if (!xp) {
    const rules = await getRewardRules();
    const rule = rules.find((r) => r.rule_type === source);
    if (rule && rule.rule_value?.xp) {
      xp = rule.rule_value.xp;
    } else {
      xp = 10; // default
    }
  }

  // Log points
  await admin.from("student_points").insert({
    student_id: studentId,
    points: xp,
    source,
    description,
  });

  // Upsert streak record
  const { data: streak } = await admin
    .from("student_streaks")
    .select("*")
    .eq("student_id", studentId)
    .single();

  const today = new Date().toISOString().split("T")[0];

  if (!streak) {
    // Create new streak
    const newXP = xp;
    const level = 1;
    const xpToNext = 100;

    await admin.from("student_streaks").insert({
      student_id: studentId,
      current_streak: 1,
      longest_streak: 1,
      last_activity_date: today,
      total_points: newXP,
      level,
      xp: newXP,
      xp_to_next_level: xpToNext,
    });
  } else {
    // Update existing
    let newStreak = streak.current_streak;
    let longestStreak = streak.longest_streak;
    const lastDate = streak.last_activity_date;

    if (lastDate !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];

      if (lastDate === yesterdayStr) {
        newStreak += 1;
      } else {
        newStreak = 1; // streak broken
      }

      if (newStreak > longestStreak) {
        longestStreak = newStreak;
      }
    }

    const newXP = streak.xp + xp;
    const newTotal = streak.total_points + xp;

    // Level calculation
    let level = streak.level;
    let xpToNext = streak.xp_to_next_level;
    let remainingXP = newXP;

    while (remainingXP >= xpToNext) {
      remainingXP -= xpToNext;
      level++;
      xpToNext = level * 100;
    }

    await admin
      .from("student_streaks")
      .update({
        current_streak: newStreak,
        longest_streak: longestStreak,
        last_activity_date: today,
        total_points: newTotal,
        level,
        xp: remainingXP,
        xp_to_next_level: xpToNext,
        updated_at: new Date().toISOString(),
      })
      .eq("student_id", studentId);

    // Check streak milestones for bonus
    if (newStreak === 7 || newStreak === 14 || newStreak === 30 || newStreak === 60 || newStreak === 90) {
      const bonusRule = `streak_${newStreak}`;
      const rules = await getRewardRules();
      const streakRule = rules.find((r) => r.rule_key === `${bonusRule}_bonus`);
      if (streakRule) {
        await admin.from("student_points").insert({
          student_id: studentId,
          points: streakRule.rule_value.xp || 75,
          source: "streak_bonus",
          description: `${newStreak}-Tage-Streak Bonus!`,
        });
      }
    }
  }

  return { xp, source };
}

export async function awardPointsForNewContact(studentId: string, email: string) {
  const admin = getAdmin();

  // Check if email already exists in bewerbungen
  const { data: existing } = await admin
    .from("bewerbungen")
    .select("id")
    .eq("email", email)
    .limit(1);

  if (existing && existing.length > 0) {
    return null; // Not a new contact
  }

  // Award XP for new contact
  await awardXP(studentId, "new_contact", `Neue Firma-Adresse: ${email}`);

  // Check contact-to-credit conversion
  const rules = await getRewardRules();
  const contactRule = rules.find((r) => r.rule_key === "contacts_to_credits");

  if (contactRule) {
    const contactsNeeded = contactRule.rule_value.contacts_needed || 2;
    const freeApps = contactRule.rule_value.free_applications || 1;

    // Count new contacts this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count } = await admin
      .from("student_points")
      .select("*", { count: "exact", head: true })
      .eq("student_id", studentId)
      .eq("source", "new_contact")
      .gte("created_at", startOfMonth.toISOString());

    if (count && count % contactsNeeded === 0) {
      // Award free credits
      const { data: student } = await admin
        .from("ausbildung_main_engine")
        .select("monthly_credit")
        .eq("user_id", studentId)
        .single();

      if (student) {
        await admin
          .from("ausbildung_main_engine")
          .update({ monthly_credit: (student.monthly_credit || 0) + freeApps })
          .eq("user_id", studentId);

        return { credited: freeApps, totalContacts: count };
      }
    }
  }

  return { credited: 0 };
}
