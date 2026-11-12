"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";

interface PopupConfig {
  enabled: boolean;
  badge: string;
  title: string;
  subtitle: string;
  image: string;
  donate_text: string;
  donate_url: string;
}

export default function FestivalPopupModal() {
  const router = useRouter();
  const pathname = usePathname();
  const [config, setConfig] = useState<PopupConfig | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Don't show popup inside the admin dashboard to avoid interrupting management work
    if (pathname?.startsWith("/admin")) {
      return;
    }

    // Check if user already dismissed it during this session
    const isDismissed = sessionStorage.getItem("dismissed_festival_popup");
    if (isDismissed === "true") {
      return;
    }

    fetch("/api/festival-popup", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data && data.enabled) {
          setConfig(data);
          // Slight delay for smooth entrance after page load
          const timer = setTimeout(() => {
            setIsOpen(true);
          }, 1200);
          return () => clearTimeout(timer);
        }
      })
      .catch((err) => console.error("Error loading festival popup:", err));
  }, [pathname]);

  const handleClose = () => {
    setIsOpen(false);
    sessionStorage.setItem("dismissed_festival_popup", "true");
  };

  const handleDonate = () => {
    handleClose();
    const destination = (!config?.donate_url || config.donate_url === "/causes")
      ? `/donate?title=${encodeURIComponent(config?.title || "Special Festival Appeal")}&category=${encodeURIComponent(config?.badge || "Festival Relief")}&amount=1000`
      : config.donate_url;
    router.push(destination);
  };

  if (!isOpen || !config || !config.enabled) {
    return null;
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        {/* Animated backdrop click to close */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="absolute inset-0 cursor-pointer"
        />

        {/* Modal Dialog Card (Compact, 3:4 Image & Mobile Portable) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-sm sm:max-w-md max-h-[92vh] overflow-y-auto bg-gradient-to-br from-zinc-950 via-zinc-900 to-[#0e2a14] border border-amber-500/40 rounded-3xl shadow-[0_0_40px_rgba(243,166,30,0.25)] text-center text-white p-4 sm:p-6 z-10"
        >
          {/* Close cross button */}
          <button
            onClick={handleClose}
            className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 p-2 text-zinc-300 hover:text-white bg-black/70 hover:bg-black/90 border border-white/15 rounded-full transition-all cursor-pointer shadow-lg hover:scale-110 active:scale-95"
            aria-label="Close Announcement"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Decorative Top Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] sm:text-xs font-black uppercase tracking-wider mb-2.5">
            <span>{config.badge || "🎉 Special Festival Drive"}</span>
          </div>

          {/* Poster / Banner Image Frame (Adapts naturally to the uploaded poster size so the entire poster is visible) */}
          {config.image && (
            <div className="relative mx-auto w-full max-w-sm rounded-xl sm:rounded-2xl overflow-hidden mb-3 sm:mb-4 border border-amber-500/30 shadow-xl bg-black/50 p-1 sm:p-1.5 flex items-center justify-center group">
              <img
                src={config.image}
                alt={config.title}
                className="w-auto h-auto max-w-full max-h-[260px] sm:max-h-[320px] object-contain rounded-lg sm:rounded-xl shadow-md transition-transform duration-500 group-hover:scale-[1.02]"
              />
            </div>
          )}

          {/* Title (Sleek & Compact) */}
          <h2 className="text-base sm:text-xl font-black text-white tracking-tight leading-snug mb-1 sm:mb-1.5 px-2">
            {config.title}
          </h2>

          {/* Message Subtitle */}
          <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed font-normal mb-3.5 sm:mb-4 max-w-xs sm:max-w-sm mx-auto px-1">
            {config.subtitle}
          </p>

          {/* Action Buttons (Compact Single-Row on Mobile & Desktop) */}
          <div className="flex gap-2 sm:gap-2.5 justify-center items-center pt-1">
            <button
              onClick={handleDonate}
              className="flex-1 py-2.5 sm:py-3 px-3.5 sm:px-4 bg-[#F3A61E] hover:bg-[#d68f12] active:bg-[#bf7e0c] text-black text-xs sm:text-sm font-black uppercase tracking-wider rounded-xl shadow-lg shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span className="truncate">{config.donate_text || "Donate Now"}</span>
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>

            <button
              onClick={handleClose}
              className="py-2.5 sm:py-3 px-3 sm:px-4 bg-zinc-800/90 hover:bg-zinc-800 active:bg-zinc-700 text-zinc-300 hover:text-white text-[11px] sm:text-xs font-bold uppercase tracking-wider rounded-xl transition-colors cursor-pointer shrink-0"
            >
              Continue
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

