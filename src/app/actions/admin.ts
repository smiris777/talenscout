"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

function getAdminSupabase() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht eingeloggt");
  const admin = getAdminSupabase();
  const { data: profile } = await admin.from("user_profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "administrator") throw new Error("Keine Admin-Berechtigung");
  return admin;
}

export async function updateAzubiStatus(id: number, status: string) {
  const admin = await requireAdmin();

  const { error } = await admin
    .from("ausbildung_main_engine")
    .update({ Aktiv: status })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function toggleAzubiVisibility(id: number, sichtbar: boolean) {
  const admin = await requireAdmin();

  const { error } = await admin
    .from("ausbildung_main_engine")
    .update({ sichtbar })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath("/");
}
