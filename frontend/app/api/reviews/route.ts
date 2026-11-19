import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';
import { getFallbackPath, getResilientData, resilientDelete, resilientPost, resilientPut } from '@/lib/db-fallback';

export const dynamic = 'force-dynamic';

// GET all reviews
export async function GET() {
  let reviews: any[] = [];
  let useFallback = false;

  const orderedIds: any[] = await getResilientData('reviews_order.json', []);

  try {
    const { data, error } = await supabase
      .from('reviews')
      .select('*');

    if (error || !data || data.length === 0) {
      useFallback = true;
    } else {
      reviews = data.map(item => ({
        id: item.id,
        title: item.title,
        desc: item.desc_text,
        author: item.author,
        video: item.video,
        order_index: item.order_index
      }));
    }
  } catch (err) {
    useFallback = true;
  }

  if (useFallback) {
    try {
      const fallbackReviews = await getResilientData('reviews.json', []);
      if (Array.isArray(fallbackReviews) && fallbackReviews.length > 0) {
        reviews = fallbackReviews;
      }
    } catch (e) {
      console.error("Failed to read reviews fallback JSON:", e);
    }
  }

  // Sort by orderedIds if present
  if (Array.isArray(orderedIds) && orderedIds.length > 0) {
    const orderMap = new Map<string, number>();
    orderedIds.forEach((id: any, index: number) => {
      orderMap.set(String(id), index);
    });

    reviews.sort((a: any, b: any) => {
      const orderA = orderMap.has(String(a.id)) ? orderMap.get(String(a.id))! : 9999;
      const orderB = orderMap.has(String(b.id)) ? orderMap.get(String(b.id))! : 9999;
      if (orderA !== orderB) return orderA - orderB;
      return (a.id || 0) - (b.id || 0);
    });
  } else {
    reviews.sort((a: any, b: any) => {
      if (typeof a.order_index === 'number' && typeof b.order_index === 'number') {
        return a.order_index - b.order_index;
      }
      return (a.id || 0) - (b.id || 0);
    });
  }

  return NextResponse.json(reviews, {
    headers: {
      'Cache-Control': 'no-store, max-age=0'
    }
  });
}

// POST new review
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const result = await resilientPost({
      table: 'reviews',
      fallbackFile: 'reviews.json',
      bodyData: {
        title: body.title,
        desc_text: body.desc,
        author: body.author,
        video: body.video || "/DIL%20KAHTA%20HAI.mp4"
      }
    });

    if (result.success && result.item) {
      const mapped = {
        id: result.item.id,
        title: result.item.title,
        desc: result.item.desc_text || result.item.desc,
        author: result.item.author,
        video: result.item.video
      };
      return NextResponse.json({ success: true, review: mapped });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT (Edit) review
export async function PUT(request: Request) {
  try {
    const body = await request.json();

    const result = await resilientPut({
      table: 'reviews',
      idOrKey: body.id,
      fallbackFile: 'reviews.json',
      bodyData: {
        title: body.title,
        desc_text: body.desc,
        author: body.author,
        video: body.video
      }
    });

    if (result.success && result.item) {
      const mapped = {
        id: result.item.id,
        title: result.item.title,
        desc: result.item.desc_text || result.item.desc,
        author: result.item.author,
        video: result.item.video
      };
      return NextResponse.json({ success: true, review: mapped });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE review
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const idStr = searchParams.get('id');
    if (!idStr) {
      return NextResponse.json({ success: false, error: "ID missing" }, { status: 400 });
    }

    const id = parseInt(idStr, 10);
    const result = await resilientDelete({
      table: 'reviews',
      idOrKey: id,
      fallbackFile: 'reviews.json'
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
