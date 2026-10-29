import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cwpfhfcxpeqiihiqxqtu.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3cGZoZmN4cGVxaWloaXF4cXR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwNTg0NjUsImV4cCI6MjA5ODYzNDQ2NX0.UE1fItwizJZ566yU8opniBYi3P5LseopfQvXxQA6q-Y";
const fallbackServiceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3cGZoZmN4cGVxaWloaXF4cXR1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzA1ODQ2NSwiZXhwIjoyMDk4NjM0NDY1fQ.7Wrh-UUcFSe7fMmCMYeySPOtEnH-Lew-CV-MWI8reDA";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || fallbackServiceKey;

const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn("Supabase URL or Anon Key is missing. Database requests will fail.");
}

// Client for public reading operations (RLS compliant)
export const supabase = (isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : new Proxy({} as any, {
      get: (target, prop) => {
        if (prop === 'then') return undefined; // Avoid blocking async checks
        return () => {
          throw new Error("Supabase public client is not configured. Please check your NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.");
        };
      }
    })) as SupabaseClient;

// Admin client for backend writing/deleting (bypasses RLS)
export const supabaseAdmin = ((supabaseUrl && (supabaseServiceKey || supabaseAnonKey))
  ? createClient(
      supabaseUrl,
      supabaseServiceKey || supabaseAnonKey!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        }
      }
    )
  : new Proxy({} as any, {
      get: (target, prop) => {
        if (prop === 'then') return undefined; // Avoid blocking async checks
        return () => {
          throw new Error("Supabase admin client is not configured. Please check your SUPABASE_SERVICE_ROLE_KEY environment variable.");
        };
      }
    })) as SupabaseClient;


