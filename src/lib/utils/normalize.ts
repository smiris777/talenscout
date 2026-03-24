import { AzubiRaw, Azubi } from "@/types/database";

export function normalizeAzubi(raw: AzubiRaw, bewerbungenCount = 0): Azubi {
  return {
    id: raw.id,
    studentId: raw["Student ID"],
    name: (raw.Namen || "").trim(),
    email: (raw.Email || "").trim(),
    ziel: (raw.Ziel || "").trim(),
    aktiv: normalizeAktiv((raw.Aktiv || "").trim()),
    deutschNiveau: (raw["Deutsch Niveau"] || "").trim().toUpperCase(),
    art: capitalizeFirst((raw.Art || "").trim()),
    videoLink: raw.BewerbungsVideoLink || null,
    fotoLink: raw.BewerbungsfotoLink || null,
    lebenslauf: raw["Lebenslauf "] || null,
    infos: raw.Infos || null,
    motivationsschreiben: raw.Motivationsschreiben || null,
    profil: raw.Profil || null,
    fotoInSystem: (raw["Foto in System"] || "").toLowerCase() === "ja",
    lebenslaufInSystem: (raw["Lebenslauf in System"] || "").toLowerCase() === "ja",
    mitarbeiter: raw.Mitarbeiter || null,
    gesamtscore: raw.Gesamtscore || null,
    bewerbungenCount,
    driveFolderId: raw.drive_folder_id || null,
    sichtbar: raw.sichtbar !== false,
  };
}

function normalizeAktiv(status: string): string {
  const s = status.replace(/\n/g, "").trim();
  if (!s) return "Unbekannt";
  return s;
}

function capitalizeFirst(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function getYouTubeEmbedUrl(url: string | null): string | null {
  if (!url) return null;
  const videoId = extractYouTubeId(url);
  if (!videoId) return null;
  return `https://www.youtube.com/embed/${videoId}`;
}

export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  // youtu.be/ID
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
  if (shortMatch) return shortMatch[1];
  // youtube.com/watch?v=ID
  const longMatch = url.match(/[?&]v=([a-zA-Z0-9_-]+)/);
  if (longMatch) return longMatch[1];
  // youtube.com/embed/ID
  const embedMatch = url.match(/embed\/([a-zA-Z0-9_-]+)/);
  if (embedMatch) return embedMatch[1];
  return null;
}

export function getGDriveThumbnailUrl(url: string | null): string | null {
  if (!url) return null;
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) return null;
  return `https://lh3.googleusercontent.com/d/${match[1]}`;
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function getStatusColor(status: string): {
  bg: string;
  text: string;
  dot: string;
} {
  const s = status.toLowerCase();
  if (s === "ja") return { bg: "bg-green-100", text: "text-green-800", dot: "bg-green-500" };
  if (s === "nein") return { bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400" };
  if (s.includes("vorstellungsgespräch") || s.includes("vorstellungsgespr"))
    return { bg: "bg-blue-100", text: "text-blue-800", dot: "bg-blue-500" };
  if (s.includes("zusage")) return { bg: "bg-emerald-100", text: "text-emerald-800", dot: "bg-emerald-500" };
  if (s.includes("visum")) return { bg: "bg-amber-100", text: "text-amber-800", dot: "bg-amber-500" };
  if (s.includes("profil beim kunden") || s.includes("lebenslauf beim kunden"))
    return { bg: "bg-purple-100", text: "text-purple-800", dot: "bg-purple-500" };
  if (s.includes("vorzusage")) return { bg: "bg-teal-100", text: "text-teal-800", dot: "bg-teal-500" };
  if (s.includes("beschleunigte")) return { bg: "bg-orange-100", text: "text-orange-800", dot: "bg-orange-500" };
  return { bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400" };
}

export function getNiveauColor(niveau: string): string {
  switch (niveau) {
    case "A1": return "bg-red-100 text-red-800";
    case "A2": return "bg-orange-100 text-orange-800";
    case "B1": return "bg-yellow-100 text-yellow-800";
    case "B2": return "bg-green-100 text-green-800";
    case "C1": return "bg-blue-100 text-blue-800";
    case "C2": return "bg-purple-100 text-purple-800";
    default: return "bg-gray-100 text-gray-600";
  }
}
