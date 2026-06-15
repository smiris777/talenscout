/**
 * AI-Klassifizierung empfangener Bewerbungs-Antworten.
 *
 * Kategorien (passen zu admin-action-center.tsx + DB Default 'general'):
 *   - interview_invite   → 🎯 Vorstellungsgespräch  (URGENT)
 *   - contract_offer     → 📝 Zusage / Vertrag        (URGENT)
 *   - document_request   → 📄 Dokumente angefragt    (MEDIUM)
 *   - rejection          → ❌ Absage                  (low)
 *   - followup_request   → ❓ Rückfrage              (medium)
 *   - other / general    → 📧 Sonstiges              (none)
 *
 * requires_action wird true gesetzt für interview_invite, contract_offer,
 * document_request, followup_request — alles wo Student/Admin reagieren muss.
 */

import Anthropic from "@anthropic-ai/sdk";

export type EmailCategory =
  | "interview_invite"
  | "contract_offer"
  | "document_request"
  | "rejection"
  | "followup_request"
  | "other";

export interface ClassifyResult {
  category: EmailCategory;
  requiresAction: boolean;
  snippet: string;
}

const URGENT_CATEGORIES: EmailCategory[] = [
  "interview_invite",
  "contract_offer",
  "document_request",
  "followup_request",
];

export async function classifyEmail(
  subject: string,
  bodyText: string,
  fromEmail: string,
): Promise<ClassifyResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      category: "other",
      requiresAction: false,
      snippet: subject.slice(0, 120),
    };
  }

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 250,
      messages: [
        {
          role: "user",
          content: `Du klassifizierst Antwort-Emails auf eine Bewerbung. Du musst entscheiden, ob die Email wichtig ist.

Von: ${fromEmail}
Betreff: ${subject}
Text: ${(bodyText || "").slice(0, 1000)}

WICHTIGE Kategorien (Student/Admin muss schnell reagieren):
- interview_invite   = Einladung zu Vorstellungsgespräch, Telefoninterview, Videocall, Probearbeit
- contract_offer     = Zusage, Vertragsangebot, Stelle bekommen
- document_request   = Firma will Dokumente: Lebenslauf, Zeugnis, Foto, Visum, etc.
- followup_request   = Firma stellt Rückfrage zur Bewerbung, will Klärung

UNWICHTIG:
- rejection          = Absage, "leider nicht"
- other              = Eingangsbestätigung, Auto-Reply, Newsletter, Spam

Snippet: 1-Satz-Zusammenfassung max 120 Zeichen auf Deutsch.

Antworte NUR mit JSON, KEIN Text drumherum:
{"category":"...","snippet":"..."}`,
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const match = text.match(/\{[\s\S]*?\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      const category = (parsed.category as EmailCategory) || "other";
      const snippet = String(parsed.snippet || subject).slice(0, 120);
      return {
        category,
        requiresAction: URGENT_CATEGORIES.includes(category),
        snippet,
      };
    }
  } catch {
    // ignore
  }

  return {
    category: "other",
    requiresAction: false,
    snippet: subject.slice(0, 120),
  };
}
