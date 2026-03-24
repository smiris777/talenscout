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

  // Get all students with auto-refill configured
  const { data: students, error } = await supabase
    .from("ausbildung_main_engine")
    .select("id, Namen, credit_auto_refill, monthly_credit")
    .gt("credit_auto_refill", 0);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let updated = 0;
  for (const student of students || []) {
    const { error: updateError } = await supabase
      .from("ausbildung_main_engine")
      .update({ monthly_credit: student.credit_auto_refill })
      .eq("id", student.id);

    if (!updateError) updated++;
  }

  return NextResponse.json({
    message: `Reset credits for ${updated} students`,
    total: students?.length || 0,
    updated,
    timestamp: new Date().toISOString(),
  });
}
