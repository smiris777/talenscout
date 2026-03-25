"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import type { JobListingInput } from "@/types/database";
import { sendEmail } from "@/lib/email/sender";
import { buildApplicationEmail } from "@/lib/email/template";
import { personalizeEmail } from "@/lib/email/ai-personalize";
import { decryptPassword } from "@/lib/email/crypto";

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

// Student bewirbt sich direkt bei einer gescannten Firma — Email wird SOFORT gesendet
export async function applyToJobListing(listingId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht eingeloggt");

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get the listing
  const { data: listing, error: fetchErr } = await supabase
    .from("job_listings")
    .select("*")
    .eq("id", listingId)
    .single();

  if (fetchErr || !listing) throw new Error("Eintrag nicht gefunden");
  if (listing.applied) throw new Error("Bereits beworben");
  if (!listing.contact_email) throw new Error("Keine E-Mail-Adresse vorhanden");

  // Get student profile
  const { data: student } = await admin
    .from("ausbildung_main_engine")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!student) throw new Error("Studentenprofil nicht gefunden");

  // Get email credentials
  const { data: creds } = await admin
    .from("email_credentials")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!creds) throw new Error("Gmail nicht eingerichtet. Gehe zu E-Mail Setup.");

  // Decrypt password
  const appPassword = decryptPassword(creds.encrypted_password);

  // AI-personalize the email
  const personalized = await personalizeEmail({
    studentName: student.Namen || "Bewerber",
    studentZiel: student.Ziel || listing.job_title || "Ausbildung",
    deutschNiveau: student["Deutsch Niveau"] || "B1",
    motivationsschreiben: student.Motivationsschreiben || "",
    companyName: listing.company_name,
  });

  // Build HTML email
  const driveFolderUrl = student.drive_folder_id
    ? `https://drive.google.com/drive/folders/${student.drive_folder_id}`
    : null;

  const html = buildApplicationEmail({
    anrede: personalized.anrede,
    einleitung: personalized.einleitung,
    motivationAngepasst: personalized.motivationAngepasst,
    studentName: student.Namen || "Bewerber",
    studentEmail: creds.gmail_address,
    studentZiel: student.Ziel || listing.job_title || "Ausbildung",
    deutschNiveau: student["Deutsch Niveau"] || "B1",
    art: student.Art || undefined,
    videoLink: student.BewerbungsVideoLink || undefined,
    fotoUrl: student.BewerbungsfotoLink || undefined,
    driveFolderUrl,
    sequenceStep: 1,
  });

  const subject = `Bewerbung als ${student.Ziel || listing.job_title || "Auszubildende/r"} — ${student.Namen || "Bewerber"}`;

  // Send email NOW
  try {
    await sendEmail({
      fromEmail: creds.gmail_address,
      fromName: student.Namen || "Bewerber",
      appPassword,
      to: listing.contact_email,
      subject,
      html,
    });

    // Log in email_send_log so it appears in Bewerbungen page
    await admin.from("email_send_log").insert({
      user_id: user.id,
      recipient_email: listing.contact_email,
      company_name: listing.company_name,
      subject,
      status: "sent",
      sequence_step: 1,
      sent_at: new Date().toISOString(),
      source: "scan",
    });

    // Also insert into bewerbungen for tracking (ignore duplicate)
    await admin.from("bewerbungen").insert({
      email: listing.contact_email,
      firmenname: listing.company_name,
      telefonnummer: listing.phone,
      bereich: listing.job_title,
      student_user_id: user.id,
      status: "gesendet",
    });

    // Mark as applied
    await supabase.from("job_listings").update({ applied: true }).eq("id", listingId);

    revalidatePath("/scan");
    revalidatePath("/bewerbungen");
    return { status: "success", message: "✅ Bewerbung gesendet an " + listing.contact_email };
  } catch (err) {
    // Log the failure
    await admin.from("email_send_log").insert({
      user_id: user.id,
      recipient_email: listing.contact_email,
      company_name: listing.company_name,
      subject,
      status: "failed",
      sequence_step: 1,
      error_message: err instanceof Error ? err.message : "Unbekannter Fehler",
      source: "scan",
    });

    return { status: "error", message: "Email-Versand fehlgeschlagen: " + (err instanceof Error ? err.message : "Unbekannter Fehler") };
  }
}

// Automatischer Transfer nach 30 Tagen (wird vom Cron-Job aufgerufen, nicht vom Student)
export async function transferJobListingNow(listingId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht eingeloggt");

  const { data: listing, error: fetchErr } = await supabase
    .from("job_listings")
    .select("*")
    .eq("id", listingId)
    .single();

  if (fetchErr || !listing) throw new Error("Eintrag nicht gefunden");
  if (listing.transferred) throw new Error("Bereits übertragen");

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
    await supabase.from("job_listings").update({ transferred: true }).eq("id", listingId);
    revalidatePath("/scan");
    return { status: "duplicate", message: "Firma existiert bereits in der Datenbank" };
  }

  const { error: insertErr } = await admin.from("bewerbungen").insert({
    email: listing.contact_email,
    firmenname: listing.company_name,
    telefonnummer: listing.phone,
    bereich: listing.job_title,
    student_user_id: user.id,
  });

  if (insertErr) throw new Error(insertErr.message);

  await supabase.from("job_listings").update({ transferred: true }).eq("id", listingId);

  revalidatePath("/scan");
  revalidatePath("/bewerbungen");
  return { status: "success", message: "Firma erfolgreich übertragen" };
}
