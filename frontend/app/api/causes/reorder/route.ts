import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import fs from 'fs';
import { getFallbackPath, saveResilientFallback } from '@/lib/db-fallback';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orderedIds } = body; // Array of IDs in desired order: [3, 1, 4, ...]

    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return NextResponse.json({ success: false, error: 'orderedIds array is required' }, { status: 400 });
    }

    // 1. Persist orderedIds to resilient fallback causes_order.json (Cloud Storage + Memory + Disk)
    await saveResilientFallback('causes_order.json', orderedIds);

    // 2. Update local causes.json fallback
    const fallbackPath = getFallbackPath('causes.json');
    let updatedCauses: any[] = [];
    if (fs.existsSync(fallbackPath)) {
      try {
        const fileContent = fs.readFileSync(fallbackPath, 'utf-8');
        const causes = JSON.parse(fileContent);
        if (Array.isArray(causes)) {
          // Map to new order
          const causeMap = new Map();
          causes.forEach((c: any) => causeMap.set(String(c.id), c));

          orderedIds.forEach((id: any, index: number) => {
            const item = causeMap.get(String(id));
            if (item) {
              item.order_index = index;
              updatedCauses.push(item);
              causeMap.delete(String(id));
            }
          });

          // Append any remaining causes not in orderedIds
          causeMap.forEach((item) => {
            item.order_index = updatedCauses.length;
            updatedCauses.push(item);
          });

          await saveResilientFallback('causes.json', updatedCauses);
        }
      } catch (err) {
        console.error("Failed to update causes.json reorder:", err);
      }
    }

    // 3. Update Supabase causes table if order_index column exists
    try {
      for (let i = 0; i < orderedIds.length; i++) {
        const id = orderedIds[i];
        await supabaseAdmin
          .from('causes')
          .update({ order_index: i })
          .eq('id', id);
      }
    } catch (dbErr) {
      console.warn("Could not update order_index in Supabase causes table:", dbErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Causes reordered successfully',
      orderedIds,
      causes: updatedCauses
    });
  } catch (error: any) {
    console.error("Error reordering causes:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
