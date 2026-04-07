"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface SentEmail {
  id: string;
  recipient_email: string;
  company_name: string | null;
  subject: string;
  status: string;
  sequence_step: number;
  sent_at: string | null;
  error_message?: string | null;
  source?: string | null;
  body_html?: string | null;
}

interface ReceivedEmail {
  id: string;
  from_email: string;
  from_name: string | null;
  subject: string;
  body_text: string | null;
  received_at: string;
  is_read: boolean;
}

type Tab = "gesendet" | "empfangen" | "alle";

export function EmailInbox({
  sentEmails,
  receivedEmails,
}: {
  sentEmails: SentEmail[];
  receivedEmails: ReceivedEmail[];
}) {
  const [tab, setTab] = useState<Tab>("gesendet");
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [selectedReceived, setSelectedReceived] = useState<ReceivedEmail | null>(null);
  const [selectedSent, setSelectedSent] = useState<SentEmail | null>(null);

  async function handleSync() {
    setSyncing(true);
    setSyncMessage("");
    try {
      const res = await fetch("/api/email/fetch-inbox", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setSyncMessage(data.message);
        if (data.newEmails > 0) {
          // Reload page to show new emails
          window.location.reload();
        }
      } else {
        setSyncMessage(data.error || "Fehler beim Abrufen.");
      }
    } catch {
      setSyncMessage("Netzwerkfehler.");
    }
    setSyncing(false);
  }

  // Build combined timeline for "alle" tab
  const allEmails = [
    ...sentEmails.map((e) => ({
      type: "sent" as const,
      date: e.sent_at || "",
      email: e.recipient_email,
      name: e.company_name || e.recipient_email,
      subject: e.subject,
      status: e.status,
      data: e,
    })),
    ...receivedEmails.map((e) => ({
      type: "received" as const,
      date: e.received_at,
      email: e.from_email,
      name: e.from_name || e.from_email,
      subject: e.subject,
      status: "received",
      data: e,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <>
      <Card className="rounded-2xl border-0 bg-white/80 backdrop-blur-sm shadow-sm shadow-black/[0.03] overflow-hidden">
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-[#1d1d1f] tracking-tight">E-Mail Verlauf</CardTitle>
            <div className="flex items-center gap-2">
              {syncMessage && (
                <span className="text-xs text-gray-400">{syncMessage}</span>
              )}
              <button
                onClick={handleSync}
                disabled={syncing}
                className="px-3.5 py-1.5 text-xs font-medium text-[#1d1d1f] bg-gray-100/80 hover:bg-gray-200/80 rounded-full transition-all duration-200 disabled:opacity-50 flex items-center gap-1.5"
              >
                {syncing ? (
                  <span className="inline-block w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  "📥"
                )}
                {syncing ? "Abrufen..." : "Posteingang aktualisieren"}
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-0.5 mt-4 bg-gray-100/80 rounded-full p-1 w-fit">
            {([
              { key: "gesendet", label: "Gesendet", count: sentEmails.length },
              { key: "empfangen", label: "Empfangen", count: receivedEmails.length },
              { key: "alle", label: "Alle", count: allEmails.length },
            ] as const).map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ${
                  tab === key
                    ? "bg-white text-[#1d1d1f] shadow-sm"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                {label} ({count})
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {/* Gesendet Tab */}
          {tab === "gesendet" && (
            sentEmails.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400 border-b border-gray-100">
                      <th className="pb-3 text-xs font-medium uppercase tracking-wider">Firma</th>
                      <th className="pb-3 text-xs font-medium uppercase tracking-wider">Empfänger</th>
                      <th className="pb-3 text-xs font-medium uppercase tracking-wider">Betreff</th>
                      <th className="pb-3 text-xs font-medium uppercase tracking-wider">Schritt</th>
                      <th className="pb-3 text-xs font-medium uppercase tracking-wider">Status</th>
                      <th className="pb-3 text-xs font-medium uppercase tracking-wider">Datum</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {sentEmails.map((email) => (
                      <tr
                        key={email.id}
                        onClick={() => setSelectedSent(email)}
                        className="cursor-pointer hover:bg-gray-50/80 transition-all duration-200"
                      >
                        <td className="py-3 font-medium text-[#1d1d1f]">{email.company_name || "-"}</td>
                        <td className="py-3 text-gray-400 max-w-36 truncate">{email.recipient_email}</td>
                        <td className="py-3 text-gray-500 max-w-48 truncate">{email.subject}</td>
                        <td className="py-2">
                          <Badge variant="outline" className="text-xs">
                            {email.source === "scan" ? "📸 Scan" : email.source === "manual" ? "✍️ Manuell" : "🤖 Auto"}
                            {email.sequence_step > 1 ? ` · F${email.sequence_step - 1}` : ""}
                          </Badge>
                        </td>
                        <td className="py-2">
                          <Badge
                            variant="outline"
                            className={email.status === "sent" ? "text-green-600 border-green-200" : "text-red-500 border-red-200"}
                          >
                            {email.status === "sent" ? "Gesendet" : "Fehler"}
                          </Badge>
                        </td>
                        <td className="py-2 text-gray-500 whitespace-nowrap">
                          {email.sent_at ? new Date(email.sent_at).toLocaleDateString("de-DE") : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-400 text-center py-8">Noch keine Bewerbungen versendet.</p>
            )
          )}

          {/* Empfangen Tab */}
          {tab === "empfangen" && (
            receivedEmails.length > 0 ? (
              <div className="space-y-2">
                {receivedEmails.map((email) => (
                  <button
                    key={email.id}
                    onClick={() => setSelectedReceived(email)}
                    className={`w-full text-left p-3.5 rounded-2xl border transition-all duration-200 hover:shadow-sm hover:-translate-y-px ${
                      !email.is_read ? "bg-white border-gray-200/80 shadow-sm" : "bg-white/60 border-gray-100/80"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {!email.is_read && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
                          <span className="font-medium text-sm text-gray-900 truncate">
                            {email.from_name || email.from_email}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 truncate mt-0.5">{email.subject}</p>
                        {email.body_text && (
                          <p className="text-xs text-gray-400 truncate mt-0.5">
                            {email.body_text.substring(0, 100)}...
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 whitespace-nowrap ml-2">
                        {new Date(email.received_at).toLocaleDateString("de-DE")}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-400">Noch keine Antworten empfangen.</p>
                <p className="text-xs text-gray-300 mt-1">
                  Klicke &quot;Posteingang aktualisieren&quot; um nach Antworten zu suchen.
                </p>
              </div>
            )
          )}

          {/* Alle Tab */}
          {tab === "alle" && (
            allEmails.length > 0 ? (
              <div className="space-y-2">
                {allEmails.map((item, i) => (
                  <div
                    key={`${item.type}-${i}`}
                    className={`p-3.5 rounded-2xl border text-sm cursor-pointer transition-all duration-200 hover:shadow-sm hover:-translate-y-px ${
                      item.type === "received"
                        ? "bg-white border-gray-200/80 shadow-sm"
                        : "bg-white/60 border-gray-100/80"
                    }`}
                    onClick={() => {
                      if (item.type === "received") setSelectedReceived(item.data as ReceivedEmail);
                      else setSelectedSent(item.data as SentEmail);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        item.type === "sent"
                          ? item.status === "sent" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                          : "bg-blue-100 text-blue-700"
                      }`}>
                        {item.type === "sent" ? "↑ Gesendet" : "↓ Empfangen"}
                      </span>
                      <span className="font-medium text-gray-900 truncate">{item.name}</span>
                      <span className="text-gray-400 text-xs ml-auto whitespace-nowrap">
                        {new Date(item.date).toLocaleDateString("de-DE")}
                      </span>
                    </div>
                    <p className="text-gray-600 truncate mt-1">{item.subject}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-center py-8">Keine E-Mails vorhanden.</p>
            )
          )}
        </CardContent>
      </Card>

      {/* Sent Email Detail Dialog */}
      {selectedSent && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedSent(null)}
        >
          <Card className="w-full max-w-3xl max-h-[80vh] overflow-auto rounded-2xl border-0 shadow-2xl shadow-black/10 bg-white/95 backdrop-blur-xl" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-base">{selectedSent.subject}</CardTitle>
                  <p className="text-sm text-gray-500 mt-1">
                    An: <span className="font-medium">{selectedSent.company_name || selectedSent.recipient_email}</span>
                    <span className="text-gray-400 ml-1">&lt;{selectedSent.recipient_email}&gt;</span>
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-400">
                      {selectedSent.sent_at ? new Date(selectedSent.sent_at).toLocaleString("de-DE") : "-"}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {selectedSent.source === "scan" ? "📸 Scan" : selectedSent.source === "manual" ? "✍️ Manuell" : "🤖 Auto"}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={selectedSent.status === "sent" ? "text-green-600 border-green-200" : "text-red-500 border-red-200"}
                    >
                      {selectedSent.status === "sent" ? "✅ Gesendet" : "❌ Fehler"}
                    </Badge>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedSent(null)}
                  className="text-gray-400 hover:text-gray-600 text-lg ml-2"
                >
                  ✕
                </button>
              </div>
            </CardHeader>
            <CardContent>
              {selectedSent.body_html ? (
                <div
                  className="bg-white rounded-lg border p-4 text-sm"
                  dangerouslySetInnerHTML={{ __html: selectedSent.body_html }}
                />
              ) : (
                <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-400 text-center">
                  Email-Inhalt nicht verfügbar (wurde vor dem Update gesendet)
                </div>
              )}
              {selectedSent.error_message && (
                <div className="mt-3 p-3 bg-red-50 rounded-lg text-sm text-red-600">
                  <strong>Fehler:</strong> {selectedSent.error_message}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Received Email Detail Dialog */}
      {selectedReceived && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedReceived(null)}
        >
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-auto rounded-2xl border-0 shadow-2xl shadow-black/10 bg-white/95 backdrop-blur-xl" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-base">{selectedReceived.subject}</CardTitle>
                  <p className="text-sm text-gray-500 mt-1">
                    Von: <span className="font-medium">{selectedReceived.from_name || selectedReceived.from_email}</span>
                    {selectedReceived.from_name && (
                      <span className="text-gray-400 ml-1">&lt;{selectedReceived.from_email}&gt;</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(selectedReceived.received_at).toLocaleString("de-DE")}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedReceived(null)}
                  className="text-gray-400 hover:text-gray-600 text-lg ml-2"
                >
                  ✕
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">
                {selectedReceived.body_text || "(Kein Textinhalt verfügbar)"}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
