import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const runtime = "nodejs";

function encryptPassword(password: string): string {
  const key = Buffer.from(process.env.EMAIL_ENCRYPTION_KEY!, "hex");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(password, "utf8");
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), encrypted.toString("base64"), tag.toString("base64")].join(":");
}

async function checkAdmin(supabase: ReturnType<Awaited<ReturnType<typeof createClient>>extends infer T ? () => T : never>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("user_profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "administrator") return null;
  return user;
}

// CREATE new student
export async function POST(request: Request) {
  const supabase = await createClient();
  const admin = await checkAdmin(supabase as any);
  if (!admin) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });

  const body = await request.json();
  const { namen, email, password, ziel, deutschNiveau, art, videoLink, fotoLink, driveLink, motivationsschreiben, profil, infos, gmailAddress, gmailAppPassword, credits, autoRefill, maxDailyEmails, whatsapp } = body;

  if (!namen || !email || !password) {
    return NextResponse.json({ error: "Name, Email und Passwort sind erforderlich" }, { status: 400 });
  }

  const adminSupabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // 1. Create auth user
    const { data: authUser, error: authError } = await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) throw new Error("Auth: " + authError.message);
    const userId = authUser.user.id;

    // 2. Create user profile
    const { error: profileError } = await adminSupabase.from("user_profiles").insert({
      id: userId,
      full_name: namen,
      role: "bewerber",
      email,
    });
    if (profileError) throw new Error("Profil: " + profileError.message);

    // 3. Extract drive folder ID from URL
    let driveFolderId = driveLink || null;
    if (driveFolderId && driveFolderId.includes("folders/")) {
      const match = driveFolderId.match(/folders\/([^/?]+)/);
      if (match) driveFolderId = match[1];
    }

    // 4. Create engine entry
    const { error: engineError } = await adminSupabase.from("ausbildung_main_engine").insert({
      Namen: namen,
      Email: email,
      Ziel: ziel || null,
      "Deutsch Niveau": deutschNiveau || null,
      Art: art || "Ausbildung-lite",
      BewerbungsVideoLink: videoLink || null,
      BewerbungsfotoLink: fotoLink || null,
      Motivationsschreiben: motivationsschreiben || null,
      Profil: profil || null,
      Infos: infos || null,
      user_id: userId,
      drive_folder_id: driveFolderId,
      sichtbar: true,
      Aktiv: "ja",
      monthly_credit: credits || 10,
      credit_auto_refill: autoRefill || 0,
      student_active: true,
      daily_email_enabled: !!gmailAppPassword,
      gmail_app_password_set: !!gmailAppPassword,
      max_daily_emails: maxDailyEmails || 10,
      whatsapp: whatsapp || null,
    });
    if (engineError) throw new Error("Engine: " + engineError.message);

    // 5. Save Gmail credentials if provided
    if (gmailAppPassword && gmailAddress) {
      const cleanPassword = gmailAppPassword.replace(/\s+/g, "");
      const encryptedPw = encryptPassword(cleanPassword);

      const { error: credsError } = await adminSupabase.from("email_credentials").insert({
        user_id: userId,
        email: gmailAddress,
        encrypted_password: encryptedPw,
        is_active: true,
      });
      if (credsError) throw new Error("Credentials: " + credsError.message);
    }

    return NextResponse.json({ success: true, userId, message: `${namen} wurde erfolgreich erstellt!` });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// UPDATE existing student
export async function PUT(request: Request) {
  const supabase = await createClient();
  const admin = await checkAdmin(supabase as any);
  if (!admin) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });

  const body = await request.json();
  const { engineId, userId, namen, email, ziel, deutschNiveau, art, videoLink, fotoLink, driveLink, motivationsschreiben, profil, infos, gmailAddress, gmailAppPassword, credits, autoRefill, maxDailyEmails, newPassword, whatsapp } = body;

  if (!engineId) {
    return NextResponse.json({ error: "Engine ID erforderlich" }, { status: 400 });
  }

  const adminSupabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // Extract drive folder ID
    let driveFolderId = driveLink || null;
    if (driveFolderId && driveFolderId.includes("folders/")) {
      const match = driveFolderId.match(/folders\/([^/?]+)/);
      if (match) driveFolderId = match[1];
    }

    // 1. Update engine
    const engineUpdate: Record<string, any> = {};
    if (namen !== undefined) engineUpdate.Namen = namen;
    if (email !== undefined) engineUpdate.Email = email;
    if (ziel !== undefined) engineUpdate.Ziel = ziel;
    if (deutschNiveau !== undefined) engineUpdate["Deutsch Niveau"] = deutschNiveau;
    if (art !== undefined) engineUpdate.Art = art;
    if (videoLink !== undefined) engineUpdate.BewerbungsVideoLink = videoLink;
    if (fotoLink !== undefined) engineUpdate.BewerbungsfotoLink = fotoLink;
    if (motivationsschreiben !== undefined) engineUpdate.Motivationsschreiben = motivationsschreiben;
    if (profil !== undefined) engineUpdate.Profil = profil;
    if (infos !== undefined) engineUpdate.Infos = infos;
    if (driveFolderId !== undefined) engineUpdate.drive_folder_id = driveFolderId;
    if (credits !== undefined) engineUpdate.monthly_credit = credits;
    if (autoRefill !== undefined) engineUpdate.credit_auto_refill = autoRefill;
    if (maxDailyEmails !== undefined) engineUpdate.max_daily_emails = maxDailyEmails;
    if (whatsapp !== undefined) engineUpdate.whatsapp = whatsapp || null;

    if (Object.keys(engineUpdate).length > 0) {
      const { error } = await adminSupabase.from("ausbildung_main_engine").update(engineUpdate).eq("id", engineId);
      if (error) throw new Error("Engine: " + error.message);
    }

    // 2. Update user profile if name or email changed
    if (userId && (namen || email)) {
      const profileUpdate: Record<string, any> = {};
      if (namen) profileUpdate.full_name = namen;
      if (email) profileUpdate.email = email;
      await adminSupabase.from("user_profiles").update(profileUpdate).eq("id", userId);
    }

    // 3. Update auth email/password if changed
    if (userId) {
      const authUpdate: Record<string, any> = {};
      if (email) authUpdate.email = email;
      if (newPassword) authUpdate.password = newPassword;
      if (Object.keys(authUpdate).length > 0) {
        const { error } = await adminSupabase.auth.admin.updateUserById(userId, authUpdate);
        if (error) throw new Error("Auth: " + error.message);
      }
    }

    // 4. Update Gmail credentials
    if (gmailAppPassword && gmailAddress && userId) {
      const cleanPassword = gmailAppPassword.replace(/\s+/g, "");
      const encryptedPw = encryptPassword(cleanPassword);

      // Check if exists
      const { data: existing } = await adminSupabase.from("email_credentials").select("id").eq("user_id", userId).single();

      if (existing) {
        await adminSupabase.from("email_credentials").update({
          email: gmailAddress,
          encrypted_password: encryptedPw,
          is_active: true,
          updated_at: new Date().toISOString(),
        }).eq("user_id", userId);
      } else {
        await adminSupabase.from("email_credentials").insert({
          user_id: userId,
          email: gmailAddress,
          encrypted_password: encryptedPw,
          is_active: true,
        });
      }

      // Mark in engine
      await adminSupabase.from("ausbildung_main_engine").update({
        gmail_app_password_set: true,
        daily_email_enabled: true,
      }).eq("id", engineId);
    }

    return NextResponse.json({ success: true, message: "Änderungen gespeichert!" });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// GET student details for edit modal
export async function GET(request: Request) {
  const supabase = await createClient();
  const admin = await checkAdmin(supabase as any);
  if (!admin) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const engineId = searchParams.get("id");

  if (!engineId) return NextResponse.json({ error: "ID erforderlich" }, { status: 400 });

  const adminSupabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: student, error } = await adminSupabase
    .from("ausbildung_main_engine")
    .select("*")
    .eq("id", parseInt(engineId))
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get Gmail credentials if exists
  let gmailEmail = null;
  let stats: Record<string, any> = {};

  if (student.user_id) {
    const { data: creds } = await adminSupabase
      .from("email_credentials")
      .select("email")
      .eq("user_id", student.user_id)
      .single();
    gmailEmail = creds?.email || null;

    // Gather stats
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // Last week start for velocity comparison
    const lastWeekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() - 7).toISOString();

    const [totalSent, totalReceived, sentToday, sentWeek, sentLastWeek, sentMonth, totalScans, failedSent] = await Promise.all([
      adminSupabase.from("email_send_log").select("*", { count: "exact", head: true }).eq("user_id", student.user_id).eq("status", "sent"),
      adminSupabase.from("email_received_log").select("*", { count: "exact", head: true }).eq("user_id", student.user_id),
      adminSupabase.from("email_send_log").select("*", { count: "exact", head: true }).eq("user_id", student.user_id).eq("status", "sent").gte("sent_at", todayStart),
      adminSupabase.from("email_send_log").select("*", { count: "exact", head: true }).eq("user_id", student.user_id).eq("status", "sent").gte("sent_at", weekStart),
      adminSupabase.from("email_send_log").select("*", { count: "exact", head: true }).eq("user_id", student.user_id).eq("status", "sent").gte("sent_at", lastWeekStart).lt("sent_at", weekStart),
      adminSupabase.from("email_send_log").select("*", { count: "exact", head: true }).eq("user_id", student.user_id).eq("status", "sent").gte("sent_at", monthStart),
      adminSupabase.from("job_listings").select("*", { count: "exact", head: true }).eq("student_id", student.user_id),
      adminSupabase.from("email_send_log").select("*", { count: "exact", head: true }).eq("user_id", student.user_id).eq("status", "failed"),
    ]);

    // Profile completeness calculation
    const profileFields = [
      student.Namen, student.Email, student.Ziel, student["Deutsch Niveau"],
      student.BewerbungsVideoLink, student.BewerbungsfotoLink, student.Motivationsschreiben,
      student.Profil, student.drive_folder_id, student.Infos,
    ];
    const filledFields = profileFields.filter(f => f && String(f).trim()).length;
    const profileCompleteness = Math.round((filledFields / profileFields.length) * 100);

    // Velocity trend
    const thisWeekCount = sentWeek.count || 0;
    const lastWeekCount = sentLastWeek.count || 0;
    const velocityTrend = thisWeekCount > lastWeekCount ? "up" : thisWeekCount < lastWeekCount ? "down" : "same";

    // Milestones
    const total = totalSent.count || 0;
    const milestones = [5, 10, 25, 50, 100, 250, 500];
    const nextMilestone = milestones.find(m => m > total) || 1000;
    const lastMilestone = milestones.filter(m => m <= total).pop() || 0;

    stats = {
      totalSent: total,
      totalFailed: failedSent.count || 0,
      totalReceived: totalReceived.count || 0,
      sentToday: sentToday.count || 0,
      sentThisWeek: thisWeekCount,
      sentLastWeek: lastWeekCount,
      sentThisMonth: sentMonth.count || 0,
      totalScans: totalScans.count || 0,
      lastLoginAt: student.last_login_at || null,
      loginCount: student.login_count || 0,
      profileCompleteness,
      velocityTrend,
      nextMilestone,
      lastMilestone,
      responseRate: total > 0 ? Math.round(((totalReceived.count || 0) / total) * 100) : 0,
      successRate: total > 0 ? Math.round((total - (failedSent.count || 0)) / total * 100) : 0,
    };
  }

  return NextResponse.json({ student, gmailEmail, stats });
}
