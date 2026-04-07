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
type AdminTab = "studenten" | "leaderboard" | "aktionen" | "rewards";

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

  // SMTP
  const [smtpStatus, setSmtpStatus] = useState<Record<string, { status: "loading" | "connected" | "failed" | "no_credentials"; gmail?: string; error?: string }>>({});

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

  /* ─── WhatsApp Login senden ─── */

  function sendWhatsApp(azubi: AdminAzubi) {
    const phone = (azubi.whatsapp || "").replace(/\D/g, "");
    if (!phone) { alert("Keine WhatsApp-Nummer für " + azubi.Namen); return; }
    const loginEmail = azubi.Email || "";
    const msg = encodeURIComponent(
      `Hallo ${(azubi.Namen || "").split(" ")[0]} 👋\n\nHier sind deine TalentScout Login-Daten:\n\n🔗 https://talent-scout-tau.vercel.app/login\n📧 E-Mail: ${loginEmail}\n🔑 Passwort: Test1234!\n\nBitte ändere dein Passwort nach dem ersten Login.\n\nBei Fragen einfach melden! 😊`
    );
    window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
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

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl w-fit flex-wrap">
        {([
          { key: "studenten" as AdminTab, label: "Studenten", icon: "👥", badge: null },
          { key: "aktionen" as AdminTab, label: "Aktionen", icon: "⚡", badge: urgentCount > 0 ? urgentCount : null },
          { key: "leaderboard" as AdminTab, label: "Leaderboard", icon: "🏆", badge: null },
          { key: "rewards" as AdminTab, label: "XP-Regeln", icon: "🎯", badge: null },
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
                <th className="p-3 font-medium text-center min-w-[110px]">Aktiv / Sperren</th>
                <th className="p-3 font-medium text-center">Auto</th>
                <th className="p-3 font-medium text-center">SMTP</th>
                <th className="p-3 font-medium text-center min-w-[130px]">📱 Login senden</th>
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
                      <button
                        onClick={() => openEditModal(azubi)}
                        className="text-left font-medium text-gray-800 hover:text-blue-600 transition-colors"
                      >
                        {(azubi.Namen || "Kein Name").trim()}
                        <div className="text-[11px] text-gray-400 font-normal truncate max-w-[200px]">
                          {azubi.Email || ""}
                        </div>
                      </button>
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

                    {/* Aktiv / Sperren */}
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleActiveToggle(azubi.id, isActive)}
                        disabled={isSaving}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all shadow-sm border ${
                          isActive
                            ? "bg-green-50 text-green-700 border-green-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                            : "bg-red-50 text-red-600 border-red-200 hover:bg-green-50 hover:text-green-700 hover:border-green-200"
                        } disabled:opacity-40`}
                      >
                        {isActive ? "✅ Aktiv" : "🔴 Gesperrt"}
                      </button>
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
                          if (!st) {
                            return (
                              <button
                                onClick={() => testSmtp(azubi.user_id!)}
                                className="px-2 py-0.5 text-[11px] bg-gray-100 hover:bg-gray-200 rounded-md transition-colors text-gray-500"
                              >
                                Test
                              </button>
                            );
                          }
                          if (st.status === "loading") return <span className="text-[11px] text-gray-400 animate-pulse">...</span>;
                          if (st.status === "connected") return <span className="w-2 h-2 rounded-full bg-green-500 inline-block" title="Verbunden" />;
                          if (st.status === "no_credentials") return <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" title="Keine Daten" />;
                          return <span className="w-2 h-2 rounded-full bg-red-500 inline-block cursor-help" title={st.error || "Fehler"} />;
                        })()
                      ) : (
                        <span className="text-gray-200">-</span>
                      )}
                    </td>

                    {/* WhatsApp Login senden */}
                    <td className="p-3 text-center">
                      {azubi.whatsapp ? (
                        <button
                          onClick={() => sendWhatsApp(azubi)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-green-500 hover:bg-green-600 rounded-lg shadow-sm transition-all"
                        >
                          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                          Login senden
                        </button>
                      ) : (
                        <button
                          onClick={() => openEditModal(azubi)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-orange-600 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg transition-all"
                          title="Keine WhatsApp-Nummer — klicken zum Hinzufügen"
                        >
                          + Nummer
                        </button>
                      )}
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
                  {editModal?.mode === "edit" && form.whatsapp && (
                    <button
                      onClick={() => {
                        const phone = form.whatsapp.replace(/\D/g, "");
                        const msg = encodeURIComponent(
                          `Hallo ${(form.namen || "").split(" ")[0]} 👋\n\nHier sind deine TalentScout Login-Daten:\n\n🔗 https://talent-scout-tau.vercel.app/login\n📧 E-Mail: ${form.email}\n🔑 Passwort: Test1234!\n\nBei Fragen einfach melden! 😊`
                        );
                        window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
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
    </div>
  );
}

/* ─── Reusable form components ─── */

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
