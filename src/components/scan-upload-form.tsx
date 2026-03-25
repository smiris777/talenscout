"use client";

import { useState, useRef, useCallback } from "react";
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

interface ImageItem {
  file: File;
  preview: string;
  status: "pending" | "scanning" | "scanned" | "saving" | "saved" | "error";
  result?: OcrResult;
  error?: string;
}

const MAX_IMAGES = 10;

export function ScanUploadForm() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [scanningAll, setScanningAll] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  // Handle file selection (multiple)
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    addFiles(files);
    if (fileRef.current) fileRef.current.value = "";
  }

  function addFiles(files: File[]) {
    setMessage(null);
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      setMessage({ type: "error", text: `Maximal ${MAX_IMAGES} Bilder gleichzeitig erlaubt.` });
      return;
    }

    const validFiles = files
      .filter(f => f.type.startsWith("image/"))
      .slice(0, remaining);

    if (validFiles.length < files.length) {
      setMessage({ type: "error", text: `Nur Bilddateien erlaubt. Max. ${MAX_IMAGES} Bilder.` });
    }

    const newItems: ImageItem[] = [];
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const item: ImageItem = {
          file,
          preview: ev.target?.result as string,
          status: "pending",
        };
        setImages(prev => {
          const updated = [...prev, item];
          if (prev.length === 0) setActiveIndex(0);
          return updated;
        });
      };
      reader.readAsDataURL(file);
    });
  }

  // Drag & Drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
  }, [images.length]);

  function removeImage(index: number) {
    setImages(prev => prev.filter((_, i) => i !== index));
    if (activeIndex === index) setActiveIndex(null);
    else if (activeIndex !== null && activeIndex > index) setActiveIndex(activeIndex - 1);
  }

  // Scan single image
  async function scanImage(index: number) {
    const img = images[index];
    if (!img || img.status === "scanning") return;

    setImages(prev => prev.map((item, i) => i === index ? { ...item, status: "scanning", error: undefined } : item));

    try {
      const formData = new FormData();
      formData.append("image", img.file);
      const res = await fetch("/api/scan/ocr", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setImages(prev => prev.map((item, i) => i === index ? { ...item, status: "error", error: data.error || "Scan fehlgeschlagen" } : item));
        return;
      }

      setImages(prev => prev.map((item, i) => i === index ? { ...item, status: "scanned", result: data } : item));
      setActiveIndex(index);
    } catch {
      setImages(prev => prev.map((item, i) => i === index ? { ...item, status: "error", error: "Scan fehlgeschlagen" } : item));
    }
  }

  // Scan ALL images
  async function scanAll() {
    setScanningAll(true);
    setMessage(null);
    const pending = images.map((img, i) => img.status === "pending" || img.status === "error" ? i : -1).filter(i => i >= 0);

    for (const idx of pending) {
      await scanImage(idx);
    }
    setScanningAll(false);
    setMessage({ type: "success", text: `${pending.length} Bilder gescannt!` });
  }

  // Save single result
  async function handleSave(index: number) {
    const img = images[index];
    if (!img?.result) return;

    setImages(prev => prev.map((item, i) => i === index ? { ...item, status: "saving" } : item));

    try {
      await saveJobListing({
        company_name: img.result.company_name,
        job_title: img.result.job_title || undefined,
        location: img.result.location || undefined,
        contact_email: img.result.contact_email || undefined,
        phone: img.result.phone || undefined,
        deadline: img.result.deadline || undefined,
        scan_image_url: img.result.scan_image_url || undefined,
      });
      setImages(prev => prev.map((item, i) => i === index ? { ...item, status: "saved" } : item));
    } catch (err) {
      setImages(prev => prev.map((item, i) => i === index ? { ...item, status: "error", error: err instanceof Error ? err.message : "Speichern fehlgeschlagen" } : item));
    }
  }

  // Save ALL scanned results
  async function saveAll() {
    const scanned = images.map((img, i) => img.status === "scanned" && img.result?.company_name ? i : -1).filter(i => i >= 0);
    for (const idx of scanned) {
      await handleSave(idx);
    }
    const savedCount = scanned.length;
    setMessage({ type: "success", text: `${savedCount} Firmen gespeichert! 30-Tage-Countdown gestartet.` });
  }

  function updateField(index: number, field: keyof OcrResult, value: string) {
    setImages(prev => prev.map((item, i) => {
      if (i !== index || !item.result) return item;
      return { ...item, result: { ...item.result, [field]: value } };
    }));
  }

  function clearAll() {
    setImages([]);
    setActiveIndex(null);
    setMessage(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  const pendingCount = images.filter(i => i.status === "pending" || i.status === "error").length;
  const scannedCount = images.filter(i => i.status === "scanned").length;
  const savedCount = images.filter(i => i.status === "saved").length;
  const activeResult = activeIndex !== null ? images[activeIndex] : null;

  return (
    <div className="space-y-6">
      {/* Upload Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-2xl">📸</span> Stellenanzeigen scannen
            <span className="text-sm font-normal text-gray-400 ml-2">
              ({images.length}/{MAX_IMAGES})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-500">
            Lade bis zu {MAX_IMAGES} Screenshots gleichzeitig hoch. Die KI extrahiert automatisch alle Firmendaten.
          </p>

          {/* Drop Zone */}
          <div
            ref={dropRef}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-blue-400 hover:bg-blue-50/50 transition-colors cursor-pointer"
            onClick={() => fileRef.current?.click()}
          >
            <div className="text-4xl mb-2">📎</div>
            <p className="text-sm text-gray-600 font-medium">
              Bilder hierher ziehen oder klicken zum Auswählen
            </p>
            <p className="text-xs text-gray-400 mt-1">
              JPG, PNG, WebP • Max. {MAX_IMAGES} Bilder • Kamera oder Galerie
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Image Thumbnails Grid */}
          {images.length > 0 && (
            <div className="space-y-3">
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                {images.map((img, i) => (
                  <div
                    key={i}
                    onClick={() => setActiveIndex(i)}
                    className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 aspect-square transition-all ${
                      activeIndex === i ? "border-blue-500 ring-2 ring-blue-200" :
                      img.status === "saved" ? "border-green-400" :
                      img.status === "scanned" ? "border-yellow-400" :
                      img.status === "error" ? "border-red-400" :
                      img.status === "scanning" ? "border-blue-300 animate-pulse" :
                      "border-gray-200"
                    }`}
                  >
                    <img src={img.preview} alt={`Bild ${i + 1}`} className="w-full h-full object-cover" />

                    {/* Status Badge */}
                    <div className="absolute bottom-0 left-0 right-0 text-center text-[10px] font-bold py-0.5" style={{
                      backgroundColor: img.status === "saved" ? "#22c55e" :
                        img.status === "scanned" ? "#eab308" :
                        img.status === "scanning" ? "#3b82f6" :
                        img.status === "error" ? "#ef4444" : "#9ca3af",
                      color: "white",
                    }}>
                      {img.status === "pending" && "Bereit"}
                      {img.status === "scanning" && "⏳"}
                      {img.status === "scanned" && "✓ Erkannt"}
                      {img.status === "saving" && "💾"}
                      {img.status === "saved" && "✅ Gespeichert"}
                      {img.status === "error" && "❌ Fehler"}
                    </div>

                    {/* Remove Button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); removeImage(i); }}
                      className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    >
                      ×
                    </button>
                  </div>
                ))}

                {/* Add More Button */}
                {images.length < MAX_IMAGES && (
                  <div
                    onClick={() => fileRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 rounded-lg aspect-square flex items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                  >
                    <span className="text-2xl text-gray-400">+</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2">
                {pendingCount > 0 && (
                  <Button
                    onClick={scanAll}
                    disabled={scanningAll}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {scanningAll ? (
                      <span className="flex items-center gap-2">
                        <span className="animate-spin">⏳</span> Scanne {pendingCount} Bilder...
                      </span>
                    ) : (
                      <span>🔍 Alle scannen ({pendingCount})</span>
                    )}
                  </Button>
                )}
                {scannedCount > 0 && (
                  <Button onClick={saveAll} className="bg-green-600 hover:bg-green-700">
                    💾 Alle speichern ({scannedCount})
                  </Button>
                )}
                <Button variant="outline" onClick={clearAll}>
                  🗑️ Alle entfernen
                </Button>
                {savedCount > 0 && (
                  <span className="text-sm text-green-600 font-medium flex items-center">
                    ✅ {savedCount} gespeichert
                  </span>
                )}
              </div>
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

      {/* OCR Result Form for selected image */}
      {activeResult?.result && activeResult.status !== "saved" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-2xl">✏️</span> Erkannte Daten prüfen
              <span className="text-sm font-normal text-gray-400 ml-2">
                (Bild {(activeIndex ?? 0) + 1} von {images.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Preview of selected image */}
            <div className="border rounded-lg overflow-hidden max-h-48 flex items-center justify-center bg-gray-50">
              <img src={activeResult.preview} alt="Vorschau" className="max-h-48 object-contain" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Firmenname <span className="text-red-500">*</span>
                </label>
                <Input
                  value={activeResult.result.company_name}
                  onChange={(e) => updateField(activeIndex!, "company_name", e.target.value)}
                  placeholder="z.B. Muster GmbH"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stellenbezeichnung</label>
                <Input
                  value={activeResult.result.job_title}
                  onChange={(e) => updateField(activeIndex!, "job_title", e.target.value)}
                  placeholder="z.B. Ausbildung Elektroniker"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ort / Adresse</label>
                <Input
                  value={activeResult.result.location}
                  onChange={(e) => updateField(activeIndex!, "location", e.target.value)}
                  placeholder="z.B. Berlin 10115"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
                <Input
                  value={activeResult.result.contact_email}
                  onChange={(e) => updateField(activeIndex!, "contact_email", e.target.value)}
                  placeholder="bewerbung@firma.de"
                  type="email"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                <Input
                  value={activeResult.result.phone}
                  onChange={(e) => updateField(activeIndex!, "phone", e.target.value)}
                  placeholder="+49 30 123456"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bewerbungsfrist</label>
                <Input
                  value={activeResult.result.deadline || ""}
                  onChange={(e) => updateField(activeIndex!, "deadline", e.target.value)}
                  type="date"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                onClick={() => handleSave(activeIndex!)}
                disabled={!activeResult.result.company_name || activeResult.status === "saving"}
                className="bg-green-600 hover:bg-green-700"
              >
                {activeResult.status === "saving" ? "Wird gespeichert..." : "💾 Firma speichern"}
              </Button>
              {/* Navigate between scanned images */}
              {images.filter(i => i.status === "scanned").length > 1 && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const prev = images.findIndex((img, i) => i < activeIndex! && img.status === "scanned");
                      if (prev >= 0) setActiveIndex(prev);
                    }}
                  >
                    ← Vorherige
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const next = images.findIndex((img, i) => i > activeIndex! && img.status === "scanned");
                      if (next >= 0) setActiveIndex(next);
                    }}
                  >
                    Nächste →
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
