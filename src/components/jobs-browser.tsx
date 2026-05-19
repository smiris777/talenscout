"use client";

import { useCallback, useEffect, useState } from "react";

interface Job {
  id: number;
  firmenname: string | null;
  email: string | null;
  telefonnummer: string | null;
  bereich: string | null;
  ansprechpartner: string | null;
  geschlecht: string | null;
  zusatzinfo: string | null;
  created_at: string | null;
  alreadyApplied: boolean;
}

interface ListResponse {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  studentZiel: string | null;
  jobs: Job[];
}

const AGE_OPTIONS = [
  { value: 0, label: "Egal" },
  { value: 7, label: "Letzte 7 Tage" },
  { value: 30, label: "Letzte 30 Tage" },
  { value: 90, label: "Letzte 90 Tage" },
];

function formatAge(iso: string | null): { label: string; fresh: boolean } {
  if (!iso) return { label: "unbekannt", fresh: false };
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return { label: "heute", fresh: true };
  if (days === 1) return { label: "gestern", fresh: true };
  if (days <= 7) return { label: `vor ${days} Tagen`, fresh: true };
  if (days <= 30) return { label: `vor ${days} Tagen`, fresh: false };
  if (days <= 90) return { label: `vor ${Math.floor(days / 7)} Wochen`, fresh: false };
  return { label: `vor ${Math.floor(days / 30)} Monaten`, fresh: false };
}

export function JobsBrowser() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [maxAgeDays, setMaxAgeDays] = useState(0);
  const [onlyMyBereich, setOnlyMyBereich] = useState(true);
  const [onlyNew, setOnlyNew] = useState(true);

  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Per-Job apply state
  const [applying, setApplying] = useState<number | null>(null);
  const [appliedNow, setAppliedNow] = useState<Set<number>>(new Set());
  const [errors, setErrors] = useState<Record<number, string>>({});

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      if (search) params.set("q", search);
      if (maxAgeDays > 0) params.set("maxAgeDays", String(maxAgeDays));
      if (onlyMyBereich) params.set("onlyMine", "1");
      if (onlyNew) params.set("onlyNew", "1");
      const res = await fetch(`/api/jobs/list?${params}`);
      const json: ListResponse = await res.json();
      setData(json);
    } catch {
      setData(null);
    }
    setLoading(false);
  }, [page, search, maxAgeDays, onlyMyBereich, onlyNew]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  async function handleApply(job: Job) {
    if (!job.email || !job.firmenname) return;
    setApplying(job.id);
    setErrors((prev) => {
      const next = { ...prev };
      delete next[job.id];
      return next;
    });
    try {
      const res = await fetch("/api/email/send-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firmenname: job.firmenname,
          email: job.email,
          ansprechpartner: job.ansprechpartner ?? "",
          geschlecht: job.geschlecht ?? "",
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErrors((prev) => ({ ...prev, [job.id]: json.error || "Fehler" }));
      } else {
        setAppliedNow((prev) => new Set(prev).add(job.id));
      }
    } catch (e) {
      setErrors((prev) => ({ ...prev, [job.id]: (e as Error).message }));
    }
    setApplying(null);
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  }

  const jobs = data?.jobs ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Jobs durchsuchen</h1>
        <p className="text-gray-500 mt-1">
          {data?.studentZiel ? (
            <>Firmen aus dem Pool — gefiltert nach deinem Ziel: <span className="font-medium">{data.studentZiel}</span></>
          ) : (
            "Firmen aus dem Pool"
          )}
        </p>
      </div>

      {/* Filter-Leiste */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4 space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Suche nach Firma oder Beruf …"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
          >
            Suchen
          </button>
          {search && (
            <button
              type="button"
              onClick={() => { setSearch(""); setSearchInput(""); setPage(1); }}
              className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              ✕ Zurücksetzen
            </button>
          )}
        </form>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            <span className="text-gray-500">Aktualität:</span>
            <select
              value={maxAgeDays}
              onChange={(e) => { setMaxAgeDays(parseInt(e.target.value)); setPage(1); }}
              className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none"
            >
              {AGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyMyBereich}
              onChange={(e) => { setOnlyMyBereich(e.target.checked); setPage(1); }}
              className="rounded"
            />
            <span className="text-gray-700">Nur mein Bereich</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyNew}
              onChange={(e) => { setOnlyNew(e.target.checked); setPage(1); }}
              className="rounded"
            />
            <span className="text-gray-700">Bereits beworbene ausblenden</span>
          </label>

          {data && (
            <span className="ml-auto text-gray-400">
              {data.total.toLocaleString("de-DE")} Treffer
              {data.totalPages > 1 && <> · Seite {data.page}/{data.totalPages}</>}
            </span>
          )}
        </div>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-5xl mb-3">🔍</p>
          <p className="text-sm">Keine Firmen gefunden. Probier andere Filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {jobs.map((j) => {
            const age = formatAge(j.created_at);
            const applied = j.alreadyApplied || appliedNow.has(j.id);
            const err = errors[j.id];
            return (
              <div
                key={j.id}
                className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 flex flex-col gap-2 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-gray-900 text-sm leading-tight">
                    {j.firmenname || "Unbekannte Firma"}
                  </h3>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap ${
                      age.fresh
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-gray-50 text-gray-500 border border-gray-200"
                    }`}
                    title={j.created_at || undefined}
                  >
                    {age.label}
                  </span>
                </div>

                {j.bereich && (
                  <div className="text-xs text-gray-600 line-clamp-2">{j.bereich}</div>
                )}

                <div className="text-xs text-gray-500 space-y-0.5 mt-1">
                  {j.ansprechpartner && (
                    <div>👤 {j.geschlecht === "w" ? "Frau" : j.geschlecht === "m" ? "Herr" : ""} {j.ansprechpartner}</div>
                  )}
                  <div className="truncate">📧 {j.email}</div>
                  {j.telefonnummer && <div>📞 {j.telefonnummer}</div>}
                </div>

                <div className="mt-auto pt-2">
                  {applied ? (
                    <div className="w-full px-3 py-2 text-xs font-medium rounded-lg bg-gray-100 text-gray-500 text-center">
                      ✓ Bereits beworben
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleApply(j)}
                      disabled={applying === j.id || !j.email}
                      className="w-full px-3 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white transition-colors"
                    >
                      {applying === j.id ? "Sende…" : "📨 Jetzt bewerben"}
                    </button>
                  )}
                  {err && (
                    <div className="mt-1.5 text-[11px] text-red-600">{err}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← Vorherige
          </button>
          <span className="text-sm text-gray-500 px-2">
            {data.page} / {data.totalPages}
          </span>
          <button
            type="button"
            disabled={page >= data.totalPages}
            onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
            className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Nächste →
          </button>
        </div>
      )}
    </div>
  );
}
