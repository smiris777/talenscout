"use client";

import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateAzubiStatus, toggleAzubiVisibility } from "@/app/actions/admin";
import {
  setOneTimeCredit,
  setRecurringCredit,
  blockStudent,
  toggleStudentActive,
  toggleDailyEmail,
} from "@/app/actions/credit";
import { getStatusColor } from "@/lib/utils/normalize";

interface AdminAzubi {
  id: number;
  "Student ID": number;
  Namen: string | null;
  Email: string | null;
  Ziel: string | null;
  Aktiv: string | null;
  "Deutsch Niveau": string | null;
  Art: string | null;
  sichtbar: boolean | null;
  drive_folder_id: string | null;
  user_id: string | null;
  monthly_credit: number | null;
  credit_auto_refill: number | null;
  student_active: boolean | null;
  daily_email_enabled: boolean | null;
  gmail_app_password_set: boolean | null;
}

const STATUS_OPTIONS = [
  "ja",
  "nein",
  "Vorstellungsgespräch",
  "Zusage Erhalten",
  "Visum Beantragt",
  "Profil beim Kunden",
  "Lebenslauf beim Kunden",
  "Vorzusage",
  "Warte auf beschleunigte Verfahren",
  "warte auf Vertrag",
  "Beschleunigte Verfahren",
];

export function AdminDashboard({ azubis }: { azubis: AdminAzubi[] }) {
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState<number | null>(null);
  const [creditDialog, setCreditDialog] = useState<{ azubi: AdminAzubi; mode: "einmalig" | "monatlich" | "sperren" } | null>(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [smtpStatus, setSmtpStatus] = useState<Record<string, { status: "loading" | "connected" | "failed" | "no_credentials"; gmail?: string; error?: string }>>({});

  async function testSmtp(userId: string) {
    setSmtpStatus((prev) => ({ ...prev, [userId]: { status: "loading" } }));
    try {
      const res = await fetch("/api/admin/test-smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      setSmtpStatus((prev) => ({ ...prev, [userId]: { status: data.status || (data.success ? "connected" : "failed"), gmail: data.gmail, error: data.error } }));
    } catch {
      setSmtpStatus((prev) => ({ ...prev, [userId]: { status: "failed", error: "Netzwerkfehler" } }));
    }
  }

  async function testAllSmtp() {
    const withGmail = azubis.filter((a) => a.gmail_app_password_set && a.user_id);
    for (const a of withGmail) {
      testSmtp(a.user_id!);
    }
  }

  const filtered = useMemo(() => {
    if (!search) return azubis;
    const q = search.toLowerCase();
    return azubis.filter(
      (a) =>
        (a.Namen || "").toLowerCase().includes(q) ||
        (a.Ziel || "").toLowerCase().includes(q) ||
        (a.Email || "").toLowerCase().includes(q)
    );
  }, [azubis, search]);

  async function handleStatusChange(id: number, status: string) {
    setSaving(id);
    try {
      await updateAzubiStatus(id, status);
    } catch (e) {
      alert("Fehler: " + (e as Error).message);
    }
    setSaving(null);
  }

  async function handleVisibilityToggle(id: number, currentVisible: boolean) {
    setSaving(id);
    try {
      await toggleAzubiVisibility(id, !currentVisible);
    } catch (e) {
      alert("Fehler: " + (e as Error).message);
    }
    setSaving(null);
  }

  async function handleActiveToggle(id: number, current: boolean) {
    setSaving(id);
    try {
      await toggleStudentActive(id, !current);
    } catch (e) {
      alert("Fehler: " + (e as Error).message);
    }
    setSaving(null);
  }

  async function handleDailyEmailToggle(id: number, current: boolean) {
    setSaving(id);
    try {
      await toggleDailyEmail(id, !current);
    } catch (e) {
      alert("Fehler: " + (e as Error).message);
    }
    setSaving(null);
  }

  async function handleCreditAction() {
    if (!creditDialog) return;
    const { azubi, mode } = creditDialog;
    setSaving(azubi.id);

    try {
      if (mode === "sperren") {
        await blockStudent(azubi.id);
      } else if (mode === "einmalig") {
        await setOneTimeCredit(azubi.id, parseInt(creditAmount) || 0);
      } else if (mode === "monatlich") {
        await setRecurringCredit(azubi.id, parseInt(creditAmount) || 0);
      }
    } catch (e) {
      alert("Fehler: " + (e as Error).message);
    }

    setSaving(null);
    setCreditDialog(null);
    setCreditAmount("");
  }

  return (
    <div className="space-y-4">
      <Input
        placeholder="Suche nach Name, Beruf oder E-Mail..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-md"
      />

      <div className="flex items-center gap-4">
        <p className="text-sm text-gray-500">{filtered.length} Kandidaten</p>
        <button
          onClick={testAllSmtp}
          className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          Alle SMTP testen
        </button>
      </div>

      {/* Credit Dialog */}
      {creditDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setCreditDialog(null)}>
          <Card className="w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <CardContent className="pt-6 space-y-4">
              <h3 className="text-lg font-semibold">
                Guthaben: {creditDialog.azubi.Namen}
              </h3>
              <p className="text-sm text-gray-500">
                Aktuell: {creditDialog.azubi.monthly_credit || 0} Credits
                {(creditDialog.azubi.credit_auto_refill || 0) > 0 && (
                  <span className="ml-2 text-blue-600">(Monatlich: {creditDialog.azubi.credit_auto_refill})</span>
                )}
              </p>

              <div className="flex gap-2">
                {(["einmalig", "monatlich", "sperren"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setCreditDialog({ ...creditDialog, mode })}
                    className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                      creditDialog.mode === mode
                        ? mode === "sperren"
                          ? "bg-red-600 text-white border-red-600"
                          : "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {mode === "einmalig" ? "Einmalig" : mode === "monatlich" ? "Monatlich" : "Sperren"}
                  </button>
                ))}
              </div>

              {creditDialog.mode !== "sperren" && (
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    {creditDialog.mode === "einmalig" ? "Einmalige Credits:" : "Monatliche Credits:"}
                  </label>
                  <Input
                    type="number"
                    min="0"
                    max="500"
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(e.target.value)}
                    placeholder="z.B. 30"
                    className="mt-1"
                    autoFocus
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    {creditDialog.mode === "einmalig"
                      ? "Wird sofort gesetzt. Kein automatisches Auffüllen."
                      : "Wird sofort gesetzt und jeden Monat automatisch aufgefüllt."}
                  </p>
                </div>
              )}

              {creditDialog.mode === "sperren" && (
                <div className="p-3 bg-red-50 rounded-lg text-sm text-red-700">
                  Credits werden auf 0 gesetzt, Auto-Email deaktiviert und Account gesperrt.
                </div>
              )}

              <div className="flex gap-3 justify-end pt-2">
                <button
                  onClick={() => { setCreditDialog(null); setCreditAmount(""); }}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleCreditAction}
                  disabled={creditDialog.mode !== "sperren" && !creditAmount}
                  className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 ${
                    creditDialog.mode === "sperren"
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  {creditDialog.mode === "sperren" ? "Sperren" : "Speichern"}
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500 bg-gray-50">
              <th className="p-3 font-medium">ID</th>
              <th className="p-3 font-medium">Name</th>
              <th className="p-3 font-medium">Ziel</th>
              <th className="p-3 font-medium">Deutsch</th>
              <th className="p-3 font-medium min-w-[200px]">Status</th>
              <th className="p-3 font-medium text-center">Guthaben</th>
              <th className="p-3 font-medium text-center">Aktiv</th>
              <th className="p-3 font-medium text-center">Auto-Email</th>
              <th className="p-3 font-medium text-center">Gmail</th>
              <th className="p-3 font-medium text-center">SMTP</th>
              <th className="p-3 font-medium text-center">Sichtbar</th>
              <th className="p-3 font-medium text-center">Drive</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((azubi) => {
              const statusColor = getStatusColor(
                (azubi.Aktiv || "").replace(/\n/g, "").trim()
              );
              const isVisible = azubi.sichtbar !== false;
              const isActive = azubi.student_active === true;
              const isDailyEmail = azubi.daily_email_enabled === true;
              const hasGmail = azubi.gmail_app_password_set === true;
              const isSaving = saving === azubi.id;

              return (
                <tr
                  key={azubi.id}
                  className={`border-b hover:bg-gray-50 ${!isVisible ? "opacity-50" : ""} ${isSaving ? "animate-pulse" : ""}`}
                >
                  <td className="p-3 text-gray-500">{azubi["Student ID"]}</td>
                  <td className="p-3 font-medium text-gray-900">
                    {(azubi.Namen || "").trim()}
                  </td>
                  <td className="p-3 text-gray-600 max-w-[200px] truncate">
                    {(azubi.Ziel || "").trim()}
                  </td>
                  <td className="p-3">
                    <Badge variant="outline" className="text-xs">
                      {(azubi["Deutsch Niveau"] || "-").trim().toUpperCase()}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <Select
                      value={(azubi.Aktiv || "").replace(/\n/g, "").trim()}
                      onValueChange={(val) => handleStatusChange(azubi.id, val ?? "")}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue>
                          <span className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${statusColor.dot}`} />
                            {(azubi.Aktiv || "Unbekannt").replace(/\n/g, "").trim()}
                          </span>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  {/* Guthaben */}
                  <td className="p-3 text-center">
                    <button
                      onClick={() => setCreditDialog({ azubi, mode: "einmalig" })}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
                      title="Guthaben verwalten"
                    >
                      <span className="font-mono font-semibold text-blue-700">
                        {azubi.monthly_credit || 0}
                      </span>
                      {(azubi.credit_auto_refill || 0) > 0 && (
                        <span className="text-[10px] text-blue-400">&#x21bb;</span>
                      )}
                    </button>
                  </td>
                  {/* Aktiv */}
                  <td className="p-3 text-center">
                    <button
                      onClick={() => handleActiveToggle(azubi.id, isActive)}
                      className={`w-8 h-5 rounded-full transition-colors relative ${
                        isActive ? "bg-green-500" : "bg-gray-300"
                      }`}
                      title={isActive ? "Account aktiv" : "Account gesperrt"}
                    >
                      <span
                        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                          isActive ? "left-3.5" : "left-0.5"
                        }`}
                      />
                    </button>
                  </td>
                  {/* Auto-Email */}
                  <td className="p-3 text-center">
                    <button
                      onClick={() => handleDailyEmailToggle(azubi.id, isDailyEmail)}
                      className={`w-8 h-5 rounded-full transition-colors relative ${
                        isDailyEmail ? "bg-blue-500" : "bg-gray-300"
                      }`}
                      title={isDailyEmail ? "Auto-Email aktiv" : "Auto-Email deaktiviert"}
                    >
                      <span
                        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                          isDailyEmail ? "left-3.5" : "left-0.5"
                        }`}
                      />
                    </button>
                  </td>
                  {/* Gmail */}
                  <td className="p-3 text-center">
                    <span className={`text-lg ${hasGmail ? "" : "opacity-30"}`} title={hasGmail ? "Gmail verbunden" : "Gmail nicht eingerichtet"}>
                      {hasGmail ? "✅" : "❌"}
                    </span>
                  </td>
                  {/* SMTP Status */}
                  <td className="p-3 text-center">
                    {azubi.user_id && hasGmail ? (
                      (() => {
                        const st = smtpStatus[azubi.user_id!];
                        if (!st) {
                          return (
                            <button
                              onClick={() => testSmtp(azubi.user_id!)}
                              className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                              title="SMTP-Verbindung testen"
                            >
                              Testen
                            </button>
                          );
                        }
                        if (st.status === "loading") {
                          return <span className="text-xs text-gray-400 animate-pulse">Teste...</span>;
                        }
                        if (st.status === "connected") {
                          return (
                            <span className="text-xs text-green-600 font-medium" title={st.gmail || ""}>
                              Verbunden
                            </span>
                          );
                        }
                        if (st.status === "no_credentials") {
                          return <span className="text-xs text-orange-500" title="Keine Zugangsdaten">Keine Daten</span>;
                        }
                        return (
                          <span className="text-xs text-red-600 cursor-help" title={st.error || "Fehler"}>
                            Fehler
                          </span>
                        );
                      })()
                    ) : (
                      <span className="text-gray-300 text-xs">-</span>
                    )}
                  </td>
                  {/* Sichtbar */}
                  <td className="p-3 text-center">
                    <button
                      onClick={() => handleVisibilityToggle(azubi.id, isVisible)}
                      className={`text-lg transition-transform hover:scale-110 ${isSaving ? "pointer-events-none" : ""}`}
                      title={isVisible ? "Klicken um auszublenden" : "Klicken um einzublenden"}
                    >
                      {isVisible ? "👁️" : "🚫"}
                    </button>
                  </td>
                  {/* Drive */}
                  <td className="p-3 text-center">
                    {azubi.drive_folder_id ? (
                      <a
                        href={`https://drive.google.com/drive/folders/${azubi.drive_folder_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline text-xs"
                      >
                        📁
                      </a>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
