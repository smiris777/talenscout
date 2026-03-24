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
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white text-sm font-bold">
                TS
              </div>
              <h1 className="text-lg font-semibold text-gray-900">
                TalentScout
              </h1>
            </Link>
            <nav className="hidden sm:flex items-center gap-1">
              <Link
                href="/"
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  pathname === "/"
                    ? "bg-gray-100 text-gray-900 font-medium"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Übersicht
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    pathname === "/admin"
                      ? "bg-gray-100 text-gray-900 font-medium"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Admin
                </Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 hidden sm:block">
              {userName}
            </span>
            <form action={logout}>
              <Button variant="outline" size="sm" type="submit">
                Abmelden
              </Button>
            </form>
          </div>
        </div>
      </div>
    </header>
  );
}
