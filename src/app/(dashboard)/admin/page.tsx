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
      <div className="text-center py-20">
        <h2 className="text-xl font-semibold text-[#1d1d1f]">Zugriff verweigert</h2>
        <p className="text-sm text-gray-400 mt-2">Nur Administratoren haben Zugang zu dieser Seite.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Admin-Dashboard</h2>
        <p className="text-sm text-gray-400 mt-1">
          Studenten verwalten, Credits zuweisen, E-Mail-Status pruefen
        </p>
      </div>
      <AdminDashboard />
    </div>
  );
}
