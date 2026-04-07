"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Supabase redirects with #access_token=...&type=recovery in the URL hash
    // The client SDK picks this up automatically via onAuthStateChange
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });

    // Also check if we already have a session (user came via the link)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Passwort muss mindestens 8 Zeichen lang sein.");
      return;
    }
    if (password !== confirm) {
      setError("Passwörter stimmen nicht überein.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError("Fehler: " + error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
    setTimeout(() => router.push("/login"), 3000);
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
            Neues Passwort
          </h1>
          <p className="text-sm text-gray-400 mt-1.5 font-medium">
            Wähle ein sicheres Passwort
          </p>
        </div>

        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg shadow-black/[0.03] p-6">
          {success ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Passwort geändert!</p>
                <p className="text-sm text-gray-500 mt-1">
                  Du wirst in 3 Sekunden zum Login weitergeleitet...
                </p>
              </div>
            </div>
          ) : !ready ? (
            <div className="text-center py-4">
              <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-500">Einen Moment...</p>
              <p className="text-xs text-gray-400 mt-1">
                Falls diese Seite hängt,{" "}
                <a href="/forgot-password" className="underline">beantrage einen neuen Link</a>.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Neues Passwort
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mindestens 8 Zeichen"
                  required
                  minLength={8}
                  className="w-full h-11 rounded-xl bg-[#f5f5f7] border-0 px-4 text-sm text-[#1d1d1f] placeholder:text-gray-300 focus:outline-none focus:bg-white focus:ring-2 focus:ring-gray-900/10 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Passwort wiederholen
                </label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Passwort bestätigen"
                  required
                  className="w-full h-11 rounded-xl bg-[#f5f5f7] border-0 px-4 text-sm text-[#1d1d1f] placeholder:text-gray-300 focus:outline-none focus:bg-white focus:ring-2 focus:ring-gray-900/10 transition-all"
                />
              </div>

              {/* Password strength indicator */}
              {password.length > 0 && (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          password.length >= i * 3
                            ? password.length >= 12
                              ? "bg-green-500"
                              : password.length >= 8
                              ? "bg-yellow-400"
                              : "bg-red-400"
                            : "bg-gray-200"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-gray-400">
                    {password.length < 8 ? "Zu kurz" : password.length < 12 ? "Ausreichend" : "Stark ✓"}
                  </p>
                </div>
              )}

              {error && (
                <p className="text-sm text-red-600 bg-red-50 p-3 rounded-xl">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-full bg-[#1d1d1f] text-white text-sm font-medium hover:bg-black transition-all disabled:opacity-50"
              >
                {loading ? "Speichern..." : "Passwort speichern"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
