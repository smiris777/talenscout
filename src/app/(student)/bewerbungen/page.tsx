import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ManualBewerbungForm } from "@/components/manual-bewerbung-form";
import { EmailInbox } from "@/components/email-inbox";

export default async function StudentBewerbungen() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: emails } = await supabase
    .from("email_send_log")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const { data: receivedEmails } = await supabase
    .from("email_received_log")
    .select("*")
    .eq("user_id", user.id)
    .order("received_at", { ascending: false })
    .limit(100);

  const sentCount = emails?.filter((e) => e.status === "sent").length || 0;
  const failedCount = emails?.filter((e) => e.status === "failed").length || 0;
  const receivedCount = receivedEmails?.length || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Meine Bewerbungen</h1>
        <p className="text-gray-500 mt-1">Bewerbungen versenden und Antworten verfolgen</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
      </div>

      <ManualBewerbungForm />

      <EmailInbox
        sentEmails={emails || []}
        receivedEmails={receivedEmails || []}
      />
    </div>
  );
}
