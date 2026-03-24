"use client";

import { useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Task {
  id: string;
  type: string;
  title: string;
  description: string | null;
  company_name: string | null;
  phone_number: string | null;
  priority: string;
  status: string;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
}

const typeIcons: Record<string, string> = {
  call: "📞",
  email_followup: "📧",
  document_upload: "📄",
  interview_prep: "📋",
};

const typeLabels: Record<string, string> = {
  call: "Anrufen",
  email_followup: "Follow-up",
  document_upload: "Dokument",
  interview_prep: "Vorbereitung",
};

const priorityColors: Record<string, string> = {
  high: "text-red-600 bg-red-50 border-red-200",
  medium: "text-yellow-600 bg-yellow-50 border-yellow-200",
  low: "text-gray-600 bg-gray-50 border-gray-200",
};

export default function StudentAufgaben() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<"pending" | "done" | "all">("pending");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    fetchTasks();
  }, []);

  async function fetchTasks() {
    const supabase = createClient();
    const { data } = await supabase
      .from("student_tasks")
      .select("*")
      .order("due_date", { ascending: true })
      .order("created_at", { ascending: false });
    if (data) setTasks(data);
  }

  async function markDone(taskId: string) {
    const supabase = createClient();
    startTransition(async () => {
      await supabase
        .from("student_tasks")
        .update({ status: "done", completed_at: new Date().toISOString() })
        .eq("id", taskId);
      await fetchTasks();
    });
  }

  async function skipTask(taskId: string) {
    const supabase = createClient();
    startTransition(async () => {
      await supabase
        .from("student_tasks")
        .update({ status: "skipped", completed_at: new Date().toISOString() })
        .eq("id", taskId);
      await fetchTasks();
    });
  }

  const filtered = tasks.filter((t) => {
    if (filter === "pending") return t.status === "pending";
    if (filter === "done") return t.status === "done" || t.status === "skipped";
    return true;
  });

  const pendingCount = tasks.filter((t) => t.status === "pending").length;
  const doneCount = tasks.filter((t) => t.status !== "pending").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Meine Aufgaben</h1>
        <p className="text-gray-500 mt-1">
          {pendingCount} offen, {doneCount} erledigt
        </p>
      </div>

      <div className="flex gap-2">
        {(["pending", "done", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === f
                ? "bg-blue-50 text-blue-700"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {f === "pending" ? "Offen" : f === "done" ? "Erledigt" : "Alle"}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.length > 0 ? (
          filtered.map((task) => (
            <Card key={task.id} className={task.status !== "pending" ? "opacity-60" : ""}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span className="text-xl mt-0.5">{typeIcons[task.type] || "📋"}</span>
                    <div>
                      <p className="font-medium text-gray-900">{task.title}</p>
                      {task.description && (
                        <p className="text-sm text-gray-500 mt-0.5">{task.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-xs">
                          {typeLabels[task.type] || task.type}
                        </Badge>
                        <Badge variant="outline" className={`text-xs ${priorityColors[task.priority]}`}>
                          {task.priority === "high" ? "Dringend" : task.priority === "medium" ? "Normal" : "Niedrig"}
                        </Badge>
                        {task.due_date && (
                          <span className="text-xs text-gray-400">
                            Fällig: {new Date(task.due_date).toLocaleDateString("de-DE")}
                          </span>
                        )}
                      </div>
                      {task.phone_number && task.type === "call" && (
                        <a
                          href={`tel:${task.phone_number}`}
                          className="inline-flex items-center gap-1 mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          📞 {task.phone_number}
                        </a>
                      )}
                    </div>
                  </div>

                  {task.status === "pending" && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => markDone(task.id)}
                        disabled={isPending}
                        className="px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-md transition-colors"
                      >
                        Erledigt
                      </button>
                      <button
                        onClick={() => skipTask(task.id)}
                        disabled={isPending}
                        className="px-3 py-1.5 text-sm font-medium text-gray-500 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
                      >
                        Überspringen
                      </button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-gray-400">
              {filter === "pending" ? "Keine offenen Aufgaben" : "Keine Aufgaben gefunden"}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
