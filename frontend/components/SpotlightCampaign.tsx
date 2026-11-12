"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

interface CampaignData {
  id: number | string;
  enabled?: boolean;
  badge: string;
  title: string;
  tagline: string;
  image: string;
  target_amount: number;
  raised_amount: number;
  donors_count: number;
  donate_url: string;
  days_left?: number;
}

export default function SpotlightCampaign() {
  const [campaigns, setCampaigns] = useState<CampaignData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    fetch("/api/spotlight-campaign", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : (data && typeof data === 'object' ? [data] : []);
        const activeList = list.filter((c: CampaignData) => c.enabled !== false);
        setCampaigns(activeList);
      })
      .catch(() => setCampaigns([]))
      .finally(() => setLoading(false));
  }, []);

  // Auto-advance slider if multiple campaigns exist and user is not hovering
  useEffect(() => {
    if (campaigns.length <= 1 || isPaused) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % campaigns.length);
    }, 7000);

    return () => clearInterval(timer);
  }, [campaigns.length, isPaused]);

  if (loading || campaigns.length === 0) {
    return null;
  }

  const current = campaigns[currentIndex] || campaigns[0];
  const target = Number(current.target_amount) || 1;
  const raised = Number(current.raised_amount) || 0;
  const percent = Math.min(Math.round((raised / target) * 100), 100);

  const formatINR = (val: number) => {
    return "₹" + Number(val || 0).toLocaleString("en-IN");
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + campaigns.length) % campaigns.length);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % campaigns.length);
  };

  // Resolve target cause page redirect (e.g. /causes/6 for study kit, /causes/1 for food, /causes/3 for menstrual kit)
  const getRedirectUrl = (camp: CampaignData) => {
    if (camp.donate_url && camp.donate_url.trim() !== "" && camp.donate_url !== "/donate" && camp.donate_url !== "/causes") {
      return camp.donate_url;
    }

    const text = `${camp.title} ${camp.badge} ${camp.tagline}`.toLowerCase();
    if (text.includes("study") || text.includes("shiksha") || text.includes("book") || text.includes("education")) {
      return "/causes/6"; // Study Kit Cause Page
    }
    if (text.includes("menstrual") || text.includes("hygiene") || text.includes("girl") || text.includes("swabhiman") || text.includes("pad")) {
      return "/causes/3"; // Menstrual Hygiene Kit Cause Page
    }
    if (text.includes("food") || text.includes("meal") || text.includes("annapurna") || text.includes("ration") || text.includes("packet")) {
      return "/causes/1"; // Food Packet Cause Page
    }
    if (text.includes("thali")) {
      return "/causes/2"; // Wholesome Thali Cause Page
    }
    if (text.includes("birthday") || text.includes("cake")) {
      return "/causes/4"; // Birthday Cause Page
    }
    if (text.includes("tree") || text.includes("plant")) {
      return "/causes/7"; // Plantation Cause Page
    }
    if (text.includes("cow") || text.includes("dog") || text.includes("animal")) {
      return "/causes/8"; // Animal Welfare Cause Page
    }

    return camp.donate_url || "/causes";
  };

  return (
    <section 
      className="relative mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8 md:px-8 overflow-hidden font-sans"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="relative w-full rounded-2xl sm:rounded-3xl lg:rounded-[2.5rem] bg-gradient-to-br from-[#0c2a13] via-[#103E1C] to-[#07180b] border border-emerald-500/20 overflow-hidden shadow-2xl">
        {/* Subtle decorative glow circles */}
        <div className="absolute top-0 right-0 w-64 sm:w-80 h-64 sm:h-80 bg-emerald-500/10 rounded-full blur-[80px] sm:blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 sm:w-80 h-64 sm:h-80 bg-amber-500/10 rounded-full blur-[80px] sm:blur-[100px] pointer-events-none" />

        <AnimatePresence mode="wait">
          <motion.div
            key={current.id || currentIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.35 }}
            drag={campaigns.length > 1 ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => {
              if (info.offset.x < -40) handleNext();
              else if (info.offset.x > 40) handlePrev();
            }}
            className="px-4 py-6 sm:px-8 sm:py-10 md:py-14 md:px-12 flex flex-col lg:flex-row gap-6 sm:gap-8 lg:gap-12 items-center"
          >
            {/* Left Side: Campaign Photo Frame (Adapts to uploaded poster size so the entire poster is visible) */}
            <div className="w-full lg:w-5/12 flex justify-center relative z-10">
              <div className="relative w-full max-w-sm sm:max-w-md rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl border-2 border-emerald-600/40 bg-black/60 p-2 sm:p-2.5 flex items-center justify-center min-h-[220px] sm:min-h-[280px] group">
                <img
                  src={current.image || "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&auto=format&fit=crop&q=80"}
                  alt={current.title}
                  className="w-auto h-auto max-w-full max-h-[280px] sm:max-h-[340px] lg:max-h-[380px] object-contain rounded-xl sm:rounded-2xl transition-transform duration-500 group-hover:scale-[1.02] shadow-md"
                />
                {/* Urgent / Spotlight Badge on Image */}
                <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-10 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full bg-black/80 backdrop-blur-md border border-amber-500/50 text-amber-300 text-[10px] sm:text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-lg">
                  <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-amber-400 animate-ping" />
                  <span>{current.badge || "Live Campaign"}</span>
                </div>
              </div>
            </div>

            {/* Right Side: Fundraising Details & Progress Bar */}
            <div className="w-full lg:w-7/12 flex flex-col text-left relative z-10 text-white">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2 sm:mb-3">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-emerald-950/70 border border-emerald-500/30 text-emerald-300 text-[10px] sm:text-[11px] font-black uppercase tracking-wider w-fit">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Special Fundraising Drive
                </div>

                {campaigns.length > 1 && (
                  <span className="text-[10px] sm:text-[11px] font-bold text-amber-400 bg-black/40 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full border border-white/10">
                    {currentIndex + 1} / {campaigns.length}
                  </span>
                )}
              </div>

              <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black tracking-tight text-white leading-tight">
                {current.title}
              </h2>

              <p className="mt-2 text-xs sm:text-sm md:text-base text-emerald-100/80 leading-relaxed font-normal">
                {current.tagline}
              </p>

              {/* Fundraising Stats Grid */}
              <div className="mt-4 sm:mt-6 bg-black/30 backdrop-blur-md border border-white/10 rounded-xl sm:rounded-2xl p-3.5 sm:p-5">
                <div className="flex items-baseline justify-between gap-2 mb-2.5 sm:mb-3">
                  <div>
                    <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-emerald-400 block">Raised So Far</span>
                    <span className="text-xl sm:text-2xl md:text-3xl font-black text-[#F3A61E]">
                      {formatINR(raised)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-zinc-400 block">Target Goal</span>
                    <span className="text-lg sm:text-xl md:text-2xl font-black text-white">
                      {formatINR(target)}
                    </span>
                  </div>
                </div>

                {/* Animated Progress Bar */}
                <div className="relative w-full h-2.5 sm:h-3.5 bg-zinc-900 rounded-full overflow-hidden border border-white/10">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percent}%` }}
                    transition={{ duration: 1.0, ease: "easeOut" }}
                    className="h-full bg-gradient-to-r from-amber-500 via-[#F3A61E] to-emerald-400 rounded-full shadow-[0_0_12px_rgba(243,166,30,0.5)]"
                  />
                </div>

                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-1.5 text-[11px] sm:text-xs font-bold text-zinc-300">
                  <span className="text-emerald-400 font-black">{percent}% Completed</span>
                  {current.donors_count ? (
                    <span className="text-zinc-400">❤️ {current.donors_count}+ Donors</span>
                  ) : null}
                  {current.days_left ? (
                    <span className="text-amber-400">⏳ {current.days_left} Days Left</span>
                  ) : null}
                </div>
              </div>

              {/* CTA Button Row + Navigation Controls */}
              <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 flex-1">
                  <Link
                    href={getRedirectUrl(current)}
                    className="w-full sm:w-auto px-5 sm:px-7 py-2.5 sm:py-3.5 bg-[#F3A61E] hover:bg-[#d68f12] active:bg-[#bf7e0c] text-black text-xs sm:text-sm font-black uppercase tracking-wider rounded-xl sm:rounded-full shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer text-center"
                  >
                    <span>Support This Cause</span>
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </Link>

                  <Link
                    href="/causes"
                    className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3.5 border border-white/20 hover:border-white/50 active:bg-white/10 text-white text-[11px] sm:text-xs font-bold uppercase tracking-wider rounded-xl sm:rounded-full transition-colors cursor-pointer text-center"
                  >
                    Explore All Causes
                  </Link>
                </div>

                {/* Multiple Campaign Carousel Arrows */}
                {campaigns.length > 1 && (
                  <div className="flex items-center justify-center sm:justify-end gap-2 pt-1 sm:pt-0">
                    <button
                      type="button"
                      onClick={handlePrev}
                      className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-black/40 hover:bg-black/80 border border-white/20 hover:border-[#F3A61E] text-white flex items-center justify-center transition-all cursor-pointer shadow-md active:scale-95"
                      title="Previous Campaign"
                      aria-label="Previous Campaign"
                    >
                      <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={handleNext}
                      className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-black/40 hover:bg-black/80 border border-white/20 hover:border-[#F3A61E] text-white flex items-center justify-center transition-all cursor-pointer shadow-md active:scale-95"
                      title="Next Campaign"
                      aria-label="Next Campaign"
                    >
                      <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Bottom Dot Indicators for multiple campaigns */}
        {campaigns.length > 1 && (
          <div className="flex justify-center items-center gap-1.5 sm:gap-2 pb-3 sm:pb-4 relative z-20">
            {campaigns.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                className={`transition-all rounded-full cursor-pointer ${
                  currentIndex === idx
                    ? "w-6 sm:w-8 h-1.5 sm:h-2 bg-[#F3A61E] shadow-[0_0_8px_rgba(243,166,30,0.6)]"
                    : "w-1.5 sm:w-2 h-1.5 sm:h-2 bg-white/30 hover:bg-white/60"
                }`}
                aria-label={`Jump to campaign ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
