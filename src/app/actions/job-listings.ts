"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import type { JobListingInput } from "@/types/database";

export async function saveJobListing(data: JobListingInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht eingeloggt");

  const { error } = await supabase.from("job_listings").insert({
    student_id: user.id,
    company_name: data.company_name,
    job_title: data.job_title || null,
    location: data.location || null,
    contact_email: data.contact_email || null,
    phone: data.phone || null,
    deadline: data.deadline || null,
    scan_image_url: data.scan_image_url || null,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/scan");
  revalidatePath("/scan/listings");
}

export async function updateJobRating(listingId: string, rating: number) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("job_listings")
    .update({ rating })
    .eq("id", listingId);
  if (error) throw new Error(error.message);
  revalidatePath("/scan/listings");
}

export async function updateJobNotes(listingId: string, notes: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("job_listings")
    .update({ notes })
    .eq("id", listingId);
  if (error) throw new Error(error.message);
  revalidatePath("/scan/listings");
}

export async function deleteJobListing(listingId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("job_listings")
    .delete()
    .eq("id", listingId);
  if (error) throw new Error(error.message);
  revalidatePath("/scan/listings");
}

export async function transferJobListingNow(listingId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht eingeloggt");

  // Get the listing
  const { data: listing, error: fetchErr } = await supabase
    .from("job_listings")
    .select("*")
    .eq("id", listingId)
    .single();

  if (fetchErr || !listing) throw new Error("Eintrag nicht gefunden");
  if (listing.transferred) throw new Error("Bereits übertragen");

  // Use admin client for bewerbungen insert
  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Duplicate check
  const { data: existing } = await admin
    .from("bewerbungen")
    .select("id")
    .ilike("firmenname", listing.company_name)
    .limit(1);

  if (existing && existing.length > 0) {
    // Mark as transferred even if duplicate
    await supabase.from("job_listings").update({ transferred: true }).eq("id", listingId);
    revalidatePath("/scan/listings");
    return { status: "duplicate", message: "Firma existiert bereits in der Datenbank" };
  }

  // Insert into bewerbungen
  const { error: insertErr } = await admin.from("bewerbungen").insert({
    email: listing.contact_email,
    firmenname: listing.company_name,
    telefonnummer: listing.phone,
    bereich: listing.job_title,
    student_user_id: user.id,
  });

  if (insertErr) throw new Error(insertErr.message);

  // Mark as transferred
  await supabase.from("job_listings").update({ transferred: true }).eq("id", listingId);

  revalidatePath("/scan/listings");
  revalidatePath("/bewerbungen");
  return { status: "success", message: "Firma erfolgreich übertragen" };
}
