/**
 * Maps student Ziel (target job) to related bereich (company field) values.
 * Used by the cron job to find matching companies.
 */

const BEREICH_MAP: Record<string, string[]> = {
  // Pflege
  pflegefachmann: ["Pflege", "Gesundheit", "Altenpflege", "Krankenpflege", "Pflegefachmann", "Pflegefachfrau"],
  pflegefachfrau: ["Pflege", "Gesundheit", "Altenpflege", "Krankenpflege", "Pflegefachmann", "Pflegefachfrau"],
  altenpflege: ["Pflege", "Altenpflege", "Gesundheit", "Pflegefachmann", "Pflegefachfrau"],

  // Elektro
  elektroniker: ["Elektronik", "Elektrotechnik", "Elektriker", "Elektroniker", "Energie- und Gebäudetechnik"],
  elektrotechnik: ["Elektronik", "Elektrotechnik", "Elektriker", "Elektroniker"],
  mechatroniker: ["Mechatronik", "Mechatroniker", "Elektrotechnik", "Elektronik", "Maschinenbau"],

  // IT
  fachinformatiker: ["IT", "Informatik", "Fachinformatiker", "Systemintegration", "Anwendungsentwicklung"],
  "it-systemelektroniker": ["IT", "Informatik", "Systemelektroniker", "IT-System"],

  // Hotel/Gastro
  hotelfachmann: ["Hotel", "Hotellerie", "Gastronomie", "Hotelfachmann", "Hotelfachfrau", "Tourismus"],
  hotelfachfrau: ["Hotel", "Hotellerie", "Gastronomie", "Hotelfachmann", "Hotelfachfrau", "Tourismus"],
  koch: ["Küche", "Koch", "Gastronomie", "Restaurant"],
  restaurantfachmann: ["Restaurant", "Gastronomie", "Service", "Hotellerie"],

  // Handwerk
  mechaniker: ["Mechanik", "Mechaniker", "KFZ", "Maschinenbau", "Werkstatt"],
  kfz: ["KFZ", "Mechaniker", "Autowerkstatt", "Fahrzeugtechnik"],
  berufskraftfahrer: ["Logistik", "Transport", "Berufskraftfahrer", "Spedition", "LKW"],
  anlagenmechaniker: ["Anlagenmechanik", "SHK", "Sanitär", "Heizung", "Klima"],

  // Kaufmännisch
  kaufmann: ["Kaufmann", "Kauffrau", "Einzelhandel", "Büro", "Verwaltung"],
  einzelhandel: ["Einzelhandel", "Verkauf", "Handel", "Kaufmann"],
  "bürokaufmann": ["Büro", "Verwaltung", "Bürokaufmann", "Büromanagement"],

  // Bau
  maler: ["Maler", "Lackierer", "Bau", "Handwerk"],
  tischler: ["Tischler", "Schreiner", "Holz", "Handwerk"],
  maurer: ["Bau", "Maurer", "Hochbau"],
};

/**
 * Get matching bereich values for a student's Ziel.
 * Returns an array of possible bereich strings to match against.
 */
export function getMatchingBereiche(ziel: string): string[] {
  if (!ziel) return [];

  const lower = ziel.toLowerCase().trim();
  const matches = new Set<string>();

  // Add the original Ziel
  matches.add(ziel.trim());

  // Check each keyword in the mapping
  for (const [keyword, bereiche] of Object.entries(BEREICH_MAP)) {
    if (lower.includes(keyword)) {
      bereiche.forEach((b) => matches.add(b));
    }
  }

  // Extract first significant word as fallback
  const words = lower
    .replace(/[()]/g, "")
    .replace(/ausbildung\s+(als|zum|zur)\s+/i, "")
    .split(/\s+/)
    .filter((w) => w.length > 3);

  if (words.length > 0) {
    // Add the first meaningful word (capitalized)
    const firstWord = words[0].charAt(0).toUpperCase() + words[0].slice(1);
    matches.add(firstWord);
  }

  return Array.from(matches);
}

/**
 * Build a Supabase OR filter string for matching bereiche.
 */
export function buildBereichFilter(ziel: string): string {
  const bereiche = getMatchingBereiche(ziel);
  if (bereiche.length === 0) return "";

  // Build OR conditions: bereich.eq.X,bereich.ilike.%Y%
  const conditions = bereiche.map((b) => `bereich.ilike.%${b}%`);
  return conditions.join(",");
}
