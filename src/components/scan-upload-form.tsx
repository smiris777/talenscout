"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveJobListing } from "@/app/actions/job-listings";

interface OcrResult {
  scan_image_url: string;
  company_name: string;
  job_title: string;
  location: string;
  contact_email: string;
  phone: string;
  deadline: string | null;
}

export function ScanUploadForm() {
  const [preview, setPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<OcrResult | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    setMessage(null);

    // Preview
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleScan() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setScanning(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch("/api/scan/ocr", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Scan fehlgeschlagen" });
        return;
      }

      setResult(data);
    } catch {
      setMessage({ type: "error", text: "Scan fehlgeschlagen. Bitte erneut versuchen." });
    } finally {
      setScanning(false);
    }
  }

  async function handleSave() {
    if (!result) return;
    setSaving(true);
    setMessage(null);
    try {
      await saveJobListing({
        company_name: result.company_name,
        job_title: result.job_title || undefined,
        location: result.location || undefined,
        contact_email: result.contact_email || undefined,
        phone: result.phone || undefined,
        deadline: result.deadline || undefined,
        scan_image_url: result.scan_image_url || undefined,
      });
      setMessage({ type: "success", text: "Firma gespeichert! 30-Tage-Countdown gestartet." });
      setResult(null);
      setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Speichern fehlgeschlagen" });
    } finally {
      setSaving(false);
    }
  }

  function updateField(field: keyof OcrResult, value: string) {
    if (!result) return;
    setResult({ ...result, [field]: value });
  }

  return (
    <div className="space-y-6">
      {/* Upload Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-2xl">📸</span> Stellenanzeige scannen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-500">
            Fotografiere oder lade einen Screenshot einer Stellenanzeige hoch. Die KI extrahiert automatisch alle Firmendaten.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
              />
            </div>
            <Button
              onClick={handleScan}
              disabled={!preview || scanning}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {scanning ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⏳</span> Wird gescannt...
                </span>
              ) : (
                <span className="flex items-center gap-2">🔍 Scannen</span>
              )}
            </Button>
          </div>

          {/* Image Preview */}
          {preview && (
            <div className="border rounded-lg overflow-hidden max-h-64 flex items-center justify-center bg-gray-50">
              <img src={preview} alt="Vorschau" className="max-h-64 object-contain" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg text-sm ${
          message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
        }`}>
          {message.text}
        </div>
      )}

      {/* OCR Result Form */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-2xl">✏️</span> Erkannte Daten prüfen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-500">
              Überprüfe und korrigiere die erkannten Felder, dann speichere die Firma.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Firmenname <span className="text-red-500">*</span>
                </label>
                <Input
                  value={result.company_name}
                  onChange={(e) => updateField("company_name", e.target.value)}
                  placeholder="z.B. Muster GmbH"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stellenbezeichnung</label>
                <Input
                  value={result.job_title}
                  onChange={(e) => updateField("job_title", e.target.value)}
                  placeholder="z.B. Ausbildung Elektroniker"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ort / Adresse</label>
                <Input
                  value={result.location}
                  onChange={(e) => updateField("location", e.target.value)}
                  placeholder="z.B. Berlin 10115"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
                <Input
                  value={result.contact_email}
                  onChange={(e) => updateField("contact_email", e.target.value)}
                  placeholder="bewerbung@firma.de"
                  type="email"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                <Input
                  value={result.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  placeholder="+49 30 123456"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bewerbungsfrist</label>
                <Input
                  value={result.deadline || ""}
                  onChange={(e) => updateField("deadline", e.target.value)}
                  type="date"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleSave}
                disabled={!result.company_name || saving}
                className="bg-green-600 hover:bg-green-700"
              >
                {saving ? "Wird gespeichert..." : "💾 Firma speichern (30-Tage-Phase)"}
              </Button>
              <Button
                variant="outline"
                onClick={() => { setResult(null); setPreview(null); if (fileRef.current) fileRef.current.value = ""; }}
              >
                Abbrechen
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
