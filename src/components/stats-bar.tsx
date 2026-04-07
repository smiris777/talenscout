"use client";

import { Azubi } from "@/types/database";
import { Card } from "@/components/ui/card";

interface StatsBarProps {
  azubis: Azubi[];
  filteredCount?: number;
}

export function StatsBar({ azubis, filteredCount }: StatsBarProps) {
  const total = azubis.length;
  const aktiv = azubis.filter(
    (a) => a.aktiv.toLowerCase() === "ja"
  ).length;
  const gespraech = azubis.filter((a) =>
    a.aktiv.toLowerCase().includes("vorstellungsgespräch")
  ).length;
  const zusage = azubis.filter((a) =>
    a.aktiv.toLowerCase().includes("zusage")
  ).length;
  const visum = azubis.filter((a) =>
    a.aktiv.toLowerCase().includes("visum")
  ).length;
  const beimKunden = azubis.filter(
    (a) =>
      a.aktiv.toLowerCase().includes("profil beim kunden") ||
      a.aktiv.toLowerCase().includes("lebenslauf beim kunden")
  ).length;

  const stats = [
    { label: "Gesamt", value: total, color: "text-gray-900" },
    { label: "Aktiv", value: aktiv, color: "text-green-600" },
    { label: "Vorstellungsgespräch", value: gespraech, color: "text-blue-600" },
    { label: "Zusage", value: zusage, color: "text-emerald-600" },
    { label: "Visum", value: visum, color: "text-amber-600" },
    { label: "Beim Kunden", value: beimKunden, color: "text-purple-600" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {stats.map((stat) => (
        <Card key={stat.label} className="p-5 rounded-2xl border-0 bg-white/80 backdrop-blur-sm shadow-sm shadow-black/[0.03] hover:shadow-md transition-all duration-300">
          <div className={`text-3xl font-semibold tracking-tight ${stat.color}`}>
            {stat.value}
          </div>
          <div className="text-xs text-gray-400 mt-1.5 font-medium">{stat.label}</div>
        </Card>
      ))}
    </div>
  );
}
