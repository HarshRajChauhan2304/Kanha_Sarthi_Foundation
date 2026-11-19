import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import fs from 'fs';
import { getFallbackPath } from '@/lib/db-fallback';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const fallbackPath = getFallbackPath('monthly_donation.json');
    if (fs.existsSync(fallbackPath)) {
      const fileContent = fs.readFileSync(fallbackPath, 'utf-8');
      const data = JSON.parse(fileContent);
      return NextResponse.json(data, {
        headers: {
          'Cache-Control': 'no-store, max-age=0'
        }
      });
    }

    return NextResponse.json([], { status: 404 });
  } catch (error: any) {
    console.error("Error reading monthly_donation config:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const fallbackPath = getFallbackPath('monthly_donation.json');

    let currentList: any[] = [];
    if (fs.existsSync(fallbackPath)) {
      try {
        currentList = JSON.parse(fs.readFileSync(fallbackPath, 'utf-8'));
      } catch (_) {}
    }

    if (body.categories && Array.isArray(body.categories)) {
      // Overwrite full categories list
      currentList = body.categories;
    } else if (body.id) {
      // Update specific category by id (education, healthcare, food)
      const idx = currentList.findIndex((item: any) => item.id === body.id);
      if (idx !== -1) {
        currentList[idx] = {
          ...currentList[idx],
          ...body
        };
      } else {
        currentList.push(body);
      }
    } else {
      return NextResponse.json({ success: false, error: "Invalid payload format" }, { status: 400 });
    }

    fs.writeFileSync(fallbackPath, JSON.stringify(currentList, null, 2), 'utf-8');

    // Also attempt resilient sync to Supabase if config table exists
    try {
      await supabaseAdmin
        .from('site_settings')
        .upsert({ key: 'monthly_donation', value: currentList });
    } catch (_) {}

    return NextResponse.json({
      success: true,
      message: "Monthly donation settings updated successfully",
      categories: currentList
    });
  } catch (error: any) {
    console.error("Error updating monthly donation config:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
