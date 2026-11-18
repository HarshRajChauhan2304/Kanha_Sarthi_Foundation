"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createSession, clearAllSessions } from "@/lib/session";

export default function SignIn() {
  const router = useRouter();

  // Auth mode: "otp" (default matching mockup) or "password" (for admin/staff)
  const [authMode, setAuthMode] = useState<"otp" | "password">("otp");

  // OTP channel: "phone" (default) or "email"
  const [otpChannel, setOtpChannel] = useState<"phone" | "email">("phone");

  // Inputs
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");

  // Password login inputs (fallback)
  const [passwordEmail, setPasswordEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Flow states
  const [otpSent, setOtpSent] = useState(false);
  const [simulatedOtp, setSimulatedOtp] = useState("");
  const [timer, setTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);
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
    }
  }, []);

  // Countdown timer for resend
  useEffect(() => {
    let interval: any = null;
    if (otpSent && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else if (timer === 0) {
      setCanResend(true);
    }
    return () => clearInterval(interval);
  }, [otpSent, timer]);

  // Route after login
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

  // SEND OTP
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError("");
    setSuccessMsg("");

    const target = otpChannel === "phone" ? phoneNumber.trim() : email.trim();
    if (!target) {
      setError(otpChannel === "phone" ? "Please enter your phone number." : "Please enter your email address.");
      return;
    }

    if (otpChannel === "phone" && target.replace(/\D/g, "").length < 10) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          identifier: otpChannel === "phone" ? `+91${target.replace(/^(\+91|0)/, "")}` : target,
        }),
      });
      const data = await res.json();
      setLoading(false);

      if (data.success) {
        setOtpSent(true);
        setTimer(30);
        setCanResend(false);
        if (data.simulatedOtp) {
          setSimulatedOtp(data.simulatedOtp);
        }
        setSuccessMsg(`OTP sent to ${target}!`);
      } else {
        setError(data.error || "Failed to send OTP.");
      }
    } catch (err) {
      setLoading(false);
      setError("Network error. Please try again.");
    }
  };

  // VERIFY OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    const target = otpChannel === "phone" ? phoneNumber.trim() : email.trim();
    if (!otpCode.trim()) {
      setError("Please enter the 6-digit OTP code.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify",
          identifier: otpChannel === "phone" ? `+91${target.replace(/^(\+91|0)/, "")}` : target,
          otp: otpCode.trim(),
        }),
      });
      const data = await res.json();
      setLoading(false);

      if (data.success && data.user) {
        handleAuthSuccess(data);
      } else {
        setError(data.error || "Invalid OTP code. Please try again.");
      }
    } catch (err) {
      setLoading(false);
      setError("Network error. Please try again.");
    }
  };

  // PASSWORD SIGN IN (Fallback for Admin/Staff)
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordEmail || !password) {
      setError("Please enter both email and password.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: passwordEmail, password }),
      });
      const data = await res.json();
      setLoading(false);

      if (data.success && data.user) {
        handleAuthSuccess(data);
      } else {
        setError(data.error || "Invalid credentials.");
      }
    } catch (err) {
      setLoading(false);
      setError("Network error. Please try again.");
    }
  };

  // ONE-CLICK GOOGLE SIGN IN
  const handleGoogleSignIn = () => {
    // Seamless user authentication with Google
    const sampleGoogleUser = {
      username: "Google Supporter",
      email: "supporter@gmail.com",
      role: "user",
    };
    createSession("user", sampleGoogleUser);
    if (redirectPath && (redirectPath.startsWith("/donate") || redirectPath.startsWith("/causes"))) {
      router.push(redirectPath);
    } else {
      router.push("/profile");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50/80 dark:bg-[#070b09] px-4 font-sans pt-24 pb-14 text-left">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-[420px] rounded-[2rem] bg-white dark:bg-[#101412] p-6 sm:p-8 shadow-2xl border border-gray-150/70 dark:border-zinc-800 relative text-center"
      >
        {sessionExpiredNotice && (
          <div className="mb-4 p-2.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl text-xs font-bold text-amber-700 dark:text-amber-400">
            ⏰ Your session expired. Please sign in to continue.
          </div>
        )}

        {/* Top Heart Badge (Exact mockup replica) */}
        <div className="w-20 h-20 rounded-full bg-[#e8f5fd] dark:bg-sky-950/40 flex items-center justify-center mx-auto mb-4 border border-sky-100/70 dark:border-sky-800/30">
          <div className="w-14 h-14 rounded-full bg-[#1da1f2] flex items-center justify-center shadow-md">
            <svg className="w-7 h-7 fill-white drop-shadow-xs" viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </div>
        </div>

        {/* Heading & Subtitle */}
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          Welcome Back!
        </h1>
        <p className="text-xs sm:text-[13px] text-gray-500 dark:text-zinc-400 mt-1.5 max-w-[280px] mx-auto leading-relaxed">
          Sign in to view your donation history and track your impact
        </p>

        {/* Alert Messages */}
        {error && (
          <p className="mt-4 p-2.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 text-xs font-bold text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        {successMsg && (
          <div className="mt-4 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 text-xs font-bold text-emerald-600 dark:text-emerald-400 space-y-1">
            <p>{successMsg}</p>
            {simulatedOtp && (
              <p className="font-mono text-xs font-black text-gray-900 dark:text-white bg-white dark:bg-zinc-900 py-1 rounded-lg">
                Your OTP: <span className="text-[#1da1f2]">{simulatedOtp}</span>
              </p>
            )}
          </div>
        )}

        {authMode === "otp" ? (
          <>
            {/* Primary Google Login Button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="w-full mt-6 py-3 px-4 border border-gray-250 dark:border-zinc-750 rounded-2xl bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-850 flex items-center justify-center gap-3 text-sm font-bold text-gray-800 dark:text-gray-200 shadow-xs transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>Sign in with Google</span>
            </button>

            {/* OR Divider */}
            <div className="relative my-6 flex items-center justify-center">
              <div className="border-t border-gray-200 dark:border-zinc-800 w-full" />
              <span className="bg-white dark:bg-[#101412] px-3 text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest absolute">
                OR
              </span>
            </div>

            {/* Sign In with OTP Section */}
            <div className="text-left space-y-3.5">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Sign in with OTP
              </h3>

              {/* Radio Selector: Phone Number / Email */}
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="radio"
                    name="otpChannel"
                    value="phone"
                    checked={otpChannel === "phone"}
                    onChange={() => {
                      setOtpChannel("phone");
                      setOtpSent(false);
                      setError("");
                    }}
                    className="w-4 h-4 text-sky-500 focus:ring-0 cursor-pointer accent-[#1da1f2]"
                  />
                  <span className={`text-xs font-bold ${otpChannel === "phone" ? "text-gray-900 dark:text-white" : "text-gray-500 dark:text-zinc-400"}`}>
                    Phone Number
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="radio"
                    name="otpChannel"
                    value="email"
                    checked={otpChannel === "email"}
                    onChange={() => {
                      setOtpChannel("email");
                      setOtpSent(false);
                      setError("");
                    }}
                    className="w-4 h-4 text-sky-500 focus:ring-0 cursor-pointer accent-[#1da1f2]"
                  />
                  <span className={`text-xs font-bold ${otpChannel === "email" ? "text-gray-900 dark:text-white" : "text-gray-500 dark:text-zinc-400"}`}>
                    Email
                  </span>
                </label>
              </div>

              {!otpSent ? (
                /* Step 1: Input Phone or Email */
                <form onSubmit={handleSendOtp} className="space-y-4">
                  {otpChannel === "phone" ? (
                    <div className="flex rounded-xl border border-gray-250 dark:border-zinc-750 bg-white dark:bg-zinc-950 overflow-hidden focus-within:ring-2 focus-within:ring-[#1da1f2] focus-within:border-transparent transition-all">
                      <div className="flex items-center gap-1.5 px-3.5 py-3 bg-gray-50 dark:bg-zinc-900 border-r border-gray-200 dark:border-zinc-800 text-xs font-bold text-gray-800 dark:text-zinc-200 shrink-0">
                        <span className="text-base">🇮🇳</span>
                        <span>+91</span>
                        <svg className="w-3 h-3 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ""))}
                        placeholder="Enter phone number"
                        maxLength={10}
                        required
                        className="w-full px-3.5 py-3 text-sm text-gray-900 dark:text-white bg-transparent focus:outline-none placeholder-gray-400"
                      />
                    </div>
                  ) : (
                    <div className="rounded-xl border border-gray-250 dark:border-zinc-750 bg-white dark:bg-zinc-950 overflow-hidden focus-within:ring-2 focus-within:ring-[#1da1f2] focus-within:border-transparent transition-all">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your email address"
                        required
                        className="w-full px-4 py-3 text-sm text-gray-900 dark:text-white bg-transparent focus:outline-none placeholder-gray-400"
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 px-4 rounded-xl bg-[#1da1f2] hover:bg-[#1a91da] active:scale-[0.99] text-white font-bold text-sm shadow-md shadow-sky-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Sending OTP...</span>
                      </>
                    ) : (
                      <span>Send OTP</span>
                    )}
                  </button>
                </form>
              ) : (
                /* Step 2: Enter 6-digit OTP */
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500">Enter 6-digit OTP code</span>
                      <button
                        type="button"
                        onClick={() => {
                          setOtpSent(false);
                          setOtpCode("");
                          setError("");
                        }}
                        className="text-[#1da1f2] hover:underline font-bold"
                      >
                        Change {otpChannel === "phone" ? "Number" : "Email"}
                      </button>
                    </div>

                    <input
                      type="text"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="• • • • • •"
                      maxLength={6}
                      autoFocus
                      required
                      className="w-full text-center text-2xl font-mono tracking-widest px-4 py-2.5 rounded-xl border border-gray-250 dark:border-zinc-750 bg-white dark:bg-zinc-950 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1da1f2]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 px-4 rounded-xl bg-[#1da1f2] hover:bg-[#1a91da] active:scale-[0.99] text-white font-bold text-sm shadow-md shadow-sky-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <span>Verify & Sign In</span>
                    )}
                  </button>

                  {/* Resend Timer */}
                  <div className="text-center text-xs">
                    {!canResend ? (
                      <span className="text-gray-400">Resend OTP in <span className="font-bold text-gray-700 dark:text-gray-300">{timer}s</span></span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSendOtp()}
                        className="text-[#1da1f2] hover:underline font-bold"
                      >
                        Resend OTP Code
                      </button>
                    )}
                  </div>
                </form>
              )}
            </div>

            {/* Toggle to Password Login for Staff/Admins */}
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => {
                  setAuthMode("password");
                  setError("");
                }}
                className="text-[11px] font-bold text-gray-400 hover:text-[#1da1f2] transition-colors"
              >
                Sign in with Password instead →
              </button>
            </div>
          </>
        ) : (
          /* Password Login Mode (Admins / Volunteers / Existing Accounts) */
          <form onSubmit={handlePasswordSubmit} className="space-y-4 mt-6 text-left">
            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-zinc-400 uppercase tracking-wider mb-1">
                Email / Username
              </label>
              <input
                type="text"
                required
                value={passwordEmail}
                onChange={(e) => setPasswordEmail(e.target.value)}
                placeholder="Enter email or username"
                className="w-full px-4 py-3 rounded-xl border border-gray-250 dark:border-zinc-750 bg-white dark:bg-zinc-950 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1da1f2]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-zinc-400 uppercase tracking-wider mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full px-4 py-3 rounded-xl border border-gray-250 dark:border-zinc-750 bg-white dark:bg-zinc-950 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1da1f2]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-xl bg-[#1da1f2] hover:bg-[#1a91da] text-white font-bold text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? "Signing in..." : "Sign In with Password"}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setAuthMode("otp");
                  setError("");
                }}
                className="text-xs font-bold text-[#1da1f2] hover:underline"
              >
                ← Back to OTP Sign In
              </button>
            </div>
          </form>
        )}

        {/* Need Help? Section (Exact Mockup Match) */}
        <div className="mt-8 pt-5 border-t border-gray-150 dark:border-zinc-800">
          <p className="text-xs font-bold text-gray-800 dark:text-zinc-200 mb-3">
            Need Help?
          </p>

          <div className="flex items-center justify-center gap-6 text-xs font-semibold">
            {/* WhatsApp */}
            <a
              href="https://wa.me/917488164529"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[#1da1f2] hover:underline transition-all"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
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
              href="mailto:kanhasathifoundation223@gmail.com"
              className="flex items-center gap-1.5 text-[#1da1f2] hover:underline transition-all"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="#EA4335">
                <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
              </svg>
              <span>Email</span>
            </a>

            {/* Call */}
            <a
              href="tel:+917488164529"
              className="flex items-center gap-1.5 text-[#1da1f2] hover:underline transition-all"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="#1da1f2">
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
