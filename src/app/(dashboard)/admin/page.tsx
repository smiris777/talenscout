import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/admin-dashboard";

export default async function AdminPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Check admin role
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "administrator") {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-semibold text-red-600">Zugriff verweigert</h2>
        <p className="text-gray-500 mt-2">Nur Administratoren haben Zugang zu dieser Seite.</p>
      </div>
    );
  }

  // Fetch all azubis for admin management
  const { data: azubis } = await supabase
    .from("ausbildung_main_engine")
    .select(`id, "Student ID", "Namen", "Email", "Ziel", "Aktiv", "Deutsch Niveau", "Art", sichtbar, drive_folder_id, user_id, monthly_credit, credit_auto_refill, student_active, daily_email_enabled, gmail_app_password_set`)
    .order("Namen", { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Admin-Verwaltung</h2>
        <p className="text-sm text-gray-500 mt-1">
          Bewerber-Status ändern und Sichtbarkeit verwalten
        </p>
      </div>
      <AdminDashboard azubis={azubis || []} />
    </div>
  );
}
