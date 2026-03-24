import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { personalizeEmail } from "@/lib/email/ai-personalize";
import { buildApplicationEmail } from "@/lib/email/template";
import { getGDriveThumbnailUrl } from "@/lib/utils/normalize";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  const { firmenname, ansprechpartner, geschlecht, customEinleitung, customMotivation, accentColor } = await request.json();

  const adminSupabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: student } = await adminSupabase
    .from("ausbildung_main_engine")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!student) {
    return NextResponse.json({ error: "Profil nicht gefunden" }, { status: 404 });
  }

  const { data: creds } = await adminSupabase
    .from("email_credentials")
    .select("email")
    .eq("user_id", user.id)
    .single();

  const studentName = student.Namen || `${student.first_name} ${student.last_name}`;
  const studentEmail = creds?.email || student.Email || "";

  // Use custom text or generate via AI
  let anrede: string;
  let einleitung: string;
  let motivationAngepasst: string;

  if (customEinleitung || customMotivation) {
    // Custom text provided
    anrede = ansprechpartner
      ? `Sehr geehrte${geschlecht === "w" ? "" : "r"} ${geschlecht === "w" ? "Frau" : "Herr"} ${ansprechpartner}`
      : "Sehr geehrte Damen und Herren";
    einleitung = customEinleitung || `mit großem Interesse bewerbe ich mich bei ${firmenname || "Ihrem Unternehmen"} als ${student.Ziel || "Azubi"}.`;
    motivationAngepasst = customMotivation || student.Motivationsschreiben || "";
  } else {
    // AI personalization
    const personalized = await personalizeEmail({
      studentName,
      studentZiel: student.Ziel || "",
      deutschNiveau: student["Deutsch Niveau"] || "",
      motivationsschreiben: student.Motivationsschreiben || "",
      companyName: firmenname || "Muster GmbH",
      contactName: ansprechpartner || "",
      contactGender: geschlecht === "w" ? "Frau" : geschlecht === "m" ? "Herr" : "",
    });
    anrede = personalized.anrede;
    einleitung = personalized.einleitung;
    motivationAngepasst = personalized.motivationAngepasst;
  }

  const fotoUrl = getGDriveThumbnailUrl(student.BewerbungsfotoLink);
  const driveFolderUrl = student.drive_folder_id
    ? `https://drive.google.com/drive/folders/${student.drive_folder_id}`
    : null;

  let html = buildApplicationEmail({
    anrede,
    einleitung,
    motivationAngepasst,
    videoLink: student.BewerbungsVideoLink || null,
    fotoUrl,
    driveFolderUrl,
    studentName,
    studentEmail,
    studentZiel: student.Ziel || "",
    deutschNiveau: student["Deutsch Niveau"] || "",
    sequenceStep: 1,
  });

  // Apply accent color if provided
  if (accentColor && accentColor !== "#2563eb") {
    html = html.replace(/#2563eb/g, accentColor);
  }

  return NextResponse.json({
    html,
    anrede,
    einleitung,
    motivationAngepasst,
    studentName,
    studentZiel: student.Ziel || "",
  });
}
