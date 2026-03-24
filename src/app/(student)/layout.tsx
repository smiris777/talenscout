import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StudentNavBar } from "@/components/student-nav-bar";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "bewerber") redirect("/");

  // Get student data for credit display
  const { data: student } = await supabase
    .from("ausbildung_main_engine")
    .select("monthly_credit, student_active")
    .eq("user_id", user.id)
    .single();

  if (student && !student.student_active) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8 bg-white rounded-xl shadow-sm max-w-md">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Konto deaktiviert</h1>
          <p className="text-gray-500">
            Dein Konto wurde vorübergehend deaktiviert. Bitte kontaktiere deinen Vermittler für weitere Informationen.
          </p>
        </div>
      </div>
    );
  }

  // Count emails sent this month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { count: monthlyUsage } = await supabase
    .from("email_send_log")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "sent")
    .gte("sent_at", startOfMonth.toISOString());

  // Count pending tasks
  const { count: pendingTasks } = await supabase
    .from("student_tasks")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "pending");

  return (
    <div className="min-h-screen bg-gray-50">
      <StudentNavBar
        userName={profile.full_name || "Student"}
        creditUsed={monthlyUsage || 0}
        creditTotal={student?.monthly_credit || 0}
        pendingTasks={pendingTasks || 0}
      />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  );
}
