"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { isSessionExpired, clearAllSessions } from "@/lib/session";

import DonorDeliveryPopup from "@/components/DonorDeliveryPopup";
import BirthdayWishModal from "@/components/BirthdayWishModal";

interface DonationItem {
  id?: number;
  title: string;
  amount: string;
  date: string;
  status: string;
  proof_media?: string;
  beneficiary_name?: string;
  feedback?: string;
  cause?: string;
  quantity?: string;
}

export default function UserProfilePage() {
  const router = useRouter();
  
  // Profile state
  const [name, setName] = useState("Vikram Singh");
  const [email, setEmail] = useState("user@example.com");
  const [phone, setPhone] = useState("+91 98765 43210");
  const [gender, setGender] = useState("Male");
  const [dob, setDob] = useState("");
  const [bio, setBio] = useState("Proud donor. Believer in direct grassroots impact.");
  const [avatar, setAvatar] = useState("https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80");
  const [role, setRole] = useState("Donor & Supporter");

  // Flow states
  const [isEditing, setIsEditing] = useState(false);
  const [donations, setDonations] = useState<DonationItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [alertMsg, setAlertMsg] = useState("");
  const [showBirthdayModal, setShowBirthdayModal] = useState(false);
  const [isBirthdayToday, setIsBirthdayToday] = useState(false);
  const [activeMonthlyDonation, setActiveMonthlyDonation] = useState<any | null>(null);
  const [isMonthlyRenewalDue, setIsMonthlyRenewalDue] = useState(false);
  
  // Form input binding states
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editGender, setEditGender] = useState("Male");
  const [editDob, setEditDob] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editPassword, setEditPassword] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Check authentication & session validity
    if (isSessionExpired()) {
      router.push("/signin?expired=1");
      return;
    }
    const authState = localStorage.getItem("auth");
    if (authState !== "true") {
      router.push("/signin");
      return;
    }

    // Load credentials
    const storedEmail = localStorage.getItem("user_email") || "user@example.com";
    const storedName = localStorage.getItem("user_name") || "Vikram Singh";
    const storedPhone = localStorage.getItem("user_phone") || "+91 98765 43210";
    const storedGender = localStorage.getItem("user_gender") || "Male";
    const storedDob = localStorage.getItem("user_dob") || "";
    const storedBio = localStorage.getItem("user_bio") || "Proud donor. Believer in direct grassroots impact.";
    const storedAvatar = localStorage.getItem("user_avatar") || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80";
    const storedRoleRaw = localStorage.getItem("user_role") || localStorage.getItem("session_role") || "Donor & Supporter";

    let displayRole = storedRoleRaw;
    if (displayRole.toLowerCase() === 'admin') displayRole = 'Administrator';
    else if (displayRole.toLowerCase() === 'volunteer') displayRole = 'Volunteer Member';
    else if (displayRole.toLowerCase() === 'director') displayRole = 'Managing Director';
    else if (displayRole.toLowerCase() === 'user') displayRole = 'Donor & Supporter';
    setRole(displayRole);

    setName(storedName);
    setEmail(storedEmail);
    setPhone(storedPhone);
    setGender(storedGender);
    setDob(storedDob);
    setBio(storedBio);
    setAvatar(storedAvatar);

    // Initialize edit fields
    setEditName(storedName);
    setEditEmail(storedEmail);
    setEditPhone(storedPhone);
    setEditGender(storedGender);
    setEditDob(storedDob);
    setEditBio(storedBio);

    // Analyze DOB for Birthday Popup & In-Page Celebration Banner
    if (storedDob) {
      const today = new Date();
      const todayMMDD = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      
      let dobMMDD = "";
      if (storedDob.includes("-")) {
        const parts = storedDob.split("-");
        if (parts.length === 3) {
          if (parts[0].length === 4) dobMMDD = `${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
          else if (parts[2].length === 4) dobMMDD = `${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }

      if (dobMMDD === todayMMDD) {
        setIsBirthdayToday(true);
        setShowBirthdayModal(true);
        // Call cron API to process notifications
        fetch('/api/cron/birthday', { method: 'POST' }).catch(() => {});
      }
    }

    // Fetch real donation history from server
    const fetchUserDonations = async () => {
      try {
        let completedTasks: any[] = [];
        try {
          const tasksRes = await fetch('/api/volunteer/tasks', { cache: 'no-store' });
          if (tasksRes.ok) {
            const tasksData = await tasksRes.json();
            if (tasksData.success && Array.isArray(tasksData.tasks)) {
              completedTasks = tasksData.tasks.filter((t: any) => t.status === 'Completed' && t.proof_media);
            }
          }
        } catch (e) {
          console.error("Error fetching completed tasks:", e);
        }

        const res = await fetch(`/api/donations/by-user?email=${encodeURIComponent(storedEmail)}&phone=${encodeURIComponent(storedPhone)}&name=${encodeURIComponent(storedName)}`, { cache: 'no-store' });
        if (res.ok && res.headers.get("content-type")?.includes("application/json")) {
          const data = await res.json();
          if (data.success && Array.isArray(data.donations) && data.donations.length > 0) {
            // Check for monthly recurring donation
            const monthlyRecord = data.donations.find((d: any) => {
              const text = `${d.donation_for || ''} ${d.title || ''}`.toLowerCase();
              return text.includes("monthly") || text.includes("subscription") || text.includes("recurring");
            });

            if (monthlyRecord) {
              setActiveMonthlyDonation(monthlyRecord);
              const now = new Date();
              let subDay = now.getDate();
              if (monthlyRecord.created_at) {
                const cDate = new Date(monthlyRecord.created_at);
                if (!isNaN(cDate.getTime())) subDay = cDate.getDate();
              }
              if (subDay === now.getDate()) {
                setIsMonthlyRenewalDue(true);
              }
            }

            const mapped: DonationItem[] = data.donations.map((d: any) => {
              const numAmt = d.amount ? String(d.amount).replace(/[^0-9]/g, "") : "";
              
              // Find matching task specifically for this donation
              const matchedTask = completedTasks.find((t: any) => {
                if (t.donation_id && String(t.donation_id) === String(d.id)) return true;
                if (numAmt && t.donation_amount && String(t.donation_amount).replace(/[^0-9]/g, "") === numAmt) return true;
                if (numAmt && t.assigned_money && String(t.assigned_money) === numAmt) return true;
                return false;
              });

              return {
                id: d.id,
                title: d.donation_for || "General Support",
                amount: d.amount || "₹0",
                date: d.transaction_date || (d.created_at ? new Date(d.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : "Recently"),
                status: d.payment_status === "SUCCESS" ? "Completed" : (d.payment_status || "Completed"),
                proof_media: matchedTask ? matchedTask.proof_media : undefined,
                beneficiary_name: matchedTask ? matchedTask.beneficiary_name : undefined,
                feedback: matchedTask ? matchedTask.feedback : undefined,
                cause: matchedTask ? matchedTask.cause : undefined,
                quantity: matchedTask ? matchedTask.quantity : undefined
              };
            });
            setDonations(mapped);
            return;
          }
        }
      } catch (err) {
        console.error("Error fetching user donations from server:", err);
      }

      // Fallback to localStorage or defaults
      const historyKey = `user_donations_${storedEmail.trim().toLowerCase()}`;
      const storedHistory = localStorage.getItem(historyKey);
      if (storedHistory) {
        try {
          setDonations(JSON.parse(storedHistory));
        } catch (err) {
          console.error("Error reading donations history:", err);
        }
      } else {
        if (storedEmail === "user@example.com") {
          const defaults = [
            { title: "Clean Water for Families Project", amount: "Rs. 500.00", date: "June 28, 2026", status: "Completed" },
            { title: "Support Local Education Fund", amount: "Rs. 250.00", date: "May 14, 2026", status: "Completed" }
          ];
          setDonations(defaults);
          localStorage.setItem(historyKey, JSON.stringify(defaults));
        } else {
          setDonations([]);
        }
      }
    };

    fetchUserDonations();
  }, [router]);

  const triggerAlert = (msg: string) => {
    setAlertMsg(msg);
    setTimeout(() => setAlertMsg(""), 4000);
  };

  const handleLogout = () => {
    clearAllSessions();
    router.push("/signin");
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        setAvatar(data.url);
        localStorage.setItem("user_avatar", data.url);

        // Update database immediately with new avatar
        const currentEmail = localStorage.getItem("user_email") || "user@example.com";
        const storedName = localStorage.getItem("user_name") || "Vikram Singh";
        const storedPhone = localStorage.getItem("user_phone") || "+91 98765 43210";
        const storedGender = localStorage.getItem("user_gender") || "Male";
        const storedBio = localStorage.getItem("user_bio") || "";

        await fetch('/api/user/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: "update",
            currentEmail,
            username: storedName,
            email: currentEmail,
            phone: storedPhone,
            avatar: data.url,
            gender: storedGender,
            bio: storedBio
          })
        });

        window.dispatchEvent(new Event("user_avatar_update"));
        triggerAlert("Profile picture updated and saved!");
      } else {
        triggerAlert(data.error || "Upload failed.");
      }
    } catch (err) {
      console.error("Avatar upload error:", err);
      triggerAlert("Error uploading avatar.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || !editEmail.trim() || !editPhone.trim()) {
      triggerAlert("Required fields cannot be empty.");
      return;
    }

    const currentEmail = localStorage.getItem("user_email") || "user@example.com";

    try {
      const res = await fetch('/api/user/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: "update",
          currentEmail,
          username: editName,
          email: editEmail,
          phone: editPhone,
          avatar: avatar,
          gender: editGender,
          dob: editDob,
          bio: editBio,
          password: editPassword.trim() || undefined
        })
      });
      const data = await res.json();
      if (data.success) {
        setName(editName);
        setEmail(editEmail);
        setPhone(editPhone);
        setGender(editGender);
        setDob(editDob);
        setBio(editBio);

        localStorage.setItem("user_name", editName);
        localStorage.setItem("user_email", editEmail);
        localStorage.setItem("user_phone", editPhone);
        localStorage.setItem("user_gender", editGender);
        localStorage.setItem("user_dob", editDob);
        localStorage.setItem("user_bio", editBio);
        localStorage.setItem("user_avatar", avatar);

        setIsEditing(false);
        triggerAlert("Profile saved successfully!");
        window.dispatchEvent(new Event("user_avatar_update"));
      } else {
        triggerAlert(data.error || "Failed to save profile.");
      }
    } catch (err) {
      console.error("Save profile error:", err);
      triggerAlert("Error saving profile.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#07100b] pt-28 pb-16 md:pt-32 md:pb-20 px-4 md:px-8 font-sans">
      
      {/* Birthday Celebration Wish Modal */}
      <BirthdayWishModal
        isOpen={showBirthdayModal}
        onClose={() => setShowBirthdayModal(false)}
        userName={name}
        phone={phone}
        userType="user"
      />

      {/* Toast Alert Indicator */}
      <AnimatePresence>
        {alertMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-50 bg-[#1E4D2B] border border-emerald-500/30 text-white px-6 py-3 rounded-xl shadow-2xl font-bold flex items-center gap-2"
          >
            <svg className="h-5 w-5 text-emerald-400 fill-current" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            {alertMsg}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mx-auto max-w-5xl">
        
        {/* 🎂 Birthday Celebration In-Page Banner */}
        {isBirthdayToday && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-rose-500/20 border-2 border-amber-500/50 text-white relative overflow-hidden shadow-xl"
          >
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4 text-left">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-rose-500 flex items-center justify-center text-3xl shrink-0 shadow-lg shadow-orange-500/30">
                  🎂
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/30 text-amber-300 text-[10px] font-black uppercase tracking-wider mb-1">
                    <span>🎉 Happy Birthday!</span>
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-gray-950 dark:text-white">
                    Wishing you a blessed & joyful Birthday, {name}! 🎈
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-zinc-300 mt-0.5 leading-snug">
                    Celebrate your special day by spreading smiles. Sponsor a nutritious meal or study kit for underprivileged children today!
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto">
                <a
                  href="/donate?cause=birthday"
                  className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black text-xs uppercase tracking-wider shadow-md hover:scale-105 active:scale-95 transition-all text-center"
                >
                  🎁 Donate on My Birthday
                </a>
                <a
                  href={`https://api.whatsapp.com/send?phone=${phone ? phone.replace(/[^0-9]/g, '') : '9182587765159'}&text=${encodeURIComponent(`🎉 Happy Birthday ${name}! 🎂 Kanha Sarthi Foundation wishes you good health & happiness. Make your day memorable by giving back: https://kanha-foundation.org/donate?cause=birthday`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 shrink-0"
                  title="WhatsApp Wish"
                >
                  <span>📲 WhatsApp</span>
                </a>
              </div>
            </div>
          </motion.div>
        )}

        {/* 🔁 Monthly Subscription Renewal Due Banner */}
        {isMonthlyRenewalDue && activeMonthlyDonation && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-emerald-500/20 via-teal-500/15 to-emerald-950/40 border-2 border-emerald-500/60 text-white relative overflow-hidden shadow-xl"
          >
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4 text-left">
                <div className="w-14 h-14 rounded-2xl bg-[#1E4D2B] border border-emerald-500/40 flex items-center justify-center text-2xl shrink-0 shadow-lg shadow-emerald-900/30">
                  🔁
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 text-[10px] font-black uppercase tracking-wider mb-1">
                    <span>🌸 Monthly Support Renewal Due</span>
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-gray-950 dark:text-white">
                    Namaste {name}! Your monthly support is due today.
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-zinc-300 mt-0.5 leading-snug">
                    Your monthly contribution of <strong>{activeMonthlyDonation.amount}</strong> for <strong>{activeMonthlyDonation.donation_for || 'Monthly Giving'}</strong> keeps hope and nourishment alive for innocent children.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto">
                <a
                  href={`/donate-monthly?amount=${(activeMonthlyDonation.amount || '').replace(/[^0-9]/g, '') || '200'}`}
                  className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-[#1E4D2B] hover:bg-[#15381E] text-white font-black text-xs uppercase tracking-wider shadow-md hover:scale-105 active:scale-95 transition-all text-center border border-emerald-500/40"
                >
                  Renew Donation ({activeMonthlyDonation.amount}) 🌸
                </a>
                <a
                  href={`https://api.whatsapp.com/send?phone=9182587765159&text=${encodeURIComponent(`🌸 Namaste Kanha Sarthi Foundation, today is my monthly donation renewal day (${activeMonthlyDonation.amount}). I would like to renew my monthly subscription!`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 shrink-0"
                  title="WhatsApp Support"
                >
                  <span>📲 WhatsApp</span>
                </a>
              </div>
            </div>
          </motion.div>
        )}

        {/* Profile/Donation Grid */}
        <div className="grid gap-8 lg:grid-cols-12 items-start">
          
          {/* Left Column: Profile Card (Col 5) */}
          <div className="lg:col-span-5 bg-white dark:bg-[#101412] p-8 rounded-[2.5rem] border border-gray-150/45 dark:border-zinc-800/80 shadow-sm text-center relative overflow-hidden">
            
            {/* Direct avatar upload trigger */}
            <div className="relative h-28 w-28 mx-auto mb-6 group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
              <img
                src={avatar}
                alt={name}
                className="h-full w-full object-cover rounded-full border-4 border-emerald-500/10 shadow-md group-hover:brightness-75 transition-all"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                </svg>
              </div>
            </div>

            {isUploading && <p className="text-xs text-yellow-500 font-bold mb-4 animate-pulse">Uploading profile photo...</p>}

            <AnimatePresence mode="wait">
              {!isEditing ? (
                <motion.div
                  key="view"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  <div>
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white leading-tight">{name}</h2>
                    <div className={`mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border shadow-sm ${
                      role.toLowerCase().includes('director') 
                        ? 'bg-purple-950/40 text-purple-300 border-purple-500/40' 
                        : role.toLowerCase().includes('admin') 
                        ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/40' 
                        : role.toLowerCase().includes('volunteer') 
                        ? 'bg-blue-950/40 text-blue-300 border-blue-500/40' 
                        : 'bg-amber-950/40 text-[#F3A61E] border-amber-500/40'
                    }`}>
                      <span className={`h-2 w-2 rounded-full ${
                        role.toLowerCase().includes('director') ? 'bg-purple-400' :
                        role.toLowerCase().includes('admin') ? 'bg-emerald-400' :
                        role.toLowerCase().includes('volunteer') ? 'bg-blue-400' : 'bg-[#F3A61E]'
                      } animate-pulse`} />
                      <span>Role: {role}</span>
                    </div>
                  </div>

                  <p className="text-xs text-gray-500 dark:text-gray-400 italic max-w-xs mx-auto">
                    "{bio}"
                  </p>

                  <div className="border-t border-gray-150/40 dark:border-zinc-800/80 pt-6 text-left space-y-3.5">
                    <div>
                      <span className="block text-[10px] font-black text-gray-400 uppercase tracking-wider">Account Role / Designation</span>
                      <span className="text-sm font-bold text-[#F3A61E] dark:text-[#F3A61E] flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs">🛡️</span> {role}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-black text-gray-400 uppercase tracking-wider">Email Address</span>
                      <span className="text-sm font-bold text-gray-800 dark:text-zinc-200">{email}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-black text-gray-400 uppercase tracking-wider">WhatsApp Number</span>
                      <span className="text-sm font-bold text-gray-800 dark:text-zinc-200">{phone}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-black text-gray-400 uppercase tracking-wider">Date of Birth (DOB)</span>
                      <span className="text-sm font-bold text-gray-800 dark:text-zinc-200">{dob || "Not specified"}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-black text-gray-400 uppercase tracking-wider">Gender</span>
                      <span className="text-sm font-bold text-gray-800 dark:text-zinc-200">{gender}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 pt-6">
                    <button
                      onClick={() => setIsEditing(true)}
                      className="w-full py-3 bg-[#1E4D2B] hover:bg-[#15381E] text-white font-extrabold text-xs rounded-xl shadow-md cursor-pointer select-none"
                    >
                      Edit Profile
                    </button>
                    <button
                      onClick={handleLogout}
                      className="w-full py-3 bg-red-650/10 border border-red-900/20 text-red-500 hover:bg-red-650/20 font-extrabold text-xs rounded-xl transition-all cursor-pointer"
                    >
                      Logout
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.form
                  key="edit"
                  onSubmit={handleSaveProfile}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4 text-left pt-2"
                >
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">Full Name</label>
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#0c1510] border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">Email Address</label>
                    <input
                      type="email"
                      required
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#0c1510] border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">WhatsApp Mobile</label>
                    <input
                      type="text"
                      required
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#0c1510] border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">Date of Birth (DOB) *</label>
                    <input
                      type="date"
                      required
                      value={editDob}
                      onChange={(e) => setEditDob(e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#0c1510] border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">Gender</label>
                    <select
                      value={editGender}
                      onChange={(e) => setEditGender(e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#0c1510] border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none text-zinc-300"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">New Password (optional)</label>
                    <input
                      type="password"
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      placeholder="Leave blank to keep unchanged"
                      className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#0c1510] border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">Short Bio</label>
                    <textarea
                      value={editBio}
                      onChange={(e) => setEditBio(e.target.value)}
                      className="w-full h-16 px-4 py-2.5 bg-gray-50 dark:bg-[#0c1510] border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none resize-none"
                    />
                  </div>

                  <div className="flex gap-2 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditing(false);
                        setEditName(name);
                        setEditEmail(email);
                        setEditPhone(phone);
                        setEditGender(gender);
                        setEditDob(dob);
                        setEditBio(bio);
                        setEditPassword("");
                      }}
                      className="flex-1 py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-bold text-gray-500 dark:text-zinc-300 rounded-xl cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2.5 bg-[#1E4D2B] hover:bg-[#15381E] text-white text-xs font-black uppercase tracking-wider rounded-xl cursor-pointer"
                    >
                      Save
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

          </div>

          {/* Right Column: Donations History (Col 7) */}
          <div className="lg:col-span-7 bg-white dark:bg-[#101412] p-8 sm:p-10 rounded-[2.5rem] border border-gray-150/45 dark:border-zinc-800/80 shadow-sm text-left">
            <h2 className="text-xl font-black text-gray-900 dark:text-white mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <span>Your Donations History</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => router.push("/causes")}
                  className="px-3.5 py-1.5 bg-[#1E4D2B] hover:bg-[#15381E] text-white text-xs font-black rounded-xl transition-all cursor-pointer shadow-sm border border-emerald-800/40"
                >
                  Sponsor a Cause →
                </button>
                <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-950/20 text-[#1E4D2B] dark:text-[#52c47c] text-xs font-black rounded-full select-none">
                  {donations.length} {donations.length === 1 ? "Contribution" : "Contributions"}
                </span>
              </div>
            </h2>

            {donations.length > 0 ? (
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                {donations.map((d, index) => (
                  <div
                    key={index}
                    className="p-5 rounded-2xl border border-gray-100 dark:border-zinc-800/80 hover:shadow-md transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50/30"
                  >
                    <div>
                      <h4 className="text-sm font-extrabold text-gray-900 dark:text-white leading-tight">{d.title}</h4>
                      <p className="text-[10px] text-gray-400 font-bold mt-1.5 flex items-center gap-2">
                        <span>{d.date}</span>
                        <span>•</span>
                        <span className="text-emerald-500 font-extrabold">{d.status}</span>
                      </p>
                    </div>

                    <div className="text-left sm:text-right flex flex-col items-start sm:items-end gap-2">
                      <span className="text-base font-black text-[#F3A61E]">{d.amount}</span>
                      
                      {d.proof_media ? (
                        <button
                          onClick={() => {
                            window.dispatchEvent(new CustomEvent("open_donor_proof", {
                              detail: {
                                id: d.id || index + 1,
                                task_title: d.title,
                                proof_media: d.proof_media,
                                beneficiary_name: d.beneficiary_name || "Underprivileged Beneficiary",
                                feedback: d.feedback || "Donation successfully delivered on-ground with full proof.",
                                donor_name: name,
                                cause: d.cause || d.title,
                                quantity: d.quantity || "Relief Items",
                                donation_amount: d.amount
                              }
                            }));
                          }}
                          className="px-3.5 py-1.5 bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-400 text-[11px] font-black rounded-xl cursor-pointer flex items-center gap-1.5 shadow-sm transition-all"
                        >
                          <span>📸 Donation Successfully Proof</span>
                        </button>
                      ) : (
                        <span className="px-3 py-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 text-[10px] font-bold rounded-xl flex items-center gap-1">
                          <span>⏳ Field Proof In-Progress</span>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20 border border-dashed border-gray-200 dark:border-zinc-800 rounded-2xl">
                <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="mt-4 text-sm text-gray-500 font-bold">No contributions recorded yet</p>
                <button
                  onClick={() => window.location.href = "/causes"}
                  className="mt-4 text-xs font-bold text-[#1E4D2B] dark:text-[#52c47c] hover:underline"
                >
                  Sponsor a cause today &rarr;
                </button>
              </div>
            )}

          </div>

        </div>

      </div>

    </div>
  );
}
