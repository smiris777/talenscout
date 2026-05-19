import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { JobsBrowser } from "@/components/jobs-browser";

export default async function JobsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <JobsBrowser />;
}
