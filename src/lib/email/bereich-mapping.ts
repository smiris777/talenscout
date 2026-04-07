/**
 * Extracts search terms from a student's Ziel to find matching companies.
 *
 * Strategy: Strip "Ausbildung als/zum/zur/im", "Arbeit als" etc. prefixes
 * to get the CORE job title — that's what the bewerbungen.bereich column uses.
 *
 * DB examples:
 *   "Ausbildung Als Pflegefachmann"  →  search: %Pflegefachmann%
 *   "Ausbildung als KFZ-Mechatroniker" → search: %KFZ-Mechatroniker% + %Mechatroniker%
 *   "Arbeit als Sozialassistant"     →  search: %Sozialassistant%
 */

// Words to SKIP when extracting core title parts (stop words + German prefix words)
const STOP_WORDS = new Set([
  "für", "und", "der", "die", "das", "ein", "eine", "als", "zum", "zur",
  "mit", "bei", "von", "bis", "aus", "nach", "seit", "über", "unter",
  "ausbildung", "arbeit", "stelle", "job", "bereich",
]);

/**
 * Returns search terms to use as `bereich ILIKE %term%` filters.
 */
export function getMatchingBereiche(ziel: string): string[] {
  if (!ziel) return [];

  // Normalize: trim, collapse whitespace, remove newlines
  const clean = ziel
    .trim()
    .replace(/[\n\r\t]/g, " ")
    .replace(/\s+/g, " ");

  const terms = new Set<string>();

  // 1. Strip common German prefixes to get core job title
  let core = clean
    // "Ausbildung als/zum/zur/im/in/an/bei Beruf"
    .replace(/^(Ausbildung|Arbeit|Stelle|Job)\s+(als|zum|zur|im|in|an|bei|für|zur\/zum|in der|im Bereich)\s+/i, "")
    // "Ausbildung Beruf" (no preposition)
    .replace(/^(Ausbildung|Arbeit|Stelle|Job)\s+/i, "")
    // Remove (m/w/d), (m/w), (w/m/d)
    .replace(/\([mwdf]\/[mwdf](\/[mwdf])?\)/gi, "")
    // Unwrap remaining parens but keep content: "(Elektroniker/in)" → "Elektroniker/in"
    .replace(/^\((.+)\)$/, "$1")
    // Remove "/in", "/r", "/e" suffix variants
    .replace(/\/in\b/gi, "")
    .replace(/\/r\b/gi, "")
    // Normalize spaces again
    .replace(/\s+/g, " ")
    .trim();

  if (core.length >= 2) {
    terms.add(core);

    // 2. Split compound titles (e.g. "KFZ-Mechatroniker" → also "Mechatroniker")
    //    Split on spaces and hyphens, keep meaningful parts
    const parts = core
      .split(/[\s\-\/]+/)
      .map((w) => w.trim())
      .filter((w) => w.length >= 4 && !STOP_WORDS.has(w.toLowerCase()));

    for (const part of parts) {
      terms.add(part);
    }
  }

  // 3. Remove terms that would break PostgREST OR syntax (comma, quote, percent, underscore)
  return Array.from(terms).filter(
    (t) => t.length >= 2 && !/[,%"_]/.test(t)
  );
}

/**
 * Build a Supabase OR filter string for matching bereiche.
 * Returns empty string if no terms found.
 */
export function buildBereichFilter(ziel: string): string {
  const terms = getMatchingBereiche(ziel);
  if (terms.length === 0) return "";
  return terms.map((t) => `bereich.ilike.%${t}%`).join(",");
}
