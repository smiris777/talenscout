import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Not logged in → redirect to /login (except public auth pages)
  const publicPaths = ["/login", "/forgot-password", "/reset-password"];
  if (!user && !publicPaths.some(p => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Logged in → role-based routing
  if (user) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role;
    // Students (bewerber) cannot access recruiter/admin dashboard
    if (role === "bewerber") {
      if (pathname === "/" || pathname.startsWith("/admin") || pathname.startsWith("/azubi")) {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
      }
      // Redirect /login to /student if already logged in
      if (pathname === "/login") {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
      }
    }

    // Recruiters/Admins cannot access student pages
    if (role === "recruiter" || role === "administrator") {
      const studentPaths = ["/dashboard", "/bewerbungen", "/aufgaben", "/email-setup", "/scan"];
      if (studentPaths.some(p => pathname === p || pathname.startsWith(p + "/")) || pathname.startsWith("/student")) {
        const url = request.nextUrl.clone();
        url.pathname = "/";
        return NextResponse.redirect(url);
      }
      // Redirect /login to / if already logged in
      if (pathname === "/login") {
        const url = request.nextUrl.clone();
        url.pathname = "/";
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}
