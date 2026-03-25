"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { StudentStreak, StudentPoint } from "@/types/database";

interface Props {
  streak: StudentStreak | null;
  recentPoints: StudentPoint[];
}

function getLevelInfo(level: number) {
  if (level >= 16) return { name: "Elite", badge: "💎", color: "bg-purple-500" };
  if (level >= 11) return { name: "Profi", badge: "🥇", color: "bg-yellow-500" };
  if (level >= 6) return { name: "Fortgeschritten", badge: "🥈", color: "bg-gray-400" };
  return { name: "Einsteiger", badge: "🥉", color: "bg-orange-400" };
}

function getSourceIcon(source: string) {
  switch (source) {
    case "daily_login": return "🔑";
    case "scan_bonus": return "📸";
    case "new_contact": return "🏢";
    case "application_sent": return "📧";
    case "reply_received": return "📬";
    case "interview": return "🎯";
    case "streak_bonus": return "🔥";
    default: return "⭐";
  }
}

export function GamificationWidget({ streak, recentPoints }: Props) {
  if (!streak) {
    return (
      <Card>
        <CardContent className="p-4 text-center">
          <div className="text-3xl mb-2">🎮</div>
          <p className="text-sm text-gray-500">Starte deine erste Aktivität, um Punkte zu sammeln!</p>
        </CardContent>
      </Card>
    );
  }

  const levelInfo = getLevelInfo(streak.level);
  const xpPercent = streak.xp_to_next_level > 0
    ? Math.round((streak.xp / streak.xp_to_next_level) * 100)
    : 0;

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/* Header: Streak + Level */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Streak Fire */}
            <div className="text-center">
              <div className={`text-3xl ${streak.current_streak > 0 ? "" : "opacity-30"}`}>🔥</div>
              <div className="text-xs font-bold text-gray-900">{streak.current_streak} Tage</div>
            </div>

            {/* Level Badge */}
            <div className="text-center">
              <div className="text-3xl">{levelInfo.badge}</div>
              <div className="text-xs font-medium text-gray-600">Level {streak.level}</div>
            </div>
          </div>

          {/* Total Points */}
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">{streak.total_points}</div>
            <div className="text-xs text-gray-500">Gesamt-XP</div>
          </div>
        </div>

        {/* XP Progress Bar */}
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{levelInfo.name}</span>
            <span>{streak.xp}/{streak.xp_to_next_level} XP</span>
          </div>
          <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${levelInfo.color}`}
              style={{ width: `${Math.min(xpPercent, 100)}%` }}
            />
          </div>
        </div>

        {/* Streak Info */}
        {streak.longest_streak > 1 && (
          <div className="text-xs text-gray-500 flex items-center gap-1">
            🏆 Längster Streak: <span className="font-semibold">{streak.longest_streak} Tage</span>
          </div>
        )}

        {/* Recent Points */}
        {recentPoints.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-gray-700 mb-2">Letzte Aktivitäten</h4>
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {recentPoints.slice(0, 5).map((point) => (
                <div key={point.id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span>{getSourceIcon(point.source)}</span>
                    <span className="text-gray-600 truncate max-w-[180px]">{point.description}</span>
                  </div>
                  <span className="font-semibold text-green-600 whitespace-nowrap">+{point.points} XP</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
