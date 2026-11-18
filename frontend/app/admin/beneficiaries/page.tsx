"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import fallbackCauses from "@/data/causes.json";

export type CauseType = "women_care" | "birthday" | "studykit" | "food" | "other";

interface Child {
  name: string;
  dob: string;
  aadhar_number: string;
  aadhar_upload_url: string;
  handover_pics?: string[];
}

interface Beneficiary {
  id: number;
  cause_type?: CauseType;
  cause_title?: string;
  beneficiary_name?: string;
  age?: string;
  parents_name?: string;
  father_name?: string;
  mother_name?: string;
  phone?: string;
  email?: string;
  address: string;
  aadhar_number?: string;
  aadhar_upload_url?: string;
  father_aadhar_number?: string;
  father_aadhar_upload_url?: string;
  mother_aadhar_number?: string;
  mother_aadhar_upload_url?: string;
  children?: Child[];
  causes_donated?: string[];
  donation_pic_url: string;
  created_at?: string;
}

const CAUSE_CONFIG: Record<CauseType, {
  label: string;
  icon: string;
  primaryFieldLabel: string;
  primaryPlaceholder: string;
  ageRequired: boolean;
  parentsRequired: boolean;
  aadharRequired: boolean;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
}> = {
  women_care: {
    label: "Women Care",
    icon: "🌸",
    primaryFieldLabel: "Women / Girl Name *",
    primaryPlaceholder: "e.g. Pooja Kumari",
    ageRequired: true,
    parentsRequired: true,
    aadharRequired: true,
    badgeBg: "bg-pink-50 dark:bg-pink-950/30",
    badgeBorder: "border-pink-200 dark:border-pink-900/30",
    badgeText: "text-pink-600 dark:text-pink-400"
  },
  birthday: {
    label: "Birthday Giving",
    icon: "🎂",
    primaryFieldLabel: "Child Name *",
    primaryPlaceholder: "e.g. Sonu Kumar",
    ageRequired: false,
    parentsRequired: false,
    aadharRequired: false,
    badgeBg: "bg-amber-50 dark:bg-amber-950/30",
    badgeBorder: "border-amber-200 dark:border-amber-900/30",
    badgeText: "text-amber-600 dark:text-amber-400"
  },
  studykit: {
    label: "Study Kit / Education",
    icon: "📚",
    primaryFieldLabel: "Student Name *",
    primaryPlaceholder: "e.g. Rahul Sharma",
    ageRequired: true,
    parentsRequired: true,
    aadharRequired: false,
    badgeBg: "bg-blue-50 dark:bg-blue-950/30",
    badgeBorder: "border-blue-200 dark:border-blue-900/30",
    badgeText: "text-blue-600 dark:text-blue-400"
  },
  food: {
    label: "Food Packets / Needy",
    icon: "🍲",
    primaryFieldLabel: "Beneficiary Name *",
    primaryPlaceholder: "e.g. Ramesh Singh",
    ageRequired: false,
    parentsRequired: false,
    aadharRequired: false,
    badgeBg: "bg-emerald-50 dark:bg-emerald-950/30",
    badgeBorder: "border-emerald-200 dark:border-emerald-900/30",
    badgeText: "text-emerald-600 dark:text-emerald-400"
  },
  other: {
    label: "Other Causes",
    icon: "🌿",
    primaryFieldLabel: "Beneficiary Name *",
    primaryPlaceholder: "e.g. Anil Kumar",
    ageRequired: false,
    parentsRequired: false,
    aadharRequired: false,
    badgeBg: "bg-purple-50 dark:bg-purple-950/30",
    badgeBorder: "border-purple-200 dark:border-purple-900/30",
    badgeText: "text-purple-600 dark:text-purple-400"
  }
};

const detectCauseType = (causeStr: string): CauseType => {
  const s = (causeStr || "").toLowerCase();
  if (s.includes("women") || s.includes("girl") || s.includes("menstrual") || s.includes("pad") || s.includes("sanitary")) return "women_care";
  if (s.includes("birthday") || s.includes("cake")) return "birthday";
  if (s.includes("study") || s.includes("kit") || s.includes("education") || s.includes("student") || s.includes("school")) return "studykit";
  if (s.includes("food") || s.includes("thali") || s.includes("meal") || s.includes("ration") || s.includes("needy")) return "food";
  return "other";
};

export default function AdminBeneficiariesPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isVolunteer, setIsVolunteer] = useState(false);
  
  // Data lists
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [causes, setCauses] = useState<any[]>(fallbackCauses);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTabFilter, setActiveTabFilter] = useState<string>("ALL");
  
  // Modal toggles
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Beneficiary | null>(null);
  const [viewing, setViewing] = useState<Beneficiary | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // File uploading states
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  // Form states
  const [formCauseType, setFormCauseType] = useState<CauseType>("women_care");
  const [formSelectedCauseTitle, setFormSelectedCauseTitle] = useState("");
  const [formBeneficiaryName, setFormBeneficiaryName] = useState("");
  const [formAge, setFormAge] = useState("");
  const [formParentsName, setFormParentsName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formAadharNumber, setFormAadharNumber] = useState("");
  const [formAadharUploadUrl, setFormAadharUploadUrl] = useState("");
  const [formDonationPicUrl, setFormDonationPicUrl] = useState("");
  const [formCausesDonated, setFormCausesDonated] = useState<string[]>([]);
  const [formChildren, setFormChildren] = useState<Child[]>([]);

  // Authenticate session (admin or volunteer)
  useEffect(() => {
    const adminAuth = localStorage.getItem("admin_auth");
    const volunteerSession = localStorage.getItem("volunteer_session");
    
    if (adminAuth === "true") {
      setIsAdmin(true);
      setIsVolunteer(false);
    } else if (volunteerSession) {
      setIsAdmin(true);
      setIsVolunteer(true);
    } else {
      router.push("/admin");
    }
  }, [router]);

  // Fetch beneficiaries and causes
  const fetchData = async () => {
    if (!isAdmin) return;
    try {
      setLoading(true);
      const resB = await fetch("/api/beneficiaries", { cache: "no-store" });
      if (resB.ok) {
        const dataB = await resB.json();
        if (Array.isArray(dataB)) {
          setBeneficiaries(dataB);
        }
      }
      
      const resC = await fetch("/api/causes", { cache: "no-store" });
      if (resC.ok) {
        const dataC = await resC.json();
        if (Array.isArray(dataC) && dataC.length > 0) {
          setCauses(dataC);
        }
      }
    } catch (err) {
      console.error("Error fetching admin beneficiaries data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin]);

  // Handle uploading files using `/api/upload`
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldKey: string, childIndex?: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingField(fieldKey);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success && data.url) {
        if (fieldKey === "aadhar_file") {
          setFormAadharUploadUrl(data.url);
        } else if (fieldKey === "donation_pic") {
          setFormDonationPicUrl(data.url);
        } else if (fieldKey === "child_aadhar" && childIndex !== undefined) {
          const updatedChildren = [...formChildren];
          updatedChildren[childIndex].aadhar_upload_url = data.url;
          setFormChildren(updatedChildren);
        }
      } else {
        alert("Upload failed: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      console.error("Error uploading file:", err);
      alert("Error uploading file. Please try again.");
    } finally {
      setUploadingField(null);
    }
  };

  // Multiple handover pictures for child (if Birthday/Family logging)
  const handleMultipleUpload = async (e: React.ChangeEvent<HTMLInputElement>, childIndex: number) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fieldKey = `child_handover_${childIndex}`;
    setUploadingField(fieldKey);

    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        return data.success ? data.url : null;
      });

      const urls = await Promise.all(uploadPromises);
      const successfulUrls = urls.filter((url): url is string => url !== null);

      if (successfulUrls.length > 0) {
        const updatedChildren = [...formChildren];
        const currentPics = updatedChildren[childIndex].handover_pics || [];
        updatedChildren[childIndex].handover_pics = [...currentPics, ...successfulUrls];
        setFormChildren(updatedChildren);
      }
    } catch (err) {
      console.error("Error uploading multiple files:", err);
      alert("Failed to upload one or more files. Please try again.");
    } finally {
      setUploadingField(null);
    }
  };

  const addChild = () => {
    setFormChildren([...formChildren, { name: "", dob: "", aadhar_number: "", aadhar_upload_url: "", handover_pics: [] }]);
  };

  const removeChild = (index: number) => {
    setFormChildren(formChildren.filter((_, idx) => idx !== index));
  };

  const updateChildField = (index: number, key: keyof Child, value: string) => {
    const updatedChildren = [...formChildren];
    (updatedChildren[index] as any)[key] = value;
    setFormChildren(updatedChildren);
  };

  const handleToggleCause = (causeTitle: string) => {
    if (formCausesDonated.includes(causeTitle)) {
      setFormCausesDonated(formCausesDonated.filter((c) => c !== causeTitle));
    } else {
      setFormCausesDonated([...formCausesDonated, causeTitle]);
    }
  };

  // When cause is selected from dropdown, auto-detect type
  const handleSelectCauseDropdown = (causeTitle: string) => {
    setFormSelectedCauseTitle(causeTitle);
    if (causeTitle) {
      const type = detectCauseType(causeTitle);
      setFormCauseType(type);
      if (!formCausesDonated.includes(causeTitle)) {
        setFormCausesDonated([causeTitle]);
      }
    }
  };

  // Add/Edit trigger
  const handleStartEdit = (b: Beneficiary) => {
    setEditing(b);
    const resolvedType: CauseType = b.cause_type || (b.causes_donated?.[0] ? detectCauseType(b.causes_donated[0]) : "women_care");
    setFormCauseType(resolvedType);
    setFormSelectedCauseTitle(b.cause_title || b.causes_donated?.[0] || "");
    setFormBeneficiaryName(b.beneficiary_name || b.children?.[0]?.name || b.father_name || "");
    setFormAge(b.age || "");
    setFormParentsName(b.parents_name || b.father_name || b.mother_name || "");
    setFormPhone(b.phone || "");
    setFormEmail(b.email || "");
    setFormAddress(b.address || "");
    setFormAadharNumber(b.aadhar_number || b.father_aadhar_number || "");
    setFormAadharUploadUrl(b.aadhar_upload_url || b.father_aadhar_upload_url || "");
    setFormDonationPicUrl(b.donation_pic_url || "");
    setFormCausesDonated(b.causes_donated || []);
    setFormChildren(b.children || []);
    setShowForm(true);
  };

  const handleStartAdd = () => {
    setEditing(null);
    setFormCauseType("women_care");
    setFormSelectedCauseTitle("");
    setFormBeneficiaryName("");
    setFormAge("");
    setFormParentsName("");
    setFormPhone("");
    setFormEmail("");
    setFormAddress("");
    setFormAadharNumber("");
    setFormAadharUploadUrl("");
    setFormDonationPicUrl("");
    setFormCausesDonated([]);
    setFormChildren([]);
    setShowForm(true);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditing(null);
  };

  // Submit Handler with dynamic validation according to user requirements
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Universal Mandatory Fields Validation (Phone, Email, Address, Pic Upload)
    if (!formPhone.trim()) {
      alert("Phone Number is mandatory for all beneficiary forms.");
      return;
    }
    if (!formEmail.trim()) {
      alert("Email ID is mandatory for all beneficiary forms.");
      return;
    }
    if (!formAddress.trim()) {
      alert("Physical Address is mandatory for all beneficiary forms.");
      return;
    }
    if (!formDonationPicUrl.trim()) {
      alert("Handover / Beneficiary Picture Upload is mandatory for all beneficiary forms.");
      return;
    }

    // 2. Cause-Specific Validations
    const config = CAUSE_CONFIG[formCauseType];

    // Primary name field validation (Women Name / Child Name / Student Name / Beneficiary Name)
    if (!formBeneficiaryName.trim()) {
      alert(`Please fill in ${config.primaryFieldLabel.replace('*', '').trim()} (Mandatory).`);
      return;
    }

    // Age validation
    if (config.ageRequired && !formAge.trim()) {
      alert(`Age is mandatory for ${config.label}.`);
      return;
    }

    // Parents name validation
    if (config.parentsRequired && !formParentsName.trim()) {
      alert(`Parents / Guardian Name is mandatory for ${config.label}.`);
      return;
    }

    // Aadhaar Card validation for Women Care
    if (config.aadharRequired) {
      if (!formAadharNumber.trim() && !formAadharUploadUrl.trim()) {
        alert("Aadhaar Number or Aadhaar Card Document Upload is mandatory for Women Care.");
        return;
      }
    }

    setSubmitting(true);

    const payload = {
      id: editing?.id,
      cause_type: formCauseType,
      cause_title: formSelectedCauseTitle || (formCausesDonated[0] || config.label),
      beneficiary_name: formBeneficiaryName.trim(),
      age: formAge.trim(),
      parents_name: formParentsName.trim(),
      father_name: formParentsName.trim(),
      mother_name: "",
      phone: formPhone.trim(),
      email: formEmail.trim(),
      address: formAddress.trim(),
      aadhar_number: formAadharNumber.trim(),
      aadhar_upload_url: formAadharUploadUrl,
      father_aadhar_number: formAadharNumber.trim(),
      father_aadhar_upload_url: formAadharUploadUrl,
      children: formChildren,
      causes_donated: formCausesDonated.length > 0 ? formCausesDonated : [formSelectedCauseTitle || config.label],
      donation_pic_url: formDonationPicUrl
    };

    try {
      const method = editing ? "PUT" : "POST";
      const res = await fetch("/api/beneficiaries", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setShowForm(false);
        setEditing(null);
        fetchData();
      } else {
        const errData = await res.json();
        alert("Operation failed: " + (errData.error || "Unknown error"));
      }
    } catch (err) {
      console.error("Error submitting beneficiary:", err);
      alert("An error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Handler
  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this beneficiary record? This cannot be undone.")) return;

    try {
      const res = await fetch(`/api/beneficiaries?id=${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setBeneficiaries(prev => prev.filter(b => b.id !== id));
        fetchData();
      } else {
        alert("Delete failed.");
      }
    } catch (err) {
      console.error("Error deleting beneficiary:", err);
    }
  };

  // Filtering
  const filteredBeneficiaries = beneficiaries.filter((b) => {
    const query = searchQuery.toLowerCase();
    const name = (b.beneficiary_name || b.father_name || b.children?.[0]?.name || "").toLowerCase();
    const parents = (b.parents_name || b.father_name || b.mother_name || "").toLowerCase();
    const address = (b.address || "").toLowerCase();
    const phone = (b.phone || "").toLowerCase();
    const email = (b.email || "").toLowerCase();
    const aadhar = (b.aadhar_number || b.father_aadhar_number || "").toLowerCase();
    const causeType = b.cause_type || (b.causes_donated?.[0] ? detectCauseType(b.causes_donated[0]) : "other");

    const matchesQuery = name.includes(query) || parents.includes(query) || address.includes(query) || phone.includes(query) || email.includes(query) || aadhar.includes(query);
    const matchesTab = activeTabFilter === "ALL" || causeType === activeTabFilter;

    return matchesQuery && matchesTab;
  });

  // Calculate quick stats
  const totalCount = beneficiaries.length;
  const womenCareCount = beneficiaries.filter(b => (b.cause_type === "women_care" || detectCauseType(b.causes_donated?.[0] || "") === "women_care")).length;
  const birthdayCount = beneficiaries.filter(b => (b.cause_type === "birthday" || detectCauseType(b.causes_donated?.[0] || "") === "birthday")).length;
  const studyKitCount = beneficiaries.filter(b => (b.cause_type === "studykit" || detectCauseType(b.causes_donated?.[0] || "") === "studykit")).length;
  const foodCount = beneficiaries.filter(b => (b.cause_type === "food" || detectCauseType(b.causes_donated?.[0] || "") === "food")).length;
  const aadharCount = beneficiaries.filter(b => !!(b.aadhar_number || b.aadhar_upload_url || b.father_aadhar_number || b.father_aadhar_upload_url)).length;

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#070b09] flex items-center justify-center text-white">
        <p className="text-zinc-400">Verifying session credentials...</p>
      </div>
    );
  }

  const currentConfig = CAUSE_CONFIG[formCauseType];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#070b09] text-gray-900 dark:text-gray-100 py-10 px-4 sm:px-6 lg:px-8 text-left">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 dark:border-zinc-800/80 pb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="px-3 py-1 bg-emerald-500/10 text-[#1E4D2B] dark:text-[#52c47c] border border-emerald-500/20 text-xs font-black uppercase rounded-full">
                Beneficiaries Management
              </span>
            </div>
            <h1 className="text-3xl font-black text-[#1E4D2B] dark:text-[#52c47c] tracking-tight mt-2">
              Beneficiaries Registry Room
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Cause-specific registration forms for Women Care, Birthday Celebrations, Study Kits, Food Packets, and general relief.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 self-start">
            <a
              href={isVolunteer ? "/volunteer/profile" : "/admin"}
              className="px-5 py-2.5 bg-gray-200 dark:bg-zinc-800 hover:bg-gray-300 dark:hover:bg-zinc-700 text-gray-800 dark:text-white font-bold text-xs rounded-xl shadow transition-all cursor-pointer flex items-center gap-1.5"
            >
              ← Back to Dashboard
            </a>
            <button
              onClick={handleStartAdd}
              className="px-5 py-2.5 bg-[#1E4D2B] hover:bg-[#15381E] text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
            >
              <svg className="h-4 w-4 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span>+ Add Beneficiary</span>
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
          <div className="bg-white dark:bg-[#101412] p-4 rounded-2xl border border-gray-150/45 dark:border-zinc-850">
            <span className="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest block">Total</span>
            <span className="text-2xl font-black text-[#1E4D2B] dark:text-[#52c47c] block mt-1">{totalCount}</span>
          </div>
          <div className="bg-white dark:bg-[#101412] p-4 rounded-2xl border border-gray-150/45 dark:border-zinc-850">
            <span className="text-[10px] font-black text-pink-500 uppercase tracking-widest block">🌸 Women Care</span>
            <span className="text-2xl font-black text-pink-600 dark:text-pink-400 block mt-1">{womenCareCount}</span>
          </div>
          <div className="bg-white dark:bg-[#101412] p-4 rounded-2xl border border-gray-150/45 dark:border-zinc-850">
            <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest block">📚 Study Kits</span>
            <span className="text-2xl font-black text-blue-600 dark:text-blue-400 block mt-1">{studyKitCount}</span>
          </div>
          <div className="bg-white dark:bg-[#101412] p-4 rounded-2xl border border-gray-150/45 dark:border-zinc-850">
            <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest block">🎂 Birthday</span>
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 block mt-1">{birthdayCount}</span>
          </div>
          <div className="bg-white dark:bg-[#101412] p-4 rounded-2xl border border-gray-150/45 dark:border-zinc-850">
            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest block">🍲 Food Packets</span>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 block mt-1">{foodCount}</span>
          </div>
          <div className="bg-white dark:bg-[#101412] p-4 rounded-2xl border border-gray-150/45 dark:border-zinc-850">
            <span className="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest block">Aadhaar Verified</span>
            <span className="text-2xl font-black text-amber-500 block mt-1">{aadharCount}</span>
          </div>
        </div>

        {/* Tab Filter & Search Bar */}
        <div className="space-y-3">
          <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-none snap-x border-b border-gray-200 dark:border-zinc-800">
            {[
              { id: "ALL", label: "All Beneficiaries" },
              { id: "women_care", label: "🌸 Women Care" },
              { id: "studykit", label: "📚 Study Kits" },
              { id: "birthday", label: "🎂 Birthday Celebration" },
              { id: "food", label: "🍲 Food & Nutrition" },
              { id: "other", label: "🌿 Other Causes" }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTabFilter(tab.id)}
                className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTabFilter === tab.id
                    ? "bg-[#1E4D2B] dark:bg-[#52c47c] text-white dark:text-black shadow"
                    : "bg-white dark:bg-[#101412] text-gray-600 dark:text-zinc-400 border border-gray-200 dark:border-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-850"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, parents, phone, email, address, or Aadhaar..."
              className="w-full pl-10 pr-4 py-3 bg-white dark:bg-[#101412] border border-gray-200 dark:border-zinc-800 text-sm text-gray-900 dark:text-white rounded-2xl focus:outline-none focus:ring-1 focus:ring-[#52c47c]"
            />
          </div>
        </div>

        {/* Registry Table */}
        {loading ? (
          <div className="text-center py-20 text-gray-500 dark:text-zinc-500 flex flex-col items-center justify-center">
            <svg className="animate-spin h-8 w-8 text-[#52c47c] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p>Loading beneficiaries data registry...</p>
          </div>
        ) : filteredBeneficiaries.length === 0 ? (
          <div className="bg-white dark:bg-[#101412] text-center py-16 rounded-2xl border border-gray-150/40 dark:border-zinc-850">
            <svg className="mx-auto h-12 w-12 text-zinc-400 dark:text-zinc-650 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h3 className="text-sm font-bold text-gray-700 dark:text-zinc-300">No records found</h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-zinc-500">Click '+ Add Beneficiary' above to register a new beneficiary record.</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#101412] rounded-2xl border border-gray-150/40 dark:border-zinc-850 overflow-hidden shadow">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-150 dark:divide-zinc-800 text-left">
                <thead>
                  <tr className="bg-gray-100 dark:bg-zinc-900/40 text-gray-500 dark:text-zinc-400 text-xs font-black uppercase tracking-wider">
                    <th className="px-6 py-4">Beneficiary & Cause</th>
                    <th className="px-6 py-4">Parents / Guardian</th>
                    <th className="px-6 py-4">Contact Details</th>
                    <th className="px-6 py-4">Location / Address</th>
                    <th className="px-6 py-4">Verification</th>
                    <th className="px-6 py-4">Proof Photo</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-150 dark:divide-zinc-800/80 text-sm">
                  {filteredBeneficiaries.map((b) => {
                    const causeType = b.cause_type || (b.causes_donated?.[0] ? detectCauseType(b.causes_donated[0]) : "other");
                    const cfg = CAUSE_CONFIG[causeType];
                    const displayName = b.beneficiary_name || b.children?.[0]?.name || b.father_name || "Beneficiary";
                    const displayParents = b.parents_name || b.father_name || b.mother_name || "N/A";
                    const aadharVal = b.aadhar_number || b.father_aadhar_number;
                    const aadharUrl = b.aadhar_upload_url || b.father_aadhar_upload_url;

                    return (
                      <tr key={b.id} className="hover:bg-gray-50 dark:hover:bg-zinc-900/10 transition-colors">
                        <td className="px-6 py-4">
                          <div>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border ${cfg.badgeBg} ${cfg.badgeBorder} ${cfg.badgeText}`}>
                              {cfg.icon} {cfg.label}
                            </span>
                            <p className="font-bold text-gray-900 dark:text-white mt-1 text-sm">{displayName}</p>
                            {b.age && (
                              <p className="text-[11px] text-gray-500 dark:text-zinc-500">Age: <span className="font-semibold text-gray-700 dark:text-zinc-300">{b.age}</span></p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-semibold text-xs text-gray-800 dark:text-zinc-300">{displayParents}</p>
                          {b.mother_name && (
                            <p className="text-[10px] text-gray-400">Mother: {b.mother_name}</p>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-0.5 text-xs">
                            {b.phone ? (
                              <a href={`tel:${b.phone}`} className="block text-emerald-600 dark:text-emerald-450 hover:underline font-bold">
                                📞 {b.phone}
                              </a>
                            ) : (
                              <span className="text-gray-400 text-[11px]">No phone</span>
                            )}
                            {b.email ? (
                              <a href={`mailto:${b.email}`} className="block text-gray-600 dark:text-zinc-400 text-[11px] hover:underline truncate max-w-[160px]">
                                ✉️ {b.email}
                              </a>
                            ) : (
                              <span className="text-gray-400 text-[11px] block">No email</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="max-w-[180px] text-gray-600 dark:text-zinc-400 text-xs line-clamp-2" title={b.address}>
                            📍 {b.address}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          {aadharVal || aadharUrl ? (
                            <div className="space-y-1">
                              <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400 text-[10px] font-black rounded block w-fit">
                                ✓ Aadhaar Provided
                              </span>
                              {aadharVal && <span className="text-[10px] text-gray-500 dark:text-zinc-400 block font-mono">{aadharVal}</span>}
                              {aadharUrl && (
                                <a href={aadharUrl} target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 hover:underline block font-bold">
                                  View Doc ↗
                                </a>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-gray-400 italic">Optional / Not provided</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {b.donation_pic_url ? (
                            <a href={b.donation_pic_url} target="_blank" rel="noreferrer" className="block relative h-12 w-16 rounded-lg overflow-hidden border border-gray-200 dark:border-zinc-800 shadow-xs hover:scale-105 transition-transform">
                              <img src={b.donation_pic_url} alt="Proof" className="object-cover w-full h-full" />
                            </a>
                          ) : (
                            <span className="text-[10px] text-red-400 font-bold">Missing</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setViewing(b)}
                              className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20 rounded-lg transition-colors cursor-pointer"
                              title="View full record"
                            >
                              <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleStartEdit(b)}
                              className="p-1.5 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/20 rounded-lg transition-colors cursor-pointer"
                              title="Edit record"
                            >
                              <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            {!isVolunteer && (
                              <button
                                onClick={() => handleDelete(b.id)}
                                className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors cursor-pointer"
                                title="Delete record"
                              >
                                <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* View Modal Overlay */}
        <AnimatePresence>
          {viewing && (
            <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white dark:bg-[#0c0f0d] text-gray-900 dark:text-gray-100 rounded-3xl p-6 sm:p-8 max-w-2xl w-full border border-gray-150 dark:border-zinc-800 shadow-2xl relative scrollbar-none max-h-[90vh] overflow-y-auto text-left"
              >
                <button
                  onClick={() => setViewing(null)}
                  className="absolute top-5 right-5 text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-white p-1 rounded-full cursor-pointer"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                {(() => {
                  const causeType = viewing.cause_type || (viewing.causes_donated?.[0] ? detectCauseType(viewing.causes_donated[0]) : "other");
                  const cfg = CAUSE_CONFIG[causeType];
                  const displayName = viewing.beneficiary_name || viewing.children?.[0]?.name || viewing.father_name || "Beneficiary";
                  const aadharVal = viewing.aadhar_number || viewing.father_aadhar_number;
                  const aadharUrl = viewing.aadhar_upload_url || viewing.father_aadhar_upload_url;

                  return (
                    <div className="space-y-6">
                      <div className="border-b border-gray-200 dark:border-zinc-850 pb-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border ${cfg.badgeBg} ${cfg.badgeBorder} ${cfg.badgeText}`}>
                          {cfg.icon} {cfg.label} Program
                        </span>
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white mt-2">
                          {displayName}
                        </h2>
                        {viewing.age && (
                          <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                            Age: <span className="font-bold text-gray-800 dark:text-zinc-200">{viewing.age}</span>
                          </p>
                        )}
                      </div>

                      {/* Details Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-4 bg-gray-50 dark:bg-[#101412] rounded-2xl border border-gray-200/50 dark:border-zinc-850 space-y-2">
                          <h4 className="text-[10px] font-black text-[#52c47c] uppercase tracking-wider">Family / Guardian</h4>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">
                            {viewing.parents_name || viewing.father_name || "Not provided"}
                          </p>
                          {viewing.mother_name && (
                            <p className="text-xs text-gray-500">Mother: {viewing.mother_name}</p>
                          )}
                        </div>

                        <div className="p-4 bg-gray-50 dark:bg-[#101412] rounded-2xl border border-gray-200/50 dark:border-zinc-850 space-y-2">
                          <h4 className="text-[10px] font-black text-[#52c47c] uppercase tracking-wider">Aadhaar Credentials</h4>
                          <p className="text-sm font-mono font-bold text-gray-900 dark:text-white">
                            {aadharVal || "Not provided"}
                          </p>
                          {aadharUrl && (
                            <a
                              href={aadharUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center text-xs font-bold text-blue-500 hover:underline"
                            >
                              Open Aadhaar Card Document ↗
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Contact Info (Universal) */}
                      <div className="p-4 bg-gray-50 dark:bg-[#101412] rounded-2xl border border-gray-200/50 dark:border-zinc-850 space-y-3">
                        <h4 className="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Contact Information</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-[10px] text-gray-400 block font-bold">Phone Number</span>
                            <a href={`tel:${viewing.phone}`} className="font-bold text-emerald-600 dark:text-emerald-450 hover:underline">
                              📞 {viewing.phone || "N/A"}
                            </a>
                          </div>
                          <div>
                            <span className="text-[10px] text-gray-400 block font-bold">Email ID</span>
                            <a href={`mailto:${viewing.email}`} className="font-bold text-gray-800 dark:text-zinc-200 hover:underline">
                              ✉️ {viewing.email || "N/A"}
                            </a>
                          </div>
                        </div>
                        <div>
                          <span className="text-[10px] text-gray-400 block font-bold">Physical Address</span>
                          <p className="text-xs text-gray-700 dark:text-zinc-300 mt-0.5 whitespace-pre-line">
                            📍 {viewing.address}
                          </p>
                        </div>
                      </div>

                      {/* Handover Proof Picture */}
                      <div>
                        <h4 className="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-2">Handover / Distribution Picture</h4>
                        {viewing.donation_pic_url ? (
                          <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-gray-200 dark:border-zinc-850 shadow-md">
                            <img
                              src={viewing.donation_pic_url}
                              alt="Handover proof"
                              className="object-cover w-full h-full"
                            />
                          </div>
                        ) : (
                          <p className="text-xs text-red-400 italic">No handover photo recorded.</p>
                        )}
                      </div>

                      {/* Causes */}
                      {viewing.causes_donated && viewing.causes_donated.length > 0 && (
                        <div>
                          <h4 className="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-2">Associated Causes</h4>
                          <div className="flex flex-wrap gap-1.5">
                            {viewing.causes_donated.map((c, i) => (
                              <span key={i} className="px-2.5 py-1 bg-gray-100 dark:bg-zinc-850 text-gray-800 dark:text-zinc-200 rounded-lg text-xs font-bold border border-gray-200 dark:border-zinc-800">
                                {c}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Add/Edit Dynamic Modal Overlay */}
        <AnimatePresence>
          {showForm && (
            <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white dark:bg-[#0c0f0d] text-gray-900 dark:text-gray-100 rounded-3xl p-6 sm:p-8 max-w-3xl w-full border border-gray-150 dark:border-zinc-800 shadow-2xl relative scrollbar-none max-h-[90vh] overflow-y-auto text-left"
              >
                <button
                  onClick={handleCancelForm}
                  className="absolute top-5 right-5 text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-white p-1 rounded-full cursor-pointer"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                <div className="border-b border-gray-200 dark:border-zinc-850 pb-4 mb-6">
                  <h2 className="text-2xl font-black text-gray-900 dark:text-white">
                    {editing ? "Modify Beneficiary Record" : "Register Underprivileged Beneficiary"}
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                    Fill in the form according to the cause category selected below.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  
                  {/* STEP 1: CAUSE SELECTION */}
                  <div className="space-y-3 p-4 bg-gray-50 dark:bg-[#101412] rounded-2xl border border-gray-200 dark:border-zinc-850">
                    <label className="block text-[11px] font-black uppercase tracking-wider text-[#1E4D2B] dark:text-[#52c47c]">
                      1. Select Cause / Program Type *
                    </label>

                    {/* Quick Cause Type Pills */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                      {(Object.keys(CAUSE_CONFIG) as CauseType[]).map((typeKey) => {
                        const cfg = CAUSE_CONFIG[typeKey];
                        const isSelected = formCauseType === typeKey;
                        return (
                          <button
                            key={typeKey}
                            type="button"
                            onClick={() => {
                              setFormCauseType(typeKey);
                              const matchedCause = causes.find(c => detectCauseType(c.title || c.category) === typeKey);
                              if (matchedCause) {
                                setFormSelectedCauseTitle(matchedCause.title);
                                setFormCausesDonated([matchedCause.title]);
                              }
                            }}
                            className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                              isSelected
                                ? "bg-[#1E4D2B] dark:bg-[#52c47c] text-white dark:text-black border-transparent shadow-md scale-[1.02]"
                                : "bg-white dark:bg-zinc-950 text-gray-700 dark:text-zinc-300 border-gray-200 dark:border-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-850"
                            }`}
                          >
                            <span className="text-lg">{cfg.icon}</span>
                            <span className="leading-tight">{cfg.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Specific Cause Linker Dropdown */}
                    <div className="pt-2">
                      <label className="block text-[10px] font-bold text-gray-500 dark:text-zinc-400 mb-1">
                        Select Specific Cause Campaign (Optional linkage):
                      </label>
                      <select
                        value={formSelectedCauseTitle}
                        onChange={(e) => handleSelectCauseDropdown(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none"
                      >
                        <option value="">-- Choose Campaign (Auto sets form type) --</option>
                        {causes.map((c) => (
                          <option key={c.id} value={c.title}>
                            {c.title} ({c.category})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* STEP 2: CAUSE-SPECIFIC BENEFICIARY DETAILS */}
                  <div className="space-y-4 p-4 bg-gray-50/50 dark:bg-[#101412] rounded-2xl border border-gray-200 dark:border-zinc-850">
                    <div className="flex items-center justify-between border-b border-gray-200/60 dark:border-zinc-800/60 pb-2">
                      <h3 className="text-xs font-black uppercase tracking-wider text-[#1E4D2B] dark:text-[#52c47c]">
                        2. {currentConfig.icon} {currentConfig.label} Beneficiary Information
                      </h3>
                      <span className="text-[10px] text-gray-400 font-bold">
                        Form dynamically adjusted
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Dynamic Primary Field */}
                      <div>
                        <label className="block text-[10px] font-bold text-gray-600 dark:text-zinc-300 uppercase tracking-wider mb-1">
                          {currentConfig.primaryFieldLabel}
                        </label>
                        <input
                          type="text"
                          required
                          value={formBeneficiaryName}
                          onChange={(e) => setFormBeneficiaryName(e.target.value)}
                          placeholder={currentConfig.primaryPlaceholder}
                          className="w-full px-4 py-2.5 bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#52c47c]"
                        />
                      </div>

                      {/* Age Field */}
                      <div>
                        <label className="block text-[10px] font-bold text-gray-600 dark:text-zinc-300 uppercase tracking-wider mb-1">
                          Age {currentConfig.ageRequired ? <span className="text-red-500">* (Mandatory)</span> : <span className="text-emerald-500 font-normal">(Optional)</span>}
                        </label>
                        <input
                          type="text"
                          required={currentConfig.ageRequired}
                          value={formAge}
                          onChange={(e) => setFormAge(e.target.value)}
                          placeholder="e.g. 14 Years"
                          className="w-full px-4 py-2.5 bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#52c47c]"
                        />
                      </div>

                      {/* Parents / Guardian Name Field */}
                      <div>
                        <label className="block text-[10px] font-bold text-gray-600 dark:text-zinc-300 uppercase tracking-wider mb-1">
                          Parents / Guardian Name {currentConfig.parentsRequired ? <span className="text-red-500">* (Mandatory)</span> : <span className="text-emerald-500 font-normal">(Optional)</span>}
                        </label>
                        <input
                          type="text"
                          required={currentConfig.parentsRequired}
                          value={formParentsName}
                          onChange={(e) => setFormParentsName(e.target.value)}
                          placeholder="e.g. Ramesh Kumar / Geeta Devi"
                          className="w-full px-4 py-2.5 bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#52c47c]"
                        />
                      </div>

                      {/* Aadhaar Number Field */}
                      <div>
                        <label className="block text-[10px] font-bold text-gray-600 dark:text-zinc-300 uppercase tracking-wider mb-1">
                          Aadhaar Number {currentConfig.aadharRequired ? <span className="text-red-500">* (Mandatory for Women Care)</span> : <span className="text-emerald-500 font-normal">(Optional)</span>}
                        </label>
                        <input
                          type="text"
                          required={currentConfig.aadharRequired}
                          value={formAadharNumber}
                          onChange={(e) => setFormAadharNumber(e.target.value)}
                          placeholder="12-digit Aadhaar number"
                          maxLength={12}
                          className="w-full px-4 py-2.5 bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#52c47c]"
                        />
                      </div>
                    </div>

                    {/* Aadhaar Document Upload */}
                    <div className="pt-2">
                      <label className="block text-[10px] font-bold text-gray-600 dark:text-zinc-300 uppercase tracking-wider mb-1">
                        Aadhaar Card Document Upload {currentConfig.aadharRequired ? <span className="text-red-500">* (Mandatory for Women Care)</span> : <span className="text-emerald-500 font-normal">(Optional)</span>}
                      </label>
                      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={(e) => handleUpload(e, "aadhar_file")}
                          className="block w-full text-xs text-zinc-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-gray-150 dark:file:bg-zinc-900 file:text-gray-700 dark:file:text-zinc-300 hover:file:bg-gray-200 dark:hover:file:bg-zinc-800 cursor-pointer"
                        />
                        {uploadingField === "aadhar_file" && (
                          <span className="text-xs text-amber-500 font-bold animate-pulse shrink-0">Uploading...</span>
                        )}
                        {formAadharUploadUrl && (
                          <a
                            href={formAadharUploadUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-bold text-[#52c47c] shrink-0 hover:underline flex items-center gap-1"
                          >
                            ✓ Document uploaded (View)
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* STEP 3: UNIVERSAL MANDATORY CONTACT & PICTURE DETAILS */}
                  <div className="space-y-4 p-4 bg-emerald-50/30 dark:bg-[#101412] rounded-2xl border border-emerald-200/50 dark:border-zinc-850">
                    <div className="border-b border-emerald-200/40 dark:border-zinc-800/60 pb-2">
                      <h3 className="text-xs font-black uppercase tracking-wider text-[#1E4D2B] dark:text-[#52c47c]">
                        3. Universal Contact & Verification Details <span className="text-red-500">* (Mandatory on all forms)</span>
                      </h3>
                      <p className="text-[10px] text-gray-500 dark:text-zinc-400">
                        Phone number, address, email ID, and handover photo are mandatory for every beneficiary record.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Phone Number (Universal Mandatory) */}
                      <div>
                        <label className="block text-[10px] font-bold text-gray-600 dark:text-zinc-300 uppercase tracking-wider mb-1">
                          Phone Number <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="tel"
                          required
                          value={formPhone}
                          onChange={(e) => setFormPhone(e.target.value)}
                          placeholder="e.g. +91 9876543210"
                          className="w-full px-4 py-2.5 bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#52c47c]"
                        />
                      </div>

                      {/* Email ID (Universal Mandatory) */}
                      <div>
                        <label className="block text-[10px] font-bold text-gray-600 dark:text-zinc-300 uppercase tracking-wider mb-1">
                          Email Address <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="email"
                          required
                          value={formEmail}
                          onChange={(e) => setFormEmail(e.target.value)}
                          placeholder="e.g. beneficiary@example.com"
                          className="w-full px-4 py-2.5 bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#52c47c]"
                        />
                      </div>
                    </div>

                    {/* Full Address (Universal Mandatory) */}
                    <div>
                      <label className="block text-[10px] font-bold text-gray-600 dark:text-zinc-300 uppercase tracking-wider mb-1">
                        Physical Residing Address <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        required
                        value={formAddress}
                        onChange={(e) => setFormAddress(e.target.value)}
                        placeholder="House no, Slum/Area, Village/Town, District, State, Pincode..."
                        className="w-full h-20 px-4 py-2.5 bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none resize-none focus:ring-1 focus:ring-[#52c47c]"
                      />
                    </div>

                    {/* Handover Photo Upload (Universal Mandatory) */}
                    <div>
                      <label className="block text-[10px] font-bold text-gray-600 dark:text-zinc-300 uppercase tracking-wider mb-1">
                        Beneficiary Handover Photo <span className="text-red-500">*</span>
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                        <div>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleUpload(e, "donation_pic")}
                            className="block w-full text-xs text-zinc-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-gray-150 dark:file:bg-zinc-900 file:text-gray-700 dark:file:text-zinc-300 hover:file:bg-gray-200 dark:hover:file:bg-zinc-800 cursor-pointer"
                          />
                          {uploadingField === "donation_pic" && (
                            <span className="text-xs text-amber-500 font-bold block mt-1 animate-pulse">Uploading photo...</span>
                          )}
                        </div>

                        {formDonationPicUrl ? (
                          <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-gray-200 dark:border-zinc-800 shadow">
                            <img
                              src={formDonationPicUrl}
                              alt="Handover preview"
                              className="object-cover w-full h-full"
                            />
                            <span className="absolute bottom-1 right-1 px-2 py-0.5 bg-black/70 text-[#52c47c] text-[10px] font-bold rounded">
                              ✓ Photo Ready
                            </span>
                          </div>
                        ) : (
                          <div className="h-16 bg-white dark:bg-zinc-950 border border-dashed border-gray-300 dark:border-zinc-800 rounded-xl flex items-center justify-center text-xs text-gray-400">
                            Please upload handover photo *
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Buttons */}
                  <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-zinc-850">
                    <button
                      type="button"
                      onClick={handleCancelForm}
                      disabled={submitting}
                      className="px-5 py-2.5 bg-gray-100 dark:bg-zinc-850 hover:bg-gray-200 dark:hover:bg-zinc-800 text-gray-700 dark:text-white text-xs font-bold rounded-xl cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting || uploadingField !== null}
                      className="px-6 py-2.5 bg-[#1E4D2B] hover:bg-[#15381E] disabled:bg-zinc-800 text-white text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5 shadow-md"
                    >
                      {submitting ? (
                        <>
                          <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span>Saving Record...</span>
                        </>
                      ) : (
                        <span>Save Beneficiary Record</span>
                      )}
                    </button>
                  </div>

                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
