"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { createSession, clearAllSessions } from "@/lib/session";
import { supabase } from "@/lib/supabase";

export default function SignIn() {
  const router = useRouter();

  // Mode: "signin" | "signup"
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  // Sign In inputs
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Sign Up inputs
  const [signupUsername, setSignupUsername] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");
  const [showSignupPassword, setShowSignupPassword] = useState(false);

  // States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [redirectPath, setRedirectPath] = useState("/causes");
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get("redirect");
      if (redirect) {
        setRedirectPath(redirect);
      }
      const expired = params.get("expired");
      if (expired === "1" || expired === "true") {
        setSessionExpiredNotice(true);
      }
      const initialMode = params.get("mode") || params.get("tab");
      if (initialMode === "signup") {
        setMode("signup");
      }
    }
  }, []);

  // Post-auth routing
  const handleAuthSuccess = (data: any) => {
    clearAllSessions();
    if (data.role === "admin") {
      createSession("admin", data.user);
      router.push("/admin");
    } else if (data.role === "volunteer") {
      createSession("volunteer", data.user);
      router.push("/volunteer/profile");
    } else {
      createSession("user", data.user);
      if (redirectPath && (redirectPath.startsWith("/donate") || redirectPath.startsWith("/causes"))) {
        router.push(redirectPath);
      } else {
        router.push("/profile");
      }
    }
  };

  // SIGN IN SUBMISSION (Username or Email + Password)
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!identifier.trim() || !password) {
      setError("Please enter your username/email and password.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: identifier.trim(),
          password
        }),
      });
      const data = await res.json();
      setLoading(false);

      if (data.success && data.user) {
        handleAuthSuccess(data);
      } else {
        setError(data.error || "Invalid username/email or password.");
      }
    } catch (err) {
      setLoading(false);
      setError("Network error. Please try again.");
    }
  };

  // SIGN UP SUBMISSION
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!signupUsername.trim() || !signupEmail.trim() || !signupPhone.trim() || !signupPassword) {
      setError("Please fill in all required fields.");
      return;
    }

    if (signupPassword !== signupConfirmPassword) {
      setError("Passwords do not match. Please verify.");
      return;
    }

    if (signupPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/user/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "signup",
          username: signupUsername.trim(),
          email: signupEmail.trim().toLowerCase(),
          phone: signupPhone.trim(),
          password: signupPassword,
        }),
      });
      const data = await res.json();
      setLoading(false);

      if (data.success && data.user) {
        createSession("user", {
          ...data.user,
          phone: signupPhone.trim(),
        });
        if (redirectPath && (redirectPath.startsWith("/donate") || redirectPath.startsWith("/causes"))) {
          router.push(redirectPath);
        } else {
          router.push("/profile");
        }
      } else {
        setError(data.error || "Failed to create account. Please try again.");
      }
    } catch (err) {
      setLoading(false);
      setError("Network error. Please try again.");
    }
  };

  // REAL GOOGLE SIGN IN (Positioned at bottom)
  const handleGoogleSignIn = async () => {
    setError("");
    setLoading(true);
    try {
      const redirectUrl = `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirectPath || "/profile")}`;
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) {
        setLoading(false);
        if (error.message?.includes("provider is not enabled")) {
          setError("Google Sign-In is not yet enabled in Supabase Dashboard. Go to Supabase -> Authentication -> Providers -> Google to enable it.");
        } else {
          setError(error.message || "Google Sign-in failed. Please try again.");
        }
      }
    } catch (err: any) {
      setLoading(false);
      setError(err?.message || "Google Sign-in failed. Please try again.");
    }
  };

  // Dedicated email handler (opens Gmail web compose on desktop, mailto on mobile)
  const handleEmailSupport = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const email = "kanhasarthifoundation223@gmail.com";
    const subject = encodeURIComponent("Support Inquiry - Kanha Sarthi Foundation");
    const isMobile = typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (isMobile) {
      window.location.href = `mailto:${email}?subject=${subject}`;
    } else {
      // Direct Gmail compose window in a new tab (always works without needing desktop email client configured)
      window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=${subject}`, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50/80 dark:bg-[#070b09] px-3 font-sans pt-18 pb-6 sm:pt-20 sm:pb-8 text-left">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-[390px] rounded-3xl bg-white dark:bg-[#101412] p-4 sm:p-5 shadow-xl border border-gray-150/70 dark:border-zinc-800 relative text-center my-auto"
      >
        {sessionExpiredNotice && (
          <div className="mb-2.5 p-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-lg text-[11px] font-bold text-amber-700 dark:text-amber-400">
            ⏰ Your session expired. Please sign in to continue.
          </div>
        )}

        {/* Top Heart Badge (Compact) */}
        <div className="w-11 h-11 rounded-full bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center mx-auto mb-1.5 border border-emerald-100/80 dark:border-emerald-800/40">
          <div className="w-8 h-8 rounded-full bg-[#1E4D2B] dark:bg-emerald-600 flex items-center justify-center shadow-xs">
            <svg className="w-4 h-4 fill-white drop-shadow-xs" viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </div>
        </div>

        {/* Heading & Subtitle */}
        <h1 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white tracking-tight">
          {mode === "signin" ? "Welcome Back!" : "Create Account"}
        </h1>
        <p className="text-[11px] text-gray-500 dark:text-zinc-400 mt-0.5 leading-tight">
          {mode === "signin"
            ? "Sign in with your username/email and password"
            : "Register to track your impact and donations"}
        </p>

        {/* Mode Switcher Tabs: Sign In | Sign Up (Compact) */}
        <div className="grid grid-cols-2 p-0.5 bg-gray-100 dark:bg-zinc-900 rounded-lg mt-2.5 border border-gray-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => {
              setMode("signin");
              setError("");
              setSuccessMsg("");
            }}
            className={`py-1.5 text-xs font-black rounded-md transition-all cursor-pointer ${
              mode === "signin"
                ? "bg-[#1E4D2B] text-white shadow-xs"
                : "text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setError("");
              setSuccessMsg("");
            }}
            className={`py-1.5 text-xs font-black rounded-md transition-all cursor-pointer ${
              mode === "signup"
                ? "bg-[#1E4D2B] text-white shadow-xs"
                : "text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Alert Messages */}
        {error && (
          <p className="mt-2.5 p-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 text-[11px] font-bold text-red-600 dark:text-red-400 text-left">
            {error}
          </p>
        )}
        {successMsg && (
          <p className="mt-2.5 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 text-left">
            {successMsg}
          </p>
        )}

        {/* ======================================================== */}
        {/* TAB 1: SIGN IN FORM (Username/Email & Password) */}
        {/* ======================================================== */}
        {mode === "signin" && (
          <form onSubmit={handleSignIn} className="space-y-2.5 mt-3 text-left">
            <div>
              <label className="block text-[10px] font-bold text-gray-600 dark:text-zinc-400 uppercase tracking-wider mb-0.5">
                Username or Email *
              </label>
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Username or email address"
                className="w-full px-3 py-2 rounded-lg border border-gray-250 dark:border-zinc-750 bg-white dark:bg-zinc-950 text-xs sm:text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1.5 focus:ring-[#1E4D2B] dark:focus:ring-emerald-500 placeholder-gray-400"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-600 dark:text-zinc-400 uppercase tracking-wider mb-0.5">
                Password *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full px-3 py-2 rounded-lg border border-gray-250 dark:border-zinc-750 bg-white dark:bg-zinc-950 text-xs sm:text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1.5 focus:ring-[#1E4D2B] dark:focus:ring-emerald-500 placeholder-gray-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-[11px] font-bold cursor-pointer"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-3 rounded-lg bg-[#1E4D2B] hover:bg-[#153e22] dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-bold text-xs shadow-sm active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2 mt-1"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>

            <div className="text-center pt-0.5 text-[11px]">
              <span className="text-gray-500 dark:text-zinc-400">Don't have an account? </span>
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setError("");
                }}
                className="font-bold text-[#1E4D2B] dark:text-emerald-400 hover:underline cursor-pointer"
              >
                Sign Up
              </button>
            </div>
          </form>
        )}

        {/* ======================================================== */}
        {/* TAB 2: SIGN UP FORM (Username, Email, Phone, Password) */}
        {/* ======================================================== */}
        {mode === "signup" && (
          <form onSubmit={handleSignUp} className="space-y-2 mt-2.5 text-left">
            <div>
              <label className="block text-[10px] font-bold text-gray-600 dark:text-zinc-400 uppercase tracking-wider mb-0.5">
                Full Name / Username *
              </label>
              <input
                type="text"
                required
                value={signupUsername}
                onChange={(e) => setSignupUsername(e.target.value)}
                placeholder="e.g. Vikram Singh"
                className="w-full px-3 py-1.5 sm:py-2 rounded-lg border border-gray-250 dark:border-zinc-750 bg-white dark:bg-zinc-950 text-xs sm:text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1.5 focus:ring-[#1E4D2B] dark:focus:ring-emerald-500 placeholder-gray-400"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-600 dark:text-zinc-400 uppercase tracking-wider mb-0.5">
                Email Address *
              </label>
              <input
                type="email"
                required
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full px-3 py-1.5 sm:py-2 rounded-lg border border-gray-250 dark:border-zinc-750 bg-white dark:bg-zinc-950 text-xs sm:text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1.5 focus:ring-[#1E4D2B] dark:focus:ring-emerald-500 placeholder-gray-400"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-600 dark:text-zinc-400 uppercase tracking-wider mb-0.5">
                Mobile Number *
              </label>
              <div className="flex rounded-lg border border-gray-250 dark:border-zinc-750 bg-white dark:bg-zinc-950 overflow-hidden focus-within:ring-1.5 focus-within:ring-[#1E4D2B] dark:focus-within:ring-emerald-500">
                <span className="flex items-center px-2.5 bg-gray-50 dark:bg-zinc-900 border-r border-gray-200 dark:border-zinc-800 text-[11px] font-bold text-gray-700 dark:text-zinc-300">
                  +91
                </span>
                <input
                  type="tel"
                  required
                  value={signupPhone}
                  onChange={(e) => setSignupPhone(e.target.value.replace(/\D/g, "").slice(0, 12))}
                  placeholder="10-digit mobile"
                  className="w-full px-2.5 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-900 dark:text-white bg-transparent focus:outline-none placeholder-gray-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-gray-600 dark:text-zinc-400 uppercase tracking-wider mb-0.5">
                  Password *
                </label>
                <input
                  type={showSignupPassword ? "text" : "password"}
                  required
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  placeholder="Min 6 chars"
                  className="w-full px-2.5 py-1.5 sm:py-2 rounded-lg border border-gray-250 dark:border-zinc-750 bg-white dark:bg-zinc-950 text-xs sm:text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1.5 focus:ring-[#1E4D2B] dark:focus:ring-emerald-500 placeholder-gray-400"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-600 dark:text-zinc-400 uppercase tracking-wider mb-0.5">
                  Confirm *
                </label>
                <input
                  type={showSignupPassword ? "text" : "password"}
                  required
                  value={signupConfirmPassword}
                  onChange={(e) => setSignupConfirmPassword(e.target.value)}
                  placeholder="Re-enter"
                  className="w-full px-2.5 py-1.5 sm:py-2 rounded-lg border border-gray-250 dark:border-zinc-750 bg-white dark:bg-zinc-950 text-xs sm:text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1.5 focus:ring-[#1E4D2B] dark:focus:ring-emerald-500 placeholder-gray-400"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-3 rounded-lg bg-[#1E4D2B] hover:bg-[#153e22] dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-bold text-xs shadow-sm active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2 mt-1"
            >
              {loading ? "Creating Account..." : "Create Account"}
            </button>

            <div className="text-center pt-0.5 text-[11px]">
              <span className="text-gray-500 dark:text-zinc-400">Already registered? </span>
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setError("");
                }}
                className="font-bold text-[#1E4D2B] dark:text-emerald-400 hover:underline cursor-pointer"
              >
                Sign In
              </button>
            </div>
          </form>
        )}

        {/* ======================================================== */}
        {/* BOTTOM SECTION: OR Divider & Sign In with Google */}
        {/* ======================================================== */}
        <div className="relative my-3 flex items-center justify-center">
          <div className="border-t border-gray-200 dark:border-zinc-800 w-full" />
          <span className="bg-white dark:bg-[#101412] px-2.5 text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest absolute">
            OR
          </span>
        </div>

        {/* Sign in with Google (Compact, Positioned at Bottom) */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full py-2 px-3 border border-gray-250 dark:border-zinc-750 rounded-lg bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-850 flex items-center justify-center gap-2.5 text-xs font-bold text-gray-800 dark:text-gray-200 shadow-2xs transition-all active:scale-[0.99] cursor-pointer"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
          </svg>
          <span>Sign in with Google</span>
        </button>

        {/* Need Help? Section (Compact) */}
        <div className="mt-3.5 pt-2.5 border-t border-gray-150 dark:border-zinc-800">
          <p className="text-[10px] font-bold text-gray-600 dark:text-zinc-400 mb-1.5">
            Need Help?
          </p>

          <div className="flex items-center justify-center gap-5 text-[11px] font-semibold">
            {/* WhatsApp */}
            <a
              href="https://wa.me/9182587765159"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[#1E4D2B] dark:text-emerald-400 hover:underline transition-all"
            >
              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-5.46-4.45-9.92-9.91-9.92z"
                  fill="#25D366"
                />
                <path
                  d="M17.5 14.3c-.25-.13-1.48-.73-1.71-.81-.23-.09-.4-.13-.57.13-.17.25-.66.81-.81.98-.15.16-.3.19-.55.06-.25-.13-1.06-.39-2.02-1.24-.75-.66-1.25-1.48-1.4-1.73-.15-.25-.02-.38.11-.51.11-.11.25-.29.38-.44.13-.14.17-.25.25-.41.08-.17.04-.31-.02-.44-.06-.13-.57-1.37-.78-1.87-.21-.49-.42-.42-.58-.43h-.49c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1s.9 2.44 1.03 2.61c.13.17 1.76 2.69 4.27 3.77.6.26 1.07.41 1.43.53.6.19 1.15.16 1.58.1.48-.07 1.48-.6 1.69-1.18.21-.58.21-1.07.15-1.18-.06-.11-.23-.17-.48-.3z"
                  fill="#FFFFFF"
                />
              </svg>
              <span>WhatsApp</span>
            </a>

            {/* Email */}
            <a
              href="https://mail.google.com/mail/?view=cm&fs=1&to=kanhasarthifoundation223@gmail.com&su=Kanha%20Sarthi%20Foundation%20Support"
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleEmailSupport}
              className="flex items-center gap-1 text-[#1E4D2B] dark:text-emerald-400 hover:underline transition-all cursor-pointer"
              title="Send email to kanhasarthifoundation223@gmail.com"
            >
              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="#EA4335">
                <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
              </svg>
              <span>Email</span>
            </a>

            {/* Call */}
            <a
              href="tel:+9182587765159"
              className="flex items-center gap-1 text-[#1E4D2B] dark:text-emerald-400 hover:underline transition-all"
            >
              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="#16a34a">
                <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.44-5.15-3.75-6.59-6.59l1.97-1.57c.27-.27.36-.66.25-1.01A11.36 11.36 0 018.57 4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.62c0-.55-.45-1-.99-1z" />
              </svg>
              <span>Call</span>
            </a>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
