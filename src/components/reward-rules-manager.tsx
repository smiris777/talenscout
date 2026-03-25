"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface RewardRule {
  id: string;
  rule_type: string;
  rule_key: string;
  rule_value: Record<string, number>;
  is_active: boolean;
}

interface LeaderboardEntry {
  student_id: string;
  name: string;
  total_points: number;
  level: number;
  current_streak: number;
  xp: number;
  xp_to_next_level: number;
}

interface Props {
  rules: RewardRule[];
  leaderboard: LeaderboardEntry[];
}

function getRuleLabel(ruleKey: string) {
  const labels: Record<string, string> = {
    contacts_to_credits: "Neue Kontakte → Kostenlose Bewerbungen",
    daily_login_xp: "Tägliches Login (XP)",
    scan_xp: "Scan einer Anzeige (XP)",
    new_contact_xp: "Neue Firma-Adresse (XP)",
    application_xp: "Bewerbung gesendet (XP)",
    reply_xp: "Antwort erhalten (XP)",
    interview_xp: "Vorstellungsgespräch (XP)",
    streak_7_bonus: "7-Tage-Streak Bonus (XP)",
    streak_30_bonus: "30-Tage-Streak Bonus (XP)",
  };
  return labels[ruleKey] || ruleKey;
}

function getLevelBadge(level: number) {
  if (level >= 16) return "💎";
  if (level >= 11) return "🥇";
  if (level >= 6) return "🥈";
  return "🥉";
}

export function RewardRulesManager({ rules, leaderboard }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  async function handleSave(ruleId: string) {
    setSaving(true);
    try {
      await fetch("/api/admin/reward-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruleId, ruleValue: editValue }),
      });
      setEditingId(null);
      window.location.reload();
    } finally {
      setSaving(false);
    }
  }

  async function toggleRule(ruleId: string, isActive: boolean) {
    await fetch("/api/admin/reward-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ruleId, isActive: !isActive }),
    });
    window.location.reload();
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>⚙️</span> Belohnungsregeln
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={`p-3 rounded-lg border ${rule.is_active ? "bg-white" : "bg-gray-50 opacity-60"}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900">{getRuleLabel(rule.rule_key)}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleRule(rule.id, rule.is_active)}
                    className={`text-xs px-2 py-0.5 rounded ${rule.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                  >
                    {rule.is_active ? "Aktiv" : "Inaktiv"}
                  </button>
                </div>
              </div>

              {editingId === rule.id ? (
                <div className="flex items-center gap-2">
                  {Object.entries(rule.rule_value).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-1">
                      <span className="text-xs text-gray-500">{key}:</span>
                      <Input
                        type="number"
                        className="w-20 h-7 text-sm"
                        defaultValue={val}
                        onChange={(e) => setEditValue({ ...editValue, [key]: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                  ))}
                  <Button size="sm" className="h-7 text-xs" onClick={() => handleSave(rule.id)} disabled={saving}>
                    Speichern
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingId(null)}>
                    X
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">
                    {Object.entries(rule.rule_value).map(([k, v]) => `${k}: ${v}`).join(", ")}
                  </span>
                  <button
                    onClick={() => { setEditingId(rule.id); setEditValue(rule.rule_value); }}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Bearbeiten
                  </button>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>🏆</span> Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          {leaderboard.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">Noch keine Aktivitäten</p>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((entry, i) => (
                <div key={entry.student_id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-gray-300 w-6 text-center">
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`}
                    </span>
                    <div>
                      <span className="text-sm font-medium text-gray-900">{entry.name}</span>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>{getLevelBadge(entry.level)} Level {entry.level}</span>
                        {entry.current_streak > 0 && <span>🔥 {entry.current_streak}d</span>}
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-sm font-semibold">
                    {entry.total_points} XP
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
