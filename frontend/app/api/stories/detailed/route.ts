import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getResilientData, resilientDelete, resilientPost, resilientPut } from '@/lib/db-fallback';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET all detailed stories
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('detailed_stories')
      .select('*')
      .order('id', { ascending: true });

    if (!error && data && data.length > 0) {
      return NextResponse.json(data, {
        headers: { 'Cache-Control': 'no-store, max-age=0' }
      });
    }
  } catch (err) {}

  const detailedStories = await getResilientData('detailed_stories.json', []);
  return NextResponse.json(detailedStories, {
    headers: { 'Cache-Control': 'no-store, max-age=0' }
  });
}

// POST new detailed story
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const result = await resilientPost({
      table: 'detailed_stories',
      fallbackFile: 'detailed_stories.json',
      bodyData: {
        title: body.title || "New Story of Hope",
        category: body.category || "Food Relief",
        desc: body.desc || "",
        image: body.image || "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=600&auto=format&fit=crop&q=80",
        stats: body.stats || "",
        date: body.date || "July 2026"
      }
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT (Edit) detailed story
export async function PUT(request: Request) {
  try {
    const body = await request.json();

    const result = await resilientPut({
      table: 'detailed_stories',
      idOrKey: body.id,
      fallbackFile: 'detailed_stories.json',
      bodyData: {
        title: body.title,
        category: body.category,
        desc: body.desc,
        image: body.image,
        stats: storyStatsString(body), // handle compatibility
        date: body.date
      }
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Helper to keep stats string
function storyStatsString(body: any) {
  return body.stats || "";
}

// DELETE detailed story
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const idStr = searchParams.get('id');
    if (!idStr) {
      return NextResponse.json({ success: false, error: "ID missing" }, { status: 400 });
    }

    const id = parseInt(idStr, 10);
    const result = await resilientDelete({
      table: 'detailed_stories',
      idOrKey: id,
      fallbackFile: 'detailed_stories.json'
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
