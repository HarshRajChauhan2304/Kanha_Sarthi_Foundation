import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getResilientData, resilientDelete, resilientPost, resilientPut } from '@/lib/db-fallback';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET all static page texts configuration settings
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('page_texts')
      .select('*')
      .order('title', { ascending: true });

    if (!error && data && data.length > 0) {
      return NextResponse.json(data, {
        headers: { 'Cache-Control': 'no-store, max-age=0' }
      });
    }
  } catch (err) {}

  const texts = await getResilientData('page_texts.json', []);
  return NextResponse.json(texts, {
    headers: { 'Cache-Control': 'no-store, max-age=0' }
  });
}

// POST a new page text configuration setting
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { key, value, title } = body;

    if (!key || !value || !title) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const result = await resilientPost({
      table: 'page_texts',
      fallbackFile: 'page_texts.json',
      bodyData: { key, value, title },
      idField: 'key'
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT (Edit) a specific page text mapping settings
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { key, value, title } = body;

    if (!key || !value || !title) {
      return NextResponse.json({ success: false, error: "Key, Title and Value are required" }, { status: 400 });
    }

    const result = await resilientPut({
      table: 'page_texts',
      idOrKey: key,
      idField: 'key',
      fallbackFile: 'page_texts.json',
      bodyData: { value, title }
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE a specific page text configuration setting
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    if (!key) {
      return NextResponse.json({ success: false, error: "Key parameter missing" }, { status: 400 });
    }

    const result = await resilientDelete({
      table: 'page_texts',
      idOrKey: key,
      idField: 'key',
      fallbackFile: 'page_texts.json'
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
