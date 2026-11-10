import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getResilientData, resilientDelete, resilientPost, resilientPut } from '@/lib/db-fallback';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET all success stories
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('success_stories')
      .select('*')
      .order('id', { ascending: true });

    if (!error && data && data.length > 0) {
      return NextResponse.json(data, {
        headers: { 'Cache-Control': 'no-store, max-age=0' }
      });
    }
  } catch (err) {}

  const successStories = await getResilientData('success_stories.json', []);
  return NextResponse.json(successStories, {
    headers: { 'Cache-Control': 'no-store, max-age=0' }
  });
}

// POST a new success story
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { image, title, desc } = body;

    if (!image || !title || !desc) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const result = await resilientPost({
      table: 'success_stories',
      fallbackFile: 'success_stories.json',
      bodyData: { image, title, desc }
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT (Edit) a success story
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, image, title, desc } = body;

    if (!id || !image || !title || !desc) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const result = await resilientPut({
      table: 'success_stories',
      idOrKey: id,
      fallbackFile: 'success_stories.json',
      bodyData: { image, title, desc }
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE a success story
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const idStr = searchParams.get('id');
    if (!idStr) {
      return NextResponse.json({ success: false, error: "ID missing" }, { status: 400 });
    }

    const id = parseInt(idStr, 10);
    const result = await resilientDelete({
      table: 'success_stories',
      idOrKey: id,
      fallbackFile: 'success_stories.json'
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
