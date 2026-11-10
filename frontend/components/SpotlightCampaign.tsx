"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";

interface CampaignData {
  enabled: boolean;
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
  const [campaign, setCampaign] = useState<CampaignData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/spotlight-campaign", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data && data.enabled !== false) {
          setCampaign(data);
        } else {
          setCampaign(null);
        }
      })
      .catch(() => setCampaign(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !campaign || campaign.enabled === false) {
    return null;
  }

  const target = Number(campaign.target_amount) || 1;
  const raised = Number(campaign.raised_amount) || 0;
  const percent = Math.min(Math.round((raised / target) * 100), 100);

  const formatINR = (val: number) => {
    return "₹" + Number(val || 0).toLocaleString("en-IN");
  };

  return (
    <section className="relative mx-auto max-w-7xl px-4 py-8 md:px-8 overflow-visible">
      <motion.div
        initial={{ opacity: 0, y: 25 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="relative w-full rounded-[2.5rem] bg-gradient-to-br from-[#0c2a13] via-[#103E1C] to-[#07180b] border border-emerald-500/20 overflow-hidden px-6 py-10 md:py-16 md:px-14 shadow-2xl flex flex-col lg:flex-row gap-8 lg:gap-14 items-center"
      >
        {/* Subtle decorative glow circles */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-amber-500/10 rounded-full blur-[100px] pointer-events-none" />

        {/* Left Side: Campaign Photo with Gold Frame */}
        <div className="w-full lg:w-5/12 flex justify-center relative z-10">
          <div className="relative w-full max-w-md aspect-[4/3] sm:aspect-[16/10] lg:aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl border-2 border-emerald-600/30 group">
            <img
              src={campaign.image || "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&auto=format&fit=crop&q=80"}
              alt={campaign.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            />
            {/* Urgent / Spotlight Badge on Image */}
            <div className="absolute top-4 left-4 z-10 px-3.5 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-amber-500/40 text-amber-300 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-lg">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
              <span>{campaign.badge || "Live Campaign"}</span>
            </div>
          </div>
        </div>

        {/* Right Side: Fundraising Details & Progress Bar */}
        <div className="w-full lg:w-7/12 flex flex-col text-left relative z-10 text-white">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/70 border border-emerald-500/30 text-emerald-300 text-[11px] font-black uppercase tracking-wider w-fit mb-3">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Special Fundraising Drive
          </div>

          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-white leading-tight">
            {campaign.title}
          </h2>

          <p className="mt-3 text-sm sm:text-base text-emerald-100/80 leading-relaxed font-normal">
            {campaign.tagline}
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
                whileInView={{ width: `${percent}%` }}
                viewport={{ once: true }}
                transition={{ duration: 1.2, ease: "easeOut" }}
                className="h-full bg-gradient-to-r from-amber-500 via-[#F3A61E] to-emerald-400 rounded-full shadow-[0_0_12px_rgba(243,166,30,0.5)]"
              />
            </div>

            <div className="mt-3 flex items-center justify-between text-xs font-bold text-zinc-300">
              <span className="text-emerald-400 font-black">{percent}% Completed</span>
              {campaign.donors_count ? (
                <span className="text-zinc-400">❤️ {campaign.donors_count}+ Generous Donors</span>
              ) : null}
              {campaign.days_left ? (
                <span className="text-amber-400">⏳ {campaign.days_left} Days Left</span>
              ) : null}
            </div>
          </div>

          {/* CTA Button Row */}
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Link
              href={campaign.donate_url || "/causes"}
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
        </div>
      </motion.div>
    </section>
  );
}
