import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ManualBewerbungForm } from "@/components/manual-bewerbung-form";
import { EmailInbox } from "@/components/email-inbox";
import Link from "next/link";

export default async function StudentBewerbungen() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Sent emails
  const { data: emails } = await supabase
    .from("email_send_log")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  // Received emails
  const { data: receivedEmails } = await supabase
    .from("email_received_log")
    .select("*")
    .eq("user_id", user.id)
    .order("received_at", { ascending: false })
    .limit(100);

  // Scanned companies waiting for application
  const { data: pendingScans } = await supabase
    .from("job_listings")
    .select("*")
    .eq("student_id", user.id)
    .eq("applied", false)
    .eq("transferred", false)
    .not("contact_email", "is", null)
    .order("created_at", { ascending: false });

  // Scanned companies already applied
  const { data: appliedScans } = await supabase
    .from("job_listings")
    .select("*")
    .eq("student_id", user.id)
    .eq("applied", true)
    .order("created_at", { ascending: false });

  const sentCount = emails?.filter((e) => e.status === "sent").length || 0;
  const failedCount = emails?.filter((e) => e.status === "failed").length || 0;
  const receivedCount = receivedEmails?.length || 0;
  const pendingCount = pendingScans?.length || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Meine Bewerbungen</h1>
        <p className="text-gray-500 mt-1">Bewerbungen versenden und Antworten verfolgen</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-500">Gesendet</p>
            <p className="text-2xl font-bold">{emails?.length || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-500">Erfolgreich</p>
            <p className="text-2xl font-bold text-green-600">{sentCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-500">Fehlgeschlagen</p>
            <p className="text-2xl font-bold text-red-500">{failedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-500">Antworten</p>
            <p className="text-2xl font-bold text-blue-600">{receivedCount}</p>
          </CardContent>
        </Card>
        <Card className={pendingCount > 0 ? "border-orange-300 bg-orange-50/50" : ""}>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-500">📸 Wartend</p>
            <p className="text-2xl font-bold text-orange-600">{pendingCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Pending scanned companies - CTA to apply */}
      {pendingCount > 0 && (
        <Card className="border-orange-300 bg-gradient-to-r from-orange-50 to-yellow-50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              📸 Gescannte Firmen — bereit zur Bewerbung
              <Badge className="bg-orange-500 text-white">{pendingCount}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingScans?.map((scan) => (
                <div key={scan.id} className="flex items-center justify-between bg-white rounded-lg border p-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900">{scan.company_name}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                      {scan.job_title && <span>{scan.job_title}</span>}
                      {scan.location && <span>📍 {scan.location}</span>}
                      <span>📧 {scan.contact_email}</span>
                    </div>
                  </div>
                  <Link
                    href="/scan"
                    className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap"
                  >
                    📨 Bewerben
                  </Link>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recently applied via Scan */}
      {appliedScans && appliedScans.length > 0 && (
        <Card className="border-green-200">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              ✅ Per Scan beworben
              <Badge variant="outline" className="text-green-600 border-green-300">{appliedScans.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {appliedScans.slice(0, 6).map((scan) => (
                <div key={scan.id} className="flex items-center gap-2 bg-green-50 rounded-lg border border-green-200 p-2.5 text-sm">
                  <span className="text-green-500">✅</span>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{scan.company_name}</p>
                    <p className="text-xs text-gray-500 truncate">{scan.contact_email}</p>
                  </div>
                </div>
              ))}
            </div>
            {appliedScans.length > 6 && (
              <Link href="/scan" className="text-sm text-blue-600 hover:underline mt-2 inline-block">
                Alle {appliedScans.length} anzeigen →
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      <ManualBewerbungForm />

      <EmailInbox
        sentEmails={emails || []}
        receivedEmails={receivedEmails || []}
      />
    </div>
  );
}
