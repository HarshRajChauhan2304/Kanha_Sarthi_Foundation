import { NextResponse } from 'next/server';
import { getConfig, saveConfig } from '@/lib/config-storage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const defaultFooter = {
  logo: "/logo.png",
  copyrightText: "Kanha Foundation",
  companyOverview: [
    { label: "About Us", href: "/about" },
    { label: "Our Values", href: "/values" },
    { label: "Privacy Notice", href: "/privacy" },
    { label: "Terms & Conditions", href: "/terms" },
    { label: "Disclaimer", href: "/disclaimer" }
  ],
  quickLinks: [
    { label: "Knowledge & FAQs", href: "/faqs" },
    { label: "Return & Refund Policy", href: "/refund" }
  ],
  contact: {
    email: "kanhafoundation223@gmail.com",
    ctaText: "Need help fast? Fill out our form or email"
  },
  social: [
    { platform: "Instagram", href: "https://www.instagram.com/kh_foundation_223/" },
    { platform: "Facebook", href: "https://www.facebook.com/profile.php?id=61564493773786" },
    { platform: "YouTube", href: "https://www.youtube.com/@KanhaFoundation-i8f" },
    { platform: "LinkedIn", href: "https://www.linkedin.com/in/kanha-foundation-635778400?" }
  ]
};

export async function GET() {
  try {
    const data = await getConfig('footer', defaultFooter, 'footer.json');
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    });
  } catch (error) {
    console.error('Error reading footer config:', error);
    return NextResponse.json(defaultFooter, {
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    });
  }
}

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    if (typeof payload !== 'object' || payload === null) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const existingData = await getConfig('footer', defaultFooter, 'footer.json');

    const updatedData = {
      ...existingData,
      ...payload,
      contact: payload.contact
        ? { ...(existingData.contact || {}), ...payload.contact }
        : existingData.contact
    };

    const saved = await saveConfig('footer', updatedData, 'footer.json');
    return NextResponse.json(saved, {
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    });
  } catch (error: any) {
    console.error('Error writing footer config:', error);
    return NextResponse.json({ error: error?.message || 'Failed to write footer config' }, { status: 500 });
  }
}
