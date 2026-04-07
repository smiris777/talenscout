import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { NavBar } from "@/components/nav-bar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get user profile for role check
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("full_name, role, email")
    .eq("id", user.id)
    .single();

  // Students should not see the recruiter dashboard
  if (profile?.role === "bewerber") {
    redirect("/dashboard");
  }

  const userName = profile?.full_name || user.email || "Benutzer";
  const isAdmin = profile?.role === "administrator";

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <NavBar userName={userName} isAdmin={isAdmin} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
