import Anthropic from "@anthropic-ai/sdk";

interface PersonalizeParams {
  studentName: string;
  studentZiel: string;
  deutschNiveau: string;
  motivationsschreiben: string;
  companyName: string;
  contactName?: string;
  contactGender?: string;
  branche?: string;
}

interface PersonalizeResult {
  anrede: string;
  einleitung: string;
  motivationAngepasst: string;
}

export async function personalizeEmail(params: PersonalizeParams): Promise<PersonalizeResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  // Fallback without AI
  if (!apiKey) {
    return fallbackPersonalization(params);
  }

  try {
    const client = new Anthropic({ apiKey });

    const prompt = `Du bist ein professioneller Bewerbungsberater. Erstelle eine personalisierte Bewerbungs-Email für folgende Situation:

Bewerber: ${params.studentName}
Zielberuf: ${params.studentZiel}
Deutschniveau: ${params.deutschNiveau}
Firma: ${params.companyName}
${params.contactName ? `Kontaktperson: ${params.contactName}` : ""}
${params.contactGender ? `Geschlecht: ${params.contactGender}` : ""}
${params.branche ? `Branche: ${params.branche}` : ""}

Original-Motivationsschreiben des Bewerbers:
${params.motivationsschreiben?.slice(0, 500) || "Kein Motivationsschreiben vorhanden."}

Erstelle:
1. Eine passende Anrede (z.B. "Sehr geehrte Frau Müller" oder "Sehr geehrte Damen und Herren")
2. Einen personalisierten Einleitungssatz (2-3 Sätze, bezogen auf die Firma und den Bewerber)
3. Ein leicht angepasstes Motivationsschreiben (max 150 Wörter, professionell, auf Deutsch)

Antworte NUR im folgenden JSON-Format:
{"anrede": "...", "einleitung": "...", "motivationAngepasst": "..."}`;

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as PersonalizeResult;
    }

    return fallbackPersonalization(params);
  } catch {
    return fallbackPersonalization(params);
  }
}

function fallbackPersonalization(params: PersonalizeParams): PersonalizeResult {
  let anrede = "Sehr geehrte Damen und Herren";
  if (params.contactName && params.contactGender) {
    const prefix = params.contactGender === "Frau" ? "Sehr geehrte Frau" : "Sehr geehrter Herr";
    anrede = `${prefix} ${params.contactName}`;
  }

  return {
    anrede,
    einleitung: `mit großem Interesse bewerbe ich mich bei ${params.companyName} als ${params.studentZiel}. Mein Deutschniveau liegt bei ${params.deutschNiveau} und ich bringe starke Motivation und Lernbereitschaft mit.`,
    motivationAngepasst: params.motivationsschreiben || `Ich bin hochmotiviert, meine Ausbildung als ${params.studentZiel} bei ${params.companyName} zu absolvieren. Ich freue mich auf die Möglichkeit, meine Fähigkeiten in Ihrem Unternehmen einzubringen.`,
  };
}
