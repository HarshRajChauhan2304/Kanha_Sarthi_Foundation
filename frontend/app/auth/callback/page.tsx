"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { createSession } from "@/lib/session";

export default function AuthCallback() {
  const router = useRouter();
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const handleAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          setErrorMsg(error.message || "Failed to retrieve Google authentication session.");
          return;
        }

        if (session && session.user) {
          const googleUser = session.user;
          const userEmail = googleUser.email || "";
          const fullName = googleUser.user_metadata?.full_name || googleUser.user_metadata?.name || userEmail.split('@')[0];
          const avatarUrl = googleUser.user_metadata?.avatar_url || googleUser.user_metadata?.picture || "";

          // Sync with local backend
          const res = await fetch("/api/user/auth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "google_sync",
              email: userEmail,
              username: fullName,
              avatar: avatarUrl
            })
          });

          const data = await res.json();
          const savedUser = (data && data.success && data.user) ? data.user : {
            username: fullName,
            email: userEmail,
            avatar: avatarUrl,
            role: "Donor & Supporter"
          };

          createSession("user", savedUser);

          // Check redirect param in URL
          const params = new URLSearchParams(window.location.search);
          const redirect = params.get("redirect") || "/profile";
          router.push(redirect);
        } else {
          setErrorMsg("No active session found. Please try signing in again.");
        }
      } catch (err: any) {
        setErrorMsg(err?.message || "An unexpected error occurred during Google sign-in.");
      }
    };

    handleAuth();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-[#070b09] px-4 font-sans">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#101412] p-8 shadow-xl border border-gray-150 dark:border-zinc-800 text-center">
        {!errorMsg ? (
          <div className="space-y-4">
            <div className="w-12 h-12 border-4 border-[#1E4D2B] border-t-transparent rounded-full animate-spin mx-auto" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Authenticating with Google...</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Verifying your account details. Please wait.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto text-xl font-black">✕</div>
            <h2 className="text-lg font-bold text-red-600 dark:text-red-400">Sign-in Failed</h2>
            <p className="text-xs text-gray-600 dark:text-gray-300">{errorMsg}</p>
            <button
              onClick={() => router.push("/signin")}
              className="mt-4 px-6 py-2.5 rounded-xl bg-[#1E4D2B] text-white font-bold text-xs hover:bg-[#163b21] transition-all cursor-pointer"
            >
              Back to Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
