import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("image") as File | null;
    if (!file) {
      return NextResponse.json({ error: "Kein Bild hochgeladen" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/heic"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Ungültiges Bildformat. Erlaubt: JPG, PNG, WebP" }, { status: 400 });
    }

    // Convert to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to Supabase Storage
    const admin = createAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const ext = file.type === "image/png" ? "png" : "jpg";
    const filePath = `${user.id}/${randomUUID()}.${ext}`;

    const { error: uploadError } = await admin.storage
      .from("job-scans")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json({ error: "Bild-Upload fehlgeschlagen" }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = admin.storage
      .from("job-scans")
      .getPublicUrl(filePath);

    const scanImageUrl = urlData.publicUrl;

    // OCR with Claude Vision
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "KI-Service nicht konfiguriert" }, { status: 500 });
    }

    const base64Image = buffer.toString("base64");
    const mediaType = file.type as "image/jpeg" | "image/png" | "image/webp" | "image/gif";

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: base64Image },
          },
          {
            type: "text",
            text: `Analysiere dieses Bild einer Stellenanzeige. Extrahiere folgende Felder und gib NUR gültiges JSON zurück:
{
  "company_name": "Firmenname",
  "job_title": "Stellenbezeichnung/Ausbildung",
  "location": "Adresse oder Stadt/PLZ",
  "contact_email": "E-Mail-Adresse für Bewerbung",
  "phone": "Telefonnummer",
  "deadline": "Bewerbungsfrist im Format YYYY-MM-DD"
}
Wenn ein Feld nicht erkennbar ist, setze null. Versuche alle Kontaktdaten zu finden.`,
          },
        ],
      }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return NextResponse.json({
        scan_image_url: scanImageUrl,
        company_name: "",
        job_title: "",
        location: "",
        contact_email: "",
        phone: "",
        deadline: null,
        raw_text: text,
      });
    }

    const extracted = JSON.parse(jsonMatch[0]);

    return NextResponse.json({
      scan_image_url: scanImageUrl,
      company_name: extracted.company_name || "",
      job_title: extracted.job_title || "",
      location: extracted.location || "",
      contact_email: extracted.contact_email || "",
      phone: extracted.phone || "",
      deadline: extracted.deadline || null,
    });
  } catch (error) {
    console.error("OCR Error:", error);
    return NextResponse.json({ error: "OCR fehlgeschlagen" }, { status: 500 });
  }
}
