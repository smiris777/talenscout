"use client";

import { useEffect, useState } from "react";

interface Counts {
  auto: number;
  scan: number;
  manual: number;
  total: number;
}

interface StatsResponse {
  scope: "admin" | "student";
  today: Counts;
  week: Counts;
  month: Counts;
  all: Counts;
  error?: string;
}

const SOURCE_LABELS = {
  auto: { label: "🤖 Auto", color: "text-indigo-600" },
  scan: { label: "📸 Scan", color: "text-orange-600" },
  manual: { label: "✍️ Manuell", color: "text-emerald-600" },
} as const;

function Row({ label, counts }: { label: string; counts: Counts }) {
  return (
    <div className="grid grid-cols-5 items-center gap-2 py-2 border-b border-gray-100 last:border-0">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className="text-center">
        <div className="text-xs text-gray-400">{SOURCE_LABELS.auto.label}</div>
        <div className={`text-sm font-semibold ${SOURCE_LABELS.auto.color}`}>{counts.auto}</div>
      </div>
      <div className="text-center">
        <div className="text-xs text-gray-400">{SOURCE_LABELS.manual.label}</div>
        <div className={`text-sm font-semibold ${SOURCE_LABELS.manual.color}`}>{counts.manual}</div>
      </div>
      <div className="text-center">
        <div className="text-xs text-gray-400">{SOURCE_LABELS.scan.label}</div>
        <div className={`text-sm font-semibold ${SOURCE_LABELS.scan.color}`}>{counts.scan}</div>
      </div>
      <div className="text-center">
        <div className="text-xs text-gray-400">Total</div>
        <div className="text-sm font-bold text-gray-800">{counts.total}</div>
      </div>
    </div>
  );
}

export function SourceStats({ title = "Bewerbungs-Statistik" }: { title?: string }) {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/stats/sources")
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setData({ error: "Fehler" } as StatsResponse); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        {data?.scope && (
          <span className="text-[10px] text-gray-400 uppercase tracking-wider">
            {data.scope === "admin" ? "Alle Studenten" : "Mein Account"}
          </span>
        )}
      </div>

      {loading ? (
        <div className="py-6 text-center">
          <div className="inline-block w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : data?.error ? (
        <div className="py-3 text-sm text-red-600">Fehler beim Laden: {data.error}</div>
      ) : data ? (
        <div className="space-y-0">
          <Row label="Heute" counts={data.today} />
          <Row label="Diese Woche" counts={data.week} />
          <Row label="Dieser Monat" counts={data.month} />
          <Row label="Gesamt" counts={data.all} />
        </div>
      ) : null}
    </div>
  );
}
