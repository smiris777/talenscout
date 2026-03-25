"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ActionEmail {
  id: string;
  user_id: string;
  from_email: string;
  from_name: string | null;
  subject: string;
  body_text: string | null;
  received_at: string;
  email_category: string;
  action_status: string;
  student_name?: string;
}

interface Props {
  emails: ActionEmail[];
}

function getCategoryInfo(category: string) {
  switch (category) {
    case "contract_offer":
      return { label: "Vertrag/Zusage", color: "bg-red-100 text-red-700", icon: "📝", priority: "🔴" };
    case "interview_invite":
      return { label: "Vorstellungsgespräch", color: "bg-red-100 text-red-700", icon: "🎯", priority: "🔴" };
    case "document_request":
      return { label: "Dokument-Anfrage", color: "bg-yellow-100 text-yellow-700", icon: "📄", priority: "🟡" };
    case "rejection":
      return { label: "Absage", color: "bg-gray-100 text-gray-600", icon: "❌", priority: "⚪" };
    default:
      return { label: "Sonstiges", color: "bg-green-100 text-green-700", icon: "📧", priority: "🟢" };
  }
}

export function AdminActionCenter({ emails }: Props) {
  const [items, setItems] = useState(emails);
  const [processing, setProcessing] = useState<string | null>(null);

  const pending = items.filter((e) => e.action_status === "pending");
  const urgent = pending.filter((e) => ["contract_offer", "interview_invite"].includes(e.email_category));
  const medium = pending.filter((e) => e.email_category === "document_request");

  async function markDone(emailId: string) {
    setProcessing(emailId);
    try {
      const res = await fetch("/api/admin/action-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailId, action: "done" }),
      });
      if (res.ok) {
        setItems((prev) => prev.map((e) => e.id === emailId ? { ...e, action_status: "done" } : e));
      }
    } finally {
      setProcessing(null);
    }
  }

  async function createTask(emailId: string, email: ActionEmail) {
    setProcessing(emailId);
    try {
      const res = await fetch("/api/admin/action-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailId,
          action: "create_task",
          userId: email.user_id,
          taskTitle: `${getCategoryInfo(email.email_category).label}: ${email.from_name || email.from_email}`,
          companyName: email.from_name || email.from_email,
        }),
      });
      if (res.ok) {
        setItems((prev) => prev.map((e) => e.id === emailId ? { ...e, action_status: "task_created" } : e));
      }
    } finally {
      setProcessing(null);
    }
  }

  if (pending.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center">
          <span className="text-2xl">✅</span>
          <p className="text-sm text-gray-500 mt-2">Keine offenen Aktionen</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span>⚡</span> Aktions-Center
          </span>
          <div className="flex gap-2">
            {urgent.length > 0 && (
              <Badge variant="destructive">{urgent.length} dringend</Badge>
            )}
            {medium.length > 0 && (
              <Badge variant="secondary">{medium.length} mittel</Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 max-h-96 overflow-y-auto">
        {pending.map((email) => {
          const cat = getCategoryInfo(email.email_category);
          const isDone = email.action_status !== "pending";

          return (
            <div
              key={email.id}
              className={`flex items-center justify-between p-3 rounded-lg border ${isDone ? "opacity-50 bg-gray-50" : "bg-white"}`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className="text-lg">{cat.priority}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {email.student_name || "Student"}
                    </span>
                    <Badge className={`${cat.color} text-xs`}>{cat.icon} {cat.label}</Badge>
                  </div>
                  <p className="text-xs text-gray-500 truncate">
                    Von: {email.from_name || email.from_email} — {email.subject}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(email.received_at).toLocaleDateString("de-DE")}
                  </p>
                </div>
              </div>

              {!isDone && (
                <div className="flex gap-1.5 ml-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => createTask(email.id, email)}
                    disabled={processing === email.id}
                    className="text-xs h-7"
                  >
                    📋 Aufgabe
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => markDone(email.id)}
                    disabled={processing === email.id}
                    className="text-xs h-7 text-green-600"
                  >
                    ✅
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
