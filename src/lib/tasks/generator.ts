import { SupabaseClient } from "@supabase/supabase-js";

export async function createCallTaskIfPhoneAvailable(
  supabase: SupabaseClient,
  userId: string,
  companyName: string,
  phoneNumber: string | null
) {
  if (!phoneNumber) return;

  await supabase.from("student_tasks").insert({
    user_id: userId,
    type: "call",
    title: `${companyName} anrufen`,
    description: `Bewerbung wurde per E-Mail versendet. Bitte ruf an, um dein Interesse zu bekräftigen.`,
    company_name: companyName,
    phone_number: phoneNumber,
    priority: "high",
    status: "pending",
    due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // +2 Tage
  });
}
