"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface StudentNavBarProps {
  userName: string;
  creditUsed: number;
  creditTotal: number;
  pendingTasks: number;
  scanCount?: number;
  streakDays?: number;
}

export function StudentNavBar({
  userName,
  creditUsed,
  creditTotal,
  pendingTasks,
  scanCount = 0,
  streakDays = 0,
}: StudentNavBarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const navItems = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/scan", label: "Scan & Apply", badge: scanCount },
    { href: "/bewerbungen", label: "Bewerbungen" },
    { href: "/aufgaben", label: "Aufgaben", badge: pendingTasks },
    { href: "/email-setup", label: "E-Mail Setup" },
  ];

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const creditPercent = creditTotal > 0 ? Math.round((creditUsed / creditTotal) * 100) : 0;

  return (
    <nav className="border-b bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white text-sm font-bold">
                TS
              </div>
              <span className="font-semibold text-gray-900">TalentScout</span>
            </Link>

            <div className="hidden sm:flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors relative ${
                    pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  {item.label}
                  {item.badge && item.badge > 0 ? (
                    <span className="ml-1.5 inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {streakDays > 0 && (
              <div className="hidden sm:flex items-center gap-1 text-sm">
                <span>🔥</span>
                <span className="font-semibold text-orange-600">{streakDays}</span>
              </div>
            )}
            {creditTotal > 0 && (
              <div className="hidden sm:flex items-center gap-2 text-sm">
                <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      creditPercent >= 90 ? "bg-red-500" : creditPercent >= 70 ? "bg-yellow-500" : "bg-blue-500"
                    }`}
                    style={{ width: `${Math.min(creditPercent, 100)}%` }}
                  />
                </div>
                <span className="text-gray-500 whitespace-nowrap">
                  {creditUsed}/{creditTotal}
                </span>
              </div>
            )}

            <span className="text-sm text-gray-600 hidden md:block">{userName}</span>

            <Link
              href="/passwort"
              className="text-sm text-gray-400 hover:text-gray-600 px-2 py-1 rounded-md hover:bg-gray-50 transition-colors hidden sm:block"
              title="Passwort ändern"
            >
              🔑
            </Link>

            <button
              onClick={handleLogout}
              className="text-sm text-gray-500 hover:text-gray-700 px-2 py-1 rounded-md hover:bg-gray-100 transition-colors"
            >
              Abmelden
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
