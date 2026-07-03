"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
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
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/jobs", label: "Jobs" },
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
    <nav className="border-b bg-white relative">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white text-sm font-bold">
                TS
              </div>
              <span className="font-semibold text-gray-900">TalentScout</span>
            </Link>

            {/* Desktop Nav (>= sm) */}
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
              className="hidden sm:block text-sm text-gray-500 hover:text-gray-700 px-2 py-1 rounded-md hover:bg-gray-100 transition-colors"
            >
              Abmelden
            </button>

            {/* Mobile Hamburger (< sm) */}
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? "Menü schließen" : "Menü öffnen"}
              className="sm:hidden inline-flex items-center justify-center w-9 h-9 rounded-md text-gray-600 hover:bg-gray-100"
            >
              {mobileOpen ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" y1="6" x2="20" y2="6" />
                  <line x1="4" y1="12" x2="20" y2="12" />
                  <line x1="4" y1="18" x2="20" y2="18" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileOpen && (
        <>
          {/* Overlay zum Schließen bei Klick außerhalb */}
          <div
            className="sm:hidden fixed inset-0 top-14 bg-black/20 z-30"
            onClick={() => setMobileOpen(false)}
          />
          <div className="sm:hidden absolute top-14 inset-x-0 bg-white border-b shadow-lg z-40">
            <div className="px-4 py-3 space-y-1">
              {navItems.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      active ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <span>{item.label}</span>
                    {item.badge && item.badge > 0 ? (
                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                        {item.badge}
                      </span>
                    ) : null}
                  </Link>
                );
              })}

              <div className="border-t border-gray-100 my-2" />

              {/* Zusatz-Infos für Mobile: Credits, Streak, Name */}
              <div className="px-3 py-2 space-y-2">
                {creditTotal > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-500 w-16">Kredit:</span>
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          creditPercent >= 90 ? "bg-red-500" : creditPercent >= 70 ? "bg-yellow-500" : "bg-blue-500"
                        }`}
                        style={{ width: `${Math.min(creditPercent, 100)}%` }}
                      />
                    </div>
                    <span className="text-gray-600 whitespace-nowrap">
                      {creditUsed}/{creditTotal}
                    </span>
                  </div>
                )}
                {streakDays > 0 && (
                  <div className="text-xs text-gray-600">
                    🔥 <span className="font-semibold text-orange-600">{streakDays}</span> Tage Streak
                  </div>
                )}
                <div className="text-xs text-gray-500">{userName}</div>
              </div>

              <Link
                href="/passwort"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                🔑 Passwort ändern
              </Link>

              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  handleLogout();
                }}
                className="w-full text-left px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50"
              >
                Abmelden
              </button>
            </div>
          </div>
        </>
      )}
    </nav>
  );
}
