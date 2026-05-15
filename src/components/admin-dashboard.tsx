"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateAzubiStatus, toggleAzubiVisibility } from "@/app/actions/admin";
import {
  setOneTimeCredit,
  setRecurringCredit,
  blockStudent,
  toggleStudentActive,
  toggleDailyEmail,
} from "@/app/actions/credit";
import { getStatusColor } from "@/lib/utils/normalize";

/* ─── Types ─── */

interface StudentFormData {
  namen: string;
  email: string;
  password: string;
  ziel: string;
  deutschNiveau: string;
  art: string;
  videoLink: string;
  fotoLink: string;
  driveLink: string;
  motivationsschreiben: string;
  profil: string;
  infos: string;
  gmailAddress: string;
  gmailAppPassword: string;
  credits: number;
  autoRefill: number;
  maxDailyEmails: number;
  whatsapp: string;
}

const emptyForm: StudentFormData = {
  namen: "", email: "", password: "Test1234!", ziel: "", deutschNiveau: "B1",
  art: "Ausbildung-lite", videoLink: "", fotoLink: "", driveLink: "",
  motivationsschreiben: "", profil: "", infos: "", gmailAddress: "",
  gmailAppPassword: "", credits: 10, autoRefill: 0, maxDailyEmails: 10,
  whatsapp: "",
};

interface AdminAzubi {
  id: number;
  "Student ID": number;
  Namen: string | null;
  Email: string | null;
  Ziel: string | null;
  Aktiv: string | null;
  "Deutsch Niveau": string | null;
  Art: string | null;
  sichtbar: boolean | null;
  drive_folder_id: string | null;
  user_id: string | null;
  monthly_credit: number | null;
  credit_auto_refill: number | null;
  student_active: boolean | null;
  daily_email_enabled: boolean | null;
  gmail_app_password_set: boolean | null;
  max_daily_emails: number | null;
  BewerbungsfotoLink: string | null;
  last_login_at: string | null;
  login_count: number | null;
  whatsapp: string | null;
  _sentToday: number;
  _sentTotal: number;
  _scans: number;
}

interface DashboardStats {
  totalStudents: number;
  activeStudents: number;
  emailsSentToday: number;
  emailsSentWeek: number;
  emailsSentTotal: number;
  responseRate: number;
  interviews: number;
}

const STATUS_OPTIONS = [
  "ja", "nein", "Vorstellungsgespräch", "Zusage Erhalten",
  "Visum Beantragt", "Profil beim Kunden", "Lebenslauf beim Kunden",
  "Vorzusage", "Warte auf beschleunigte Verfahren",
  "warte auf Vertrag", "Beschleunigte Verfahren",
];

type SortKey = "name" | "credits" | "emailsTotal" | "emailsToday" | "scans" | "lastLogin";
type SortDir = "asc" | "desc";
type AdminTab = "uebersicht" | "studenten" | "leaderboard" | "aktionen" | "rewards" | "posteingang";

interface InboxEmail {
  id: string;
  user_id: string;
  student_name: string;
  student_email: string;
  from_email: string;
  from_name: string | null;
  subject: string;
  body_text: string | null;
  received_at: string;
  is_read: boolean;
}

interface ScrapeStatus {
  activeTerms: string[];
  studentTerms: string[];
  extraTerms: Array<{ id: string; term: string; is_active: boolean }>;
  lastRunAt: string | null;
  isLikelyRunning: boolean;
  todayInserted: number;
  weekInserted: number;
  nextRunsUTC: string[];
  lastRunStats: Array<{ bereich: string; inserted: number; skipped: number }>;
  recentActivityCount: number;
}

interface AnalyticsData {
  pipeline: Array<{ label: string; value: number; rate?: number; color: string }>;
  classificationCounts: Record<string, number>;
  emailsSentTimeSeries: Record<string, number>;
  emailsReceivedTimeSeries: Record<string, number>;
  scrapingTimeSeries: Record<string, number>;
  studentPipeline: Array<{
    userId: string; name: string; ziel: string; aktiv: string;
    fotoLink: string | null; gmailSet: boolean; studentActive: boolean;
    sent: number; received: number; interviews: number;
  }>;
  totalPool: number;
  totalSent: number;
  totalReceived: number;
}

interface ActionItem {
  id: string;
  user_id: string;
  from_email: string;
  from_name: string | null;
  subject: string;
  classification: string;
  received_at: string;
  action_status: string | null;
  snippet: string | null;
  company_name: string | null;
  studentName: string;
  fotoLink: string | null;
}

interface RewardRule {
  id: string;
  source_type: string;
  description: string | null;
  xp_value: number;
  rule_value: number | null;
  is_active: boolean;
  updated_at: string;
}

interface LeaderboardEntry {
  id: number;
  userId: string | null;
  name: string;
  ziel: string;
  fotoLink: string | null;
  studentActive: boolean | null;
  gmailSet: boolean | null;
  level: number;
  xp: number;
  xpToNext: number;
  totalPoints: number;
  currentStreak: number;
  longestStreak: number;
  lastActive: string | null;
  emailsSent: number;
}

/* ─── Stat Card ─── */

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className={`rounded-2xl border border-gray-100 bg-white p-5 shadow-sm hover:shadow-md transition-shadow`}>
      <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

/* ─── Avatar ─── */

function StudentAvatar({ name, fotoLink }: { name: string; fotoLink: string | null }) {
  const initials = (name || "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  if (fotoLink) {
    // Try to extract Google Drive thumbnail
    let src = fotoLink;
    const driveMatch = fotoLink.match(/\/d\/([^/]+)/);
    if (driveMatch) {
      src = `https://drive.google.com/thumbnail?id=${driveMatch[1]}&sz=w80`;
    }
    return (
      <img
        src={src}
        alt={name}
        className="w-8 h-8 rounded-full object-cover bg-gray-100 ring-2 ring-white"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
          (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
        }}
      />
    );
  }

  return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-semibold ring-2 ring-white">
      {initials}
    </div>
  );
}

/* ─── Toggle ─── */

function Toggle({ on, onChange, colorOn = "bg-blue-500", size = "default" }: {
  on: boolean;
  onChange: () => void;
  colorOn?: string;
  size?: "default" | "sm";
}) {
  const w = size === "sm" ? "w-7 h-4" : "w-9 h-5";
  const dot = size === "sm" ? "w-3 h-3" : "w-4 h-4";
  const translate = size === "sm" ? (on ? "translate-x-3" : "translate-x-0.5") : (on ? "translate-x-4" : "translate-x-0.5");

  return (
    <button
      type="button"
      onClick={onChange}
      className={`${w} rounded-full transition-colors relative flex items-center ${on ? colorOn : "bg-gray-300"}`}
    >
      <span className={`${dot} rounded-full bg-white shadow-sm transition-transform ${translate} block`} />
    </button>
  );
}

/* ─── Main Component ─── */

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<AdminTab>("studenten");
  const [students, setStudents] = useState<AdminAzubi[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Leaderboard
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  // Aktions-Center
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [urgentCount, setUrgentCount] = useState(0);

  // Reward-Rules
  const [rewardRules, setRewardRules] = useState<RewardRule[]>([]);
  const [rewardLoading, setRewardLoading] = useState(false);
  const [rewardSaving, setRewardSaving] = useState<string | null>(null);

  // Credit dialog
  const [creditDialog, setCreditDialog] = useState<{ azubi: AdminAzubi; mode: "einmalig" | "monatlich" | "sperren" } | null>(null);
  const [creditAmount, setCreditAmount] = useState("");

  // Manual email send dialog
  const [sendDialog, setSendDialog] = useState<AdminAzubi | null>(null);
  const [sendCount, setSendCount] = useState<number>(1);
  const [sendLoading, setSendLoading] = useState(false);
  const [sendResult, setSendResult] = useState<{ sent: number; errors: number; message: string; log?: any[] } | null>(null);

  // WhatsApp Login dialog
  const [waDialog, setWaDialog] = useState<AdminAzubi | null>(null);
  const [waPhone, setWaPhone] = useState("");

  // Block confirm dialog
  const [blockDialog, setBlockDialog] = useState<AdminAzubi | null>(null);
  const [blockLoading, setBlockLoading] = useState(false);

  // SMTP
  const [smtpStatus, setSmtpStatus] = useState<Record<string, { status: "loading" | "connected" | "failed" | "no_credentials"; gmail?: string; error?: string }>>({});

  // Email-Diagnose
  const [diagOpen, setDiagOpen] = useState(false);
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagResult, setDiagResult] = useState<{
    environment?: { cronSecretSet: boolean; supabaseUrlSet: boolean; serviceKeySet: boolean; anthropicKeySet: boolean };
    summary?: { totalStudents: number; readyToSend: number; blocked: number; poolSize: number };
    topBlockers?: Array<{ reason: string; count: number }>;
    recentFailures?: Array<{ company: string; email: string; error: string; at: string }>;
    students?: Array<{ id: number; name: string | null; ziel: string | null; ready: boolean; blockers: string[]; poolMatches: number; bereicheSuchbegriffe: string[]; monatlichGesendet: number; heuteGesendet: number; monthlyCredit: number }>;
    error?: string;
  } | null>(null);

  // Analytics / Übersicht
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Scraping live status (always loaded)
  const [scrapeStatus, setScrapeStatus] = useState<ScrapeStatus | null>(null);
  const [scrapeStatusLoading, setScrapeStatusLoading] = useState(false);

  // Extra scrape terms management
  const [newTermInput, setNewTermInput] = useState("");
  const [newTermLoading, setNewTermLoading] = useState(false);

  // Stelle manuell hinzufügen
  const [addStelleOpen, setAddStelleOpen] = useState(false);
  const [addStelleForm, setAddStelleForm] = useState({ firmenname: "", email: "", bereich: "", name: "", geschlecht: "", telefonnummer: "", notizen: "" });
  const [addStelleLoading, setAddStelleLoading] = useState(false);
  const [addStelleMsg, setAddStelleMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Posteingang aller Studenten
  const [inboxEmails, setInboxEmails] = useState<InboxEmail[]>([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxSyncing, setInboxSyncing] = useState(false);
  const [inboxSyncMsg, setInboxSyncMsg] = useState("");
  const [inboxSelected, setInboxSelected] = useState<InboxEmail | null>(null);
  const [inboxStudentFilter, setInboxStudentFilter] = useState<string>("alle");

  // Arbeitsagentur-Scraping
  const [scrapeOpen, setScrapeOpen] = useState(false);
  const [scrapeWas, setScrapeWas] = useState("");
  const [scrapeWo, setScrapeWo] = useState("");
  const [scrapeUmkreis, setScrapeUmkreis] = useState<number>(0);
  const [scrapeMax, setScrapeMax] = useState<number>(25);
  const [scrapeLoading, setScrapeLoading] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<{
    mode?: string;
    durationMs?: number;
    stats?: { inserted: number; noEmail: number; duplicateInPool: number; alreadyLogged: number; errors: number };
    total?: { inserted: number; noEmail: number; duplicateInPool: number; alreadyLogged: number; errors: number };
    perSearch?: Array<{ was: string; inserted: number; noEmail: number; duplicates: number; alreadyLogged: number; errors: number }>;
    error?: string;
  } | null>(null);

  // Edit / Create modal
  const [editModal, setEditModal] = useState<{ mode: "create" | "edit"; engineId?: number; userId?: string } | null>(null);
  const [form, setForm] = useState<StudentFormData>(emptyForm);
  const [formSaving, setFormSaving] = useState(false);
  const [formMessage, setFormMessage] = useState("");
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [studentStats, setStudentStats] = useState<Record<string, any> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/dashboard-stats");
      const data = await res.json();
      if (data.students) setStudents(data.students);
      if (data.stats) setStats(data.stats);
    } catch {
      // silent
    }
    setLoading(false);
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    setLeaderboardLoading(true);
    try {
      const res = await fetch("/api/admin/leaderboard");
      const data = await res.json();
      if (data.leaderboard) setLeaderboard(data.leaderboard);
    } catch {
      // silent
    }
    setLeaderboardLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchActionCenter = useCallback(async () => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/action-center");
      const data = await res.json();
      if (data.items) setActionItems(data.items);
      if (data.urgent !== undefined) setUrgentCount(data.urgent);
    } catch { /* silent */ }
    setActionLoading(false);
  }, []);

  const fetchRewardRules = useCallback(async () => {
    setRewardLoading(true);
    try {
      const res = await fetch("/api/admin/reward-rules");
      const data = await res.json();
      if (data.rules) setRewardRules(data.rules);
    } catch { /* silent */ }
    setRewardLoading(false);
  }, []);

  useEffect(() => {
    if (activeTab === "leaderboard" && leaderboard.length === 0) {
      fetchLeaderboard();
    }
  }, [activeTab, leaderboard.length, fetchLeaderboard]);

  useEffect(() => {
    if (activeTab === "aktionen") fetchActionCenter();
  }, [activeTab, fetchActionCenter]);

  useEffect(() => {
    if (activeTab === "rewards" && rewardRules.length === 0) fetchRewardRules();
  }, [activeTab, rewardRules.length, fetchRewardRules]);

  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const res = await fetch("/api/admin/analytics");
      const data = await res.json();
      setAnalytics(data);
    } catch { /* silent */ }
    setAnalyticsLoading(false);
  }, []);

  useEffect(() => {
    if (activeTab === "uebersicht" && !analytics) fetchAnalytics();
  }, [activeTab, analytics, fetchAnalytics]);

  const fetchScrapeStatus = useCallback(async () => {
    setScrapeStatusLoading(true);
    try {
      const res = await fetch("/api/admin/scrape-status");
      const data = await res.json();
      setScrapeStatus(data);
    } catch { /* silent */ }
    setScrapeStatusLoading(false);
  }, []);

  // Load scrape status once on mount
  useEffect(() => { fetchScrapeStatus(); }, [fetchScrapeStatus]);

  async function handleAddStelle() {
    setAddStelleLoading(true);
    setAddStelleMsg(null);
    try {
      const res = await fetch("/api/admin/add-stelle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addStelleForm),
      });
      const data = await res.json();
      if (data.error) {
        setAddStelleMsg({ type: "err", text: data.error });
      } else {
        setAddStelleMsg({ type: "ok", text: "Stelle erfolgreich hinzugefügt!" });
        setAddStelleForm({ firmenname: "", email: "", bereich: "", name: "", geschlecht: "", telefonnummer: "", notizen: "" });
        fetchScrapeStatus();
      }
    } catch {
      setAddStelleMsg({ type: "err", text: "Netzwerkfehler" });
    }
    setAddStelleLoading(false);
  }

  async function handleAddTerm() {
    if (!newTermInput.trim() || newTermInput.trim().length < 3) return;
    setNewTermLoading(true);
    await fetch("/api/admin/scrape-terms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ term: newTermInput.trim() }),
    });
    setNewTermInput("");
    await fetchScrapeStatus();
    setNewTermLoading(false);
  }

  async function handleDeleteTerm(id: string) {
    await fetch("/api/admin/scrape-terms", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await fetchScrapeStatus();
  }

  async function handleToggleTerm(id: string, is_active: boolean) {
    await fetch("/api/admin/scrape-terms", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, is_active }),
    });
    await fetchScrapeStatus();
  }

  const fetchInbox = useCallback(async () => {
    setInboxLoading(true);
    try {
      const res = await fetch("/api/admin/inbox-overview");
      const data = await res.json();
      if (data.emails) setInboxEmails(data.emails);
    } catch { /* silent */ }
    setInboxLoading(false);
  }, []);

  const syncAllInboxes = useCallback(async () => {
    setInboxSyncing(true);
    setInboxSyncMsg("");
    try {
      const res = await fetch("/api/admin/inbox-overview", { method: "POST" });
      const data = await res.json();
      setInboxSyncMsg(data.message || "Fertig");
      await fetchInbox();
    } catch {
      setInboxSyncMsg("Fehler beim Synchronisieren");
    }
    setInboxSyncing(false);
  }, [fetchInbox]);

  useEffect(() => {
    if (activeTab === "posteingang" && inboxEmails.length === 0) fetchInbox();
  }, [activeTab, inboxEmails.length, fetchInbox]);

  function updateForm(field: keyof StudentFormData, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  /* ─── Sort helpers ─── */

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className="text-gray-300 ml-0.5">{"\u2195"}</span>;
    return <span className="text-blue-500 ml-0.5">{sortDir === "asc" ? "\u25B2" : "\u25BC"}</span>;
  }

  const filtered = useMemo(() => {
    let list = students;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          (a.Namen || "").toLowerCase().includes(q) ||
          (a.Ziel || "").toLowerCase().includes(q) ||
          (a.Email || "").toLowerCase().includes(q)
      );
    }
    // Sort
    list = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = (a.Namen || "").localeCompare(b.Namen || "");
          break;
        case "credits":
          cmp = (a.monthly_credit || 0) - (b.monthly_credit || 0);
          break;
        case "emailsTotal":
          cmp = (a._sentTotal || 0) - (b._sentTotal || 0);
          break;
        case "emailsToday":
          cmp = (a._sentToday || 0) - (b._sentToday || 0);
          break;
        case "scans":
          cmp = (a._scans || 0) - (b._scans || 0);
          break;
        case "lastLogin":
          cmp = (a.last_login_at || "").localeCompare(b.last_login_at || "");
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [students, search, sortKey, sortDir]);

  /* ─── Edit Modal ─── */

  async function openEditModal(azubi: AdminAzubi) {
    setLoadingEdit(true);
    setEditModal({ mode: "edit", engineId: azubi.id, userId: azubi.user_id || undefined });
    setFormMessage("");
    setStudentStats(null);
    try {
      const res = await fetch(`/api/admin/manage-student?id=${azubi.id}`);
      const data = await res.json();
      if (data.student) {
        const s = data.student;
        setForm({
          namen: s.Namen || "",
          email: s.Email || "",
          password: "",
          ziel: s.Ziel || "",
          deutschNiveau: s["Deutsch Niveau"] || "",
          art: s.Art || "Ausbildung-lite",
          videoLink: s.BewerbungsVideoLink || "",
          fotoLink: s.BewerbungsfotoLink || "",
          driveLink: s.drive_folder_id ? `https://drive.google.com/drive/folders/${s.drive_folder_id}` : "",
          motivationsschreiben: s.Motivationsschreiben || "",
          profil: s.Profil || "",
          infos: s.Infos || "",
          gmailAddress: data.gmailEmail || s.Email || "",
          gmailAppPassword: "",
          credits: s.monthly_credit || 0,
          autoRefill: s.credit_auto_refill || 0,
          maxDailyEmails: s.max_daily_emails || 10,
          whatsapp: s.whatsapp || "",
        });
      }
      if (data.stats) setStudentStats(data.stats);
    } catch {
      setFormMessage("Fehler beim Laden der Daten");
    }
    setLoadingEdit(false);
  }

  function openCreateModal() {
    setEditModal({ mode: "create" });
    setForm(emptyForm);
    setFormMessage("");
    setStudentStats(null);
  }

  async function handleFormSubmit() {
    setFormSaving(true);
    setFormMessage("");
    try {
      if (editModal?.mode === "create") {
        const res = await fetch("/api/admin/manage-student", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (data.success) {
          setFormMessage("Student erstellt!");
          setEditModal(null);
          fetchData();
        } else {
          setFormMessage("Fehler: " + data.error);
        }
      } else if (editModal?.mode === "edit") {
        const res = await fetch("/api/admin/manage-student", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            engineId: editModal.engineId,
            userId: editModal.userId,
            ...form,
            newPassword: form.password || undefined,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setFormMessage("Gespeichert!");
          setEditModal(null);
          fetchData();
        } else {
          setFormMessage("Fehler: " + data.error);
        }
      }
    } catch (e: any) {
      setFormMessage("Fehler: " + e.message);
    }
    setFormSaving(false);
  }

  /* ─── SMTP Testing ─── */

  async function testSmtp(userId: string) {
    setSmtpStatus((prev) => ({ ...prev, [userId]: { status: "loading" } }));
    try {
      const res = await fetch("/api/admin/test-smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      setSmtpStatus((prev) => ({
        ...prev,
        [userId]: {
          status: data.status || (data.success ? "connected" : "failed"),
          gmail: data.gmail,
          error: data.error,
        },
      }));
    } catch {
      setSmtpStatus((prev) => ({ ...prev, [userId]: { status: "failed", error: "Netzwerkfehler" } }));
    }
  }

  async function testAllSmtp() {
    const withGmail = students.filter((a) => a.gmail_app_password_set && a.user_id);
    for (const a of withGmail) {
      testSmtp(a.user_id!);
    }
  }

  /* ─── WhatsApp Login Dialog öffnen ─── */

  function openWaDialog(azubi: AdminAzubi) {
    setWaDialog(azubi);
    setWaPhone(azubi.whatsapp || "");
  }

  function sendWhatsAppFromDialog() {
    if (!waDialog) return;
    const phone = waPhone.replace(/\D/g, "");
    if (!phone) { alert("Bitte WhatsApp-Nummer eingeben."); return; }
    const msg = encodeURIComponent(
      `Hallo ${(waDialog.Namen || "").split(" ")[0]} 👋\n\nHier sind deine TalentScout Login-Daten:\n\n🔗 https://talent-scout-tau.vercel.app/login\n📧 E-Mail: ${waDialog.Email || ""}\n🔑 Passwort: Test1234!\n\nBitte ändere dein Passwort nach dem ersten Login.\n\nBei Fragen einfach melden! 😊`
    );
    window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
    setWaDialog(null);
  }

  /* ─── Konto sperren ─── */

  async function handleBlockStudent() {
    if (!blockDialog) return;
    setBlockLoading(true);
    try {
      await blockStudent(blockDialog.id);
      fetchData();
      setBlockDialog(null);
    } catch (e) { alert("Fehler: " + (e as Error).message); }
    setBlockLoading(false);
  }

  /* ─── Manual email send ─── */

  async function handleSendManual() {
    if (!sendDialog?.user_id) return;
    setSendLoading(true);
    setSendResult(null);
    try {
      const res = await fetch("/api/admin/send-emails-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: sendDialog.user_id, count: sendCount }),
      });
      const data = await res.json();
      setSendResult(data);
      fetchData(); // refresh stats
    } catch (e) {
      setSendResult({ sent: 0, errors: 1, message: "Netzwerkfehler: " + (e as Error).message });
    }
    setSendLoading(false);
  }

  /* ─── Inline row actions ─── */

  async function handleStatusChange(id: number, status: string) {
    // Optimistic update
    setStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, Aktiv: status } : s))
    );
    setSaving(id);
    try {
      await updateAzubiStatus(id, status);
      // Re-sync to confirm DB value
      fetchData();
    } catch (e) {
      alert("Fehler beim Speichern: " + (e as Error).message);
      fetchData(); // revert optimistic update
    }
    setSaving(null);
  }

  async function handleVisibilityToggle(id: number, currentVisible: boolean) {
    setSaving(id);
    try { await toggleAzubiVisibility(id, !currentVisible); } catch (e) { alert("Fehler: " + (e as Error).message); }
    setSaving(null);
    fetchData();
  }

  async function handleActiveToggle(id: number, current: boolean) {
    setSaving(id);
    try { await toggleStudentActive(id, !current); } catch (e) { alert("Fehler: " + (e as Error).message); }
    setSaving(null);
    fetchData();
  }

  async function handleDailyEmailToggle(id: number, current: boolean) {
    setSaving(id);
    try { await toggleDailyEmail(id, !current); } catch (e) { alert("Fehler: " + (e as Error).message); }
    setSaving(null);
    fetchData();
  }

  async function handleCreditAction() {
    if (!creditDialog) return;
    const { azubi, mode } = creditDialog;
    setSaving(azubi.id);
    try {
      if (mode === "sperren") {
        await blockStudent(azubi.id);
      } else if (mode === "einmalig") {
        await setOneTimeCredit(azubi.id, parseInt(creditAmount) || 0);
      } else if (mode === "monatlich") {
        await setRecurringCredit(azubi.id, parseInt(creditAmount) || 0);
      }
    } catch (e) {
      alert("Fehler: " + (e as Error).message);
    }
    setSaving(null);
    setCreditDialog(null);
    setCreditAmount("");
    fetchData();
  }

  /* Quick credit actions from modal */
  async function quickCredit(amount: number) {
    if (!editModal?.engineId) return;
    const newVal = form.credits + amount;
    updateForm("credits", newVal);
    try {
      await setOneTimeCredit(editModal.engineId, newVal);
      setFormMessage(`+${amount} Credits hinzugefuegt (jetzt ${newVal})`);
      fetchData();
    } catch (e: any) {
      setFormMessage("Fehler: " + e.message);
    }
  }

  /* ─── Loading state ─── */

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-400">Dashboard wird geladen...</span>
        </div>
      </div>
    );
  }

  /* ─── Aktions-Center handlers ─── */

  async function handleActionDone(emailId: string) {
    try {
      await fetch("/api/admin/action-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailId, action: "done" }),
      });
      setActionItems((prev) => prev.filter((i) => i.id !== emailId));
      setUrgentCount((c) => Math.max(0, c - 1));
    } catch { /* silent */ }
  }

  async function handleCreateTask(item: ActionItem) {
    try {
      await fetch("/api/admin/action-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailId: item.id,
          action: "create_task",
          userId: item.user_id,
          taskTitle: item.subject,
          companyName: item.company_name || item.from_name,
        }),
      });
      setActionItems((prev) =>
        prev.map((i) => i.id === item.id ? { ...i, action_status: "task_created" } : i)
      );
    } catch { /* silent */ }
  }

  /* ─── Reward-Rules handlers ─── */

  async function saveRewardRule(rule: RewardRule, field: "xp_value" | "rule_value" | "is_active", value: number | boolean) {
    setRewardSaving(rule.id);
    try {
      await fetch("/api/admin/reward-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ruleId: rule.id,
          ...(field === "xp_value" ? { ruleValue: value } : {}),
          ...(field === "is_active" ? { isActive: value } : {}),
        }),
      });
      setRewardRules((prev) =>
        prev.map((r) => r.id === rule.id ? { ...r, [field]: value } : r)
      );
    } catch { /* silent */ }
    setRewardSaving(null);
  }

  /* ─── Leaderboard helpers ─── */

  function getLevelInfo(level: number) {
    if (level >= 16) return { name: "Elite", badge: "💎", color: "text-purple-600", bg: "bg-purple-50" };
    if (level >= 11) return { name: "Profi", badge: "🥇", color: "text-yellow-600", bg: "bg-yellow-50" };
    if (level >= 6) return { name: "Fortgeschritten", badge: "🥈", color: "text-slate-600", bg: "bg-slate-50" };
    return { name: "Einsteiger", badge: "🥉", color: "text-amber-600", bg: "bg-amber-50" };
  }

  function RankBadge({ rank }: { rank: number }) {
    if (rank === 1) return <span className="text-2xl">🥇</span>;
    if (rank === 2) return <span className="text-2xl">🥈</span>;
    if (rank === 3) return <span className="text-2xl">🥉</span>;
    return <span className="text-sm font-bold text-gray-400 w-8 text-center">#{rank}</span>;
  }

  /* ─── Email-Diagnose ─── */

  async function handleDiagnose() {
    setDiagLoading(true);
    setDiagResult(null);
    try {
      const res = await fetch("/api/admin/email-diagnose");
      const data = await res.json();
      setDiagResult(data);
    } catch (e) {
      setDiagResult({ error: (e as Error).message });
    }
    setDiagLoading(false);
  }

  /* ─── Arbeitsagentur-Scrape ─── */

  async function handleScrape(mode: "single" | "batch") {
    setScrapeLoading(true);
    setScrapeResult(null);
    try {
      const body: Record<string, unknown> = {
        size: 25,
        pages: 1,
        maxInserts: scrapeMax || 25,
      };
      if (mode === "single") {
        if (!scrapeWas.trim()) {
          setScrapeResult({ error: "Bitte einen Beruf eingeben." });
          setScrapeLoading(false);
          return;
        }
        body.was = scrapeWas.trim();
        if (scrapeWo.trim()) body.wo = scrapeWo.trim();
        if (scrapeUmkreis > 0) body.umkreis = scrapeUmkreis;
      } else if (scrapeWo.trim()) {
        body.wo = scrapeWo.trim();
        if (scrapeUmkreis > 0) body.umkreis = scrapeUmkreis;
      }
      const res = await fetch("/api/admin/scrape-arbeitsagentur", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setScrapeResult(data);
    } catch (e) {
      setScrapeResult({ error: (e as Error).message });
    }
    setScrapeLoading(false);
  }

  /* ─── Render ─── */

  return (
    <div className="space-y-6">
      {/* ── Stats Row ── */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          <StatCard label="Studenten" value={stats.totalStudents} color="text-gray-800" />
          <StatCard label="Gmail aktiv" value={stats.activeStudents} sub={`${Math.round((stats.activeStudents / Math.max(stats.totalStudents, 1)) * 100)}%`} color="text-blue-600" />
          <StatCard label="Heute gesendet" value={stats.emailsSentToday} color="text-emerald-600" />
          <StatCard label="Diese Woche" value={stats.emailsSentWeek} color="text-violet-600" />
          <StatCard label="Gesamt gesendet" value={stats.emailsSentTotal} color="text-indigo-600" />
          <StatCard label="Antwortrate" value={stats.responseRate + "%"} color="text-amber-600" />
          <StatCard label="Interviews" value={stats.interviews} color="text-rose-600" />
        </div>
      )}

      {/* ── Scraping Live-Status (immer sichtbar) ── */}
      <div className={`rounded-2xl border shadow-sm transition-colors ${scrapeStatus?.isLikelyRunning ? "border-teal-300 bg-teal-50/60" : "border-gray-100 bg-white"}`}>
        {/* ── Top row: status + counters ── */}
        <div className="flex items-center justify-between px-5 py-3 gap-3 flex-wrap border-b border-gray-50">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base">🔎</span>
            <span className="text-sm font-semibold text-gray-800">Automatisches Scraping</span>
            {scrapeStatus?.isLikelyRunning ? (
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-teal-700 bg-teal-100 border border-teal-200 rounded-full px-2 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse inline-block" />
                Läuft gerade
              </span>
            ) : scrapeStatus?.lastRunAt ? (
              <span className="text-[11px] text-gray-400">Zuletzt: {new Date(scrapeStatus.lastRunAt).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
            ) : null}
            {!scrapeStatus?.isLikelyRunning && scrapeStatus?.nextRunsUTC[0] && (
              <span className="text-[11px] text-gray-400">· Nächster Lauf: {new Date(scrapeStatus.nextRunsUTC[0]).toLocaleString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr</span>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs text-gray-500"><span className="font-semibold text-gray-700">{scrapeStatus?.todayInserted ?? "—"}</span> heute · <span className="font-semibold text-gray-700">{scrapeStatus?.weekInserted ?? "—"}</span> diese Woche</span>
            <button onClick={fetchScrapeStatus} disabled={scrapeStatusLoading} className="px-2 py-1 text-xs bg-white border border-gray-200 text-gray-400 rounded-lg hover:bg-gray-50 transition-colors">
              {scrapeStatusLoading ? "…" : "↻"}
            </button>
          </div>
        </div>

        {/* ── Terms rows ── */}
        <div className="px-5 py-3 space-y-2.5">
          {/* Student terms (read-only) */}
          {scrapeStatus && scrapeStatus.studentTerms.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-gray-400 font-medium shrink-0">👥 Studenten-Ziele:</span>
              {scrapeStatus.studentTerms.map((term) => {
                const stat = scrapeStatus.lastRunStats.find((s) => s.bereich?.toLowerCase().includes(term.toLowerCase()) || term.toLowerCase().includes((s.bereich ?? "").toLowerCase()));
                return (
                  <span key={term} className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${scrapeStatus.isLikelyRunning ? "bg-teal-100 text-teal-700 border-teal-200" : "bg-gray-100 text-gray-600 border-gray-200"}`}>
                    {term}{stat && stat.inserted > 0 ? <span className="ml-1 text-teal-600 font-semibold">+{stat.inserted}</span> : ""}
                  </span>
                );
              })}
            </div>
          )}

          {/* Extra terms (editable) */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-gray-400 font-medium shrink-0">➕ Manuell hinzugefügt:</span>
            {scrapeStatus?.extraTerms.map((et) => {
              const stat = scrapeStatus.lastRunStats.find((s) => s.bereich?.toLowerCase().includes(et.term.toLowerCase()) || et.term.toLowerCase().includes((s.bereich ?? "").toLowerCase()));
              return (
                <span key={et.id} className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border font-medium transition-opacity ${et.is_active ? "bg-blue-100 text-blue-700 border-blue-200" : "bg-gray-100 text-gray-400 border-gray-200 opacity-60"}`}>
                  <button onClick={() => handleToggleTerm(et.id, !et.is_active)} title={et.is_active ? "Deaktivieren" : "Aktivieren"} className="hover:opacity-70">
                    {et.is_active ? "●" : "○"}
                  </button>
                  {et.term}{stat && stat.inserted > 0 ? <span className="ml-0.5 text-teal-600 font-semibold">+{stat.inserted}</span> : ""}
                  <button onClick={() => handleDeleteTerm(et.id)} className="ml-0.5 hover:text-red-500 transition-colors" title="Entfernen">×</button>
                </span>
              );
            })}
            {(!scrapeStatus?.extraTerms || scrapeStatus.extraTerms.length === 0) && (
              <span className="text-[11px] text-gray-400 italic">Noch keine manuellen Suchbegriffe</span>
            )}
          </div>

          {/* Add new term input */}
          <div className="flex items-center gap-2 pt-0.5">
            <input
              type="text"
              value={newTermInput}
              onChange={(e) => setNewTermInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddTerm()}
              placeholder="Beruf zum Scraping hinzufügen, z. B. Altenpflegehelfer…"
              className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-300 max-w-sm"
            />
            <button
              onClick={handleAddTerm}
              disabled={newTermLoading || newTermInput.trim().length < 3}
              className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors whitespace-nowrap"
            >
              {newTermLoading ? "…" : "+ Zur Suche hinzufügen"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Stelle manuell hinzufügen Modal ── */}
      {addStelleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-800">Stelle manuell hinzufügen</h3>
                <p className="text-xs text-gray-400 mt-0.5">Direkt in den Bewerbungs-Pool einfügen</p>
              </div>
              <button onClick={() => { setAddStelleOpen(false); setAddStelleMsg(null); }} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-500 block mb-1">Firmenname *</label>
                <Input value={addStelleForm.firmenname} onChange={(e) => setAddStelleForm((f) => ({ ...f, firmenname: e.target.value }))} placeholder="z. B. Physiozentrum Berlin GmbH" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-500 block mb-1">E-Mail Adresse *</label>
                <Input type="email" value={addStelleForm.email} onChange={(e) => setAddStelleForm((f) => ({ ...f, email: e.target.value }))} placeholder="bewerbung@firma.de" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-500 block mb-1">Bereich / Beruf *</label>
                <Input value={addStelleForm.bereich} onChange={(e) => setAddStelleForm((f) => ({ ...f, bereich: e.target.value }))} placeholder="z. B. Physiotherapeut" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Ansprechpartner</label>
                <Input value={addStelleForm.name} onChange={(e) => setAddStelleForm((f) => ({ ...f, name: e.target.value }))} placeholder="z. B. Müller" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Geschlecht</label>
                <select
                  value={addStelleForm.geschlecht}
                  onChange={(e) => setAddStelleForm((f) => ({ ...f, geschlecht: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                >
                  <option value="">Unbekannt</option>
                  <option value="Herr">Herr</option>
                  <option value="Frau">Frau</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Telefon</label>
                <Input value={addStelleForm.telefonnummer} onChange={(e) => setAddStelleForm((f) => ({ ...f, telefonnummer: e.target.value }))} placeholder="+49 30 ..." />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Notizen</label>
                <Input value={addStelleForm.notizen} onChange={(e) => setAddStelleForm((f) => ({ ...f, notizen: e.target.value }))} placeholder="optional" />
              </div>
            </div>

            {addStelleMsg && (
              <div className={`text-xs rounded-lg px-3 py-2 ${addStelleMsg.type === "ok" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                {addStelleMsg.text}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button onClick={() => { setAddStelleOpen(false); setAddStelleMsg(null); }} className="px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Abbrechen</button>
              <button
                onClick={handleAddStelle}
                disabled={addStelleLoading || !addStelleForm.firmenname.trim() || !addStelleForm.email.trim() || !addStelleForm.bereich.trim()}
                className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {addStelleLoading ? "Wird gespeichert…" : "Zur Pool hinzufügen"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Email-Diagnose ── */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50/40 shadow-sm">
        <button
          type="button"
          onClick={() => {
            setDiagOpen((v) => !v);
            if (!diagResult) handleDiagnose();
          }}
          className="w-full flex items-center justify-between p-4 hover:bg-amber-50 rounded-2xl transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">🩺</span>
            <div className="text-left">
              <div className="text-sm font-semibold text-gray-800">
                Email-Versand Diagnose
              </div>
              <div className="text-xs text-gray-500">
                Warum gehen keine Emails raus? Hier sehen.
              </div>
            </div>
          </div>
          <span className="text-gray-400 text-sm">{diagOpen ? "▲" : "▼"}</span>
        </button>

        {diagOpen && (
          <div className="p-4 border-t border-amber-200 space-y-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDiagnose}
                disabled={diagLoading}
                className="px-4 py-2 text-sm font-medium bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 text-white rounded-lg transition-colors"
              >
                {diagLoading ? "Prüfe…" : "Erneut prüfen"}
              </button>
            </div>

            {diagResult?.error && (
              <div className="text-red-600 text-sm">Fehler: {diagResult.error}</div>
            )}

            {diagResult?.summary && (
              <>
                {/* Übersicht */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div className="bg-white rounded-lg p-3 border border-gray-100">
                    <div className="text-gray-400">Studenten gesamt</div>
                    <div className="text-2xl font-bold text-gray-800">{diagResult.summary.totalStudents}</div>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-gray-100">
                    <div className="text-gray-400">Bereit zu senden</div>
                    <div className="text-2xl font-bold text-emerald-600">{diagResult.summary.readyToSend}</div>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-gray-100">
                    <div className="text-gray-400">Blockiert</div>
                    <div className="text-2xl font-bold text-red-600">{diagResult.summary.blocked}</div>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-gray-100">
                    <div className="text-gray-400">Firmen-Pool</div>
                    <div className="text-2xl font-bold text-indigo-600">{diagResult.summary.poolSize}</div>
                  </div>
                </div>

                {/* Environment */}
                {diagResult.environment && (
                  <div className="bg-white rounded-lg p-3 border border-gray-100 text-xs">
                    <div className="font-semibold text-gray-700 mb-1">Server-Konfiguration</div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      <span className={diagResult.environment.cronSecretSet ? "text-emerald-600" : "text-red-600 font-semibold"}>
                        {diagResult.environment.cronSecretSet ? "✓" : "✗"} CRON_SECRET
                      </span>
                      <span className={diagResult.environment.supabaseUrlSet ? "text-emerald-600" : "text-red-600 font-semibold"}>
                        {diagResult.environment.supabaseUrlSet ? "✓" : "✗"} SUPABASE_URL
                      </span>
                      <span className={diagResult.environment.serviceKeySet ? "text-emerald-600" : "text-red-600 font-semibold"}>
                        {diagResult.environment.serviceKeySet ? "✓" : "✗"} SERVICE_ROLE_KEY
                      </span>
                      <span className={diagResult.environment.anthropicKeySet ? "text-emerald-600" : "text-amber-600"}>
                        {diagResult.environment.anthropicKeySet ? "✓" : "?"} ANTHROPIC_API_KEY
                      </span>
                    </div>
                  </div>
                )}

                {/* Top Blocker */}
                {diagResult.topBlockers && diagResult.topBlockers.length > 0 && (
                  <div className="bg-white rounded-lg p-3 border border-gray-100 text-xs">
                    <div className="font-semibold text-gray-700 mb-2">Häufigste Ursachen</div>
                    <ul className="space-y-1">
                      {diagResult.topBlockers.map((b) => (
                        <li key={b.reason} className="flex justify-between">
                          <span className="text-gray-700">{b.reason}</span>
                          <span className="font-semibold text-red-600">{b.count}×</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Recent Failures */}
                {diagResult.recentFailures && diagResult.recentFailures.length > 0 && (
                  <details className="bg-white rounded-lg p-3 border border-gray-100 text-xs">
                    <summary className="font-semibold text-gray-700 cursor-pointer">
                      Fehlgeschlagene Versuche (letzte 24h, {diagResult.recentFailures.length})
                    </summary>
                    <ul className="mt-2 space-y-1">
                      {diagResult.recentFailures.map((f, i) => (
                        <li key={i} className="border-b border-gray-50 pb-1">
                          <div className="text-gray-700">{f.company || "?"} → {f.email}</div>
                          <div className="text-red-600 truncate">{f.error}</div>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                {/* Pro Student */}
                {diagResult.students && (
                  <details className="bg-white rounded-lg p-3 border border-gray-100 text-xs">
                    <summary className="font-semibold text-gray-700 cursor-pointer">
                      Status pro Student ({diagResult.students.length})
                    </summary>
                    <div className="mt-2 max-h-96 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="text-gray-400 sticky top-0 bg-white">
                          <tr>
                            <th className="text-left py-1">Student</th>
                            <th className="text-left py-1">Status</th>
                            <th className="text-right py-1">Pool</th>
                            <th className="text-right py-1">Heute</th>
                            <th className="text-right py-1">Monat</th>
                          </tr>
                        </thead>
                        <tbody>
                          {diagResult.students.map((s) => (
                            <tr key={s.id} className="border-t border-gray-50">
                              <td className="py-1">
                                <div className="font-medium text-gray-700">{s.name || "(ohne Name)"}</div>
                                <div className="text-gray-400 truncate max-w-xs">{s.ziel}</div>
                              </td>
                              <td className="py-1">
                                {s.ready ? (
                                  <span className="text-emerald-600 font-semibold">✓ bereit</span>
                                ) : (
                                  <div className="text-red-600">
                                    {s.blockers.map((b, i) => (
                                      <div key={i}>· {b}</div>
                                    ))}
                                  </div>
                                )}
                              </td>
                              <td className="text-right py-1 text-gray-600">{s.poolMatches}</td>
                              <td className="text-right py-1 text-gray-600">{s.heuteGesendet}</td>
                              <td className="text-right py-1 text-gray-600">{s.monatlichGesendet}/{s.monthlyCredit}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Arbeitsagentur-Scraper ── */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setScrapeOpen((v) => !v)}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-2xl transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔎</span>
            <div className="text-left">
              <div className="text-sm font-semibold text-gray-800">
                Bewerbungs-Pool füllen (Agentur für Arbeit)
              </div>
              <div className="text-xs text-gray-400">
                Sucht offene Stellen und fügt sie automatisch in den Pool ein
              </div>
            </div>
          </div>
          <span className="text-gray-400 text-sm">{scrapeOpen ? "▲" : "▼"}</span>
        </button>

        {scrapeOpen && (
          <div className="p-4 border-t border-gray-100 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Beruf (leer = alle Studenten-Ziele)</label>
                <Input
                  value={scrapeWas}
                  onChange={(e) => setScrapeWas(e.target.value)}
                  placeholder="z. B. Pflegefachmann"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Ort (optional)</label>
                <Input
                  value={scrapeWo}
                  onChange={(e) => setScrapeWo(e.target.value)}
                  placeholder="z. B. Berlin"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Umkreis (km)</label>
                <Input
                  type="number"
                  value={scrapeUmkreis || ""}
                  onChange={(e) => setScrapeUmkreis(parseInt(e.target.value) || 0)}
                  placeholder="0 = ohne"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Max. neue Einträge</label>
                <Input
                  type="number"
                  value={scrapeMax}
                  onChange={(e) => setScrapeMax(parseInt(e.target.value) || 25)}
                  placeholder="25"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleScrape("single")}
                disabled={scrapeLoading || !scrapeWas.trim()}
                className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg transition-colors"
              >
                {scrapeLoading ? "Suche läuft…" : "Diesen Beruf suchen"}
              </button>
              <button
                type="button"
                onClick={() => handleScrape("batch")}
                disabled={scrapeLoading}
                className="px-4 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white rounded-lg transition-colors"
              >
                {scrapeLoading ? "Suche läuft…" : "Für alle Studenten-Ziele suchen"}
              </button>
              <span className="text-xs text-gray-400 ml-2">
                Läuft auch nachts automatisch um 03:00 Uhr.
              </span>
            </div>

            {scrapeResult && (
              <div className="mt-2 rounded-xl bg-gray-50 border border-gray-100 p-3 text-xs text-gray-700">
                {scrapeResult.error ? (
                  <div className="text-red-600">Fehler: {scrapeResult.error}</div>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 font-medium">
                      <span>✅ Neu im Pool: <span className="text-emerald-600 font-semibold">{scrapeResult.stats?.inserted ?? scrapeResult.total?.inserted ?? 0}</span></span>
                      <span>✉️ Ohne E-Mail: {scrapeResult.stats?.noEmail ?? scrapeResult.total?.noEmail ?? 0}</span>
                      <span>♻️ Duplikate: {scrapeResult.stats?.duplicateInPool ?? scrapeResult.total?.duplicateInPool ?? 0}</span>
                      <span>📋 Schon gesehen: {scrapeResult.stats?.alreadyLogged ?? scrapeResult.total?.alreadyLogged ?? 0}</span>
                      {(scrapeResult.stats?.errors ?? scrapeResult.total?.errors ?? 0) > 0 && (
                        <span className="text-red-600">⚠️ Fehler: {scrapeResult.stats?.errors ?? scrapeResult.total?.errors}</span>
                      )}
                      {scrapeResult.durationMs && (
                        <span className="text-gray-400">⏱ {(scrapeResult.durationMs / 1000).toFixed(1)}s</span>
                      )}
                    </div>
                    {scrapeResult.perSearch && scrapeResult.perSearch.length > 0 && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                          Details ({scrapeResult.perSearch.length} Berufe)
                        </summary>
                        <ul className="mt-2 space-y-1">
                          {scrapeResult.perSearch.map((p) => (
                            <li key={p.was} className="flex justify-between">
                              <span className="text-gray-700">{p.was}</span>
                              <span className="text-gray-500">
                                +{p.inserted} neu · {p.noEmail} o.Mail · {p.duplicates} Dup
                              </span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl w-fit flex-wrap">
        {([
          { key: "uebersicht" as AdminTab, label: "Übersicht", icon: "📊", badge: null },
          { key: "studenten" as AdminTab, label: "Studenten", icon: "👥", badge: null },
          { key: "aktionen" as AdminTab, label: "Aktionen", icon: "⚡", badge: urgentCount > 0 ? urgentCount : null },
          { key: "leaderboard" as AdminTab, label: "Leaderboard", icon: "🏆", badge: null },
          { key: "rewards" as AdminTab, label: "XP-Regeln", icon: "🎯", badge: null },
          { key: "posteingang" as AdminTab, label: "Posteingang", icon: "📬", badge: inboxEmails.filter(e => !e.is_read).length || null },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === tab.key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
            {tab.badge !== null && (
              <span className="ml-1 text-[10px] font-bold bg-red-500 text-white rounded-full px-1.5 py-0.5 min-w-[16px] text-center">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Leaderboard Tab ── */}
      {activeTab === "leaderboard" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-800">XP Rangliste</h3>
              <p className="text-xs text-gray-400">Alle Studenten sortiert nach Gesamtpunkten</p>
            </div>
            <button
              onClick={fetchLeaderboard}
              className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
            >
              Aktualisieren
            </button>
          </div>

          {leaderboardLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-7 h-7 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3">🏆</p>
              <p className="text-sm">Noch keine Aktivitäten aufgezeichnet.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
              {/* Top 3 Podium */}
              {leaderboard.length >= 3 && (
                <div className="bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50 border-b border-amber-100 p-6">
                  <div className="flex items-end justify-center gap-4">
                    {/* #2 */}
                    <div className="flex flex-col items-center gap-2 pb-2">
                      <StudentAvatar name={leaderboard[1].name} fotoLink={leaderboard[1].fotoLink} />
                      <span className="text-2xl">🥈</span>
                      <div className="text-center">
                        <p className="text-xs font-semibold text-gray-700 truncate max-w-[80px]">{leaderboard[1].name.split(" ")[0]}</p>
                        <p className="text-[10px] text-gray-400">Lvl {leaderboard[1].level} · {leaderboard[1].totalPoints.toLocaleString("de-DE")} XP</p>
                      </div>
                    </div>
                    {/* #1 */}
                    <div className="flex flex-col items-center gap-2 scale-110">
                      <div className="relative">
                        <StudentAvatar name={leaderboard[0].name} fotoLink={leaderboard[0].fotoLink} />
                        <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-lg">👑</span>
                      </div>
                      <span className="text-3xl">🥇</span>
                      <div className="text-center">
                        <p className="text-sm font-bold text-gray-800 truncate max-w-[90px]">{leaderboard[0].name.split(" ")[0]}</p>
                        <p className="text-[10px] text-amber-600 font-semibold">Lvl {leaderboard[0].level} · {leaderboard[0].totalPoints.toLocaleString("de-DE")} XP</p>
                      </div>
                    </div>
                    {/* #3 */}
                    <div className="flex flex-col items-center gap-2">
                      <StudentAvatar name={leaderboard[2].name} fotoLink={leaderboard[2].fotoLink} />
                      <span className="text-xl">🥉</span>
                      <div className="text-center">
                        <p className="text-xs font-semibold text-gray-700 truncate max-w-[80px]">{leaderboard[2].name.split(" ")[0]}</p>
                        <p className="text-[10px] text-gray-400">Lvl {leaderboard[2].level} · {leaderboard[2].totalPoints.toLocaleString("de-DE")} XP</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Full ranking table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left text-xs text-gray-400 uppercase tracking-wider bg-gray-50/60">
                      <th className="px-4 py-3 font-medium w-12 text-center">#</th>
                      <th className="px-4 py-3 font-medium">Student</th>
                      <th className="px-4 py-3 font-medium text-center">Level</th>
                      <th className="px-4 py-3 font-medium text-center">XP Gesamt</th>
                      <th className="px-4 py-3 font-medium text-center">XP Fortschritt</th>
                      <th className="px-4 py-3 font-medium text-center">Streak 🔥</th>
                      <th className="px-4 py-3 font-medium text-center">Rekord</th>
                      <th className="px-4 py-3 font-medium text-center">Bewerbungen</th>
                      <th className="px-4 py-3 font-medium text-center">Zuletzt aktiv</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((entry, idx) => {
                      const li = getLevelInfo(entry.level);
                      const xpPct = entry.xpToNext > 0 ? Math.min(100, Math.round((entry.xp / entry.xpToNext) * 100)) : 100;
                      const isTop3 = idx < 3;
                      return (
                        <tr
                          key={entry.id}
                          className={`border-b border-gray-50 hover:bg-amber-50/30 transition-colors ${isTop3 ? "bg-yellow-50/20" : ""}`}
                        >
                          <td className="px-4 py-3 text-center">
                            <RankBadge rank={idx + 1} />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <StudentAvatar name={entry.name} fotoLink={entry.fotoLink} />
                              <div>
                                <div className="font-medium text-gray-800 text-sm">{entry.name}</div>
                                <div className="text-[11px] text-gray-400">{entry.ziel || "—"}</div>
                              </div>
                              {!entry.studentActive && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-red-50 text-red-500 rounded-md">inaktiv</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold ${li.bg} ${li.color}`}>
                              {li.badge} {entry.level}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="font-mono font-bold text-gray-800">{entry.totalPoints.toLocaleString("de-DE")}</span>
                            <span className="text-[10px] text-gray-400 ml-0.5">XP</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 min-w-[100px]">
                              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full"
                                  style={{ width: `${xpPct}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-gray-400 whitespace-nowrap">{xpPct}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`font-mono font-bold text-lg ${entry.currentStreak >= 7 ? "text-orange-500" : entry.currentStreak > 0 ? "text-amber-500" : "text-gray-300"}`}>
                              {entry.currentStreak}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="font-mono text-sm text-gray-500">{entry.longestStreak}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="font-mono text-sm text-blue-600 font-semibold">{entry.emailsSent}</span>
                          </td>
                          <td className="px-4 py-3 text-center text-xs text-gray-400">
                            {entry.lastActive
                              ? new Date(entry.lastActive).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Aktions-Center Tab ── */}
      {activeTab === "aktionen" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-800">Aktions-Center</h3>
              <p className="text-xs text-gray-400">Wichtige Emails die eine Reaktion brauchen</p>
            </div>
            <button
              onClick={fetchActionCenter}
              className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
            >
              Aktualisieren
            </button>
          </div>

          {actionLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : actionItems.length === 0 ? (
            <div className="text-center py-16 rounded-2xl border border-gray-100 bg-white">
              <p className="text-4xl mb-3">✅</p>
              <p className="text-sm font-medium text-gray-600">Alles erledigt!</p>
              <p className="text-xs text-gray-400 mt-1">Keine ausstehenden Aktionen.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {actionItems.map((item) => {
                const isUrgent = ["interview_invite", "offer"].includes(item.classification);
                const isTaskCreated = item.action_status === "task_created";
                const classLabel: Record<string, { label: string; color: string; bg: string }> = {
                  interview_invite: { label: "🎯 Interview", color: "text-green-700", bg: "bg-green-50 border-green-200" },
                  offer:            { label: "🎉 Zusage",    color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
                  document_request: { label: "📄 Dokumente", color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
                  followup_request: { label: "📩 Follow-up", color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
                };
                const cl = classLabel[item.classification] || { label: item.classification, color: "text-gray-600", bg: "bg-gray-50 border-gray-200" };

                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl border p-4 flex items-start gap-4 ${isUrgent ? "border-l-4 border-l-green-500 bg-green-50/30 border-gray-100" : "bg-white border-gray-100"}`}
                  >
                    <StudentAvatar name={item.studentName} fotoLink={item.fotoLink} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-gray-800">{item.studentName}</span>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cl.bg} ${cl.color}`}>
                          {cl.label}
                        </span>
                        {isTaskCreated && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 border border-purple-200">
                            ✓ Aufgabe erstellt
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-gray-700 mt-1 truncate">{item.subject}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Von: {item.from_name || item.from_email}
                        {item.company_name && ` · ${item.company_name}`}
                        {" · "}
                        {new Date(item.received_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </p>
                      {item.snippet && (
                        <p className="text-xs text-gray-400 mt-1 line-clamp-2 italic">"{item.snippet}"</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      {!isTaskCreated && (
                        <button
                          onClick={() => handleCreateTask(item)}
                          className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
                        >
                          + Aufgabe
                        </button>
                      )}
                      <button
                        onClick={() => handleActionDone(item.id)}
                        className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Erledigt ✓
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Reward-Rules Tab ── */}
      {activeTab === "rewards" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-800">XP-Regeln</h3>
              <p className="text-xs text-gray-400">Punkte für Aktionen konfigurieren</p>
            </div>
            <button
              onClick={fetchRewardRules}
              className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
            >
              Aktualisieren
            </button>
          </div>

          {rewardLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-7 h-7 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs text-gray-400 uppercase tracking-wider bg-gray-50/60">
                    <th className="px-5 py-3 font-medium">Aktion</th>
                    <th className="px-5 py-3 font-medium">Beschreibung</th>
                    <th className="px-5 py-3 font-medium text-center">XP</th>
                    <th className="px-5 py-3 font-medium text-center">Aktiv</th>
                    <th className="px-5 py-3 font-medium text-center">Zuletzt geändert</th>
                  </tr>
                </thead>
                <tbody>
                  {rewardRules.map((rule) => {
                    const isSaving = rewardSaving === rule.id;
                    const icons: Record<string, string> = {
                      daily_login: "📅",
                      email_sent: "📧",
                      new_contact: "🏢",
                      interview_invite: "🎯",
                      offer_received: "🎉",
                      streak_7: "🔥",
                      streak_30: "💥",
                      profile_complete: "✅",
                    };
                    return (
                      <tr key={rule.id} className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${isSaving ? "opacity-60" : ""}`}>
                        <td className="px-5 py-3">
                          <span className="inline-flex items-center gap-2 font-mono text-xs bg-gray-100 px-2.5 py-1 rounded-lg text-gray-700">
                            <span>{icons[rule.source_type] || "⭐"}</span>
                            {rule.source_type}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-gray-600 text-xs max-w-[200px]">
                          {rule.description || "—"}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <input
                            type="number"
                            min="0"
                            max="1000"
                            defaultValue={rule.xp_value}
                            onBlur={(e) => {
                              const val = parseInt(e.target.value);
                              if (!isNaN(val) && val !== rule.xp_value) {
                                saveRewardRule(rule, "xp_value", val);
                              }
                            }}
                            className="w-16 text-center font-mono font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                          />
                          <span className="text-xs text-gray-400 ml-1">XP</span>
                        </td>
                        <td className="px-5 py-3 text-center">
                          <Toggle
                            on={rule.is_active}
                            onChange={() => saveRewardRule(rule, "is_active", !rule.is_active)}
                            colorOn="bg-green-500"
                            size="sm"
                          />
                        </td>
                        <td className="px-5 py-3 text-center text-xs text-gray-400">
                          {new Date(rule.updated_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                        </td>
                      </tr>
                    );
                  })}
                  {rewardRules.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-12 text-center text-gray-400 text-sm">
                        Keine Regeln gefunden. Bitte stelle sicher, dass die reward_rules Tabelle befüllt ist.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Übersicht / Analytics Tab ── */}
      {activeTab === "uebersicht" && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-800">Analytics Übersicht</h3>
              <p className="text-xs text-gray-400">Echtzeit-Einblick in alle Prozesse</p>
            </div>
            <button
              onClick={fetchAnalytics}
              disabled={analyticsLoading}
              className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
            >
              {analyticsLoading ? "Lädt…" : "Aktualisieren"}
            </button>
          </div>

          {analyticsLoading || !analytics ? (
            <div className="flex items-center justify-center py-24">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* ── Pipeline Funnel ── */}
              <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-6">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-5">Bewerbungs-Pipeline</p>
                <div className="flex items-stretch gap-0">
                  {analytics.pipeline.map((stage, i) => {
                    const colors: Record<string, { bg: string; text: string; bar: string; arrow: string }> = {
                      blue:    { bg: "bg-blue-50",    text: "text-blue-700",    bar: "bg-blue-500",    arrow: "text-blue-200" },
                      indigo:  { bg: "bg-indigo-50",  text: "text-indigo-700",  bar: "bg-indigo-500",  arrow: "text-indigo-200" },
                      violet:  { bg: "bg-violet-50",  text: "text-violet-700",  bar: "bg-violet-500",  arrow: "text-violet-200" },
                      emerald: { bg: "bg-emerald-50", text: "text-emerald-700", bar: "bg-emerald-500", arrow: "text-emerald-200" },
                    };
                    const c = colors[stage.color] || colors.blue;
                    return (
                      <React.Fragment key={stage.label}>
                        <div className={`flex-1 ${c.bg} rounded-xl px-5 py-4 flex flex-col gap-1`}>
                          <p className="text-[11px] font-medium text-gray-500">{stage.label}</p>
                          <p className={`text-3xl font-bold ${c.text}`}>{stage.value.toLocaleString("de-DE")}</p>
                          {stage.rate !== undefined && (
                            <p className="text-[11px] text-gray-400">{stage.rate}% Conversion</p>
                          )}
                        </div>
                        {i < analytics.pipeline.length - 1 && (
                          <div className="flex items-center px-1 text-gray-200 text-2xl select-none">›</div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* Progress bar */}
                <div className="mt-4 flex h-1.5 rounded-full overflow-hidden gap-0.5">
                  {analytics.pipeline.map((stage) => {
                    const max = analytics.pipeline[0]?.value || 1;
                    const pct = Math.max(2, Math.round((stage.value / max) * 100));
                    const barColors: Record<string, string> = { blue: "bg-blue-500", indigo: "bg-indigo-500", violet: "bg-violet-500", emerald: "bg-emerald-500" };
                    return <div key={stage.label} style={{ width: `${pct}%` }} className={`${barColors[stage.color] || "bg-blue-500"} rounded-full`} />;
                  })}
                </div>
              </div>

              {/* ── KPI Cards ── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
                  <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Job-Pool</p>
                  <p className="text-2xl font-bold text-gray-800 mt-1">{analytics.totalPool.toLocaleString("de-DE")}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Stellen gesamt</p>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
                  <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Reply-Rate</p>
                  <p className="text-2xl font-bold text-indigo-600 mt-1">
                    {analytics.totalSent ? Math.round((analytics.totalReceived / analytics.totalSent) * 100) : 0}%
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{analytics.totalReceived} Antworten</p>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
                  <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Gespräche</p>
                  <p className="text-2xl font-bold text-violet-600 mt-1">{analytics.classificationCounts["interview_invite"] ?? 0}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Einladungen</p>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
                  <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Zusagen</p>
                  <p className="text-2xl font-bold text-emerald-600 mt-1">{analytics.classificationCounts["offer"] ?? 0}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Jobangebote</p>
                </div>
              </div>

              {/* ── Charts Row ── */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Email Verlauf (last 30d) */}
                <div className="lg:col-span-2 rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">E-Mail Verlauf — letzte 30 Tage</p>
                  {(() => {
                    const entries = Object.entries(analytics.emailsSentTimeSeries);
                    const maxVal = Math.max(1, ...entries.map(([, v]) => v));
                    return (
                      <div className="flex items-end gap-0.5 h-28">
                        {entries.map(([day, count]) => {
                          const pct = (count / maxVal) * 100;
                          const label = new Date(day).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
                          const isWeekend = [0, 6].includes(new Date(day).getDay());
                          return (
                            <div key={day} className="flex-1 flex flex-col items-center justify-end gap-0.5 group relative" title={`${label}: ${count}`}>
                              <div
                                style={{ height: `${Math.max(2, pct)}%` }}
                                className={`w-full rounded-sm transition-all ${count > 0 ? (isWeekend ? "bg-gray-200" : "bg-blue-500 group-hover:bg-blue-600") : "bg-gray-100"}`}
                              />
                              <span className="absolute bottom-full mb-1 text-[9px] text-gray-600 bg-white border border-gray-100 rounded px-1 py-0.5 opacity-0 group-hover:opacity-100 whitespace-nowrap shadow-sm z-10">
                                {label}: {count}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                  <div className="flex justify-between mt-1.5">
                    <span className="text-[10px] text-gray-400">vor 30 Tagen</span>
                    <span className="text-[10px] text-gray-400">heute</span>
                  </div>
                </div>

                {/* Eingang-Typen */}
                <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Eingang-Typen</p>
                  <div className="space-y-2.5">
                    {[
                      { key: "interview_invite", label: "Vorstellungsgespräch", icon: "🎯", color: "bg-violet-500" },
                      { key: "offer",            label: "Zusage",               icon: "🎉", color: "bg-emerald-500" },
                      { key: "document_request", label: "Dokument-Anfrage",     icon: "📄", color: "bg-blue-500" },
                      { key: "followup_request", label: "Rückfrage",            icon: "📩", color: "bg-amber-500" },
                      { key: "rejection",        label: "Absage",               icon: "❌", color: "bg-red-400" },
                      { key: "other",            label: "Sonstiges",            icon: "📧", color: "bg-gray-300" },
                    ].map(({ key, label, icon, color }) => {
                      const count = analytics.classificationCounts[key] ?? 0;
                      const total = Object.values(analytics.classificationCounts).reduce((a, b) => a + b, 0) || 1;
                      const pct = Math.round((count / total) * 100);
                      return (
                        <div key={key}>
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-xs text-gray-600">{icon} {label}</span>
                            <span className="text-xs font-semibold text-gray-700">{count}</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div style={{ width: `${pct}%` }} className={`h-full ${color} rounded-full`} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* ── Scraping Aktivität ── */}
              <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Scraping Aktivität — letzte 14 Tage</p>
                  <button onClick={() => setAddStelleOpen(true)} className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    + Stelle hinzufügen
                  </button>
                </div>
                {(() => {
                  const entries = Object.entries(analytics.scrapingTimeSeries);
                  const maxVal = Math.max(1, ...entries.map(([, v]) => v));
                  return (
                    <div className="flex items-end gap-1 h-20">
                      {entries.map(([day, count]) => {
                        const pct = (count / maxVal) * 100;
                        const label = new Date(day).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
                        return (
                          <div key={day} className="flex-1 flex flex-col items-center justify-end gap-1 group relative">
                            <div
                              style={{ height: `${Math.max(2, pct)}%` }}
                              className={`w-full rounded-sm ${count > 0 ? "bg-teal-500 group-hover:bg-teal-600" : "bg-gray-100"} transition-all`}
                              title={`${label}: ${count} Jobs`}
                            />
                            <span className="text-[9px] text-gray-400 truncate">{label.slice(0, 5)}</span>
                            <span className="absolute bottom-full mb-1 text-[9px] text-gray-600 bg-white border border-gray-100 rounded px-1 py-0.5 opacity-0 group-hover:opacity-100 whitespace-nowrap shadow-sm z-10">
                              {label}: {count} Jobs
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
                {/* Per-term last 24h stats from scrapeStatus */}
                {scrapeStatus && scrapeStatus.lastRunStats.length > 0 && (
                  <div className="mt-4 border-t border-gray-50 pt-3">
                    <p className="text-[11px] text-gray-400 mb-2">Letzte 24h pro Beruf:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {scrapeStatus.lastRunStats.map((s) => (
                        <span key={s.bereich} className="text-[11px] px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-100">
                          {s.bereich}: <strong>+{s.inserted}</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Kandidaten Pipeline ── */}
              <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Kandidaten Pipeline</p>
                  <p className="text-xs text-gray-400">{analytics.studentPipeline.length} Kandidaten</p>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] text-gray-400 uppercase tracking-wider bg-gray-50/60 border-b border-gray-100">
                      <th className="px-5 py-3 font-medium">Kandidat</th>
                      <th className="px-4 py-3 font-medium text-right">Gesendet</th>
                      <th className="px-4 py-3 font-medium text-right">Antworten</th>
                      <th className="px-4 py-3 font-medium text-right">Gespräche</th>
                      <th className="px-4 py-3 font-medium">Fortschritt</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.studentPipeline.map((s) => {
                      const replyRate = s.sent > 0 ? Math.round((s.received / s.sent) * 100) : 0;
                      const statusColors: Record<string, string> = {
                        "Vorstellungsgespräch": "bg-violet-100 text-violet-700",
                        "Zusage Erhalten": "bg-emerald-100 text-emerald-700",
                        "Vorzusage": "bg-green-100 text-green-700",
                        "ja": "bg-blue-50 text-blue-600",
                        "nein": "bg-gray-100 text-gray-500",
                      };
                      const statusCls = statusColors[s.aktiv] || "bg-gray-50 text-gray-500";
                      return (
                        <tr key={s.userId} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2.5">
                              <StudentAvatar name={s.name} fotoLink={s.fotoLink} />
                              <div>
                                <p className="text-xs font-semibold text-gray-800 truncate max-w-[120px]">{s.name}</p>
                                <p className="text-[11px] text-gray-400 truncate max-w-[120px]">{s.ziel}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-gray-700">{s.sent.toLocaleString("de-DE")}</td>
                          <td className="px-4 py-3 text-right font-mono text-xs text-gray-600">{s.received} <span className="text-gray-400 font-normal">({replyRate}%)</span></td>
                          <td className="px-4 py-3 text-right font-mono text-xs font-bold text-violet-600">{s.interviews}</td>
                          <td className="px-4 py-3 min-w-[100px]">
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                style={{ width: `${Math.min(100, replyRate)}%` }}
                                className="h-full bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full"
                              />
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full ${statusCls}`}>
                              {s.aktiv || "—"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {analytics.studentPipeline.length === 0 && (
                      <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-400">Keine Daten</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Posteingang Tab ── */}
      {activeTab === "posteingang" && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-base font-semibold text-gray-800">Posteingang – Alle Kandidaten</h3>
              <p className="text-xs text-gray-400">Antworten von Unternehmen auf gesendete Bewerbungen</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={inboxStudentFilter}
                onChange={(e) => setInboxStudentFilter(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="alle">Alle Kandidaten</option>
                {Array.from(new Set(inboxEmails.map((e) => e.student_name))).sort().map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <button
                onClick={syncAllInboxes}
                disabled={inboxSyncing}
                className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm flex items-center gap-1.5"
              >
                {inboxSyncing ? (
                  <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /> Sync läuft…</>
                ) : "📥 Sync"}
              </button>
              <button
                onClick={fetchInbox}
                disabled={inboxLoading}
                className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
              >
                Aktualisieren
              </button>
            </div>
          </div>

          {inboxSyncMsg && (
            <div className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
              {inboxSyncMsg}
            </div>
          )}

          {inboxLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="flex gap-4" style={{ minHeight: "400px" }}>
              {/* Email list */}
              <div className="flex-1 rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                {(() => {
                  const filtered = inboxStudentFilter === "alle"
                    ? inboxEmails
                    : inboxEmails.filter((e) => e.student_name === inboxStudentFilter);
                  if (filtered.length === 0) {
                    return (
                      <div className="text-center py-16">
                        <p className="text-4xl mb-3">📭</p>
                        <p className="text-sm font-medium text-gray-600">Keine Emails</p>
                        <p className="text-xs text-gray-400 mt-1">Klicke auf Sync um den Posteingang zu laden.</p>
                      </div>
                    );
                  }
                  return (
                    <ul className="divide-y divide-gray-50">
                      {filtered.map((email) => (
                        <li
                          key={email.id}
                          onClick={() => setInboxSelected(email)}
                          className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50/70 transition-colors ${inboxSelected?.id === email.id ? "bg-blue-50/60" : ""}`}
                        >
                          {!email.is_read && (
                            <span className="mt-1.5 w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                          )}
                          {email.is_read && <span className="mt-1.5 w-2 h-2 shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-gray-800 truncate">
                                {email.from_name || email.from_email}
                              </span>
                              <span className="text-[10px] text-gray-400 shrink-0">
                                {new Date(email.received_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                            <p className="text-xs text-gray-600 truncate mt-0.5">{email.subject}</p>
                            <span className="inline-block mt-1 text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-full px-2 py-0.5 font-medium">
                              {email.student_name}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  );
                })()}
              </div>

              {/* Email detail */}
              {inboxSelected ? (
                <div className="w-96 rounded-2xl border border-gray-100 bg-white shadow-sm p-5 flex flex-col gap-3 overflow-auto">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{inboxSelected.subject}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Von: <span className="font-medium">{inboxSelected.from_name || inboxSelected.from_email}</span>
                        {inboxSelected.from_name && <span className="text-gray-400"> &lt;{inboxSelected.from_email}&gt;</span>}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Kandidat: <span className="font-medium text-indigo-600">{inboxSelected.student_name}</span>
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(inboxSelected.received_at).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <button
                      onClick={() => setInboxSelected(null)}
                      className="text-gray-400 hover:text-gray-600 text-lg leading-none shrink-0"
                    >
                      ×
                    </button>
                  </div>
                  <div className="border-t border-gray-100 pt-3">
                    <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {inboxSelected.body_text || "(Kein Text)"}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="w-96 rounded-2xl border border-gray-100 bg-gray-50/50 flex items-center justify-center text-gray-400 text-sm">
                  Email auswählen
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Studenten Tab content ── */}
      {activeTab !== "studenten" ? null : <>

      {/* ── Toolbar ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <Input
            placeholder="Suche nach Name, Beruf oder E-Mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">{filtered.length} Studenten</span>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
          >
            + Neuer Student
          </button>
          <button
            onClick={testAllSmtp}
            className="px-4 py-2 text-sm font-medium bg-white text-gray-700 rounded-xl hover:bg-gray-50 transition-colors border border-gray-200 shadow-sm"
          >
            SMTP testen
          </button>
        </div>
      </div>

      {/* ── Student Table ── */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-400 uppercase tracking-wider bg-gray-50/60">
                <th className="p-3 font-medium w-10"></th>
                <th className="p-3 font-medium cursor-pointer select-none" onClick={() => toggleSort("name")}>
                  Name <SortIcon col="name" />
                </th>
                <th className="p-3 font-medium">Ziel</th>
                <th className="p-3 font-medium">Deutsch</th>
                <th className="p-3 font-medium">Gmail</th>
                <th className="p-3 font-medium text-center cursor-pointer select-none" onClick={() => toggleSort("credits")}>
                  Credits <SortIcon col="credits" />
                </th>
                <th className="p-3 font-medium text-center cursor-pointer select-none" onClick={() => toggleSort("emailsToday")}>
                  Heute <SortIcon col="emailsToday" />
                </th>
                <th className="p-3 font-medium text-center cursor-pointer select-none" onClick={() => toggleSort("emailsTotal")}>
                  Gesamt <SortIcon col="emailsTotal" />
                </th>
                <th className="p-3 font-medium text-center cursor-pointer select-none" onClick={() => toggleSort("scans")}>
                  Scans <SortIcon col="scans" />
                </th>
                <th className="p-3 font-medium cursor-pointer select-none" onClick={() => toggleSort("lastLogin")}>
                  Login <SortIcon col="lastLogin" />
                </th>
                <th className="p-3 font-medium min-w-[180px]">Status</th>
                <th className="p-3 font-medium text-center">Auto</th>
                <th className="p-3 font-medium text-center">SMTP</th>
                <th className="p-3 font-medium text-center min-w-[200px]">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((azubi) => {
                const statusColor = getStatusColor((azubi.Aktiv || "").replace(/\n/g, "").trim());
                const isActive = azubi.student_active === true;
                const isDailyEmail = azubi.daily_email_enabled === true;
                const hasGmail = azubi.gmail_app_password_set === true;
                const isSaving = saving === azubi.id;

                return (
                  <tr
                    key={azubi.id}
                    className={`border-b border-gray-50 hover:bg-blue-50/40 transition-colors ${isSaving ? "opacity-60" : ""}`}
                  >
                    {/* Avatar */}
                    <td className="p-3">
                      <div className="relative">
                        <StudentAvatar name={azubi.Namen || ""} fotoLink={azubi.BewerbungsfotoLink} />
                        {/* Fallback hidden div for broken images */}
                        <div className="hidden w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-semibold ring-2 ring-white">
                          {(azubi.Namen || "?").split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                        </div>
                      </div>
                    </td>

                    {/* Name - clickable */}
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(azubi)}
                          className="text-left font-medium text-gray-800 hover:text-blue-600 transition-colors"
                        >
                          {(azubi.Namen || "Kein Name").trim()}
                          <div className="text-[11px] text-gray-400 font-normal truncate max-w-[160px]">
                            {azubi.Email || ""}
                          </div>
                        </button>
                        {/* Quick send button */}
                        {azubi.user_id && azubi.gmail_app_password_set && (
                          <button
                            onClick={() => { setSendDialog(azubi); setSendCount(1); setSendResult(null); }}
                            title="Emails manuell senden"
                            className="shrink-0 w-6 h-6 flex items-center justify-center rounded-md bg-blue-50 hover:bg-blue-100 text-blue-500 hover:text-blue-700 transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Ziel */}
                    <td className="p-3 text-gray-600 max-w-[180px] truncate text-xs">
                      {(azubi.Ziel || "-").trim()}
                    </td>

                    {/* Deutsch */}
                    <td className="p-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-xs font-medium text-gray-600">
                        {(azubi["Deutsch Niveau"] || "-").trim().toUpperCase()}
                      </span>
                    </td>

                    {/* Gmail */}
                    <td className="p-3">
                      {hasGmail ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-green-50 text-xs font-medium text-green-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                          Verbunden
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-50 text-xs font-medium text-gray-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                          Fehlt
                        </span>
                      )}
                    </td>

                    {/* Credits */}
                    <td className="p-3 text-center">
                      <button
                        onClick={() => setCreditDialog({ azubi, mode: "einmalig" })}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-blue-50 transition-colors"
                      >
                        <span className="font-mono font-semibold text-blue-700">{azubi.monthly_credit || 0}</span>
                        {(azubi.credit_auto_refill || 0) > 0 && (
                          <span className="text-[10px] text-blue-400" title={`Auto-Refill: ${azubi.credit_auto_refill}/Monat`}>
                            &#x21bb;
                          </span>
                        )}
                      </button>
                    </td>

                    {/* Emails Today */}
                    <td className="p-3 text-center">
                      <span className={`font-mono text-sm ${azubi._sentToday > 0 ? "text-emerald-600 font-semibold" : "text-gray-300"}`}>
                        {azubi._sentToday}
                      </span>
                    </td>

                    {/* Emails Total */}
                    <td className="p-3 text-center">
                      <span className="font-mono text-sm text-gray-600">{azubi._sentTotal}</span>
                    </td>

                    {/* Scans */}
                    <td className="p-3 text-center">
                      <span className="font-mono text-sm text-gray-600">{azubi._scans}</span>
                    </td>

                    {/* Last Login */}
                    <td className="p-3 text-xs text-gray-400">
                      {azubi.last_login_at
                        ? new Date(azubi.last_login_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" })
                        : "-"}
                    </td>

                    {/* Status */}
                    <td className="p-3">
                      {(() => {
                        const aktiv = (azubi.Aktiv || "").replace(/\n/g, "").trim();
                        const selectVal = STATUS_OPTIONS.includes(aktiv) ? aktiv : "ja";
                        return (
                          <Select
                            key={`status-${azubi.id}-${selectVal}`}
                            value={selectVal}
                            onValueChange={(val: string | null) => {
                              if (val) handleStatusChange(azubi.id, val);
                            }}
                          >
                            <SelectTrigger className="h-7 text-xs rounded-lg min-w-[140px]">
                              <span className="flex items-center gap-1.5">
                                <span className={`w-1.5 h-1.5 rounded-full ${statusColor.dot}`} />
                                <SelectValue placeholder={selectVal} />
                              </span>
                            </SelectTrigger>
                            <SelectContent className="z-[9999]">
                              {STATUS_OPTIONS.map((s) => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        );
                      })()}
                    </td>

                    {/* Auto-Email toggle */}
                    <td className="p-3 text-center">
                      <div className="flex justify-center">
                        <Toggle on={isDailyEmail} onChange={() => handleDailyEmailToggle(azubi.id, isDailyEmail)} size="sm" />
                      </div>
                    </td>

                    {/* SMTP */}
                    <td className="p-3 text-center">
                      {azubi.user_id && hasGmail ? (
                        (() => {
                          const st = smtpStatus[azubi.user_id!];
                          if (!st) return <button onClick={() => testSmtp(azubi.user_id!)} className="px-2 py-0.5 text-[11px] bg-gray-100 hover:bg-gray-200 rounded-md transition-colors text-gray-500">Test</button>;
                          if (st.status === "loading") return <span className="text-[11px] text-gray-400 animate-pulse">...</span>;
                          if (st.status === "connected") return <span className="w-2 h-2 rounded-full bg-green-500 inline-block" title="Verbunden" />;
                          if (st.status === "no_credentials") return <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" title="Keine Daten" />;
                          return <span className="w-2 h-2 rounded-full bg-red-500 inline-block cursor-help" title={st.error || "Fehler"} />;
                        })()
                      ) : <span className="text-gray-200">-</span>}
                    </td>

                    {/* ── Aktionen ── */}
                    <td className="p-3">
                      <div className="flex items-center gap-1.5 justify-center flex-wrap">

                        {/* 1. Aktiv / Deaktivieren */}
                        <button
                          onClick={() => handleActiveToggle(azubi.id, isActive)}
                          disabled={isSaving}
                          title={isActive ? "Klicken zum Deaktivieren (stoppt Emails)" : "Klicken zum Aktivieren"}
                          className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-all disabled:opacity-40 ${
                            isActive
                              ? "bg-green-50 text-green-700 border-green-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                              : "bg-red-50 text-red-600 border-red-200 hover:bg-green-50 hover:text-green-700 hover:border-green-200"
                          }`}
                        >
                          {isActive ? "✅ Aktiv" : "⏸ Pausiert"}
                        </button>

                        {/* 2. Sichtbar / Unsichtbar */}
                        <button
                          onClick={() => handleVisibilityToggle(azubi.id, azubi.sichtbar !== false)}
                          disabled={isSaving}
                          title={azubi.sichtbar !== false ? "Für Kunden unsichtbar machen" : "Wieder sichtbar machen"}
                          className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-all disabled:opacity-40 ${
                            azubi.sichtbar !== false
                              ? "bg-blue-50 text-blue-600 border-blue-200 hover:bg-gray-100 hover:text-gray-500 hover:border-gray-200"
                              : "bg-gray-100 text-gray-400 border-gray-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
                          }`}
                        >
                          {azubi.sichtbar !== false ? "👁 Sichtbar" : "🙈 Versteckt"}
                        </button>

                        {/* 3. Konto sperren */}
                        <button
                          onClick={() => setBlockDialog(azubi)}
                          title="Konto komplett sperren (Credits = 0, Login gesperrt)"
                          className="px-2.5 py-1 text-[11px] font-semibold rounded-lg border bg-red-50 text-red-500 border-red-200 hover:bg-red-500 hover:text-white transition-all"
                        >
                          🚫 Sperren
                        </button>

                        {/* 4. WhatsApp Login senden */}
                        <button
                          onClick={() => openWaDialog(azubi)}
                          title="Login-Daten per WhatsApp senden"
                          className="px-2.5 py-1 text-[11px] font-semibold rounded-lg border bg-green-500 text-white border-green-500 hover:bg-green-600 transition-all shadow-sm"
                        >
                          📱 Login
                        </button>

                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={14} className="p-12 text-center text-gray-400">
                    {search ? "Keine Studenten gefunden." : "Keine Studenten vorhanden."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      </> /* end studenten tab */}

      {/* ── Credit Dialog ── */}
      {creditDialog && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setCreditDialog(null)}>
          <div className="w-full max-w-md mx-4 bg-white rounded-2xl shadow-xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-800">
              Credits: {creditDialog.azubi.Namen}
            </h3>
            <p className="text-sm text-gray-500">
              Aktuell: <span className="font-mono font-semibold text-blue-700">{creditDialog.azubi.monthly_credit || 0}</span>
              {(creditDialog.azubi.credit_auto_refill || 0) > 0 && (
                <span className="ml-2 text-blue-500">(Auto: {creditDialog.azubi.credit_auto_refill}/Monat)</span>
              )}
            </p>

            <div className="flex gap-2">
              {(["einmalig", "monatlich", "sperren"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setCreditDialog({ ...creditDialog, mode })}
                  className={`px-3 py-1.5 text-sm rounded-xl border transition-all ${
                    creditDialog.mode === mode
                      ? mode === "sperren"
                        ? "bg-red-600 text-white border-red-600 shadow-sm"
                        : "bg-blue-600 text-white border-blue-600 shadow-sm"
                      : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {mode === "einmalig" ? "Einmalig" : mode === "monatlich" ? "Monatlich" : "Sperren"}
                </button>
              ))}
            </div>

            {creditDialog.mode !== "sperren" && (
              <div>
                <label className="text-sm font-medium text-gray-600">
                  {creditDialog.mode === "einmalig" ? "Einmalige Credits:" : "Monatliche Credits:"}
                </label>
                <Input
                  type="number"
                  min="0"
                  max="500"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  placeholder="z.B. 30"
                  className="mt-1"
                  autoFocus
                />
                {/* Quick buttons */}
                <div className="flex gap-2 mt-2">
                  {[10, 50, 100].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setCreditAmount(String(amt))}
                      className="px-3 py-1 text-xs rounded-lg border border-gray-200 hover:bg-blue-50 hover:border-blue-200 transition-colors text-gray-600"
                    >
                      +{amt}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  {creditDialog.mode === "einmalig"
                    ? "Wird sofort gesetzt. Kein automatisches Auffuellen."
                    : "Wird sofort gesetzt und jeden Monat automatisch aufgefuellt."}
                </p>
              </div>
            )}

            {creditDialog.mode === "sperren" && (
              <div className="p-3 bg-red-50 rounded-xl text-sm text-red-700 border border-red-100">
                Credits werden auf 0 gesetzt, Auto-Email deaktiviert und Account gesperrt.
              </div>
            )}

            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => { setCreditDialog(null); setCreditAmount(""); }}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={handleCreditAction}
                disabled={creditDialog.mode !== "sperren" && !creditAmount}
                className={`px-5 py-2 text-sm font-medium text-white rounded-xl disabled:opacity-50 transition-all shadow-sm ${
                  creditDialog.mode === "sperren"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {creditDialog.mode === "sperren" ? "Sperren" : "Speichern"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Student Create/Edit Side Panel ── */}
      {editModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-end z-50" onClick={() => setEditModal(null)}>
          <div
            className="w-full max-w-2xl bg-white h-full overflow-y-auto shadow-2xl animate-in slide-in-from-right"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">
                  {editModal.mode === "create" ? "Neuen Student anlegen" : form.namen || "Student bearbeiten"}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {editModal.mode === "edit" ? `Engine ID: ${editModal.engineId}` : "Neues Konto wird erstellt"}
                </p>
              </div>
              <button
                onClick={() => setEditModal(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {loadingEdit ? (
                <div className="py-20 text-center">
                  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-sm text-gray-400 mt-3">Daten werden geladen...</p>
                </div>
              ) : (
                <>
                  {/* ── KPI Stats (edit mode only) ── */}
                  {editModal.mode === "edit" && studentStats && (
                    <div className="space-y-3">
                      {/* Profile completeness */}
                      <div className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100/50">
                        <div className="relative w-14 h-14 shrink-0">
                          <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                            <circle cx="28" cy="28" r="24" fill="none" stroke="#e5e7eb" strokeWidth="4" />
                            <circle
                              cx="28" cy="28" r="24" fill="none"
                              stroke={studentStats.profileCompleteness >= 80 ? "#22c55e" : studentStats.profileCompleteness >= 50 ? "#f59e0b" : "#ef4444"}
                              strokeWidth="4"
                              strokeDasharray={`${(studentStats.profileCompleteness / 100) * 150.8} 150.8`}
                              strokeLinecap="round"
                            />
                          </svg>
                          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">{studentStats.profileCompleteness}%</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-gray-800">Profil-Vollstaendigkeit</div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {studentStats.profileCompleteness < 80 ? "Felder fehlen noch" : "Profil ist gut ausgefuellt"}
                          </div>
                        </div>
                      </div>

                      {/* Main KPIs */}
                      <div className="grid grid-cols-5 gap-2">
                        {[
                          { value: studentStats.totalSent, label: "Gesendet", color: "text-blue-600", bg: "bg-blue-50" },
                          { value: studentStats.totalReceived, label: "Antworten", color: "text-emerald-600", bg: "bg-emerald-50" },
                          { value: studentStats.responseRate + "%", label: "Antwortrate", color: "text-violet-600", bg: "bg-violet-50" },
                          { value: studentStats.totalScans, label: "Gescannt", color: "text-amber-600", bg: "bg-amber-50" },
                          { value: studentStats.successRate + "%", label: "Zustellrate", color: "text-teal-600", bg: "bg-teal-50" },
                        ].map((kpi, i) => (
                          <div key={i} className={`${kpi.bg} rounded-xl p-2.5 text-center`}>
                            <div className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</div>
                            <div className="text-[10px] text-gray-500 font-medium">{kpi.label}</div>
                          </div>
                        ))}
                      </div>

                      {/* Pipeline */}
                      <div className="grid grid-cols-4 gap-2">
                        <div className="rounded-xl border border-gray-100 p-2.5 text-center">
                          <div className="text-lg font-bold text-gray-800">{studentStats.sentToday}</div>
                          <div className="text-[10px] text-gray-400">Heute</div>
                        </div>
                        <div className="rounded-xl border border-gray-100 p-2.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-lg font-bold text-gray-800">{studentStats.sentThisWeek}</span>
                            <span className={`text-xs ${studentStats.velocityTrend === "up" ? "text-green-500" : studentStats.velocityTrend === "down" ? "text-red-500" : "text-gray-400"}`}>
                              {studentStats.velocityTrend === "up" ? "^" : studentStats.velocityTrend === "down" ? "v" : "-"}
                            </span>
                          </div>
                          <div className="text-[10px] text-gray-400">Diese Woche</div>
                        </div>
                        <div className="rounded-xl border border-gray-100 p-2.5 text-center">
                          <div className="text-lg font-bold text-gray-800">{studentStats.sentThisMonth}</div>
                          <div className="text-[10px] text-gray-400">Diesen Monat</div>
                        </div>
                        <div className="rounded-xl border border-gray-100 p-2.5 text-center">
                          <div className="text-sm font-semibold text-gray-700">
                            {studentStats.lastLoginAt
                              ? new Date(studentStats.lastLoginAt).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })
                              : "--"}
                          </div>
                          <div className="text-[10px] text-gray-400">Login ({studentStats.loginCount}x)</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Personal Data ── */}
                  <Section title="Persoenliche Daten">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Name *" value={form.namen} onChange={(v) => updateForm("namen", v)} placeholder="Vorname Nachname" />
                      <Field label="E-Mail (Login) *" value={form.email} onChange={(v) => updateForm("email", v)} placeholder="email@gmail.com" />
                      <Field
                        label={editModal.mode === "create" ? "Passwort *" : "Neues Passwort"}
                        value={form.password}
                        onChange={(v) => updateForm("password", v)}
                        placeholder={editModal.mode === "create" ? "Test1234!" : "Leer = keine Aenderung"}
                      />
                      <Field label="WhatsApp Nummer" value={form.whatsapp} onChange={(v) => updateForm("whatsapp", v)} placeholder="+49 170 1234567" />
                      <div>
                        <label className="text-xs font-medium text-gray-500 mb-1 block">Deutsch Niveau</label>
                        <Select value={form.deutschNiveau} onValueChange={(v) => updateForm("deutschNiveau", v || "")}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["A1", "A2", "B1", "B2", "C1", "C2"].map((n) => (
                              <SelectItem key={n} value={n}>{n}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </Section>

                  {/* ── Professional Data ── */}
                  <Section title="Berufliche Daten">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Ziel (Beruf)" value={form.ziel} onChange={(v) => updateForm("ziel", v)} placeholder="z.B. Pflegefachmann" />
                      <div>
                        <label className="text-xs font-medium text-gray-500 mb-1 block">Art</label>
                        <Select value={form.art} onValueChange={(v) => updateForm("art", v || "")}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["Ausbildung-lite", "Ausbildung", "Anerkennung", "FSJ"].map((a) => (
                              <SelectItem key={a} value={a}>{a}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <TextArea label="Profil (Kurztext)" value={form.profil} onChange={(v) => updateForm("profil", v)} placeholder="Kurzbeschreibung..." rows={2} />
                    <TextArea label="Motivationsschreiben" value={form.motivationsschreiben} onChange={(v) => updateForm("motivationsschreiben", v)} placeholder="Motivationsschreiben..." rows={3} />
                    <TextArea label="Weitere Infos" value={form.infos} onChange={(v) => updateForm("infos", v)} placeholder="Zusaetzliche Infos..." rows={2} />
                  </Section>

                  {/* ── Links ── */}
                  <Section title="Links & Medien">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Video-Link" value={form.videoLink} onChange={(v) => updateForm("videoLink", v)} placeholder="https://youtu.be/..." />
                      <Field label="Foto-Link" value={form.fotoLink} onChange={(v) => updateForm("fotoLink", v)} placeholder="https://..." />
                    </div>
                    <Field label="Google Drive Ordner" value={form.driveLink} onChange={(v) => updateForm("driveLink", v)} placeholder="https://drive.google.com/drive/folders/..." />
                  </Section>

                  {/* ── Gmail & Credits ── */}
                  <Section title="Gmail & Credits">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Gmail-Adresse (SMTP)" value={form.gmailAddress} onChange={(v) => updateForm("gmailAddress", v)} placeholder="name@gmail.com" />
                      <Field
                        label={`App-Passwort${editModal.mode === "edit" ? " (leer = keine Aenderung)" : ""}`}
                        value={form.gmailAppPassword}
                        onChange={(v) => updateForm("gmailAppPassword", v)}
                        placeholder="xxxx xxxx xxxx xxxx"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs font-medium text-gray-500 mb-1 block">Credits</label>
                        <Input
                          type="number"
                          value={form.credits}
                          onChange={(e) => updateForm("credits", parseInt(e.target.value) || 0)}
                          className="h-9"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 mb-1 block">Auto-Refill/Monat</label>
                        <Input
                          type="number"
                          value={form.autoRefill}
                          onChange={(e) => updateForm("autoRefill", parseInt(e.target.value) || 0)}
                          className="h-9"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 mb-1 block">Max. Emails/Tag</label>
                        <Input
                          type="number"
                          value={form.maxDailyEmails}
                          onChange={(e) => updateForm("maxDailyEmails", parseInt(e.target.value) || 0)}
                          className="h-9"
                        />
                      </div>
                    </div>

                    {/* Quick credit buttons (edit mode only) */}
                    {editModal.mode === "edit" && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">Schnell:</span>
                        {[10, 50, 100].map((amt) => (
                          <button
                            key={amt}
                            onClick={() => quickCredit(amt)}
                            className="px-3 py-1 text-xs font-medium rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                          >
                            +{amt}
                          </button>
                        ))}
                      </div>
                    )}
                  </Section>

                  {/* Message */}
                  {formMessage && (
                    <div className={`p-3 rounded-xl text-sm ${formMessage.includes("Fehler") ? "bg-red-50 text-red-700 border border-red-100" : "bg-green-50 text-green-700 border border-green-100"}`}>
                      {formMessage}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            {!loadingEdit && (
              <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm border-t border-gray-100 px-6 py-4 flex gap-3 justify-between items-center">
                <div className="flex gap-2">
                  {editModal?.mode === "edit" && (
                    <button
                      onClick={() => {
                        const azubi = students.find(s => s.id === editModal.engineId);
                        if (azubi) { setEditModal(null); setTimeout(() => openWaDialog({ ...azubi, whatsapp: form.whatsapp || azubi.whatsapp }), 100); }
                      }}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-green-500 rounded-xl hover:bg-green-600 transition-all shadow-sm"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                      Login senden
                    </button>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setEditModal(null)}
                    className="px-5 py-2.5 text-sm text-gray-500 hover:text-gray-700 transition-colors rounded-xl hover:bg-gray-50"
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={handleFormSubmit}
                    disabled={formSaving || (editModal.mode === "create" && (!form.namen || !form.email))}
                    className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm"
                  >
                    {formSaving ? "Speichern..." : editModal.mode === "create" ? "Student anlegen" : "Aenderungen speichern"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── WhatsApp Login Dialog ─── */}
      {waDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" onClick={() => setWaDialog(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-800">📱 Login-Daten per WhatsApp senden</h3>
              <p className="text-sm text-gray-400 mt-0.5">{waDialog.Namen}</p>
            </div>
            <div className="px-6 py-5 space-y-4">
              {/* Phone number */}
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1.5">WhatsApp-Nummer</label>
                <input
                  type="tel"
                  value={waPhone}
                  onChange={(e) => setWaPhone(e.target.value)}
                  placeholder="+49 170 1234567"
                  className="w-full h-11 rounded-xl bg-gray-50 border border-gray-200 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                  autoFocus
                />
              </div>
              {/* Message preview */}
              <div className="bg-green-50 rounded-xl p-3 text-xs text-gray-600 space-y-1 border border-green-100">
                <p className="font-semibold text-green-700 mb-1">Nachrichtenvorschau:</p>
                <p>Hallo {(waDialog.Namen || "").split(" ")[0]} 👋</p>
                <p className="mt-1">Hier sind deine TalentScout Login-Daten:</p>
                <p>🔗 talent-scout-tau.vercel.app/login</p>
                <p>📧 {waDialog.Email || "(keine Email)"}</p>
                <p>🔑 Passwort: Test1234!</p>
                <p className="text-gray-400 mt-1">Bitte Passwort nach erstem Login ändern.</p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
              <button onClick={() => setWaDialog(null)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 rounded-xl hover:bg-gray-50 transition-colors">Abbrechen</button>
              <button
                onClick={sendWhatsAppFromDialog}
                disabled={!waPhone.trim()}
                className="px-5 py-2 text-sm font-semibold text-white bg-green-500 hover:bg-green-600 rounded-xl disabled:opacity-40 transition-all shadow-sm flex items-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                WhatsApp öffnen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Konto Sperren Bestätigung ─── */}
      {blockDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" onClick={() => setBlockDialog(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-5">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🚫</span>
              </div>
              <h3 className="text-base font-semibold text-gray-800 text-center">Konto sperren?</h3>
              <p className="text-sm text-gray-500 text-center mt-2">
                <span className="font-medium text-gray-700">{blockDialog.Namen}</span> wird gesperrt:<br />
                Credits werden auf 0 gesetzt, keine weiteren Emails.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
              <button onClick={() => setBlockDialog(null)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 rounded-xl hover:bg-gray-50 transition-colors">Abbrechen</button>
              <button
                onClick={handleBlockStudent}
                disabled={blockLoading}
                className="px-5 py-2 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-xl disabled:opacity-50 transition-all shadow-sm"
              >
                {blockLoading ? "Sperren..." : "Ja, Konto sperren"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Manual Send Modal ─── */}
      {sendDialog && (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
      onClick={() => { if (!sendLoading) { setSendDialog(null); setSendResult(null); } }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-800">Emails manuell senden</h3>
            <p className="text-sm text-gray-400">{sendDialog.Namen}</p>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Student info */}
          <div className="flex gap-4 text-sm bg-gray-50 rounded-xl p-3">
            <div>
              <span className="text-gray-400 text-xs">Credits:</span>
              <span className="ml-1 font-semibold text-gray-700">{sendDialog.monthly_credit ?? 0}</span>
            </div>
            <div>
              <span className="text-gray-400 text-xs">Heute:</span>
              <span className="ml-1 font-semibold text-gray-700">{sendDialog._sentToday}</span>
            </div>
            <div>
              <span className="text-gray-400 text-xs">Gesamt:</span>
              <span className="ml-1 font-semibold text-gray-700">{sendDialog._sentTotal}</span>
            </div>
          </div>

          {/* Count selector */}
          <div>
            <p className="text-sm font-medium text-gray-600 mb-2">Wie viele Emails senden?</p>
            <div className="flex gap-2">
              {[1, 3, 5, 10, 20].map((n) => (
                <button
                  key={n}
                  onClick={() => setSendCount(n)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                    sendCount === n
                      ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                      : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              Wähle die Anzahl — max. {sendDialog.monthly_credit ?? 0} verbleibende Credits
            </p>
          </div>

          {/* Result */}
          {sendResult && (
            <div className={`rounded-xl p-4 text-sm space-y-2 ${sendResult.errors > 0 && sendResult.sent === 0 ? "bg-red-50 border border-red-100" : "bg-green-50 border border-green-100"}`}>
              <div className={`font-semibold ${sendResult.errors > 0 && sendResult.sent === 0 ? "text-red-700" : "text-green-700"}`}>
                {sendResult.sent > 0 ? `✅ ${sendResult.sent} Email(s) erfolgreich gesendet` : ""}
                {sendResult.errors > 0 ? ` ⚠️ ${sendResult.errors} Fehler` : ""}
              </div>
              <p className="text-gray-600">{sendResult.message}</p>
              {sendResult.log && sendResult.log.length > 0 && (
                <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                  {sendResult.log.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span>{item.status === "sent" ? "✅" : "❌"}</span>
                      <span className="font-medium truncate">{item.company}</span>
                      <span className="text-gray-400 truncate">{item.email}</span>
                      {item.error && <span className="text-red-500 truncate">{item.error}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
          <button
            onClick={() => { setSendDialog(null); setSendResult(null); }}
            disabled={sendLoading}
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Schließen
          </button>
          {!sendResult && (
            <button
              onClick={handleSendManual}
              disabled={sendLoading || !sendDialog.user_id}
              className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-50 transition-all shadow-sm flex items-center gap-2"
            >
              {sendLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sende...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  {sendCount} Email{sendCount !== 1 ? "s" : ""} senden
                </>
              )}
            </button>
          )}
          {sendResult && sendResult.sent > 0 && (
            <button
              onClick={() => { setSendResult(null); }}
              className="px-5 py-2 text-sm font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all"
            >
              Nochmal senden
            </button>
          )}
        </div>
      </div>
    </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-100 p-4 space-y-3">
      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{title}</h4>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-500 mb-1 block">{label}</label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9"
      />
    </div>
  );
}

function TextArea({ label, value, onChange, placeholder, rows = 3 }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-500 mb-1 block">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full p-2.5 border border-gray-200 rounded-xl text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
        placeholder={placeholder}
        rows={rows}
      />
    </div>
  );
}
