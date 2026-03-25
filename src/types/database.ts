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

// Job Listings (Scan & Apply - private 30-day DB)
export interface JobListing {
  id: string;
  student_id: string;
  company_name: string;
  job_title: string | null;
  location: string | null;
  contact_email: string | null;
  phone: string | null;
  deadline: string | null;
  scan_image_url: string | null;
  rating: number;
  notes: string | null;
  expires_at: string;
  transferred: boolean;
  applied: boolean;
  created_at: string;
}

export interface JobListingInput {
  company_name: string;
  job_title?: string;
  location?: string;
  contact_email?: string;
  phone?: string;
  deadline?: string;
  scan_image_url?: string;
}

// Reward Rules (admin-configurable)
export interface RewardRule {
  id: string;
  rule_type: string;
  rule_key: string;
  rule_value: Record<string, number>;
  is_active: boolean;
  updated_at: string;
}

// Student Points
export interface StudentPoint {
  id: string;
  student_id: string;
  points: number;
  source: string;
  description: string | null;
  created_at: string;
}

// Student Streaks (Gamification)
export interface StudentStreak {
  student_id: string;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  total_points: number;
  level: number;
  xp: number;
  xp_to_next_level: number;
  updated_at: string;
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
