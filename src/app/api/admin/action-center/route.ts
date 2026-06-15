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
  // Filter über email_category + requires_action (neue Schema)
  const { data: emails } = await admin
    .from("email_received_log")
    .select(
      "id, user_id, from_email, from_name, subject, body_text, email_category, received_at, action_status, requires_action"
    )
    .eq("requires_action", true)
    .or("action_status.is.null,action_status.eq.pending")
    .order("received_at", { ascending: false })
    .limit(100);

  if (!emails || emails.length === 0) {
    return NextResponse.json({ items: [], total: 0, urgent: 0 });
  }

  // Get student names for user_ids
  const userIds = [
    ...new Set(emails.map((e) => e.user_id).filter(Boolean)),
  ] as string[];
  const { data: students } = await admin
    .from("ausbildung_main_engine")
    .select(`user_id, "Namen", BewerbungsfotoLink`)
    .in("user_id", userIds);

  const studentMap = new Map(
    (students || []).map((s) => [s.user_id, s])
  );

  // Mappe email_category zurück auf "classification" (Backward-compat fuer existierende UI in admin-dashboard.tsx)
  // contract_offer -> "offer" damit UI-Labels passen
  const items = emails.map((e) => {
    const student = studentMap.get(e.user_id);
    const bodyText = (e as { body_text: string | null }).body_text ?? "";
    const cat = (e as { email_category: string | null }).email_category;
    const legacyCat = cat === "contract_offer" ? "offer" : cat;
    return {
      ...e,
      classification: legacyCat,
      snippet: bodyText.slice(0, 120),
      company_name:
        (e as { from_email: string }).from_email
          ?.split("@")[1]
          ?.split(".")[0] || null,
      studentName: student?.Namen || "Unbekannt",
      fotoLink: student?.BewerbungsfotoLink || null,
    };
  });

  // Count by priority — interview_invite + contract_offer
  const urgent = items.filter((i) =>
    ["interview_invite", "offer"].includes(
      (i as { classification: string | null }).classification ?? "",
    ),
  ).length;

  return NextResponse.json({ items, total: items.length, urgent });
}
