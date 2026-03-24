"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateMonthlyCredit(studentId: number, credit: number) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ausbildung_main_engine")
    .update({ monthly_credit: credit })
    .eq("id", studentId);

  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function setOneTimeCredit(studentId: number, amount: number) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ausbildung_main_engine")
    .update({ monthly_credit: amount, credit_auto_refill: 0 })
    .eq("id", studentId);

  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function setRecurringCredit(studentId: number, amount: number) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ausbildung_main_engine")
    .update({ monthly_credit: amount, credit_auto_refill: amount })
    .eq("id", studentId);

  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function blockStudent(studentId: number) {
  const supabase = await createClient();
  const { error } = await supabase
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
  const supabase = await createClient();
  const { error } = await supabase
    .from("ausbildung_main_engine")
    .update({ student_active: active })
    .eq("id", studentId);

  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function toggleDailyEmail(studentId: number, enabled: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
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
