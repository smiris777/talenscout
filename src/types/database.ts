export interface AzubiRaw {
  id: number;
  "Student ID": number;
  Namen: string | null;
  Email: string | null;
  Ziel: string | null;
  Aktiv: string | null;
  "Deutsch Niveau": string | null;
  Art: string | null;
  BewerbungsVideoLink: string | null;
  BewerbungsfotoLink: string | null;
  "Lebenslauf ": string | null;
  Infos: string | null;
  Motivationsschreiben: string | null;
  Profil: string | null;
  "Foto in System": string | null;
  "Lebenslauf in System": string | null;
  Mitarbeiter: string | null;
  Gesamtscore: string | null;
  user_id: string | null;
  first_name: string | null;
  last_name: string | null;
  created_at: string | null;
  drive_folder_id: string | null;
  sichtbar: boolean | null;
}

export interface Azubi {
  id: number;
  studentId: number;
  name: string;
  email: string;
  ziel: string;
  aktiv: string;
  deutschNiveau: string;
  art: string;
  videoLink: string | null;
  fotoLink: string | null;
  lebenslauf: string | null;
  infos: string | null;
  motivationsschreiben: string | null;
  profil: string | null;
  fotoInSystem: boolean;
  lebenslaufInSystem: boolean;
  mitarbeiter: string | null;
  gesamtscore: string | null;
  bewerbungenCount: number;
  driveFolderId: string | null;
  sichtbar: boolean;
}

export type AktivStatus =
  | "ja"
  | "nein"
  | "Vorstellungsgespräch"
  | "Zusage Erhalten"
  | "Visum Beantragt"
  | "Profil beim Kunden"
  | "Lebenslauf beim Kunden"
  | "Vorzusage"
  | "Beschleunigte Verfahren";
