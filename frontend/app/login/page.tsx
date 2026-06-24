"use client";
import { api, setToken } from "@/lib/api";
import { initials } from "@/lib/utils";
import { Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Step = "phone" | "otp" | "profile";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [hint, setHint] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function requestOtp() {
    if (!phone.trim()) return setError("Enter a phone number");
    setLoading(true);
    setError("");
    try {
      const res = await api.requestOtp(phone.trim());
      setHint(res.hint);
      setStep("otp");
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    setLoading(true);
    setError("");
    try {
      const res = await api.verifyOtp(phone.trim(), otp.trim());
      setToken(res.access_token);
      if (res.is_new_user) {
        setDisplayName(res.user.display_name || "");
        setStep("profile");
      } else {
        router.push("/");
      }
    } catch (e: any) {
      setError(e.message || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  }

  async function saveProfile() {
    if (!displayName.trim()) return setError("Enter your name");
    setLoading(true);
    setError("");
    try {
      await api.completeProfile({
        display_name: displayName.trim(),
        username: username.trim() || null,
      });
      router.push("/");
    } catch (e: any) {
      setError(e.message || "Could not save profile");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-signal-blue text-white">
            <Lock size={30} />
          </div>
          <h1 className="text-2xl font-bold text-txt">Signal</h1>
          <p className="mt-1 text-sm text-muted">
            Private messaging. Simulated end-to-end encryption.
          </p>
        </div>

        <div className="rounded-2xl bg-surface p-6 shadow-sm">
          {step === "phone" && (
            <>
              <label className="mb-2 block text-sm font-medium text-txt">
                Phone number
              </label>
              <input
                autoFocus
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && requestOtp()}
                placeholder="+1 555 000 0001"
                className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-txt outline-none focus:border-signal-blue"
              />
              <button
                onClick={requestOtp}
                disabled={loading}
                className="mt-4 w-full rounded-lg bg-signal-blue py-2.5 font-medium text-white transition hover:bg-signal-bluedark disabled:opacity-60"
              >
                {loading ? "Sending…" : "Continue"}
              </button>
              <p className="mt-4 text-center text-xs text-muted">
                Try a seeded account, e.g. <b>+15550000001</b> (Alice)
              </p>
            </>
          )}

          {step === "otp" && (
            <>
              <label className="mb-2 block text-sm font-medium text-txt">
                Enter verification code
              </label>
              <input
                autoFocus
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && verifyOtp()}
                placeholder="123456"
                inputMode="numeric"
                className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-center text-lg tracking-[0.4em] text-txt outline-none focus:border-signal-blue"
              />
              {hint && (
                <p className="mt-2 rounded-md bg-signal-blue/10 px-3 py-2 text-center text-xs text-signal-blue">
                  {hint}
                </p>
              )}
              <button
                onClick={verifyOtp}
                disabled={loading}
                className="mt-4 w-full rounded-lg bg-signal-blue py-2.5 font-medium text-white transition hover:bg-signal-bluedark disabled:opacity-60"
              >
                {loading ? "Verifying…" : "Verify"}
              </button>
              <button
                onClick={() => setStep("phone")}
                className="mt-3 w-full text-center text-sm text-muted hover:text-txt"
              >
                ← Change number
              </button>
            </>
          )}

          {step === "profile" && (
            <>
              <div className="mb-4 flex justify-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-signal-blue text-2xl font-medium text-white">
                  {initials(displayName || "?")}
                </div>
              </div>
              <label className="mb-2 block text-sm font-medium text-txt">
                Your name
              </label>
              <input
                autoFocus
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Jane Doe"
                className="mb-3 w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-txt outline-none focus:border-signal-blue"
              />
              <label className="mb-2 block text-sm font-medium text-txt">
                Username (optional)
              </label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveProfile()}
                placeholder="jane"
                className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-txt outline-none focus:border-signal-blue"
              />
              <button
                onClick={saveProfile}
                disabled={loading}
                className="mt-4 w-full rounded-lg bg-signal-blue py-2.5 font-medium text-white transition hover:bg-signal-bluedark disabled:opacity-60"
              >
                {loading ? "Saving…" : "Finish"}
              </button>
            </>
          )}

          {error && (
            <p className="mt-3 text-center text-sm text-red-500">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
