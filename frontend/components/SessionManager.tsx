"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isSessionExpired, touchSession, clearAllSessions } from "@/lib/session";
import { motion, AnimatePresence } from "framer-motion";

export default function SessionManager() {
  const router = useRouter();
  const pathname = usePathname();
  const [showExpiredToast, setShowExpiredToast] = useState(false);

  useEffect(() => {
    // 1. Throttle user activity events to keep the session alive while actively using the site
    const handleActivity = () => {
      touchSession();
    };

    window.addEventListener("mousedown", handleActivity, { passive: true });
    window.addEventListener("keydown", handleActivity, { passive: true });
    window.addEventListener("scroll", handleActivity, { passive: true });
    window.addEventListener("touchstart", handleActivity, { passive: true });

    // 2. Periodic check for session expiration (every 15 seconds)
    const checkExpiration = () => {
      if (isSessionExpired()) {
        setShowExpiredToast(true);
        setTimeout(() => setShowExpiredToast(false), 5000);

        // If on a protected route, redirect to signin with expired flag
        const isProtected = 
          pathname?.startsWith("/admin") || 
          pathname?.startsWith("/profile") || 
          pathname?.startsWith("/volunteer/profile");

        if (isProtected) {
          router.push("/signin?expired=1");
        }
      }
    };

    // Run check on mount and on tab focus
    checkExpiration();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        checkExpiration();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    const interval = setInterval(checkExpiration, 15000);

    const handleExpiredEvent = () => {
      setShowExpiredToast(true);
      setTimeout(() => setShowExpiredToast(false), 5000);
    };
    window.addEventListener("session_expired", handleExpiredEvent);

    return () => {
      window.removeEventListener("mousedown", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("scroll", handleActivity);
      window.removeEventListener("touchstart", handleActivity);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("session_expired", handleExpiredEvent);
      clearInterval(interval);
    };
  }, [pathname, router]);

  return (
    <AnimatePresence>
      {showExpiredToast && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          className="fixed top-6 left-1/2 -translate-x-1/2 z-[10000] bg-amber-950/95 border border-amber-600/50 text-amber-200 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-md text-xs font-bold"
        >
          <svg className="h-5 w-5 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>Your session has expired due to inactivity. Please sign in again.</span>
          <button
            onClick={() => setShowExpiredToast(false)}
            className="ml-2 text-amber-400 hover:text-white p-1 rounded-full cursor-pointer transition-colors"
          >
            ✕
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
