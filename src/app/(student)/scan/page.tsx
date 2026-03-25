import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ScanUploadForm } from "@/components/scan-upload-form";
import { JobListingsView } from "@/components/job-listings-view";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

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
  const appliedCount = listings?.filter(l => l.applied).length || 0;
  const pendingCount = activeCount - appliedCount;

  // Check sent emails count for this user
  const { count: sentEmailsCount } = await supabase
    .from("email_send_log")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "sent");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Scan & Apply</h1>
          <p className="text-gray-500 mt-1">Stellenanzeigen scannen und direkt bewerben</p>
        </div>
        <Link
          href="/bewerbungen"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          📬 Bewerbungen
          {(sentEmailsCount || 0) > 0 && (
            <span className="bg-white/20 px-1.5 py-0.5 rounded text-xs">{sentEmailsCount}</span>
          )}
        </Link>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-3">
        <Badge variant="outline" className="px-3 py-1.5 text-sm">
          📋 {activeCount} gescannte Firmen
        </Badge>
        <Badge variant="outline" className="px-3 py-1.5 text-sm bg-green-50 text-green-700 border-green-300">
          ✅ {appliedCount} beworben
        </Badge>
        {pendingCount > 0 && (
          <Badge variant="outline" className="px-3 py-1.5 text-sm bg-orange-50 text-orange-700 border-orange-300">
            ⏳ {pendingCount} warten auf Bewerbung
          </Badge>
        )}
      </div>

      {/* Upload Form */}
      <ScanUploadForm />

      {/* Listings */}
      {activeCount > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Meine gescannten Firmen</h2>
            <Link href="/bewerbungen" className="text-sm text-blue-600 hover:underline">
              Alle Bewerbungen anzeigen →
            </Link>
          </div>
          <JobListingsView listings={listings || []} />
        </div>
      )}
    </div>
  );
}
