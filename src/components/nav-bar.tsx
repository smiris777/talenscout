"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { logout } from "@/app/actions/auth";

export function NavBar({
  userName,
  isAdmin,
}: {
  userName: string;
  isAdmin: boolean;
}) {
  const pathname = usePathname();

  return (
    <header className="bg-white/70 backdrop-blur-xl border-b border-gray-200/40 sticky top-0 z-50 supports-[backdrop-filter]:bg-white/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-b from-gray-800 to-black text-white text-xs font-semibold shadow-sm group-hover:shadow-md transition-shadow duration-300">
                TS
              </div>
              <h1 className="text-sm font-semibold text-[#1d1d1f] tracking-tight">
                TalentScout
              </h1>
            </Link>
            <nav className="hidden sm:flex items-center gap-0.5">
              <Link
                href="/"
                className={`px-3.5 py-1.5 text-sm rounded-full transition-all duration-200 ${
                  pathname === "/"
                    ? "bg-gray-900/8 text-[#1d1d1f] font-medium"
                    : "text-gray-500 hover:text-[#1d1d1f] hover:bg-gray-900/4"
                }`}
              >
                Übersicht
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  className={`px-3.5 py-1.5 text-sm rounded-full transition-all duration-200 ${
                    pathname === "/admin"
                      ? "bg-gray-900/8 text-[#1d1d1f] font-medium"
                      : "text-gray-500 hover:text-[#1d1d1f] hover:bg-gray-900/4"
                  }`}
                >
                  Admin
                </Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 hidden sm:block font-medium">
              {userName}
            </span>
            <form action={logout}>
              <Button variant="outline" size="sm" type="submit" className="rounded-full text-xs h-8 px-4 border-gray-200/80 text-gray-500 hover:text-[#1d1d1f] hover:bg-gray-50 hover:border-gray-300/80">
                Abmelden
              </Button>
            </form>
          </div>
        </div>
      </div>
    </header>
  );
}
