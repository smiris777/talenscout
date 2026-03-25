import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check admin role
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "administrator") {
    return NextResponse.json({ error: "Nur Admins" }, { status: 403 });
  }

  const body = await request.json();
  const { emailId, action, userId, taskTitle, companyName } = body;

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  if (action === "done") {
    await admin
      .from("email_received_log")
      .update({ action_status: "done" })
      .eq("id", emailId);
    return NextResponse.json({ success: true });
  }

  if (action === "create_task") {
    // Create task for student
    await admin.from("student_tasks").insert({
      user_id: userId,
      type: "email_followup",
      title: taskTitle || "Aktion erforderlich",
      company_name: companyName,
      priority: "high",
      status: "pending",
    });

    // Mark email as task created
    await admin
      .from("email_received_log")
      .update({ action_status: "task_created" })
      .eq("id", emailId);

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
