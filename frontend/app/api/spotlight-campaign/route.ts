import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getResilientData, saveResilientFallback } from '@/lib/db-fallback';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DEFAULT_CAMPAIGN = {
  enabled: true,
  badge: "🌟 Spotlight Fundraising Campaign",
  title: "Mission Shiksha: Educate 500 Underprivileged Children",
  tagline: "Join our mission to provide quality education, school uniforms, books, and mid-day nutrition to children from vulnerable slum communities.",
  image: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&auto=format&fit=crop&q=80",
  target_amount: 500000,
  raised_amount: 284500,
  donors_count: 142,
  donate_url: "/causes",
  days_left: 18
};

// GET spotlight campaign data
export async function GET() {
  try {
    const data = await getResilientData('spotlight_campaign.json', DEFAULT_CAMPAIGN);
    return NextResponse.json(data || DEFAULT_CAMPAIGN, {
      headers: { 'Cache-Control': 'no-store, max-age=0' }
    });
  } catch (error: any) {
    return NextResponse.json(DEFAULT_CAMPAIGN);
  }
}

// POST/PUT to update spotlight campaign data
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const current = await getResilientData('spotlight_campaign.json', DEFAULT_CAMPAIGN);
    
    const updated = {
      ...current,
      ...body,
      target_amount: Number(body.target_amount ?? current.target_amount),
      raised_amount: Number(body.raised_amount ?? current.raised_amount),
      donors_count: Number(body.donors_count ?? current.donors_count),
      enabled: body.enabled !== undefined ? Boolean(body.enabled) : current.enabled
    };

    await saveResilientFallback('spotlight_campaign.json', updated);

    return NextResponse.json({ success: true, campaign: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  return POST(request);
}
