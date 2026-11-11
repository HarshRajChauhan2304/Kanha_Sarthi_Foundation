import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getResilientData, resilientDelete, resilientPost, resilientPut } from '@/lib/db-fallback';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const defaultContactInfo = [
  { id: 1, title: "Registered Address", value: "Kanha Sarthi Foundation Office,\nRanchi, Jharkhand, 834001, India", type: "address", icon: "map-pin" },
  { id: 2, title: "Email Inquiry", value: "kanhasathifoundation223@gmail.com", type: "email", icon: "mail" },
  { id: 3, title: "WhatsApp Support", value: "+91 74881 64529", type: "whatsapp", icon: "whatsapp" }
];

// GET all contact details
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('contact_info')
      .select('*')
      .order('id', { ascending: true });

    if (!error && data && data.length > 0) {
      return NextResponse.json(data, {
        headers: {
          'Cache-Control': 'no-store, max-age=0'
        }
      });
    }
  } catch (err) {}

  const contactInfo = await getResilientData('contact_info.json', defaultContactInfo);

  return NextResponse.json(contactInfo, {
    headers: {
      'Cache-Control': 'no-store, max-age=0'
    }
  });
}

// POST a new contact detail
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, value, type, icon } = body;

    if (!title || !value || !type || !icon) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const result = await resilientPost({
      table: 'contact_info',
      fallbackFile: 'contact_info.json',
      bodyData: { title, value, type, icon },
      idField: 'id'
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT (Edit) an existing contact detail
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, title, value, type, icon } = body;

    if (!id || !title || !value || !type || !icon) {
      return NextResponse.json({ success: false, error: "ID and all details are required" }, { status: 400 });
    }

    const result = await resilientPut({
      table: 'contact_info',
      idOrKey: Number(id),
      idField: 'id',
      fallbackFile: 'contact_info.json',
      bodyData: { title, value, type, icon }
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE a contact detail
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: "ID parameter missing" }, { status: 400 });
    }

    const result = await resilientDelete({
      table: 'contact_info',
      idOrKey: Number(id),
      idField: 'id',
      fallbackFile: 'contact_info.json'
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
