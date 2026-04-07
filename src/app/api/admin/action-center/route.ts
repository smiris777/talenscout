import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "administrator")
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get important emails that need action (not yet done)
  const { data: emails } = await admin
    .from("email_received_log")
    .select(
      "id, user_id, from_email, from_name, subject, classification, received_at, action_status, snippet, company_name"
    )
    .in("classification", [
      "interview_invite",
      "document_request",
      "offer",
      "followup_request",
    ])
    .or("action_status.is.null,action_status.eq.pending")
    .order("received_at", { ascending: false })
    .limit(50);

  if (!emails || emails.length === 0) {
    return NextResponse.json({ items: [], total: 0 });
  }

  // Get student names for user_ids
  const userIds = [...new Set(emails.map((e) => e.user_id).filter(Boolean))];
  const { data: students } = await admin
    .from("ausbildung_main_engine")
    .select(`user_id, "Namen", BewerbungsfotoLink`)
    .in("user_id", userIds);

  const studentMap = new Map(
    (students || []).map((s) => [s.user_id, s])
  );

  const items = emails.map((e) => ({
    ...e,
    studentName: studentMap.get(e.user_id)?.Namen || "Unbekannt",
    fotoLink: studentMap.get(e.user_id)?.BewerbungsfotoLink || null,
  }));

  // Count by priority
  const urgent = items.filter((i) =>
    ["interview_invite", "offer"].includes(i.classification)
  ).length;

  return NextResponse.json({ items, total: items.length, urgent });
}
