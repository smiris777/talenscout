import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let transferred = 0;
  let duplicates = 0;
  let errors = 0;

  try {
    // Find expired, non-transferred listings
    const { data: expired, error } = await supabase
      .from("job_listings")
      .select("*")
      .eq("transferred", false)
      .lte("expires_at", new Date().toISOString())
      .limit(100);

    if (error) throw error;
    if (!expired || expired.length === 0) {
      return NextResponse.json({ message: "Keine abgelaufenen Einträge", transferred: 0 });
    }

    for (const listing of expired) {
      try {
        // Duplicate check
        const { data: existing } = await supabase
          .from("bewerbungen")
          .select("id")
          .ilike("firmenname", listing.company_name)
          .limit(1);

        if (existing && existing.length > 0) {
          duplicates++;
          await supabase
            .from("job_listings")
            .update({ transferred: true })
            .eq("id", listing.id);
          continue;
        }

        // Insert into bewerbungen
        const { error: insertErr } = await supabase.from("bewerbungen").insert({
          email: listing.contact_email,
          firmenname: listing.company_name,
          telefonnummer: listing.phone,
          bereich: listing.job_title,
          student_user_id: listing.student_id,
        });

        if (insertErr) {
          errors++;
          console.error(`Transfer error for ${listing.company_name}:`, insertErr);
          continue;
        }

        // Mark transferred
        await supabase
          .from("job_listings")
          .update({ transferred: true })
          .eq("id", listing.id);

        transferred++;
      } catch (err) {
        errors++;
        console.error(`Error processing listing ${listing.id}:`, err);
      }
    }

    return NextResponse.json({
      message: "Transfer abgeschlossen",
      transferred,
      duplicates,
      errors,
      total_processed: expired.length,
    });
  } catch (err) {
    console.error("Transfer cron error:", err);
    return NextResponse.json({ error: "Transfer fehlgeschlagen" }, { status: 500 });
  }
}
