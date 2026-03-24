"use client";

import { Azubi } from "@/types/database";
import { AzubiCard } from "@/components/azubi-card";

interface AzubiGridProps {
  azubis: Azubi[];
}

export function AzubiGrid({ azubis }: AzubiGridProps) {
  if (azubis.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-4xl mb-4">🔍</div>
        <h3 className="text-lg font-medium text-gray-900">
          Keine Ergebnisse
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          Versuche andere Suchbegriffe oder Filter.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {azubis.map((azubi) => (
        <AzubiCard key={azubi.id} azubi={azubi} />
      ))}
    </div>
  );
}
