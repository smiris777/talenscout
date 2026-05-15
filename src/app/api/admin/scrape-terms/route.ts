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
    .from("user_profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "administrator") return null;
  return admin;
}

export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await admin
    .from("scrape_extra_terms")
    .select("*")
    .order("created_at", { ascending: false });

  return NextResponse.json({ terms: data ?? [] });
}

export async function POST(request: Request) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { term } = await request.json() as { term: string };
  if (!term?.trim() || term.trim().length < 3) {
    return NextResponse.json({ error: "Begriff zu kurz (min. 3 Zeichen)" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("scrape_extra_terms")
    .upsert({ term: term.trim() }, { onConflict: "term" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ term: data });
}

export async function DELETE(request: Request) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await request.json() as { id: string };
  await admin.from("scrape_extra_terms").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, is_active } = await request.json() as { id: string; is_active: boolean };
  await admin.from("scrape_extra_terms").update({ is_active }).eq("id", id);
  return NextResponse.json({ ok: true });
}
