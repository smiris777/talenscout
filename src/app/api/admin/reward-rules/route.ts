import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "administrator") {
    return NextResponse.json({ error: "Nur Admins" }, { status: 403 });
  }

  const body = await request.json();
  const { ruleId, ruleValue, isActive } = body;

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (ruleValue !== undefined) update.rule_value = ruleValue;
  if (isActive !== undefined) update.is_active = isActive;

  const { error } = await admin
    .from("reward_rules")
    .update(update)
    .eq("id", ruleId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
