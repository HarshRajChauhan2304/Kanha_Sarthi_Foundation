import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getResilientData, resilientDelete, resilientPost, resilientPut, saveResilientFallback } from '@/lib/db-fallback';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET all directors and volunteers highlights
export async function GET() {
  let directors: any[] = [];
  let volunteers: any[] = [];
  let useFallback = false;
  let dbApps: any[] = [];

  try {
    const { data: dbDirs, error: dirError } = await supabase
      .from('directors')
      .select('*')
      .order('id', { ascending: true });

    const { data: dbVols, error: volError } = await supabase
      .from('volunteers')
      .select('*')
      .order('id', { ascending: true });

    const { data: dbApprovedApps, error: appError } = await supabase
      .from('volunteer_applications')
      .select('*')
      .eq('status', 'Approved');

    if (dirError || volError || !dbDirs || !dbVols || dbDirs.length === 0) {
      useFallback = true;
    } else {
      directors = dbDirs;
      volunteers = dbVols || [];
      dbApps = dbApprovedApps || [];
    }
  } catch (err) {
    useFallback = true;
  }

  // Load volunteer applications fallback
  const localApps = await getResilientData('volunteer_applications.json', []);

  // Always load fallback JSON to ensure custom order and offline support
  const parsed = await getResilientData('about_highlights.json', { directors: [], volunteers: [] });
  const fallbackDirs = parsed.directors || [];
  const fallbackVols = parsed.volunteers || [];

  if (useFallback || directors.length === 0) {
    directors = fallbackDirs;
    volunteers = fallbackVols;
  }

  // Resolve approved applications (from Supabase or local fallback)
  const approvedApps = dbApps.length > 0 ? dbApps : localApps.filter((a: any) => a.status === 'Approved');

  // Map approved applications to volunteer highlight format
  const appVolunteers = approvedApps.map((item: any) => {
    let quote = item.motivation || "Proud to be a volunteer at Kanha Foundation!";
    let profile_photo = item.profile_photo || "";
    try {
      if (item.motivation && item.motivation.trim().startsWith('{')) {
        const parsed = JSON.parse(item.motivation);
        quote = parsed.text || quote;
        profile_photo = parsed.profile_photo || profile_photo;
      }
    } catch (e) {}

    return {
      id: `app-${item.id}`,
      name: item.name,
      role: "Volunteer",
      image: profile_photo || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
      quote: quote
    };
  });

  // Merge lists to avoid duplicates (case-insensitive check by name)
  const mergedVolunteers = [...volunteers];
  appVolunteers.forEach((appVol: any) => {
    const exists = mergedVolunteers.some(
      (v: any) => v.name && v.name.trim().toLowerCase() === appVol.name.trim().toLowerCase()
    );
    if (!exists) {
      mergedVolunteers.push(appVol);
    }
  });

  // Respect ordered sequence if configured in highlights
  if (fallbackDirs.length > 0) {
    const dirOrderMap = new Map<string, number>();
    fallbackDirs.forEach((item: any, idx: number) => {
      if (item.id !== undefined) dirOrderMap.set(String(item.id), idx);
      if (item.name) dirOrderMap.set(item.name.trim().toLowerCase(), idx);
    });
    directors.sort((a: any, b: any) => {
      const orderA = dirOrderMap.has(String(a.id)) ? dirOrderMap.get(String(a.id))! : (dirOrderMap.has(a.name?.trim().toLowerCase()) ? dirOrderMap.get(a.name?.trim().toLowerCase())! : 9999);
      const orderB = dirOrderMap.has(String(b.id)) ? dirOrderMap.get(String(b.id))! : (dirOrderMap.has(b.name?.trim().toLowerCase()) ? dirOrderMap.get(b.name?.trim().toLowerCase())! : 9999);
      return orderA - orderB;
    });
  }

  if (fallbackVols.length > 0) {
    const volOrderMap = new Map<string, number>();
    fallbackVols.forEach((item: any, idx: number) => {
      if (item.id !== undefined) volOrderMap.set(String(item.id), idx);
      if (item.name) volOrderMap.set(item.name.trim().toLowerCase(), idx);
    });
    mergedVolunteers.sort((a: any, b: any) => {
      const orderA = volOrderMap.has(String(a.id)) ? volOrderMap.get(String(a.id))! : (volOrderMap.has(a.name?.trim().toLowerCase()) ? volOrderMap.get(a.name?.trim().toLowerCase())! : 9999);
      const orderB = volOrderMap.has(String(b.id)) ? volOrderMap.get(String(b.id))! : (volOrderMap.has(b.name?.trim().toLowerCase()) ? volOrderMap.get(b.name?.trim().toLowerCase())! : 9999);
      return orderA - orderB;
    });
  }

  return NextResponse.json({
    directors,
    volunteers: mergedVolunteers
  });
}

// POST new highlight record
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, name, role, image, quote } = body;

    if (type !== "directors" && type !== "volunteers") {
      return NextResponse.json({ success: false, error: "Invalid highlight type specified" }, { status: 400 });
    }

    const result = await resilientPost({
      table: type,
      fallbackFile: 'about_highlights.json',
      bodyData: { name, role, image, quote }
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT (Edit) existing highlight record or reorder items
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { type, id, name, role, image, quote, action, items } = body;

    if (type !== "directors" && type !== "volunteers") {
      return NextResponse.json({ success: false, error: "Invalid highlight type specified" }, { status: 400 });
    }

    // Handle Rearrange / Reorder action
    if (action === "reorder" && Array.isArray(items)) {
      const currentData: any = await getResilientData('about_highlights.json', { directors: [], volunteers: [] });
      currentData[type] = items;
      await saveResilientFallback('about_highlights.json', currentData);

      // Attempt Supabase order_index update if table supports it (non-blocking)
      try {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.id && typeof item.id === 'number') {
            await supabase.from(type).update({ order_index: i } as any).eq('id', item.id);
          }
        }
      } catch (dbErr) {}

      return NextResponse.json({ success: true, message: "Order updated successfully", [type]: items });
    }

    const result = await resilientPut({
      table: type,
      idOrKey: id,
      fallbackFile: 'about_highlights.json',
      bodyData: { name, role, image, quote }
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE highlight record
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const idStr = searchParams.get('id');

    if (!type || !idStr) {
      return NextResponse.json({ success: false, error: "Type or ID parameter missing" }, { status: 400 });
    }

    if (type !== "directors" && type !== "volunteers") {
      return NextResponse.json({ success: false, error: "Invalid type list specified" }, { status: 400 });
    }

    const id = parseInt(idStr, 10);

    const result = await resilientDelete({
      table: type,
      idOrKey: id,
      fallbackFile: 'about_highlights.json'
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
