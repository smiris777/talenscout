"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function ManualBewerbungForm() {
  const [firmenname, setFirmenname] = useState("");
  const [email, setEmail] = useState("");
  const [ansprechpartner, setAnsprechpartner] = useState("");
  const [geschlecht, setGeschlecht] = useState("");
  const [customEinleitung, setCustomEinleitung] = useState("");
  const [customMotivation, setCustomMotivation] = useState("");
  const [accentColor, setAccentColor] = useState("#2563eb");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error" | "previewing">("idle");
  const [message, setMessage] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialPreviewLoaded = useRef(false);

  const loadPreview = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const res = await fetch("/api/email/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firmenname: firmenname || "Muster GmbH",
          ansprechpartner,
          geschlecht,
          customEinleitung: customEinleitung || undefined,
          customMotivation: customMotivation || undefined,
          accentColor,
        }),
      });
      const data = await res.json();
      if (data.html) {
        setPreviewHtml(data.html);
        if (!initialPreviewLoaded.current) {
          initialPreviewLoaded.current = true;
          if (!customEinleitung && data.einleitung) setCustomEinleitung(data.einleitung);
          if (!customMotivation && data.motivationAngepasst) setCustomMotivation(data.motivationAngepasst);
        }
      }
    } catch {
      // Silent fail for auto-preview
    }
    setPreviewLoading(false);
  }, [firmenname, ansprechpartner, geschlecht, customEinleitung, customMotivation, accentColor]);

  // Auto-preview with debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      loadPreview();
    }, 800);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [firmenname, ansprechpartner, geschlecht, customEinleitung, customMotivation, accentColor, loadPreview]);

  async function handleSend() {
    if (!firmenname || !email) {
      setMessage("Firmenname und E-Mail sind erforderlich.");
      setStatus("error");
      return;
    }
    setStatus("sending");
    setMessage("");
    try {
      const res = await fetch("/api/email/send-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firmenname, email, ansprechpartner, geschlecht }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus("success");
        setMessage(data.message);
        setFirmenname("");
        setEmail("");
        setAnsprechpartner("");
        setGeschlecht("");
        setPreviewHtml("");
        initialPreviewLoaded.current = false;
      } else {
        setStatus("error");
        setMessage(data.error || "Fehler beim Senden.");
      }
    } catch {
      setStatus("error");
      setMessage("Netzwerkfehler. Bitte versuche es erneut.");
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Left: Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Manuelle Bewerbung senden</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Firmenname *</label>
              <Input
                placeholder="z.B. Muster GmbH"
                value={firmenname}
                onChange={(e) => setFirmenname(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">E-Mail der Firma *</label>
              <Input
                type="email"
                placeholder="bewerbung@firma.de"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Ansprechpartner</label>
              <Input
                placeholder="Müller"
                value={ansprechpartner}
                onChange={(e) => setAnsprechpartner(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Geschlecht</label>
              <select
                value={geschlecht}
                onChange={(e) => setGeschlecht(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">-- Wählen --</option>
                <option value="m">Herr</option>
                <option value="w">Frau</option>
              </select>
            </div>
          </div>

          {/* Text anpassen */}
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm font-medium text-gray-700 mb-3">Text anpassen (optional)</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500">Einleitung</label>
                <textarea
                  value={customEinleitung}
                  onChange={(e) => setCustomEinleitung(e.target.value)}
                  placeholder="Wird automatisch per KI generiert wenn leer..."
                  rows={2}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm resize-none"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Motivationstext</label>
                <textarea
                  value={customMotivation}
                  onChange={(e) => setCustomMotivation(e.target.value)}
                  placeholder="Wird automatisch per KI generiert wenn leer..."
                  rows={3}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm resize-none"
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs text-gray-500">Akzentfarbe</label>
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="h-8 w-8 rounded cursor-pointer border-0"
                />
                <span className="text-xs text-gray-400">{accentColor}</span>
              </div>
            </div>
          </div>

          {message && (
            <div className={`mt-4 p-3 rounded-lg text-sm ${
              status === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
            }`}>
              {message}
            </div>
          )}

          <div className="flex gap-3 mt-4">
            <button
              onClick={handleSend}
              disabled={status === "sending" || !firmenname || !email}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {status === "sending" ? "Wird gesendet..." : "Bewerbung senden"}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Right: Live Preview */}
      <Card className="lg:sticky lg:top-4 self-start">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Email-Vorschau
            {previewLoading && (
              <span className="inline-block w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {previewHtml ? (
            <div className="border rounded-lg overflow-hidden bg-gray-100">
              <div className="bg-gray-200 px-4 py-2 text-xs text-gray-500 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-400" />
                <span className="w-3 h-3 rounded-full bg-yellow-400" />
                <span className="w-3 h-3 rounded-full bg-green-400" />
                <span className="ml-2 truncate">Bewerbung - {firmenname || "Firma"}</span>
              </div>
              <iframe
                srcDoc={previewHtml}
                className="w-full border-0"
                style={{ height: "600px" }}
                title="Email Vorschau"
              />
            </div>
          ) : (
            <div className="h-[400px] flex items-center justify-center text-gray-400 text-sm border rounded-lg bg-gray-50">
              {previewLoading ? "Vorschau wird geladen..." : "Vorschau wird automatisch geladen..."}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
