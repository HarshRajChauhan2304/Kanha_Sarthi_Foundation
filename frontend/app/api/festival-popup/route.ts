import { NextResponse } from 'next/server';
import { getResilientData, saveResilientFallback } from '@/lib/db-fallback';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DEFAULT_POPUP = {
  enabled: true,
  badge: "🎉 Special Festival Appeal",
  title: "Spread Festive Smiles With Kanha Foundation! 🪔",
  subtitle: "Join our festive drive to distribute dry ration kits, sweets, and warm clothes to hundreds of vulnerable families and slum children.",
  image: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop&q=80",
  donate_text: "Donate Now & Share Joy",
  donate_url: "/donate"
};

// GET festival popup data
export async function GET() {
  try {
    const data = await getResilientData('festival_popup.json', DEFAULT_POPUP);
    return NextResponse.json(data || DEFAULT_POPUP, {
      headers: { 'Cache-Control': 'no-store, max-age=0' }
    });
  } catch (error: any) {
    return NextResponse.json(DEFAULT_POPUP);
  }
}

// POST/PUT to update festival popup data
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const current = await getResilientData('festival_popup.json', DEFAULT_POPUP);

    const updated = {
      ...current,
      ...body,
      enabled: body.enabled !== undefined ? Boolean(body.enabled) : current.enabled
    };

    await saveResilientFallback('festival_popup.json', updated);

    return NextResponse.json({ success: true, popup: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  return POST(request);
}

