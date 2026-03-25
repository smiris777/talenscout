import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ScanUploadForm } from "@/components/scan-upload-form";
import { JobListingsView } from "@/components/job-listings-view";
import { Badge } from "@/components/ui/badge";

export default async function ScanPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch active listings (not transferred)
  const { data: listings } = await supabase
    .from("job_listings")
    .select("*")
    .eq("student_id", user.id)
    .eq("transferred", false)
    .order("created_at", { ascending: false });

  // Stats
  const activeCount = listings?.length || 0;
  const { count: transferredCount } = await supabase
    .from("job_listings")
    .select("*", { count: "exact", head: true })
    .eq("student_id", user.id)
    .eq("transferred", true);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Scan & Apply</h1>
        <p className="text-gray-500 mt-1">Stellenanzeigen scannen und Firmen sammeln</p>
      </div>

      {/* Stats */}
      <div className="flex gap-3">
        <Badge variant="outline" className="px-3 py-1.5 text-sm">
          📋 {activeCount} aktive Firmen
        </Badge>
        <Badge variant="outline" className="px-3 py-1.5 text-sm">
          ✅ {transferredCount || 0} übertragen
        </Badge>
      </div>

      {/* Upload Form */}
      <ScanUploadForm />

      {/* Listings */}
      {activeCount > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Meine Firmen (30-Tage-Phase)</h2>
          <JobListingsView listings={listings || []} />
        </div>
      )}
    </div>
  );
}
