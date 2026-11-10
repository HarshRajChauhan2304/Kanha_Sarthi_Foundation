import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getResilientData, resilientDelete, resilientPost, resilientPut } from '@/lib/db-fallback';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DEFAULT_CATEGORIES = [
  { id: 1, name: "Birthday Giving" },
  { id: 2, name: "Anniversary Giving" },
  { id: 3, name: "Animal" },
  { id: 4, name: "Giving To The Needy" },
  { id: 5, name: "Nature" },
  { id: 6, name: "Memorial Giving" },
  { id: 7, name: "Women Care" },
  { id: 8, name: "Education" }
];

// GET all categories
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('id', { ascending: true });

    if (!error && data && data.length > 0) {
      return NextResponse.json(data, {
        headers: { 'Cache-Control': 'no-store, max-age=0' }
      });
    }
  } catch (err) {}

  const categories = await getResilientData('categories.json', DEFAULT_CATEGORIES);
  return NextResponse.json(categories, {
    headers: { 'Cache-Control': 'no-store, max-age=0' }
  });
}

// POST new category
export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ success: false, error: "Category name is required" }, { status: 400 });
    }

    const result = await resilientPost({
      table: 'categories',
      fallbackFile: 'categories.json',
      idOrKey: null,
      bodyData: {
        name: body.name.trim()
      }
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE category
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const idStr = searchParams.get('id');
    if (!idStr) {
      return NextResponse.json({ success: false, error: "ID parameter missing" }, { status: 400 });
    }

    const id = isNaN(Number(idStr)) ? idStr : parseInt(idStr, 10);
    const result = await resilientDelete({
      table: 'categories',
      idOrKey: id,
      fallbackFile: 'categories.json'
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT (Edit) existing category
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    if (!body.id) {
      return NextResponse.json({ success: false, error: "ID is required" }, { status: 400 });
    }
    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ success: false, error: "Category name is required" }, { status: 400 });
    }

    const result = await resilientPut({
      table: 'categories',
      idOrKey: body.id,
      fallbackFile: 'categories.json',
      bodyData: {
        name: body.name.trim()
      }
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

