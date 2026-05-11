/**
 * Pipeline: Stelle aus Arbeitsagentur-API → `bewerbungen`-Pool.
 *
 * - dedupe per `refnr` über `scraped_jobs_log` (übersprungen, wenn schon gesehen)
 * - dedupe per `firmenname` + `email` über `bewerbungen` (nicht zweimal selbe Firma+Mail)
 * - Stellen ohne extrahierbare E-Mail werden verworfen (passt zum Email-Cron-Versand)
 * - `bereich` = `beruf` aus API (matcht direkt mit `bereich-mapping.ts`)
 */

import { SupabaseClient } from "@supabase/supabase-js";
import {
  searchJobs,
  getJobDetail,
  extractContact,
  SearchOpts,
} from "./arbeitsagentur";

const DELAY_BETWEEN_DETAILS_MS = 400;

export interface IngestStats {
  searched: number;
  alreadyLogged: number;
  noEmail: number;
  duplicateInPool: number;
  inserted: number;
  errors: number;
  errorMessages: string[];
}

export interface IngestRunInput extends SearchOpts {
  /** Optional: Anzahl Seiten durchsuchen (jede mit `size`). Default 1. */
  pages?: number;
  /** Max gesamt zu inserierende Stellen (Sicherheitslimit). Default 100. */
  maxInserts?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function newStats(): IngestStats {
  return {
    searched: 0,
    alreadyLogged: 0,
    noEmail: 0,
    duplicateInPool: 0,
    inserted: 0,
    errors: 0,
    errorMessages: [],
  };
}

/**
 * Führt EINE Suche für genau einen `was`-Begriff aus und schreibt Treffer in den Pool.
 * Liefert Statistik dieser Suche.
 */
export async function ingestArbeitsagenturSearch(
  supabase: SupabaseClient,
  input: IngestRunInput,
): Promise<IngestStats> {
  const stats = newStats();
  const pages = Math.max(1, input.pages ?? 1);
  const maxInserts = input.maxInserts ?? 100;

  for (let page = 1; page <= pages; page++) {
    if (stats.inserted >= maxInserts) break;

    let results;
    try {
      results = await searchJobs({ ...input, page });
    } catch (err) {
      stats.errors++;
      stats.errorMessages.push(
        `search (page ${page}): ${err instanceof Error ? err.message : "Unknown"}`,
      );
      break;
    }

    stats.searched += results.length;
    if (results.length === 0) break;

    for (const r of results) {
      if (stats.inserted >= maxInserts) break;
      if (!r.refnr) continue;

      // Dedup 1: refnr schon mal verarbeitet?
      const { data: seen } = await supabase
        .from("scraped_jobs_log")
        .select("refnr")
        .eq("refnr", r.refnr)
        .maybeSingle();

      if (seen) {
        stats.alreadyLogged++;
        continue;
      }

      // Detail holen, Kontakt extrahieren
      let detail;
      try {
        detail = await getJobDetail(r.refnr);
      } catch (err) {
        stats.errors++;
        stats.errorMessages.push(
          `detail ${r.refnr}: ${err instanceof Error ? err.message : "Unknown"}`,
        );
        continue;
      }
      await sleep(DELAY_BETWEEN_DETAILS_MS);

      const beschreibung = detail?.beschreibung ?? "";
      const contact = extractContact(beschreibung);

      const bereich = r.beruf || detail?.beruf || r.titel || null;
      const arbeitsort = [r.arbeitsort?.plz, r.arbeitsort?.ort]
        .filter(Boolean)
        .join(" ");

      // Stelle ohne E-Mail: nur loggen, nicht inserieren
      if (!contact.email) {
        stats.noEmail++;
        await supabase.from("scraped_jobs_log").insert({
          refnr: r.refnr,
          source: "arbeitsagentur",
          company_name: r.firma || detail?.firma || null,
          job_title: r.titel || null,
          bereich,
          arbeitsort: arbeitsort || null,
          had_email: false,
          had_phone: !!contact.telefon,
          skipped_reason: "no_email",
        });
        continue;
      }

      // Dedup 2: Firma+Email schon im Pool?
      const firmenname = r.firma || detail?.firma || "Unbekannt";

      const { data: existing } = await supabase
        .from("bewerbungen")
        .select("id")
        .eq("email", contact.email)
        .limit(1);

      if (existing && existing.length > 0) {
        stats.duplicateInPool++;
        await supabase.from("scraped_jobs_log").insert({
          refnr: r.refnr,
          source: "arbeitsagentur",
          company_name: firmenname,
          job_title: r.titel || null,
          bereich,
          arbeitsort: arbeitsort || null,
          had_email: true,
          had_phone: !!contact.telefon,
          skipped_reason: "duplicate_email",
        });
        continue;
      }

      // Insert in Pool — student_user_id bleibt NULL (globaler Pool)
      const insertPayload: Record<string, unknown> = {
        firmenname,
        email: contact.email,
        telefonnummer: contact.telefon,
        bereich,
        name: contact.ansprechpartner,
        geschlecht: contact.geschlecht,
      };

      const { data: inserted, error: insertErr } = await supabase
        .from("bewerbungen")
        .insert(insertPayload)
        .select("id")
        .single();

      if (insertErr) {
        stats.errors++;
        stats.errorMessages.push(`insert ${r.refnr}: ${insertErr.message}`);
        await supabase.from("scraped_jobs_log").insert({
          refnr: r.refnr,
          source: "arbeitsagentur",
          company_name: firmenname,
          job_title: r.titel || null,
          bereich,
          arbeitsort: arbeitsort || null,
          had_email: true,
          had_phone: !!contact.telefon,
          skipped_reason: `insert_error: ${insertErr.message}`,
        });
        continue;
      }

      stats.inserted++;
      await supabase.from("scraped_jobs_log").insert({
        refnr: r.refnr,
        source: "arbeitsagentur",
        bewerbung_id: inserted?.id ?? null,
        company_name: firmenname,
        job_title: r.titel || null,
        bereich,
        arbeitsort: arbeitsort || null,
        had_email: true,
        had_phone: !!contact.telefon,
      });
    }
  }

  return stats;
}

/** Mehrere Suchbegriffe nacheinander abarbeiten und Statistiken aggregieren. */
export async function ingestBatch(
  supabase: SupabaseClient,
  searches: IngestRunInput[],
): Promise<{ total: IngestStats; perSearch: Array<{ was: string; stats: IngestStats }> }> {
  const total = newStats();
  const perSearch: Array<{ was: string; stats: IngestStats }> = [];

  for (const s of searches) {
    const stats = await ingestArbeitsagenturSearch(supabase, s);
    perSearch.push({ was: s.was, stats });

    total.searched += stats.searched;
    total.alreadyLogged += stats.alreadyLogged;
    total.noEmail += stats.noEmail;
    total.duplicateInPool += stats.duplicateInPool;
    total.inserted += stats.inserted;
    total.errors += stats.errors;
    total.errorMessages.push(...stats.errorMessages);
  }

  return { total, perSearch };
}

/**
 * Liefert distinct Such-Begriffe basierend auf den aktiven Studenten-Zielen.
 * Nutzt die gleiche Strip-Logik wie bereich-mapping.ts (Strip "Ausbildung als ...").
 */
export function studentZieleToSearchTerms(ziele: Array<string | null>): string[] {
  const set = new Set<string>();
  for (const raw of ziele) {
    if (!raw) continue;
    const core = raw
      .trim()
      .replace(/[\n\r\t]/g, " ")
      .replace(/\s+/g, " ")
      .replace(
        /^(Ausbildung|Arbeit|Stelle|Job)\s+(als|zum|zur|im|in|an|bei|für|zur\/zum|in der|im Bereich)\s+/i,
        "",
      )
      .replace(/^(Ausbildung|Arbeit|Stelle|Job)\s+/i, "")
      .replace(/\([mwdf]\/[mwdf](\/[mwdf])?\)/gi, "")
      .replace(/^\((.+)\)$/, "$1")
      .replace(/\/in\b/gi, "")
      .replace(/\/r\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    if (core.length >= 3) set.add(core);
  }
  return Array.from(set);
}
