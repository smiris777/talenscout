/**
 * Bundesagentur für Arbeit – Jobsuche-API Client.
 *
 * Nutzt die offizielle, öffentlich dokumentierte API (https://jobsuche.api.bund.dev/).
 * Kein CAPTCHA, kein Login, kein Browser — nur ein Header.
 *
 * Praxis-Befund: Such- und Detail-Endpoints liefern KEINE strukturierten
 * Kontaktdaten. E-Mail, Telefon und Ansprechpartner stecken als Freitext
 * in `stellenangebotsBeschreibung` und müssen per Regex/Heuristik extrahiert
 * werden. ~80 % der Stellen haben eine Email im Freitext.
 */

const API_BASE = "https://rest.arbeitsagentur.de/jobboerse/jobsuche-service";
const API_KEY = "jobboerse-jobsuche";

const DEFAULT_HEADERS = {
  "X-API-Key": API_KEY,
  Accept: "application/json",
  "User-Agent": "TalentScout/1.0",
};

const FETCH_TIMEOUT_MS = 15000;

export interface SearchResult {
  refnr: string;
  beruf: string;
  titel: string;
  firma: string;
  arbeitsort?: {
    plz?: string;
    ort?: string;
    strasse?: string;
    region?: string;
  };
  veroeffentlicht?: string;
  modifiziert?: string;
}

export interface JobDetail {
  refnr: string;
  titel: string;
  firma: string;
  beruf: string;
  beschreibung: string;
  arbeitsort?: { plz?: string; ort?: string; strasse?: string };
}

export interface ContactExtraction {
  email: string | null;
  telefon: string | null;
  ansprechpartner: string | null;
  geschlecht: "m" | "w" | null;
}

export interface SearchOpts {
  was: string;
  wo?: string;
  umkreis?: number;
  size?: number;
  page?: number;
  /** angebotsart: 1=ARBEIT, 4=AUSBILDUNG, 34=ARBEIT+AUSBILDUNG. Default: alle. */
  angebotsart?: number;
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function searchJobs(opts: SearchOpts): Promise<SearchResult[]> {
  const params = new URLSearchParams();
  params.set("was", opts.was);
  if (opts.wo) params.set("wo", opts.wo);
  if (opts.umkreis) params.set("umkreis", String(opts.umkreis));
  params.set("size", String(opts.size ?? 25));
  params.set("page", String(opts.page ?? 1));
  if (opts.angebotsart) params.set("angebotsart", String(opts.angebotsart));

  const url = `${API_BASE}/pc/v4/jobs?${params.toString()}`;
  const res = await fetchWithTimeout(url, { headers: DEFAULT_HEADERS });

  if (!res.ok) {
    throw new Error(`Arbeitsagentur search failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const stellen = data?.stellenangebote ?? [];

  return stellen.map((s: Record<string, unknown>): SearchResult => {
    const ort = (s.arbeitsort as Record<string, unknown> | undefined) ?? {};
    return {
      refnr: String(s.refnr ?? ""),
      beruf: String(s.beruf ?? ""),
      titel: String(s.titel ?? s.beruf ?? ""),
      firma: String(s.arbeitgeber ?? ""),
      arbeitsort: {
        plz: ort.plz ? String(ort.plz) : undefined,
        ort: ort.ort ? String(ort.ort) : undefined,
        strasse: ort.strasse ? String(ort.strasse) : undefined,
        region: ort.region ? String(ort.region) : undefined,
      },
      veroeffentlicht: s.aktuelleVeroeffentlichungsdatum
        ? String(s.aktuelleVeroeffentlichungsdatum)
        : undefined,
      modifiziert: s.modifikationsTimestamp ? String(s.modifikationsTimestamp) : undefined,
    };
  }).filter((s: SearchResult) => s.refnr);
}

export async function getJobDetail(refnr: string): Promise<JobDetail | null> {
  // Wichtig: refnr muss Base64-kodiert im Pfad stehen.
  const b64 = Buffer.from(refnr, "utf-8").toString("base64");
  const url = `${API_BASE}/pc/v4/jobdetails/${encodeURIComponent(b64)}`;
  const res = await fetchWithTimeout(url, { headers: DEFAULT_HEADERS });

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Arbeitsagentur detail failed: ${res.status} ${res.statusText}`);
  }

  const d = (await res.json()) as Record<string, unknown>;
  const lokationen = d.stellenlokationen as Array<Record<string, unknown>> | undefined;
  const firstLoc = lokationen?.[0]?.adresse as Record<string, unknown> | undefined;

  return {
    refnr,
    titel: String(d.stellenangebotsTitel ?? ""),
    firma: String(d.firma ?? ""),
    beruf: String(d.hauptberuf ?? d.alternativBeruf1 ?? ""),
    beschreibung: String(d.stellenangebotsBeschreibung ?? ""),
    arbeitsort: firstLoc
      ? {
          plz: firstLoc.plz ? String(firstLoc.plz) : undefined,
          ort: firstLoc.ort ? String(firstLoc.ort) : undefined,
        }
      : undefined,
  };
}

/* ───────────────── Regex-Extraktion ───────────────── */

const EMAIL_RE = /\b[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}\b/gi;

// E-Mails ignorieren, die offensichtlich keine Bewerbungsadresse sind.
const EMAIL_BLOCKLIST = [
  "@arbeitsagentur.de",
  "@arbeitsamt.de",
  "noreply@",
  "no-reply@",
  "newsletter@",
  "datenschutz@",
  "presse@",
  "webmaster@",
];

const PHONE_RE = /(?:Tel(?:efon)?\.?:?|☎|Fon:?|Phone:?)\s*([+0-9][0-9\s\-\/()]{6,24})/i;
const PHONE_FALLBACK_RE = /(?:^|\s)(\+49[\s\-\/()0-9]{7,}|0[1-9][0-9\s\-\/()]{6,20})(?=\s|$|,|\.)/m;

// "Frau Dr. Maria Müller" / "Herr Peter Schmidt"
const ANREDE_NAME_RE =
  /\b(Frau|Herr)\s+(?:Dr\.\s+|Dr\.|Prof\.\s+|Prof\.|Dipl\.[\-\s]?[\wäöüÄÖÜß]+\.?\s+)?([A-ZÄÖÜ][a-zäöüß\-]+(?:\s+(?:van|von|de|del)\s+)?(?:\s+[A-ZÄÖÜ][a-zäöüß\-]+){0,2})/;

// "Sehr geehrte Frau Müller"
const SEHR_GEEHRT_RE =
  /Sehr\s+geehrte[rn]?\s+(Frau|Herr)\s+([A-ZÄÖÜ][a-zäöüß\-]+(?:\s+[A-ZÄÖÜ][a-zäöüß\-]+){0,2})/;

function pickEmail(text: string): string | null {
  const matches = text.match(EMAIL_RE);
  if (!matches) return null;

  for (const raw of matches) {
    const e = raw.toLowerCase();
    if (EMAIL_BLOCKLIST.some((b) => e.includes(b))) continue;
    return e;
  }
  return null;
}

function pickPhone(text: string): string | null {
  const m1 = text.match(PHONE_RE);
  if (m1) return m1[1].replace(/\s+/g, " ").trim();
  const m2 = text.match(PHONE_FALLBACK_RE);
  if (m2) return m2[1].replace(/\s+/g, " ").trim();
  return null;
}

function nameFromEmail(email: string): string | null {
  const local = email.split("@")[0];
  if (!local) return null;
  // "vorname.nachname" / "vorname_nachname" / "v.nachname"
  const parts = local.split(/[._\-]/).filter((p) => p.length >= 2 && /^[a-zäöüß]+$/i.test(p));
  if (parts.length < 2) return null;
  return parts
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");
}

function pickAnsprechpartner(
  text: string,
  email: string | null,
): { name: string | null; geschlecht: "m" | "w" | null } {
  // 1) "Sehr geehrte Frau X" — präziseste Variante
  const g = text.match(SEHR_GEEHRT_RE);
  if (g) {
    return { name: g[2].trim(), geschlecht: g[1].toLowerCase() === "frau" ? "w" : "m" };
  }

  // 2) "Frau X" / "Herr X" irgendwo
  const a = text.match(ANREDE_NAME_RE);
  if (a) {
    return { name: a[2].trim(), geschlecht: a[1].toLowerCase() === "frau" ? "w" : "m" };
  }

  // 3) Fallback: aus Email-Prefix raten (kein Geschlecht)
  if (email) {
    const fromEmail = nameFromEmail(email);
    if (fromEmail) return { name: fromEmail, geschlecht: null };
  }

  return { name: null, geschlecht: null };
}

export function extractContact(beschreibung: string): ContactExtraction {
  if (!beschreibung) {
    return { email: null, telefon: null, ansprechpartner: null, geschlecht: null };
  }

  const email = pickEmail(beschreibung);
  const telefon = pickPhone(beschreibung);
  const { name, geschlecht } = pickAnsprechpartner(beschreibung, email);

  return { email, telefon, ansprechpartner: name, geschlecht };
}
