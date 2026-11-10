import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getResilientData, resilientDelete, resilientPost, resilientPut } from '@/lib/db-fallback';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET all static page media settings
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('page_media')
      .select('*')
      .order('title', { ascending: true });

    if (!error && data && data.length > 0) {
      return NextResponse.json(data, {
        headers: { 'Cache-Control': 'no-store, max-age=0' }
      });
    }
  } catch (err) {}

  const media = await getResilientData('page_media.json', []);
  return NextResponse.json(media, {
    headers: { 'Cache-Control': 'no-store, max-age=0' }
  });
}

// POST a new page media config setting
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { key, url, title, type } = body;

    if (!key || !url || !title || !type) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const result = await resilientPost({
      table: 'page_media',
      fallbackFile: 'page_media.json',
      bodyData: { key, url, title, type },
      idField: 'key'
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT (Edit) a specific page media mapping settings
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { key, url, title, type } = body;

    if (!key || !url || !title || !type) {
      return NextResponse.json({ success: false, error: "Key, Title, URL and Type are required" }, { status: 400 });
    }

    const result = await resilientPut({
      table: 'page_media',
      idOrKey: key,
      idField: 'key',
      fallbackFile: 'page_media.json',
      bodyData: { url, title, type }
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE a specific page media config setting
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    if (!key) {
      return NextResponse.json({ success: false, error: "Key parameter missing" }, { status: 400 });
    }

    const result = await resilientDelete({
      table: 'page_media',
      idOrKey: key,
      idField: 'key',
      fallbackFile: 'page_media.json'
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
