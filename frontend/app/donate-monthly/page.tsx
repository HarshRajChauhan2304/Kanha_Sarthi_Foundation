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
  defaultMonthly: number;
  impactNotes: { [amount: number]: string; default: string };
}

const CATEGORIES: MonthlyCategory[] = [
  {
    id: "education",
    name: "Education",
    tabLabel: "Education",
    title: "Educate, Empower, Transform.",
    tagline: "Provide school uniforms, textbooks, digital learning, and tuition to underprivileged children.",
    image: "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=1000&auto=format&fit=crop&q=80",
    defaultMonthly: 200, // Education default: ₹200 as requested
    impactNotes: {
      200: "₹200 / month sponsors notebook sets, pens, and study stationery for an underprivileged child.",
      500: "₹500 / month funds school kit, textbooks, uniform and educational support for 1 child.",
      1000: "₹1,000 / month sponsors full schooling and remedial evening coaching for 2 children.",
      5000: "₹5,000 / month supports complete digital classroom access and fees for 10 children.",
      default: "Every monthly rupee provides quality education and a brighter tomorrow for underprivileged children."
    }
  },
  {
    id: "healthcare",
    name: "Healthcare",
    tabLabel: "Healthcare",
    title: "Healing Lives, Restoring Dignity.",
    tagline: "Deliver critical medicines, mobile clinic checkups, diagnostic tests, and emergency medical aid to vulnerable families.",
    image: "https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=1000&auto=format&fit=crop&q=80",
    defaultMonthly: 500, // Healthcare default: ₹500 as requested
    impactNotes: {
      500: "₹500 / month provides essential chronic medicines and physician checkup for 1 destitute patient.",
      1000: "₹1,000 / month covers diagnostic tests, medical consultations, and first-aid kits.",
      5000: "₹5,000 / month sponsors life-saving emergency medical aid and pediatric care.",
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
    defaultMonthly: 500, // Food default: ₹500 as requested
    impactNotes: {
      500: "₹500 / month delivers a wholesome 15-item dry ration grocery packet feeding a needy family.",
      1000: "₹1,000 / month delivers full grocery ration plus daily hot cooked nutritious meals.",
      5000: "₹5,000 / month serves 125+ freshly cooked hot nutritious meals to street children.",
      default: "Your recurring monthly meal donation ensures hunger is eliminated one plate at a time."
    }
  }
];

export default function DonateMonthlyPage() {
  const router = useRouter();

  const [categories, setCategories] = useState<MonthlyCategory[]>(CATEGORIES);
  const [activeCategory, setActiveCategory] = useState<MonthlyCategory>(CATEGORIES[0]);

  // Duration Months: 1, 2, 6, 12, or custom increased months
  const [durationMonths, setDurationMonths] = useState<number>(1);

  // Monthly base amount: Education = 200, Healthcare = 500, Food = 500
  const [monthlyAmount, setMonthlyAmount] = useState<number>(200);
  const [monthlyAmountInput, setMonthlyAmountInput] = useState<string>("200");

  // Donor Details
  const [donorName, setDonorName] = useState<string>("");
  const [donorPhone, setDonorPhone] = useState<string>("");
  const [donorEmail, setDonorEmail] = useState<string>("");
  const [claimTax, setClaimTax] = useState<boolean>(true);

  // Tax Benefits Modal
  const [showTaxModal, setShowTaxModal] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Dynamically load monthly donation settings from API
  useEffect(() => {
    fetch('/api/monthly-donation', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setCategories(data);
          setActiveCategory(prev => {
            const found = data.find((c: any) => c.id === prev.id) || data[0];
            setMonthlyAmount(found.defaultMonthly);
            setMonthlyAmountInput(String(found.defaultMonthly));
            return found;
          });
        }
      })
      .catch(err => console.error("Error loading monthly donation categories:", err));
  }, []);

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

  // Update monthly amount directly from text input
  const handleMonthlyAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, "");
    setMonthlyAmountInput(raw);
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed)) {
      setMonthlyAmount(parsed);
    } else {
      setMonthlyAmount(0);
    }
  };

  // Increase amount via stepper button (+)
  const handleIncreaseAmount = () => {
    let step = 100;
    if (monthlyAmount >= 1000 && monthlyAmount < 5000) step = 500;
    else if (monthlyAmount >= 5000) step = 1000;
    const nextVal = (monthlyAmount || 0) + step;
    setMonthlyAmount(nextVal);
    setMonthlyAmountInput(String(nextVal));
  };

  // Decrease amount via stepper button (-)
  const handleDecreaseAmount = () => {
    let step = 100;
    if (monthlyAmount > 5000) step = 1000;
    else if (monthlyAmount > 1000 && monthlyAmount <= 5000) step = 500;
    const nextVal = Math.max(100, (monthlyAmount || 0) - step);
    setMonthlyAmount(nextVal);
    setMonthlyAmountInput(String(nextVal));
  };

  // Increase duration months (+)
  const handleIncreaseMonths = () => {
    setDurationMonths((prev) => prev + 1);
  };

  // Decrease duration months (-)
  const handleDecreaseMonths = () => {
    setDurationMonths((prev) => Math.max(1, prev - 1));
  };

  // Total calculated amount based on duration: monthlyAmount * durationMonths
  const totalAmount = (monthlyAmount || 0) * durationMonths;

  const handleDonateNow = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!monthlyAmount || monthlyAmount < 100) {
      setErrorMessage("Please enter a valid monthly donation amount of at least ₹100.");
      return;
    }

    if (!donorName.trim()) {
      setErrorMessage("Please enter your name to proceed.");
      return;
    }

    // Redirect to checkout with total calculated amount and duration
    const query = new URLSearchParams({
      title: `${activeCategory.name} Monthly Subscription (${durationMonths} ${durationMonths === 1 ? "Month" : "Months"})`,
      amount: String(totalAmount),
      monthly_rate: String(monthlyAmount),
      months: String(durationMonths),
      category: activeCategory.name,
      type: "monthly",
      name: donorName.trim(),
      email: donorEmail.trim(),
      phone: donorPhone.trim()
    });

    router.push(`/donate?${query.toString()}`);
  };

  const handleClose = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    try {
      if (typeof window !== "undefined" && window.history.length > 1) {
        router.back();
      } else {
        router.push("/");
      }
    } catch {
      router.push("/");
    }
  };

  const currentImpactNote =
    activeCategory.impactNotes[monthlyAmount] ||
    activeCategory.impactNotes.default;

  return (
    <div className="min-h-screen bg-gray-100/90 dark:bg-[#07100b] text-zinc-900 dark:text-white pt-18 pb-8 sm:pt-22 sm:pb-12 px-3 sm:px-4 font-sans">
      <div className="max-w-xl mx-auto">

        {/* Main Card Container */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white dark:bg-[#121614] text-zinc-900 dark:text-white rounded-2xl sm:rounded-3xl shadow-2xl border border-zinc-200/80 dark:border-zinc-800 overflow-hidden"
        >
          {/* Card Top Header */}
          <div className="p-3 sm:p-4 pb-2.5 sm:pb-3 border-b border-zinc-100 dark:border-zinc-800/80">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h1 className="text-sm sm:text-lg font-black tracking-tight text-zinc-900 dark:text-white truncate">
                  Monthly Subscriptions
                </h1>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium truncate">
                  Reliable grassroots impact created every month
                </p>
              </div>

              {/* Tax Benefits Button & Close Button */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowTaxModal(true)}
                  className="inline-flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1.5 bg-[#F35E1E] hover:bg-[#e04e0e] active:bg-[#c93f06] text-white text-[10px] sm:text-[11px] font-black rounded-lg shadow-sm cursor-pointer transition-transform active:scale-95 shrink-0"
                >
                  <span>🎁</span>
                  <span className="hidden xs:inline">Claim Tax Benefits</span>
                  <span className="xs:hidden">Tax 80G</span>
                </button>

                <a
                  href="/"
                  onClick={handleClose}
                  className="flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-full transition-all cursor-pointer shrink-0"
                  aria-label="Back to home"
                  title="Close"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </a>
              </div>
            </div>
          </div>

          {/* Category Tabs: Education | Healthcare | Food & Nutrition */}
          <div className="px-3.5 sm:px-5 pt-2.5">
            <div className="grid grid-cols-3 gap-1 sm:gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
              {categories.map((cat) => {
                const isActive = activeCategory.id === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setActiveCategory(cat);
                      setMonthlyAmount(cat.defaultMonthly);
                      setMonthlyAmountInput(String(cat.defaultMonthly));
                    }}
                    className={`py-1.5 sm:py-2 px-1 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1 ${isActive
                      ? "bg-[#1E4D2B] text-white shadow-xs scale-100"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                      }`}
                  >
                    <span>
                      {cat.id === "education" ? "🎓 Education" : null}
                      {cat.id === "healthcare" ? (
                        <>
                          <span className="hidden sm:inline">🩺 Healthcare</span>
                          <span className="sm:hidden">🩺 Health</span>
                        </>
                      ) : null}
                      {cat.id === "food" ? (
                        <>
                          <span className="hidden sm:inline">🍲 Food & Care</span>
                          <span className="sm:hidden">🍲 Food</span>
                        </>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Category Banner with Image and Headline (Compact Height) */}
          <div className="px-3.5 sm:px-5 pt-2.5">
            <div className="relative w-full h-24 sm:h-28 rounded-xl overflow-hidden border border-emerald-500/30 shadow-md group">
              <img
                src={activeCategory.image}
                alt={activeCategory.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent flex flex-col justify-end p-2.5 sm:p-3 text-left">
                <span className="text-[9px] font-black tracking-wider uppercase text-emerald-400">
                  Kanha Sarthi Monthly Drive
                </span>
                <h3 className="text-xs sm:text-sm font-black text-white leading-tight mt-0.5">
                  {activeCategory.title}
                </h3>
                <p className="text-[10px] sm:text-[11px] text-zinc-200 line-clamp-1 mt-0.5 font-medium">
                  {activeCategory.tagline}
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleDonateNow} className="p-3.5 sm:p-5 space-y-3 sm:space-y-3.5">

            {/* ======================================================== */}
            {/* DURATION SELECTION (1, 2, 6, 12 MONTHS + STEPPER +/-) */}
            {/* ======================================================== */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                  Select Duration (Months)
                </label>
                <span className="text-[10px] sm:text-[11px] font-black text-[#1E4D2B] dark:text-emerald-400">
                  {durationMonths} {durationMonths === 1 ? "Month" : "Months"} Subscription
                </span>
              </div>

              {/* 4 Quick Preset Buttons: 1, 2, 6, 12 Months */}
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { months: 1, label: "1 Mo", full: "1 Month" },
                  { months: 2, label: "2 Mos", full: "2 Months" },
                  { months: 6, label: "6 Mos", full: "6 Months" },
                  { months: 12, label: "12 Mos", full: "12 Months" }
                ].map((item) => {
                  const isSelected = durationMonths === item.months;
                  return (
                    <button
                      key={item.months}
                      type="button"
                      onClick={() => setDurationMonths(item.months)}
                      className={`py-1.5 sm:py-2 px-1 rounded-lg text-xs font-black border transition-all cursor-pointer flex flex-col items-center justify-center ${isSelected
                        ? "bg-emerald-50 dark:bg-emerald-950/40 border-[#1E4D2B] dark:border-emerald-500 text-[#1E4D2B] dark:text-emerald-300 ring-1.5 ring-[#1E4D2B]/30 scale-[1.01] shadow-2xs"
                        : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-emerald-400"
                        }`}
                    >
                      <span className="text-xs font-black">{item.full}</span>
                    </button>
                  );
                })}
              </div>

              {/* Month Stepper: [-] {durationMonths} Months [+] */}
              <div className="flex items-center justify-between p-1.5 sm:p-2 bg-zinc-50 dark:bg-zinc-900/60 rounded-lg border border-zinc-200 dark:border-zinc-800 mt-1.5">
                <span className="text-[10px] sm:text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
                  Adjust Months:
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleDecreaseMonths}
                    disabled={durationMonths <= 1}
                    className="w-7 h-7 rounded-md bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 disabled:opacity-40 flex items-center justify-center font-black text-sm text-zinc-800 dark:text-zinc-100 cursor-pointer active:scale-95 transition-all select-none"
                    title="Decrease month"
                    aria-label="Decrease month"
                  >
                    −
                  </button>
                  <span className="w-20 text-center font-black text-xs sm:text-sm text-[#1E4D2B] dark:text-emerald-400">
                    {durationMonths} {durationMonths === 1 ? "Month" : "Months"}
                  </span>
                  <button
                    type="button"
                    onClick={handleIncreaseMonths}
                    className="w-7 h-7 rounded-md bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 flex items-center justify-center font-black text-sm text-zinc-800 dark:text-zinc-100 cursor-pointer active:scale-95 transition-all select-none"
                    title="Increase month"
                    aria-label="Increase month"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* ======================================================== */}
            {/* MONTHLY AMOUNT INPUT & +/- STEPPERS */}
            {/* ======================================================== */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                  Monthly Contribution (Per Month)
                </label>
                <span className="text-[10px] font-bold text-zinc-400">
                  Default: ₹{activeCategory.defaultMonthly}/mo
                </span>
              </div>

              {/* Stepper with [-] and [+] buttons beside the input */}
              <div className="flex items-center gap-1.5">
                {/* Decrease Button */}
                <button
                  type="button"
                  onClick={handleDecreaseAmount}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-100 flex items-center justify-center text-lg font-black transition-all active:scale-90 cursor-pointer shadow-xs border border-zinc-200/80 dark:border-zinc-750 select-none shrink-0"
                  title="Decrease amount"
                  aria-label="Decrease amount"
                >
                  −
                </button>

                {/* Direct Custom Amount Input Field */}
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black text-zinc-400 select-none">
                    ₹
                  </span>
                  <input
                    type="text"
                    value={monthlyAmountInput}
                    onChange={handleMonthlyAmountChange}
                    placeholder="Enter monthly amount"
                    className="w-full pl-7 pr-12 py-1.5 sm:py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm sm:text-base font-black text-zinc-900 dark:text-white focus:outline-none focus:ring-1.5 focus:ring-[#1E4D2B] dark:focus:ring-emerald-500"
                    required
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-zinc-400 select-none uppercase">
                    /mo
                  </span>
                </div>

                {/* Increase Button */}
                <button
                  type="button"
                  onClick={handleIncreaseAmount}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-100 flex items-center justify-center text-lg font-black transition-all active:scale-90 cursor-pointer shadow-xs border border-zinc-200/80 dark:border-zinc-750 select-none shrink-0"
                  title="Increase amount"
                  aria-label="Increase amount"
                >
                  +
                </button>
              </div>

              {/* ======================================================== */}
              {/* ACCORDING TO MONTHS AMOUNT DISPLAY */}
              {/* ======================================================== */}
              <div className="p-2.5 sm:p-3 bg-emerald-50/90 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 rounded-lg flex items-center justify-between shadow-2xs">
                <div>
                  <span className="text-[9px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-400 block">
                    Total Contribution ({durationMonths} {durationMonths === 1 ? "Month" : "Months"})
                  </span>
                  <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">
                    ₹{monthlyAmount.toLocaleString("en-IN")} × {durationMonths} {durationMonths === 1 ? "mo" : "mos"}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-lg sm:text-xl font-black text-[#1E4D2B] dark:text-emerald-400">
                    ₹{totalAmount.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              {/* Dynamic Impact Note */}
              <div className="p-2 sm:p-2.5 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-lg text-[10px] sm:text-[11px] font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <span>✨</span>
                <span>{currentImpactNote}</span>
              </div>
            </div>

            {/* Donor Information Input Fields (2-column on desktop for compact height) */}
            <div className="space-y-2 pt-0.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-0.5">
                    Your Name *
                  </label>
                  <input
                    type="text"
                    value={donorName}
                    onChange={(e) => setDonorName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    required
                    className="w-full px-2 py-1.5 bg-transparent border-b border-zinc-200 dark:border-zinc-700 text-xs sm:text-sm font-semibold text-zinc-900 dark:text-white focus:outline-none focus:border-[#1E4D2B] transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-0.5">
                    Mobile Number (WhatsApp)
                  </label>
                  <input
                    type="tel"
                    value={donorPhone}
                    onChange={(e) => setDonorPhone(e.target.value)}
                    placeholder="e.g. +91 98765 43210"
                    className="w-full px-2 py-1.5 bg-transparent border-b border-zinc-200 dark:border-zinc-700 text-xs sm:text-sm font-semibold text-zinc-900 dark:text-white focus:outline-none focus:border-[#1E4D2B] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-0.5">
                  Email (For 80G Tax Exemption Receipt)
                </label>
                <input
                  type="email"
                  value={donorEmail}
                  onChange={(e) => setDonorEmail(e.target.value)}
                  placeholder="e.g. rahul@example.com"
                  className="w-full px-2 py-1.5 bg-transparent border-b border-zinc-200 dark:border-zinc-700 text-xs sm:text-sm font-semibold text-zinc-900 dark:text-white focus:outline-none focus:border-[#1E4D2B] transition-colors"
                />
              </div>
            </div>

            {/* 80G Tax Exemption Note */}
            <div className="flex items-start gap-1.5 pt-0.5">
              <input
                id="claimTaxCheckbox"
                type="checkbox"
                checked={claimTax}
                onChange={(e) => setClaimTax(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 rounded border-zinc-300 text-[#1E4D2B] focus:ring-[#1E4D2B]"
              />
              <label htmlFor="claimTaxCheckbox" className="text-[10px] sm:text-[11px] text-zinc-600 dark:text-zinc-400 font-medium select-none cursor-pointer">
                I would like an <strong className="text-zinc-900 dark:text-white">80G 50% Tax Exemption Certificate</strong> sent to my registered email address.
              </label>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-[11px] font-bold text-red-500">
                {errorMessage}
              </div>
            )}

            {/* Big Action Button */}
            <button
              type="submit"
              className="w-full py-2.5 sm:py-3 bg-[#1E4D2B] hover:bg-[#153e22] active:bg-[#0f2d18] text-white font-black text-xs sm:text-sm uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-950/20 hover:scale-[1.01] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <span>DONATE ₹{totalAmount.toLocaleString("en-IN")} NOW</span>
              <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            </button>

            <p className="text-center text-[9px] sm:text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
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
