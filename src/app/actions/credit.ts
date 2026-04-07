"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

function getAdminSupabase() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht eingeloggt");
  const admin = getAdminSupabase();
  const { data: profile } = await admin.from("user_profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "administrator") throw new Error("Keine Admin-Berechtigung");
  return admin;
}

export async function setOneTimeCredit(studentId: number, amount: number) {
  const admin = await requireAdmin();
  const { error } = await admin
    .from("ausbildung_main_engine")
    .update({ monthly_credit: amount, credit_auto_refill: 0 })
    .eq("id", studentId);

  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function setRecurringCredit(studentId: number, amount: number) {
  const admin = await requireAdmin();
  const { error } = await admin
    .from("ausbildung_main_engine")
    .update({ monthly_credit: amount, credit_auto_refill: amount })
    .eq("id", studentId);

  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function blockStudent(studentId: number) {
  const admin = await requireAdmin();
  const { error } = await admin
    .from("ausbildung_main_engine")
    .update({
      monthly_credit: 0,
      credit_auto_refill: 0,
      student_active: false,
      daily_email_enabled: false,
    })
    .eq("id", studentId);

  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function toggleStudentActive(studentId: number, active: boolean) {
  const admin = await requireAdmin();
  const { error } = await admin
    .from("ausbildung_main_engine")
    .update({ student_active: active })
    .eq("id", studentId);

  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function toggleDailyEmail(studentId: number, enabled: boolean) {
  const admin = await requireAdmin();
  const { error } = await admin
    .from("ausbildung_main_engine")
    .update({ daily_email_enabled: enabled })
    .eq("id", studentId);

  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function getMonthlyUsage(userId: string): Promise<number> {
  const supabase = await createClient();
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from("email_send_log")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "sent")
    .gte("sent_at", startOfMonth.toISOString());

  return count || 0;
}
