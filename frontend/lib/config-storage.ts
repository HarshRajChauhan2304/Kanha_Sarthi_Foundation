import fs from 'fs';
import path from 'path';
import { supabaseAdmin } from './supabase';
import { getFallbackPath } from './db-fallback';

/**
 * Universal configuration storage that works seamlessly on:
 * 1. Cloud / Serverless (e.g., Vercel, Netlify) with read-only filesystems (using Supabase Storage)
 * 2. Local development environments (using local JSON files + Supabase Storage sync)
 */
export async function getConfig<T>(configKey: string, defaultData: T, fallbackFile: string): Promise<T> {
  // 1. Try reading from Supabase Storage first (persists across deployments)
  try {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const { data, error } = await supabaseAdmin.storage
        .from('uploads')
        .download(`configs/${configKey}.json`);

      if (!error && data) {
        const text = await data.text();
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === 'object') {
          return parsed as T;
        }
      }
    }
  } catch (storageErr) {
    console.warn(`Supabase storage read failed for configs/${configKey}.json:`, storageErr);
  }

  // 2. Fallback: Read from local JSON file
  try {
    const localPath = getFallbackPath(fallbackFile);
    if (fs.existsSync(localPath)) {
      const fileData = fs.readFileSync(localPath, 'utf-8');
      const parsed = JSON.parse(fileData);
      if (parsed && typeof parsed === 'object') {
        // Asynchronously sync local data to Supabase Storage so it is available in cloud
        syncToCloudStorage(configKey, parsed).catch(() => {});
        return parsed as T;
      }
    }
  } catch (fsErr) {
    console.warn(`Local file read failed for ${fallbackFile}:`, fsErr);
  }

  // 3. Fallback to default
  return defaultData;
}

/**
 * Save configuration to Supabase Storage (cloud-safe) and local file (if writable).
 */
export async function saveConfig<T extends Record<string, any>>(configKey: string, data: T, fallbackFile: string): Promise<T> {
  let cloudSaved = false;

  // 1. Save to Supabase Storage (works on read-only environments like Vercel)
  try {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const jsonBuffer = Buffer.from(JSON.stringify(data, null, 2), 'utf-8');
      const { error } = await supabaseAdmin.storage
        .from('uploads')
        .upload(`configs/${configKey}.json`, jsonBuffer, {
          contentType: 'application/json',
          upsert: true
        });

      if (!error) {
        cloudSaved = true;
      } else {
        console.warn(`Supabase storage upload error for configs/${configKey}.json:`, error.message);
      }
    }
  } catch (storageErr) {
    console.warn(`Supabase storage exception for configs/${configKey}.json:`, storageErr);
  }

  // 2. Safe local file write (wrapped in try-catch so EROFS/read-only does not crash)
  try {
    const localPath = getFallbackPath(fallbackFile);
    const dir = path.dirname(localPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(localPath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (fsErr: any) {
    // If running in a read-only filesystem (e.g., Vercel EROFS), do not throw if cloud saved
    if (!cloudSaved) {
      console.error(`Failed to write local fallback file ${fallbackFile} and cloud save was unsuccessful:`, fsErr);
      throw fsErr;
    } else {
      console.warn(`Local fs write skipped (${fsErr?.code || 'read-only'}); data safely persisted in Supabase Storage.`);
    }
  }

  return data;
}

async function syncToCloudStorage(configKey: string, data: any) {
  try {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const jsonBuffer = Buffer.from(JSON.stringify(data, null, 2), 'utf-8');
      await supabaseAdmin.storage
        .from('uploads')
        .upload(`configs/${configKey}.json`, jsonBuffer, {
          contentType: 'application/json',
          upsert: true
        });
    }
  } catch {}
}
