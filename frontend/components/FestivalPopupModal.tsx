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

        {/* Modal Dialog Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: 30 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto bg-gradient-to-br from-zinc-950 via-zinc-900 to-[#0e2a14] border border-amber-500/40 rounded-[2.5rem] shadow-[0_0_50px_rgba(243,166,30,0.25)] text-center text-white p-6 sm:p-8 z-10"
        >
          {/* Close cross button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 z-20 p-2.5 text-zinc-300 hover:text-white bg-black/60 hover:bg-black/90 border border-white/10 rounded-full transition-all cursor-pointer shadow-lg hover:scale-110 active:scale-95"
            aria-label="Close Announcement"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Decorative Top Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-black uppercase tracking-wider mb-4 animate-pulse">
            <span>{config.badge || "🎉 Special Festival Drive"}</span>
          </div>

          {/* Poster / Banner Image */}
          {config.image && (
            <div className="relative w-full aspect-[16/10] sm:aspect-[16/9] rounded-2xl overflow-hidden mb-6 border border-amber-500/30 shadow-2xl group">
              <img
                src={config.image}
                alt={config.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
            </div>
          )}

          {/* Title */}
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight mb-3">
            {config.title}
          </h2>

          {/* Message Subtitle */}
          <p className="text-sm sm:text-base text-zinc-300 leading-relaxed font-normal mb-8 max-w-md mx-auto">
            {config.subtitle}
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <button
              onClick={handleDonate}
              className="w-full sm:w-auto px-8 py-4 bg-[#F3A61E] hover:bg-[#d68f12] text-black text-sm font-black uppercase tracking-wider rounded-2xl shadow-xl shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{config.donate_text || "Donate Now"}</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>

            <button
              onClick={handleClose}
              className="w-full sm:w-auto px-6 py-4 bg-zinc-800/80 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-bold uppercase tracking-wider rounded-2xl transition-colors cursor-pointer"
            >
              Continue to Website
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

