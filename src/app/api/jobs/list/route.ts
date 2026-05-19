import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { getMatchingBereiche } from "@/lib/email/bereich-mapping";

export const runtime = "nodejs";

const PAGE_SIZE = 24;

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const search = (searchParams.get("q") ?? "").trim();
  const maxAgeDays = parseInt(searchParams.get("maxAgeDays") ?? "0", 10) || 0;
  const onlyMyBereich = searchParams.get("onlyMine") === "1";
  const onlyNew = searchParams.get("onlyNew") === "1"; // schon kontaktiert ausblenden

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Student-Daten für Default-Filter (Ziel → Bereich)
  const { data: student } = await admin
    .from("ausbildung_main_engine")
    .select(`"Ziel"`)
    .eq("user_id", user.id)
    .single();

  const ziel = (student as Record<string, unknown> | null)?.["Ziel"] as string | undefined;

  // Schon kontaktierte Emails für Markierung "bereits beworben"
  const { data: sentLog } = await admin
    .from("email_send_log")
    .select("recipient_email")
    .eq("user_id", user.id);

  const sentEmails = new Set(
    (sentLog ?? [])
      .map((e) => (e as { recipient_email: string | null }).recipient_email?.toLowerCase())
      .filter((e): e is string => !!e),
  );

  // Query bauen
  let q = admin
    .from("bewerbungen")
    .select("id, firmenname, email, telefonnummer, bereich, name, geschlecht, zusatzinfo, created_at", { count: "exact" })
    .not("email", "is", null);

  // Filter 1: Volltextsuche über firmenname / bereich
  if (search) {
    const escaped = search.replace(/[%_,]/g, "");
    if (escaped.length >= 2) {
      q = q.or(`firmenname.ilike.%${escaped}%,bereich.ilike.%${escaped}%`);
    }
  }

  // Filter 2: Nur Treffer im Ziel-Bereich des Studenten
  if (onlyMyBereich && ziel) {
    const bereiche = getMatchingBereiche(ziel);
    if (bereiche.length > 0) {
      const orFilter = bereiche
        .map((b) => `bereich.ilike.%${b.replace(/[%_,]/g, "")}%`)
        .join(",");
      q = q.or(orFilter);
    }
  }

  // Filter 3: maxAgeDays — created_at >= jetzt - X Tage
  if (maxAgeDays > 0) {
    const since = new Date(Date.now() - maxAgeDays * 86400000).toISOString();
    q = q.gte("created_at", since);
  }

  // Sort: neueste zuerst
  q = q.order("created_at", { ascending: false });

  // Pagination
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  q = q.range(from, to);

  const { data, count, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let jobs = (data ?? []).map((row) => {
    const r = row as {
      id: number;
      firmenname: string | null;
      email: string | null;
      telefonnummer: string | null;
      bereich: string | null;
      name: string | null;
      geschlecht: string | null;
      zusatzinfo: string | null;
      created_at: string | null;
    };
    const alreadyApplied = r.email ? sentEmails.has(r.email.toLowerCase()) : false;
    return {
      id: r.id,
      firmenname: r.firmenname,
      email: r.email,
      telefonnummer: r.telefonnummer,
      bereich: r.bereich,
      ansprechpartner: r.name,
      geschlecht: r.geschlecht,
      zusatzinfo: r.zusatzinfo,
      created_at: r.created_at,
      alreadyApplied,
    };
  });

  // Filter 4: Nur „neu" — bereits beworbene ausblenden (client-side, da sent_log per user)
  if (onlyNew) {
    jobs = jobs.filter((j) => !j.alreadyApplied);
  }

  return NextResponse.json({
    page,
    pageSize: PAGE_SIZE,
    total: count ?? 0,
    totalPages: Math.ceil((count ?? 0) / PAGE_SIZE),
    studentZiel: ziel ?? null,
    jobs,
  });
}
