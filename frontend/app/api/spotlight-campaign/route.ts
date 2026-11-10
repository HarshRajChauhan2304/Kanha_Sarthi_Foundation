import { NextResponse } from 'next/server';
import { getResilientData, saveResilientFallback } from '@/lib/db-fallback';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DEFAULT_CAMPAIGNS = [
  {
    id: 1,
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
  }
];

// Helper to normalize data to always be an array
const normalizeCampaigns = (data: any): any[] => {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') return [data];
  return DEFAULT_CAMPAIGNS;
};

// GET all spotlight campaigns
export async function GET() {
  try {
    const raw = await getResilientData('spotlight_campaign.json', DEFAULT_CAMPAIGNS);
    const campaigns = normalizeCampaigns(raw);
    return NextResponse.json(campaigns, {
      headers: { 'Cache-Control': 'no-store, max-age=0' }
    });
  } catch (error: any) {
    return NextResponse.json(DEFAULT_CAMPAIGNS);
  }
}

// POST: Add new campaign or reorder/bulk update
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const raw = await getResilientData('spotlight_campaign.json', DEFAULT_CAMPAIGNS);
    let list = normalizeCampaigns(raw);

    // Handle bulk / reorder action
    if (body.action === "reorder" && Array.isArray(body.items)) {
      list = body.items;
      await saveResilientFallback('spotlight_campaign.json', list);
      return NextResponse.json({ success: true, campaigns: list });
    }

    // Add new campaign
    const newCampaign = {
      id: body.id || Date.now(),
      enabled: body.enabled !== undefined ? Boolean(body.enabled) : true,
      badge: body.badge || "🌟 Spotlight Campaign",
      title: body.title || "New Campaign",
      tagline: body.tagline || "",
      image: body.image || "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&auto=format&fit=crop&q=80",
      target_amount: Number(body.target_amount) || 100000,
      raised_amount: Number(body.raised_amount) || 0,
      donors_count: Number(body.donors_count) || 0,
      donate_url: body.donate_url || "/causes",
      days_left: body.days_left !== undefined ? Number(body.days_left) : 30
    };

    list.unshift(newCampaign); // Put newest at the front
    await saveResilientFallback('spotlight_campaign.json', list);

    return NextResponse.json({ success: true, campaign: newCampaign, campaigns: list });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT: Update an existing campaign by ID
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const raw = await getResilientData('spotlight_campaign.json', DEFAULT_CAMPAIGNS);
    let list = normalizeCampaigns(raw);

    // If reordering
    if (body.action === "reorder" && Array.isArray(body.items)) {
      list = body.items;
      await saveResilientFallback('spotlight_campaign.json', list);
      return NextResponse.json({ success: true, campaigns: list });
    }

    if (!body.id) {
      return NextResponse.json({ success: false, error: "Campaign ID is required for update" }, { status: 400 });
    }

    const index = list.findIndex((c: any) => String(c.id) === String(body.id));
    if (index === -1) {
      return NextResponse.json({ success: false, error: "Campaign not found" }, { status: 404 });
    }

    list[index] = {
      ...list[index],
      ...body,
      id: list[index].id,
      target_amount: body.target_amount !== undefined ? Number(body.target_amount) : list[index].target_amount,
      raised_amount: body.raised_amount !== undefined ? Number(body.raised_amount) : list[index].raised_amount,
      donors_count: body.donors_count !== undefined ? Number(body.donors_count) : list[index].donors_count,
      days_left: body.days_left !== undefined ? Number(body.days_left) : list[index].days_left,
      enabled: body.enabled !== undefined ? Boolean(body.enabled) : list[index].enabled
    };

    await saveResilientFallback('spotlight_campaign.json', list);

    return NextResponse.json({ success: true, campaign: list[index], campaigns: list });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE: Remove campaign by ID
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: "Missing ID parameter" }, { status: 400 });
    }

    const raw = await getResilientData('spotlight_campaign.json', DEFAULT_CAMPAIGNS);
    let list = normalizeCampaigns(raw);

    list = list.filter((c: any) => String(c.id) !== String(id));
    await saveResilientFallback('spotlight_campaign.json', list);

    return NextResponse.json({ success: true, message: "Campaign deleted successfully", campaigns: list });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
