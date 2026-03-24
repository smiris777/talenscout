"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff } from "lucide-react";

export default function EmailSetup() {
  const [email, setEmail] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [showPassword, setShowPassword] = useState(true);
  const [status, setStatus] = useState<"idle" | "testing" | "saving" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleTest() {
    if (!email || !appPassword) {
      setMessage("Bitte E-Mail und App-Passwort eingeben.");
      setStatus("error");
      return;
    }
    setStatus("testing");
    setMessage("");
    try {
      const res = await fetch("/api/email/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, appPassword }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus("success");
        setMessage("Verbindung erfolgreich! Du kannst jetzt speichern.");
      } else {
        setStatus("error");
        setMessage(data.error || "Verbindung fehlgeschlagen.");
      }
    } catch {
      setStatus("error");
      setMessage("Netzwerkfehler. Bitte versuche es erneut.");
    }
  }

  async function handleSave() {
    if (!email || !appPassword) return;
    setStatus("saving");
    try {
      const res = await fetch("/api/email/save-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, appPassword }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus("success");
        setMessage("Gmail-Konto erfolgreich gespeichert!");
      } else {
        setStatus("error");
        setMessage(data.error || "Speichern fehlgeschlagen.");
      }
    } catch {
      setStatus("error");
      setMessage("Netzwerkfehler.");
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">E-Mail Einrichten</h1>
        <p className="text-gray-500 mt-1">Verbinde dein Gmail-Konto für automatische Bewerbungen</p>
      </div>

      {/* Anleitung */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Anleitung: Gmail App-Passwort erstellen</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 text-sm text-gray-600">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-xs font-medium">1</span>
              <span>Öffne <a href="https://myaccount.google.com/security" target="_blank" rel="noopener" className="text-blue-600 hover:underline">Google Konto Sicherheit</a></span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-xs font-medium">2</span>
              <span>Aktiviere die <strong>2-Faktor-Authentifizierung</strong> (falls nicht aktiv)</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-xs font-medium">3</span>
              <span>Gehe zu <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener" className="text-blue-600 hover:underline">App-Passwörter</a></span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-xs font-medium">4</span>
              <span>Erstelle ein neues App-Passwort (Name: z.B. &quot;SMIRIS&quot;)</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-xs font-medium">5</span>
              <span>Kopiere das <strong>16-stellige Passwort</strong> und füge es unten ein</span>
            </li>
          </ol>
        </CardContent>
      </Card>

      {/* Eingabe */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gmail-Zugangsdaten</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label htmlFor="gmail" className="text-sm font-medium text-gray-700">Gmail-Adresse</label>
              <Input
                id="gmail"
                type="email"
                placeholder="deine.email@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label htmlFor="apppass" className="text-sm font-medium text-gray-700">App-Passwort (16-stellig)</label>
              <div className="relative mt-1">
                <Input
                  id="apppass"
                  type={showPassword ? "text" : "password"}
                  placeholder="xxxx xxxx xxxx xxxx"
                  value={appPassword}
                  onChange={(e) => setAppPassword(e.target.value)}
                  maxLength={19}
                  className="font-mono pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {message && (
              <div className={`p-3 rounded-lg text-sm ${
                status === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
              }`}>
                {message}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleTest}
                disabled={status === "testing" || status === "saving"}
                className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50"
              >
                {status === "testing" ? "Teste..." : "Verbindung testen"}
              </button>
              <button
                onClick={handleSave}
                disabled={status === "testing" || status === "saving" || !email || !appPassword}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {status === "saving" ? "Speichere..." : "Speichern"}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
