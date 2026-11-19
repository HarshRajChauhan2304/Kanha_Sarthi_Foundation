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

    // 1. Persist orderedIds to resilient fallback reviews_order.json
    await saveResilientFallback('reviews_order.json', orderedIds);

    // 2. Update local reviews.json fallback
    const fallbackPath = getFallbackPath('reviews.json');
    let updatedReviews: any[] = [];
    if (fs.existsSync(fallbackPath)) {
      try {
        const fileContent = fs.readFileSync(fallbackPath, 'utf-8');
        const reviews = JSON.parse(fileContent);
        if (Array.isArray(reviews)) {
          const reviewMap = new Map();
          reviews.forEach((r: any) => reviewMap.set(String(r.id), r));

          orderedIds.forEach((id: any, index: number) => {
            const item = reviewMap.get(String(id));
            if (item) {
              item.order_index = index;
              updatedReviews.push(item);
              reviewMap.delete(String(id));
            }
          });

          // Append any remaining reviews
          reviewMap.forEach((item) => {
            item.order_index = updatedReviews.length;
            updatedReviews.push(item);
          });

          await saveResilientFallback('reviews.json', updatedReviews);
        }
      } catch (err) {
        console.error("Failed to update reviews.json reorder:", err);
      }
    }

    // 3. Update Supabase reviews table if possible
    try {
      for (let i = 0; i < orderedIds.length; i++) {
        const id = orderedIds[i];
        await supabaseAdmin
          .from('reviews')
          .update({ order_index: i })
          .eq('id', id);
      }
    } catch (dbErr) {
      console.warn("Could not update order_index in Supabase reviews table:", dbErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Reviews reordered successfully',
      orderedIds,
      reviews: updatedReviews
    });
  } catch (error: any) {
    console.error("Error reordering reviews:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
