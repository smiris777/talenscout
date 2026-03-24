import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeAzubi, getGDriveThumbnailUrl, getStatusColor, getNiveauColor } from "@/lib/utils/normalize";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

const AZUBI_SELECT = `*, monthly_credit, daily_email_enabled, gmail_app_password_set, student_active`;

export default async function StudentDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch student data
  const { data: rawStudentData } = await supabase
    .from("ausbildung_main_engine")
    .select(AZUBI_SELECT)
    .eq("user_id", user.id)
    .single();

  if (!rawStudentData) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Kein Studentenprofil gefunden.</p>
      </div>
    );
  }

  const rawStudent = rawStudentData as any;
  const student = normalizeAzubi(rawStudent);
  const photoUrl = getGDriveThumbnailUrl(student.fotoLink);
  const statusColor = getStatusColor(student.aktiv);
  const niveauColor = getNiveauColor(student.deutschNiveau);

  // Monthly usage
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { count: monthlyUsage } = await supabase
    .from("email_send_log")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "sent")
    .gte("sent_at", startOfMonth.toISOString());

  // Recent emails
  const { data: recentEmails } = await supabase
    .from("email_send_log")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  // Pending tasks
  const { data: pendingTasks } = await supabase
    .from("student_tasks")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .order("due_date", { ascending: true })
    .limit(3);

  const credit = rawStudent.monthly_credit || 0;
  const used = monthlyUsage || 0;
  const remaining = Math.max(0, credit - used);
  const creditPercent = credit > 0 ? Math.round((used / credit) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Profile Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={student.name}
                className="w-16 h-16 rounded-xl object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center text-xl font-semibold">
                {student.name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
              </div>
            )}
            <div className="flex-1">
              <h1 className="text-xl font-semibold text-gray-900">{student.name}</h1>
              <p className="text-gray-500">{student.ziel}</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge className={`${statusColor.bg} ${statusColor.text}`}>{student.aktiv || "Unbekannt"}</Badge>
                {student.deutschNiveau && (
                  <Badge className={niveauColor}>{student.deutschNiveau}</Badge>
                )}
                {student.art && (
                  <Badge variant="outline">{student.art}</Badge>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">E-Mail</p>
              <p className="text-sm font-medium">{student.email}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Credit Widget */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Bewerbungs-Kredit</CardTitle>
          </CardHeader>
          <CardContent>
            {credit > 0 ? (
              <>
                <div className="flex items-end gap-1">
                  <span className="text-3xl font-bold text-gray-900">{remaining}</span>
                  <span className="text-gray-400 mb-1">/ {credit} verbleibend</span>
                </div>
                <div className="mt-3 w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      creditPercent >= 90 ? "bg-red-500" : creditPercent >= 70 ? "bg-yellow-500" : "bg-blue-500"
                    }`}
                    style={{ width: `${Math.min(creditPercent, 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-gray-400">{used} Bewerbungen diesen Monat versendet</p>
              </>
            ) : (
              <p className="text-gray-400 text-sm">Noch kein Kredit vergeben. Bitte kontaktiere deinen Vermittler.</p>
            )}
          </CardContent>
        </Card>

        {/* Email Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">E-Mail Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Gmail verbunden</span>
                <span className={`text-sm font-medium ${rawStudent.gmail_app_password_set ? "text-green-600" : "text-red-500"}`}>
                  {rawStudent.gmail_app_password_set ? "Ja" : "Nein"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Auto-Versand</span>
                <span className={`text-sm font-medium ${rawStudent.daily_email_enabled ? "text-green-600" : "text-gray-400"}`}>
                  {rawStudent.daily_email_enabled ? "Aktiv" : "Inaktiv"}
                </span>
              </div>
              {!rawStudent.gmail_app_password_set && (
                <Link
                  href="/email-setup"
                  className="mt-2 inline-block text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Gmail jetzt einrichten →
                </Link>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tasks Preview */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-500">Offene Aufgaben</CardTitle>
              <Link href="/aufgaben" className="text-xs text-blue-600 hover:text-blue-700">
                Alle →
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {pendingTasks && pendingTasks.length > 0 ? (
              <div className="space-y-2">
                {pendingTasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-2 text-sm">
                    <span>
                      {task.type === "call" ? "📞" : task.type === "email_followup" ? "📧" : task.type === "document_upload" ? "📄" : "📋"}
                    </span>
                    <span className="text-gray-700 truncate">{task.title}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-sm">Keine offenen Aufgaben</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Emails */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Letzte Bewerbungen</CardTitle>
            <Link href="/bewerbungen" className="text-sm text-blue-600 hover:text-blue-700">
              Alle anzeigen →
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {recentEmails && recentEmails.length > 0 ? (
            <div className="divide-y">
              {recentEmails.map((email) => (
                <div key={email.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{email.company_name || "Unbekannt"}</p>
                    <p className="text-xs text-gray-500">{email.recipient_email}</p>
                  </div>
                  <div className="text-right">
                    <Badge
                      variant="outline"
                      className={email.status === "sent" ? "text-green-600 border-green-200" : "text-red-500 border-red-200"}
                    >
                      {email.status === "sent" ? "Gesendet" : "Fehlgeschlagen"}
                    </Badge>
                    <p className="text-xs text-gray-400 mt-1">
                      {email.sent_at ? new Date(email.sent_at).toLocaleDateString("de-DE") : "-"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm text-center py-4">
              Noch keine Bewerbungen versendet. Richte zuerst dein Gmail-Konto ein.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
