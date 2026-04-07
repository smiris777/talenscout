"use client";

import type { StudentStreak, StudentPoint } from "@/types/database";

interface Props {
  streak: StudentStreak | null;
  recentPoints: StudentPoint[];
}

function getLevelInfo(level: number) {
  if (level >= 16) return { name: "Elite",          badge: "💎", from: "from-purple-500", to: "to-violet-600" };
  if (level >= 11) return { name: "Profi",           badge: "🥇", from: "from-yellow-400", to: "to-orange-500" };
  if (level >= 6)  return { name: "Fortgeschritten", badge: "🥈", from: "from-slate-400",  to: "to-gray-500"  };
  return               { name: "Einsteiger",         badge: "🥉", from: "from-amber-400",  to: "to-orange-400"};
}

const SOURCE_ICONS: Record<string, string> = {
  daily_login:      "🔑",
  scan:             "📷",
  scan_bonus:       "📸",
  new_contact:      "📬",
  application_sent: "✉️",
  email_sent:       "✉️",
  reply_received:   "💬",
  interview:        "🎯",
  streak_bonus:     "🔥",
};

export function GamificationWidget({ streak, recentPoints }: Props) {
  const s = streak ?? {
    current_streak: 0, longest_streak: 0, last_activity_date: null,
    total_points: 0, level: 1, xp: 0, xp_to_next_level: 100,
  } as StudentStreak;

  const li = getLevelInfo(s.level);
  const xpPct = s.xp_to_next_level > 0 ? Math.min(100, Math.round((s.xp / s.xp_to_next_level) * 100)) : 100;
  const fireSize = s.current_streak >= 30 ? "text-4xl" : s.current_streak >= 7 ? "text-3xl" : "text-2xl";

  return (
    <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm bg-white">
      {/* Gradient header */}
      <div className={`bg-gradient-to-br ${li.from} ${li.to} px-5 pt-4 pb-5`}>
        <div className="flex items-start justify-between">
          {/* Left: level info */}
          <div className="flex items-center gap-3">
            <span className="text-4xl drop-shadow">{li.badge}</span>
            <div>
              <p className="text-white font-bold text-base leading-tight">Level {s.level}</p>
              <p className="text-white/70 text-xs">{li.name}</p>
              <p className="text-white/80 text-xs mt-0.5 font-medium">{s.total_points.toLocaleString("de-DE")} XP gesamt</p>
            </div>
          </div>

          {/* Right: streak */}
          <div className="flex flex-col items-center bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2">
            <span className={`${fireSize} leading-none ${s.current_streak === 0 ? "opacity-30 grayscale" : ""}`}>🔥</span>
            <span className="text-white font-black text-2xl leading-none">{s.current_streak}</span>
            <span className="text-white/70 text-[10px] font-medium">TAGE</span>
          </div>
        </div>

        {/* XP progress */}
        <div className="mt-4">
          <div className="flex justify-between text-[11px] text-white/70 mb-1.5">
            <span>{s.xp} XP</span>
            <span>Level {s.level + 1} → {s.xp_to_next_level} XP</span>
          </div>
          <div className="w-full h-2.5 bg-white/25 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-700 shadow-sm"
              style={{ width: `${xpPct}%` }}
            />
          </div>
          <p className="text-white/60 text-[10px] mt-1">{s.xp_to_next_level - s.xp} XP bis zum nächsten Level</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 divide-x divide-gray-100">
        {[
          { label: "Streak", value: s.current_streak, suffix: "🔥" },
          { label: "Rekord",  value: s.longest_streak,  suffix: "🏆" },
          { label: "Level",   value: s.level,            suffix: li.badge },
        ].map((item) => (
          <div key={item.label} className="py-3 text-center">
            <div className="text-lg font-bold text-gray-800">{item.value} <span className="text-base">{item.suffix}</span></div>
            <div className="text-[11px] text-gray-400">{item.label}</div>
          </div>
        ))}
      </div>

      {/* Recent activity */}
      {recentPoints.length > 0 ? (
        <div className="px-5 py-3 border-t border-gray-100">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Letzte Aktivitäten</p>
          <div className="space-y-1.5">
            {recentPoints.slice(0, 4).map((p) => (
              <div key={p.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{SOURCE_ICONS[p.source] ?? "⭐"}</span>
                  <span className="text-xs text-gray-600 truncate max-w-[200px]">{p.description || p.source}</span>
                </div>
                <span className="text-xs font-semibold text-emerald-600 whitespace-nowrap">+{p.points} XP</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="px-5 py-4 border-t border-gray-100 text-center">
          <p className="text-sm text-gray-400">Melde dich täglich an und sende Bewerbungen — sammle XP & steige auf! 🚀</p>
        </div>
      )}
    </div>
  );
}
