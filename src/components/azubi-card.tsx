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
      <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {/* Photo or Initials */}
            <div className="flex-shrink-0">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={azubi.name}
                  className="w-14 h-14 rounded-full object-cover bg-gray-100"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = "none";
                    target.nextElementSibling?.classList.remove("hidden");
                  }}
                />
              ) : null}
              <div
                className={`w-14 h-14 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-lg font-semibold ${photoUrl ? "hidden" : ""}`}
              >
                {getInitials(azubi.name)}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 truncate">
                {azubi.name}
              </h3>
              <p className="text-sm text-gray-600 truncate mt-0.5">
                {azubi.ziel || "Kein Ziel angegeben"}
              </p>
            </div>

            {/* Video indicator */}
            {azubi.videoLink && (
              <span className="text-lg" title="Bewerbungsvideo vorhanden">
                🎬
              </span>
            )}
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            <Badge
              variant="secondary"
              className={`text-xs ${statusColor.bg} ${statusColor.text} border-0`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${statusColor.dot} mr-1`}
              />
              {azubi.aktiv}
            </Badge>
            {azubi.deutschNiveau && (
              <Badge
                variant="secondary"
                className={`text-xs ${niveauColor} border-0`}
              >
                {azubi.deutschNiveau}
              </Badge>
            )}
            {azubi.art && (
              <Badge variant="outline" className="text-xs">
                {azubi.art}
              </Badge>
            )}
          </div>

          {/* Application count */}
          {azubi.bewerbungenCount > 0 && (
            <div className="mt-3 text-xs text-gray-500">
              {azubi.bewerbungenCount.toLocaleString("de-DE")} Bewerbungen
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
