"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { updateJobRating, updateJobNotes, deleteJobListing, applyToJobListing } from "@/app/actions/job-listings";
import type { JobListing } from "@/types/database";

interface Props {
  listings: JobListing[];
}

function daysLeft(expiresAt: string): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000));
}

function StarRating({ rating, onChange }: { rating: number; onChange: (r: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onClick={() => onChange(star)}
          className={`text-lg transition-colors ${star <= rating ? "text-yellow-400" : "text-gray-300"} hover:text-yellow-400`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function ListingCard({ listing }: { listing: JobListing }) {
  const [notes, setNotes] = useState(listing.notes || "");
  const [loading, setLoading] = useState<string | null>(null);
  const [applied, setApplied] = useState(listing.applied || false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const days = daysLeft(listing.expires_at);

  async function handleRate(rating: number) {
    try { await updateJobRating(listing.id, rating); } catch {}
  }

  async function handleNotesBlur() {
    if (notes !== (listing.notes || "")) {
      try { await updateJobNotes(listing.id, notes); } catch {}
    }
  }

  async function handleDelete() {
    if (!confirm(`"${listing.company_name}" wirklich löschen?`)) return;
    setLoading("delete");
    try { await deleteJobListing(listing.id); } catch { setLoading(null); }
  }

  async function handleApply() {
    if (!listing.contact_email) {
      setMessage({ type: "error", text: "Keine E-Mail-Adresse vorhanden. Bitte ergänzen." });
      return;
    }
    setLoading("apply");
    setMessage(null);
    try {
      const result = await applyToJobListing(listing.id);
      if (result.status === "success") {
        setApplied(true);
        setMessage({ type: "success", text: "✅ Bewerbung gesendet!" });
      } else {
        setMessage({ type: "error", text: result.message });
      }
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Bewerbung fehlgeschlagen" });
    } finally {
      setLoading(null);
    }
  }

  return (
    <Card className={`overflow-hidden ${applied ? "border-green-300 bg-green-50/30" : ""}`}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">{listing.company_name}</h3>
            {listing.job_title && <p className="text-sm text-gray-500">{listing.job_title}</p>}
          </div>
          <div className="flex flex-col items-end gap-1">
            {applied && (
              <Badge className="bg-green-500 text-white whitespace-nowrap">
                ✅ Beworben
              </Badge>
            )}
            <Badge variant="outline" className="whitespace-nowrap text-xs text-gray-400">
              Gescannt {new Date(listing.created_at).toLocaleDateString("de-DE")}
            </Badge>
          </div>
        </div>

        {/* Details */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          {listing.location && (
            <div className="flex items-center gap-1 text-gray-600">
              <span>📍</span> {listing.location}
            </div>
          )}
          {listing.contact_email && (
            <div className="flex items-center gap-1 text-gray-600">
              <span>📧</span> {listing.contact_email}
            </div>
          )}
          {listing.phone && (
            <div className="flex items-center gap-1 text-gray-600">
              <span>📞</span> <a href={`tel:${listing.phone}`} className="hover:underline">{listing.phone}</a>
            </div>
          )}
          {listing.deadline && (
            <div className="flex items-center gap-1 text-gray-600">
              <span>📅</span> Frist: {new Date(listing.deadline).toLocaleDateString("de-DE")}
            </div>
          )}
        </div>

        {/* Rating */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">Bewertung:</span>
          <StarRating rating={listing.rating} onChange={handleRate} />
        </div>

        {/* Notes */}
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={handleNotesBlur}
          placeholder="Notizen zur Firma..."
          className="w-full text-sm border rounded-lg p-2 resize-none h-16 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {/* Message */}
        {message && (
          <div className={`p-2 rounded text-xs ${message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            {message.text}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          {!applied ? (
            <Button
              size="sm"
              onClick={handleApply}
              disabled={loading !== null}
              className="bg-green-600 hover:bg-green-700 text-xs flex-1"
            >
              {loading === "apply" ? (
                <span className="flex items-center gap-1"><span className="animate-spin">⏳</span> Bewerbung wird gesendet...</span>
              ) : (
                "📨 Jetzt bewerben"
              )}
            </Button>
          ) : (
            <Button size="sm" disabled className="bg-gray-200 text-gray-500 text-xs flex-1">
              ✅ Bewerbung gesendet
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={handleDelete}
            disabled={loading !== null}
            className="text-red-600 border-red-200 hover:bg-red-50 text-xs"
          >
            {loading === "delete" ? "..." : "🗑️"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function JobListingsView({ listings }: Props) {
  if (listings.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="text-4xl mb-3">📋</div>
          <h3 className="font-medium text-gray-900 mb-1">Keine gescannten Firmen</h3>
          <p className="text-sm text-gray-500">
            Scanne eine Stellenanzeige, um deine private Firmenliste aufzubauen.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {listings.map((listing) => (
        <ListingCard key={listing.id} listing={listing} />
      ))}
    </div>
  );
}
