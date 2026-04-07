"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError("E-Mail oder Passwort falsch.");
      setLoading(false);
      return;
    }

    // Force full page reload to trigger middleware role-based routing
    window.location.href = "/dashboard";
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-b from-gray-800 to-black text-white text-2xl font-semibold shadow-lg">
            TS
          </div>
          <h1 className="text-3xl font-semibold text-[#1d1d1f] tracking-tight">
            TalentScout
          </h1>
          <p className="text-sm text-gray-400 mt-1.5 font-medium">
            Bewerbungs-Portal
          </p>
        </div>

        <Card className="rounded-2xl border-0 bg-white/80 backdrop-blur-xl shadow-lg shadow-black/[0.03]">
          <CardContent className="p-6 pt-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  E-Mail
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@beispiel.de"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11 rounded-xl bg-[#f5f5f7] border-0 text-[#1d1d1f] placeholder:text-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="password" className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Passwort
                </label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Passwort eingeben"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11 rounded-xl bg-[#f5f5f7] border-0 text-[#1d1d1f] placeholder:text-gray-300 focus:bg-white focus:ring-2 focus:ring-gray-900/10"
                />
              </div>
              {error && (
                <p className="text-sm text-red-600 bg-red-50/80 p-3 rounded-xl">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full h-11 rounded-full bg-[#1d1d1f] hover:bg-black text-white text-sm font-medium shadow-sm hover:shadow-md transition-all duration-200" disabled={loading}>
                {loading ? "Anmelden..." : "Anmelden"}
              </Button>

              <div className="text-center pt-1">
                <Link
                  href="/forgot-password"
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Passwort vergessen?
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
