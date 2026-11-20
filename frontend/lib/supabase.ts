import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cwpfhfcxpeqiihiqxqtu.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3cGZoZmN4cGVxaWloaXF4cXR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwNTg0NjUsImV4cCI6MjA5ODYzNDQ2NX0.UE1fItwizJZ566yU8opniBYi3P5LseopfQvXxQA6q-Y";

const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn("Supabase URL or Anon Key is missing. Database requests will fail.");
}

// Client for public reading operations (RLS compliant)
export const supabase = (isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : new Proxy({} as any, {
      get: (target, prop) => {
        if (prop === 'then') return undefined;
        return () => {
          throw new Error("Supabase public client is not configured.");
        };
      }
    })) as SupabaseClient;

// Server-side only Admin client for backend operations (bypasses RLS)
const getSupabaseAdmin = (): SupabaseClient => {
  if (typeof window !== 'undefined') {
    throw new Error("FATAL SECURITY VIOLATION: supabaseAdmin cannot be accessed on the client.");
  }
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return supabase; // Fall back to anon client if service role is not set
  }
  return createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  });
};

export const supabaseAdmin = (typeof window === 'undefined'
  ? getSupabaseAdmin()
  : new Proxy({} as any, {
      get: () => {
        throw new Error("FATAL SECURITY VIOLATION: supabaseAdmin cannot be accessed in browser / client runtime.");
      }
    })) as SupabaseClient;
