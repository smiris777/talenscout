"use client";

import Link from "next/link";
import { Azubi } from "@/types/database";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getStatusColor,
  getNiveauColor,
  getGDriveThumbnailUrl,
  getInitials,
} from "@/lib/utils/normalize";

interface AzubiCardProps {
  azubi: Azubi;
}

export function AzubiCard({ azubi }: AzubiCardProps) {
  const statusColor = getStatusColor(azubi.aktiv);
  const niveauColor = getNiveauColor(azubi.deutschNiveau);
  const photoUrl = getGDriveThumbnailUrl(azubi.fotoLink);

  return (
    <Link href={`/azubi/${azubi.id}`}>
      <Card className="hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 cursor-pointer h-full rounded-2xl border-0 bg-white/80 backdrop-blur-sm shadow-sm shadow-black/[0.03]">
        <CardContent className="p-5">
          <div className="flex items-start gap-3.5">
            {/* Photo or Initials */}
            <div className="flex-shrink-0">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={azubi.name}
                  className="w-12 h-12 rounded-2xl object-cover bg-gray-100"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = "none";
                    target.nextElementSibling?.classList.remove("hidden");
                  }}
                />
              ) : null}
              <div
                className={`w-12 h-12 rounded-2xl bg-gray-100 text-gray-500 flex items-center justify-center text-base font-semibold ${photoUrl ? "hidden" : ""}`}
              >
                {getInitials(azubi.name)}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-[#1d1d1f] truncate text-[15px]">
                {azubi.name}
              </h3>
              <p className="text-sm text-gray-400 truncate mt-0.5">
                {azubi.ziel || "Kein Ziel angegeben"}
              </p>
            </div>

            {/* Video indicator */}
            {azubi.videoLink && (
              <span className="text-sm opacity-40" title="Bewerbungsvideo vorhanden">
                🎬
              </span>
            )}
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-1.5 mt-3.5">
            <Badge
              variant="secondary"
              className={`text-xs rounded-full ${statusColor.bg} ${statusColor.text} border-0`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${statusColor.dot} mr-1`}
              />
              {azubi.aktiv}
            </Badge>
            {azubi.deutschNiveau && (
              <Badge
                variant="secondary"
                className={`text-xs rounded-full ${niveauColor} border-0`}
              >
                {azubi.deutschNiveau}
              </Badge>
            )}
            {azubi.art && (
              <Badge variant="outline" className="text-xs rounded-full border-gray-200/80">
                {azubi.art}
              </Badge>
            )}
          </div>

          {/* Application count */}
          {azubi.bewerbungenCount > 0 && (
            <div className="mt-3.5 text-xs text-gray-400 font-medium">
              {azubi.bewerbungenCount.toLocaleString("de-DE")} Bewerbungen
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
