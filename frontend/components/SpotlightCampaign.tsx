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

  return (
    <section 
      className="relative mx-auto max-w-7xl px-4 py-8 md:px-8 overflow-visible"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="relative w-full rounded-[2.5rem] bg-gradient-to-br from-[#0c2a13] via-[#103E1C] to-[#07180b] border border-emerald-500/20 overflow-hidden shadow-2xl">
        {/* Subtle decorative glow circles */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-amber-500/10 rounded-full blur-[100px] pointer-events-none" />

        <AnimatePresence mode="wait">
          <motion.div
            key={current.id || currentIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.4 }}
            className="px-6 py-10 md:py-16 md:px-14 flex flex-col lg:flex-row gap-8 lg:gap-14 items-center"
          >
            {/* Left Side: Campaign Photo with Gold Frame */}
            <div className="w-full lg:w-5/12 flex justify-center relative z-10">
              <div className="relative w-full max-w-md aspect-[4/3] sm:aspect-[16/10] lg:aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl border-2 border-emerald-600/30 group">
                <img
                  src={current.image || "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&auto=format&fit=crop&q=80"}
                  alt={current.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
                {/* Urgent / Spotlight Badge on Image */}
                <div className="absolute top-4 left-4 z-10 px-3.5 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-amber-500/40 text-amber-300 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-lg">
                  <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
                  <span>{current.badge || "Live Campaign"}</span>
                </div>
              </div>
            </div>

            {/* Right Side: Fundraising Details & Progress Bar */}
            <div className="w-full lg:w-7/12 flex flex-col text-left relative z-10 text-white">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/70 border border-emerald-500/30 text-emerald-300 text-[11px] font-black uppercase tracking-wider w-fit">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Special Fundraising Drive
                </div>

                {campaigns.length > 1 && (
                  <span className="text-[11px] font-bold text-amber-400 bg-black/40 px-3 py-1 rounded-full border border-white/10">
                    Campaign {currentIndex + 1} of {campaigns.length}
                  </span>
                )}
              </div>

              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-white leading-tight">
                {current.title}
              </h2>

              <p className="mt-3 text-sm sm:text-base text-emerald-100/80 leading-relaxed font-normal">
                {current.tagline}
              </p>

              {/* Fundraising Stats Grid */}
              <div className="mt-6 bg-black/30 backdrop-blur-md border border-white/10 rounded-2xl p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-3 mb-3">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 block">Raised So Far</span>
                    <span className="text-2xl sm:text-3xl font-black text-[#F3A61E]">
                      {formatINR(raised)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">Target Goal</span>
                    <span className="text-xl sm:text-2xl font-black text-white">
                      {formatINR(target)}
                    </span>
                  </div>
                </div>

                {/* Animated Progress Bar */}
                <div className="relative w-full h-3.5 bg-zinc-900 rounded-full overflow-hidden border border-white/10">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percent}%` }}
                    transition={{ duration: 1.0, ease: "easeOut" }}
                    className="h-full bg-gradient-to-r from-amber-500 via-[#F3A61E] to-emerald-400 rounded-full shadow-[0_0_12px_rgba(243,166,30,0.5)]"
                  />
                </div>

                <div className="mt-3 flex items-center justify-between text-xs font-bold text-zinc-300">
                  <span className="text-emerald-400 font-black">{percent}% Completed</span>
                  {current.donors_count ? (
                    <span className="text-zinc-400">❤️ {current.donors_count}+ Generous Donors</span>
                  ) : null}
                  {current.days_left ? (
                    <span className="text-amber-400">⏳ {current.days_left} Days Left</span>
                  ) : null}
                </div>
              </div>

              {/* CTA Button Row + Navigation Controls */}
              <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    href={current.donate_url || "/causes"}
                    className="px-8 py-3.5 bg-[#F3A61E] hover:bg-[#d68f12] text-black text-sm font-black uppercase tracking-wider rounded-full shadow-lg shadow-amber-500/20 transition-all hover:scale-105 active:scale-95 flex items-center gap-2 cursor-pointer"
                  >
                    <span>Donate To This Campaign</span>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </Link>

                  <Link
                    href="/causes"
                    className="px-6 py-3.5 border border-white/20 hover:border-white/50 text-white text-xs font-bold uppercase tracking-wider rounded-full transition-colors cursor-pointer"
                  >
                    Explore All Causes
                  </Link>
                </div>

                {/* Multiple Campaign Carousel Arrows */}
                {campaigns.length > 1 && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handlePrev}
                      className="h-10 w-10 rounded-full bg-black/40 hover:bg-black/80 border border-white/20 hover:border-[#F3A61E] text-white flex items-center justify-center transition-all cursor-pointer shadow-md"
                      title="Previous Campaign"
                      aria-label="Previous Campaign"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={handleNext}
                      className="h-10 w-10 rounded-full bg-black/40 hover:bg-black/80 border border-white/20 hover:border-[#F3A61E] text-white flex items-center justify-center transition-all cursor-pointer shadow-md"
                      title="Next Campaign"
                      aria-label="Next Campaign"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
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
          <div className="flex justify-center items-center gap-2 pb-5 relative z-20">
            {campaigns.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                className={`transition-all rounded-full cursor-pointer ${
                  currentIndex === idx
                    ? "w-8 h-2 bg-[#F3A61E] shadow-[0_0_8px_rgba(243,166,30,0.6)]"
                    : "w-2 h-2 bg-white/30 hover:bg-white/60"
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
