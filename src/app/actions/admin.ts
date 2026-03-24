"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateAzubiStatus(id: number, status: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("ausbildung_main_engine")
    .update({ Aktiv: status })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function toggleAzubiVisibility(id: number, sichtbar: boolean) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("ausbildung_main_engine")
    .update({ sichtbar })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath("/");
}
