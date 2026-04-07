"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setError("Fehler: " + error.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7] px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-b from-gray-800 to-black text-white text-2xl font-semibold shadow-lg">
            TS
          </div>
          <h1 className="text-3xl font-semibold text-[#1d1d1f] tracking-tight">
            Passwort vergessen
          </h1>
          <p className="text-sm text-gray-400 mt-1.5 font-medium">
            Wir senden dir einen Reset-Link
          </p>
        </div>

        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg shadow-black/[0.03] p-6">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">E-Mail gesendet!</p>
                <p className="text-sm text-gray-500 mt-1">
                  Wir haben einen Reset-Link an <span className="font-medium text-gray-700">{email}</span> gesendet.
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  Bitte auch im Spam-Ordner schauen.
                </p>
              </div>
              <Link
                href="/login"
                className="block w-full h-11 rounded-full bg-[#1d1d1f] text-white text-sm font-medium flex items-center justify-center hover:bg-black transition-all"
              >
                Zurück zum Login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Deine E-Mail-Adresse
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@beispiel.de"
                  required
                  className="w-full h-11 rounded-xl bg-[#f5f5f7] border-0 px-4 text-sm text-[#1d1d1f] placeholder:text-gray-300 focus:outline-none focus:bg-white focus:ring-2 focus:ring-gray-900/10 transition-all"
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 p-3 rounded-xl">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-full bg-[#1d1d1f] text-white text-sm font-medium hover:bg-black transition-all disabled:opacity-50"
              >
                {loading ? "Senden..." : "Reset-Link senden"}
              </button>

              <div className="text-center">
                <Link href="/login" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                  Zurück zum Login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
