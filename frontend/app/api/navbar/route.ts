import { NextResponse } from 'next/server';
import { getConfig, saveConfig } from '@/lib/config-storage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const defaultNavbar = {
  logo: "/kanha_logo_round.png",
  name: "",
  fontFamily: "Outfit",
  fontSize: 20,
  logoSize: 80,
  navItems: [
    { label: "Home", href: "/" },
    { label: "Causes", href: "/causes" },
    { label: "Our Impact", href: "/impacts" },
    { label: "About Us", href: "/about" },
    { label: "Contact", href: "/contact" }
  ]
};

export async function GET() {
  try {
    const data = await getConfig('navbar', defaultNavbar, 'navbar.json');
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    });
  } catch (error) {
    console.error('Error reading navbar config:', error);
    return NextResponse.json(defaultNavbar, {
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    });
  }
}

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    if (typeof payload !== 'object' || payload === null) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const existingConfig = await getConfig('navbar', defaultNavbar, 'navbar.json');

    const newConfig = {
      logo: typeof payload.logo === 'string' ? payload.logo : (existingConfig.logo || ''),
      name: typeof payload.name === 'string' ? payload.name : (existingConfig.name || ''),
      fontFamily: typeof payload.fontFamily === 'string' ? payload.fontFamily : (existingConfig.fontFamily || 'Outfit'),
      fontSize: typeof payload.fontSize === 'number' ? payload.fontSize : (existingConfig.fontSize || 20),
      logoSize: typeof payload.logoSize === 'number' ? payload.logoSize : (existingConfig.logoSize || 104),
      navItems: Array.isArray(payload.navItems) ? payload.navItems : (existingConfig.navItems || defaultNavbar.navItems)
    };

    const saved = await saveConfig('navbar', newConfig, 'navbar.json');
    return NextResponse.json(saved, {
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    });
  } catch (error: any) {
    console.error('Error writing navbar config:', error);
    return NextResponse.json({ error: error?.message || 'Failed to write navbar config' }, { status: 500 });
  }
}
