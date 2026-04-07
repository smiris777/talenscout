"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ChangePasswordPage() {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Neues Passwort muss mindestens 8 Zeichen lang sein.");
      return;
    }
    if (password !== confirm) {
      setError("Passwörter stimmen nicht überein.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    // Re-authenticate with current password first
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      setError("Nicht eingeloggt.");
      setLoading(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: current,
    });

    if (signInError) {
      setError("Aktuelles Passwort ist falsch.");
      setLoading(false);
      return;
    }

    // Update password
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError("Fehler beim Ändern: " + updateError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
    setTimeout(() => router.push("/dashboard"), 2500);
  }

  return (
    <div className="max-w-md mx-auto px-4 py-10">
      <div className="mb-6">
        <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Zurück zum Dashboard
        </Link>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h1 className="text-xl font-semibold text-gray-800 mb-1">Passwort ändern</h1>
        <p className="text-sm text-gray-400 mb-6">Wähle ein neues, sicheres Passwort</p>

        {success ? (
          <div className="text-center space-y-4 py-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-gray-800">Passwort geändert! ✅</p>
              <p className="text-sm text-gray-500 mt-1">Du wirst zum Dashboard weitergeleitet...</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Aktuelles Passwort
              </label>
              <input
                type="password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                placeholder="Dein aktuelles Passwort"
                required
                className="w-full h-11 rounded-xl bg-gray-50 border border-gray-100 px-4 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-all"
              />
            </div>

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
                className="w-full h-11 rounded-xl bg-gray-50 border border-gray-100 px-4 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-all"
              />
              {/* Strength bar */}
              {password.length > 0 && (
                <div className="space-y-1 pt-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          password.length >= i * 3
                            ? password.length >= 12 ? "bg-green-500" : password.length >= 8 ? "bg-yellow-400" : "bg-red-400"
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
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Neues Passwort wiederholen
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Passwort bestätigen"
                required
                className={`w-full h-11 rounded-xl bg-gray-50 border px-4 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all ${
                  confirm.length > 0 && confirm !== password
                    ? "border-red-300 focus:border-red-300"
                    : confirm.length > 0 && confirm === password
                    ? "border-green-300 focus:border-green-300"
                    : "border-gray-100 focus:border-blue-300"
                }`}
              />
              {confirm.length > 0 && (
                <p className={`text-xs ${confirm === password ? "text-green-600" : "text-red-500"}`}>
                  {confirm === password ? "✓ Passwörter stimmen überein" : "✗ Passwörter stimmen nicht überein"}
                </p>
              )}
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 rounded-xl">
                <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || password !== confirm || password.length < 8}
              className="w-full h-11 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            >
              {loading ? "Speichern..." : "Passwort speichern"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
