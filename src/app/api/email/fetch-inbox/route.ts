import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { fetchInboxForUser } from "@/lib/email/imap-fetcher";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const result = await fetchInboxForUser(admin, user.id);

  if (result.error) {
    return NextResponse.json(
      { error: `Posteingang konnte nicht abgerufen werden: ${result.error}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    newEmails: result.newEmails,
    message:
      result.newEmails > 0
        ? `${result.newEmails} neue Antwort${result.newEmails === 1 ? "" : "en"} gefunden!`
        : "Keine neuen Antworten.",
  });
}
