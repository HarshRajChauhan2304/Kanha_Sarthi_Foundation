"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

interface MonthlyCategory {
  id: "education" | "healthcare" | "food";
  name: string;
  tabLabel: string;
  title: string;
  tagline: string;
  image: string;
  presets: number[];
  impactNotes: { [amount: number]: string; default: string };
}

const CATEGORIES: MonthlyCategory[] = [
  {
    id: "education",
    name: "Education",
    tabLabel: "Education",
    title: "Educate, Empower, Transform.",
    tagline: "Provide school uniforms, textbooks, digital learning, and tuition to underprivileged slum children.",
    image: "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=1000&auto=format&fit=crop&q=80",
    presets: [1000, 5000, 10000, 20000],
    impactNotes: {
      1000: "₹1,000 / month sponsors school kit, books, uniform & mid-day nutrition for 1 child.",
      5000: "₹5,000 / month supports full academic sponsorship and remedial evening coaching for 5 children.",
      10000: "₹10,000 / month funds digital classroom access and annual fees for an entire slum learning center.",
      20000: "₹20,000 / month sponsors comprehensive yearly schooling, health care, and nutrition for 20 children.",
      default: "Every monthly rupee helps provide quality education and a brighter tomorrow for underprivileged children."
    }
  },
  {
    id: "healthcare",
    name: "Healthcare",
    tabLabel: "Healthcare",
    title: "Healing Lives, Restoring Dignity.",
    tagline: "Deliver critical medicines, mobile clinic checkups, diagnostic tests, and emergency medical aid to vulnerable families.",
    image: "https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=1000&auto=format&fit=crop&q=80",
    presets: [1000, 5000, 10000, 20000],
    impactNotes: {
      1000: "₹1,000 / month provides essential chronic medicines and physician checkups for 1 destitute patient.",
      5000: "₹5,000 / month sponsors specialized diagnostic blood panels, dialysis support, and pediatric consultations.",
      10000: "₹10,000 / month funds a full mobile health clinic camp in remote tribal and slum pockets.",
      20000: "₹20,000 / month supports life-saving emergency surgery costs for destitute patients in critical need.",
      default: "Your monthly healthcare contribution provides immediate medical attention and relief to vulnerable lives."
    }
  },
  {
    id: "food",
    name: "Food & Nutrition",
    tabLabel: "Food & Nutrition",
    title: "No One Sleeps Hungry.",
    tagline: "Supply wholesome 15-item monthly dry grocery ration kits and daily hot cooked nutritious meals to daily wage workers and children.",
    image: "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=1000&auto=format&fit=crop&q=80",
    presets: [1000, 5000, 10000, 20000],
    impactNotes: {
      1000: "₹1,000 / month delivers a complete 15-item dry ration grocery kit feeding a needy family for 1 whole month.",
      5000: "₹5,000 / month serves 125+ freshly cooked hot nutritious meals to street children and daily wage laborers.",
      10000: "₹10,000 / month powers an open community kitchen drive feeding over 250 vulnerable individuals.",
      20000: "₹20,000 / month funds complete sustained monthly nutrition and dry ration for 20 impoverished families.",
      default: "Your recurring monthly meal donation ensures hunger is eliminated one plate at a time."
    }
  }
];

export default function DonateMonthlyPage() {
  const router = useRouter();

  const [activeCategory, setActiveCategory] = useState<MonthlyCategory>(CATEGORIES[0]);
  const [selectedPreset, setSelectedPreset] = useState<number>(1000);
  const [customAmount, setCustomAmount] = useState<string>("1000");

  // Donor Details
  const [donorName, setDonorName] = useState<string>("");
  const [donorPhone, setDonorPhone] = useState<string>("");
  const [donorEmail, setDonorEmail] = useState<string>("");
  const [claimTax, setClaimTax] = useState<boolean>(true);

  // Tax Benefits Modal
  const [showTaxModal, setShowTaxModal] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Pre-fill from active user session if available
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedName = localStorage.getItem("user_name");
      const storedEmail = localStorage.getItem("user_email");
      const storedPhone = localStorage.getItem("user_phone");

      if (storedName) setDonorName(storedName);
      if (storedEmail) setDonorEmail(storedEmail);
      if (storedPhone) setDonorPhone(storedPhone);
    }
  }, []);

  const handlePresetClick = (amount: number) => {
    setSelectedPreset(amount);
    setCustomAmount(String(amount));
  };

  const handleCustomAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, "");
    setCustomAmount(val);
    const num = parseInt(val, 10);
    if (activeCategory.presets.includes(num)) {
      setSelectedPreset(num);
    } else {
      setSelectedPreset(0);
    }
  };

  const handleDonateNow = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    const amountNum = parseInt(customAmount, 10);
    if (!amountNum || amountNum < 100) {
      setErrorMessage("Please enter a valid monthly donation amount of at least ₹100.");
      return;
    }

    if (!donorName.trim()) {
      setErrorMessage("Please enter your name to proceed.");
      return;
    }

    // Requirement 2: Redirect directly to the donation checkout form (/donate)
    const query = new URLSearchParams({
      title: `${activeCategory.name} Monthly Subscription`,
      amount: String(amountNum),
      category: activeCategory.name,
      type: "monthly",
      name: donorName.trim(),
      email: donorEmail.trim(),
      phone: donorPhone.trim()
    });

    router.push(`/donate?${query.toString()}`);
  };

  const currentImpactNote = 
    activeCategory.impactNotes[parseInt(customAmount, 10)] || 
    activeCategory.impactNotes.default;

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 via-zinc-950 to-black text-white py-10 sm:py-16 px-4 font-sans">
      <div className="max-w-xl mx-auto">
        
        {/* Main Card Container (Matches User Screenshot) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-white dark:bg-[#121614] text-zinc-900 dark:text-white rounded-[2rem] shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
        >
          {/* Card Top Header */}
          <div className="p-6 sm:p-7 pb-4 flex items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800/80">
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
                <span>Monthly Subscriptions</span>
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
                Reliable grassroots impact created every month
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* Claim Tax Benefits Button (Orange badge from user screenshot) */}
              <button
                type="button"
                onClick={() => setShowTaxModal(true)}
                className="px-3.5 py-2 bg-[#F35E1E] hover:bg-[#e04e0e] text-white text-xs font-black rounded-xl shadow-md shadow-orange-500/20 transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5 cursor-pointer shrink-0"
                title="Claim 80G Tax Benefits"
              >
                <span>🎁 Claim Tax Benefits</span>
              </button>

              {/* Close Button linking back */}
              <button
                type="button"
                onClick={() => router.push("/")}
                className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors cursor-pointer"
                aria-label="Back to home"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Category Tabs: Education | Healthcare | Food & Nutrition */}
          <div className="px-6 sm:px-7 pt-5">
            <div className="grid grid-cols-3 gap-2 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
              {CATEGORIES.map((cat) => {
                const isActive = activeCategory.id === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setActiveCategory(cat);
                      setSelectedPreset(1000);
                      setCustomAmount("1000");
                    }}
                    className={`py-3 px-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      isActive
                        ? "bg-[#7C3AED] text-white shadow-md shadow-purple-500/30 scale-100"
                        : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                    }`}
                  >
                    <span>{cat.tabLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Category Banner with Image and Headline */}
          <div className="px-6 sm:px-7 pt-5">
            <div className="relative w-full aspect-[2.3/1] rounded-2xl overflow-hidden border border-purple-500/30 shadow-lg group">
              <img
                src={activeCategory.image}
                alt={activeCategory.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/20 flex flex-col justify-end p-4 sm:p-5 text-left">
                <span className="text-[10px] sm:text-xs font-black tracking-widest uppercase text-purple-300 mb-1">
                  Kanha Sarthi Foundation Monthly Drive
                </span>
                <h3 className="text-lg sm:text-2xl font-black text-white leading-tight">
                  {activeCategory.title}
                </h3>
                <p className="text-xs text-zinc-200 line-clamp-1 mt-1 font-medium">
                  {activeCategory.tagline}
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleDonateNow} className="p-6 sm:p-7 space-y-6">
            
            {/* Preset Amount Buttons (Matches user screenshot: ₹1000, ₹5000, ₹10000, ₹20000) */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3">
                Select Monthly Contribution
              </label>
              <div className="grid grid-cols-4 gap-2.5">
                {activeCategory.presets.map((amt) => {
                  const isSelected = selectedPreset === amt;
                  return (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => handlePresetClick(amt)}
                      className={`py-3 px-1 rounded-xl text-xs sm:text-sm font-black border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-purple-50 dark:bg-purple-950/40 border-[#7C3AED] text-[#7C3AED] dark:text-purple-300 ring-2 ring-[#7C3AED]/30 scale-102"
                          : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-purple-300"
                      }`}
                    >
                      ₹{amt.toLocaleString("en-IN")}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Total Amount Input Field */}
            <div className="space-y-1.5">
              <label className="block text-xs font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                ₹ Total amount (Monthly)
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-4 text-base font-black text-zinc-400">₹</span>
                <input
                  type="text"
                  value={customAmount}
                  onChange={handleCustomAmountChange}
                  placeholder="Enter amount"
                  className="w-full pl-9 pr-4 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-base font-black text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent"
                  required
                />
              </div>

              {/* Dynamic Impact Note */}
              <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-[11px] font-bold text-purple-700 dark:text-purple-300 flex items-center gap-2">
                <span>✨</span>
                <span>{currentImpactNote}</span>
              </div>
            </div>

            {/* Donor Information Input Fields (Clean underline style from user screenshot) */}
            <div className="space-y-4 pt-2">
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                  Your Name *
                </label>
                <input
                  type="text"
                  value={donorName}
                  onChange={(e) => setDonorName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  required
                  className="w-full px-3 py-2.5 bg-transparent border-b-2 border-zinc-200 dark:border-zinc-700 text-sm font-semibold text-zinc-900 dark:text-white focus:outline-none focus:border-[#7C3AED] transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                  Mobile Number (WhatsApp Updates)
                </label>
                <input
                  type="tel"
                  value={donorPhone}
                  onChange={(e) => setDonorPhone(e.target.value)}
                  placeholder="e.g. +91 98765 43210"
                  className="w-full px-3 py-2.5 bg-transparent border-b-2 border-zinc-200 dark:border-zinc-700 text-sm font-semibold text-zinc-900 dark:text-white focus:outline-none focus:border-[#7C3AED] transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                  Email (For 80G Tax Exemption Receipt)
                </label>
                <input
                  type="email"
                  value={donorEmail}
                  onChange={(e) => setDonorEmail(e.target.value)}
                  placeholder="e.g. rahul@example.com"
                  className="w-full px-3 py-2.5 bg-transparent border-b-2 border-zinc-200 dark:border-zinc-700 text-sm font-semibold text-zinc-900 dark:text-white focus:outline-none focus:border-[#7C3AED] transition-colors"
                />
              </div>
            </div>

            {/* 80G Tax Exemption Note */}
            <div className="flex items-start gap-2.5 pt-1">
              <input
                id="claimTaxCheckbox"
                type="checkbox"
                checked={claimTax}
                onChange={(e) => setClaimTax(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-[#7C3AED] focus:ring-[#7C3AED]"
              />
              <label htmlFor="claimTaxCheckbox" className="text-xs text-zinc-600 dark:text-zinc-400 font-medium select-none cursor-pointer">
                I would like an <strong className="text-zinc-900 dark:text-white">80G 50% Tax Exemption Certificate</strong> sent to my registered email address for this monthly contribution.
              </label>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs font-bold text-red-500">
                {errorMessage}
              </div>
            )}

            {/* Big Action Button (Matches User Screenshot: DONATE NOW) */}
            <button
              type="submit"
              className="w-full py-4 bg-[#7C3AED] hover:bg-[#6D28D9] active:bg-[#5B21B6] text-white font-black text-sm uppercase tracking-wider rounded-2xl shadow-xl shadow-purple-500/30 hover:scale-[1.01] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <span>DONATE NOW</span>
              <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
            </button>

            <p className="text-center text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
              🔒 100% Secure Checkout with Cashfree • UPI, Cards & NetBanking Supported
            </p>

          </form>
        </motion.div>
      </div>

      {/* Tax Benefits Info Modal */}
      <AnimatePresence>
        {showTaxModal && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl max-w-md w-full p-6 text-zinc-900 dark:text-white shadow-2xl relative"
            >
              <button
                onClick={() => setShowTaxModal(false)}
                className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full cursor-pointer"
              >
                ✕
              </button>

              <div className="inline-flex p-3 rounded-2xl bg-orange-500/10 text-orange-500 mb-4">
                <span className="text-2xl">📜</span>
              </div>

              <h3 className="text-xl font-black mb-2">Section 80G Tax Exemption</h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
                All donations to <strong>Kanha Sarthi Foundation</strong> are 50% tax exempt under Section 80G of the Indian Income Tax Act.
              </p>

              <div className="space-y-2.5 text-xs text-zinc-600 dark:text-zinc-300 mb-6">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-500 font-black">✓</span>
                  <span>Instant 80G digital receipt emailed upon payment</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-500 font-black">✓</span>
                  <span>Valid for salaried individuals, businesses & NRIs</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-500 font-black">✓</span>
                  <span>Quarterly transparent impact reports on WhatsApp</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowTaxModal(false)}
                className="w-full py-3 bg-[#F35E1E] hover:bg-[#e04e0e] text-white text-xs font-black uppercase tracking-wider rounded-xl cursor-pointer"
              >
                Got It, Thank You
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

