import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: profile } = await admin
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "administrator") return null;
  return admin;
}

export async function POST(request: Request) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as {
    firmenname: string;
    email: string;
    bereich: string;
    name?: string;
    geschlecht?: string;
    telefonnummer?: string;
    ort?: string;
    notizen?: string;
  };

  if (!body.firmenname?.trim() || !body.email?.trim() || !body.bereich?.trim()) {
    return NextResponse.json({ error: "Firmenname, Email und Bereich sind Pflichtfelder" }, { status: 400 });
  }

  const emailLower = body.email.trim().toLowerCase();

  // Check duplicate
  const { data: existing } = await admin
    .from("bewerbungen")
    .select("id, firmenname")
    .eq("email", emailLower)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      error: `Diese E-Mail ist bereits im Pool (${existing.firmenname})`,
      duplicate: true,
    }, { status: 409 });
  }

  const payload: Record<string, unknown> = {
    firmenname: body.firmenname.trim(),
    email: emailLower,
    bereich: body.bereich.trim(),
    name: body.name?.trim() || null,
    geschlecht: body.geschlecht?.trim() || null,
    telefonnummer: body.telefonnummer?.trim() || null,
    notizen: body.notizen?.trim() || null,
  };

  const { data, error } = await admin
    .from("bewerbungen")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: data?.id });
}
