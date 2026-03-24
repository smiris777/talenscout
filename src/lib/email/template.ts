import { extractYouTubeId } from "@/lib/utils/normalize";

interface EmailTemplateParams {
  anrede: string;
  einleitung: string;
  motivationAngepasst: string;
  studentName: string;
  studentEmail: string;
  studentZiel: string;
  deutschNiveau: string;
  art?: string;
  videoLink?: string | null;
  fotoUrl?: string | null;
  driveFolderUrl?: string | null;
  sequenceStep?: number; // 1=initial, 2=followup1, 3=followup2
}

export function buildApplicationEmail(params: EmailTemplateParams): string {
  const {
    anrede,
    einleitung,
    motivationAngepasst,
    studentName,
    studentEmail,
    studentZiel,
    deutschNiveau,
    art,
    videoLink,
    fotoUrl,
    driveFolderUrl,
    sequenceStep = 1,
  } = params;

  // YouTube thumbnail
  let videoSection = "";
  if (videoLink) {
    const videoId = extractYouTubeId(videoLink);
    if (videoId) {
      const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
      videoSection = `
        <tr>
          <td style="padding: 0 0 24px 0;">
            <p style="margin: 0 0 12px 0; font-size: 14px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Mein Vorstellungsvideo</p>
            <a href="${youtubeUrl}" target="_blank" style="display: block; text-decoration: none; position: relative;">
              <img src="${thumbnailUrl}" alt="Vorstellungsvideo" style="width: 100%; max-width: 480px; border-radius: 12px; display: block;" />
              <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 64px; height: 64px; background: rgba(255,0,0,0.85); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                <div style="width: 0; height: 0; border-top: 12px solid transparent; border-bottom: 12px solid transparent; border-left: 20px solid white; margin-left: 4px;"></div>
              </div>
            </a>
          </td>
        </tr>`;
    }
  }

  // Documents CTA
  let documentsCta = "";
  if (driveFolderUrl) {
    documentsCta = `
        <tr>
          <td style="padding: 24px 0 0 0; text-align: center;">
            <a href="${driveFolderUrl}" target="_blank" style="display: inline-block; padding: 12px 28px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;">
              Alle Unterlagen einsehen
            </a>
          </td>
        </tr>`;
  }

  // Follow-up variations
  let bodyContent: string;
  if (sequenceStep === 2) {
    bodyContent = `
      <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #374151;">
        ich wollte kurz nachfragen, ob meine Bewerbung als <strong>${studentZiel}</strong> bei Ihnen angekommen ist.
      </p>
      <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #374151;">
        Ich bin nach wie vor sehr interessiert und würde mich über eine Rückmeldung freuen. Gerne stehe ich für ein Gespräch zur Verfügung.
      </p>`;
  } else if (sequenceStep === 3) {
    bodyContent = `
      <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #374151;">
        abschließend möchte ich mein Interesse an der Position als <strong>${studentZiel}</strong> in Ihrem Unternehmen bekräftigen.
      </p>
      <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #374151;">
        Sollte derzeit keine passende Stelle verfügbar sein, würde ich mich freuen, wenn Sie meine Unterlagen für zukünftige Möglichkeiten vormerken könnten.
      </p>`;
  } else {
    bodyContent = `
      <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #374151;">
        ${einleitung}
      </p>
      <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #374151;">
        ${motivationAngepasst}
      </p>`;
  }

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 0 32px;">
              ${fotoUrl ? `<img src="${fotoUrl}" alt="${studentName}" style="width: 56px; height: 56px; border-radius: 50%; object-fit: cover; margin-bottom: 16px;" />` : ""}
              <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #374151;">
                ${anrede},
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 0 32px;">
              ${bodyContent}
            </td>
          </tr>

          <!-- Video -->
          <tr>
            <td style="padding: 8px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${videoSection}
              </table>
            </td>
          </tr>

          <!-- Profile Card -->
          <tr>
            <td style="padding: 8px 32px 24px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 12px; padding: 20px;">
                <tr>
                  <td style="padding: 16px;">
                    <p style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600; color: #111827;">${studentName}</p>
                    <p style="margin: 0 0 12px 0; font-size: 14px; color: #6b7280;">${studentZiel}</p>
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-right: 8px;">
                          <span style="display: inline-block; padding: 4px 10px; background-color: #dbeafe; color: #1d4ed8; border-radius: 6px; font-size: 12px; font-weight: 600;">Deutsch ${deutschNiveau}</span>
                        </td>
                        ${art ? `<td><span style="display: inline-block; padding: 4px 10px; background-color: #e5e7eb; color: #374151; border-radius: 6px; font-size: 12px; font-weight: 500;">${art}</span></td>` : ""}
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding: 0 32px 32px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${documentsCta}
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 4px 0; font-size: 14px; color: #374151;">Mit freundlichen Grüßen</p>
              <p style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600; color: #111827;">${studentName}</p>
              <p style="margin: 0; font-size: 13px; color: #6b7280;">
                <a href="mailto:${studentEmail}" style="color: #2563eb; text-decoration: none;">${studentEmail}</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
