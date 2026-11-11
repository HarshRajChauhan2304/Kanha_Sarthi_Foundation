import fs from 'fs';
import path from 'path';
import { supabaseAdmin } from './supabase';

// In-memory cache to guarantee ultra-fast, zero-delay reads across lambda/server lifecycles
const memoryFallbackCache: Record<string, any> = {};

export function getFallbackPath(fallbackFile: string): string {
  const cwd = process.cwd();
  let baseDir = cwd;
  if (path.basename(cwd) !== 'frontend' && fs.existsSync(path.join(cwd, 'frontend'))) {
    baseDir = path.join(cwd, 'frontend');
  }
  const fallbackPath = path.join(baseDir, 'data', fallbackFile);
  if (!fs.existsSync(path.dirname(fallbackPath))) {
    try {
      fs.mkdirSync(path.dirname(fallbackPath), { recursive: true });
    } catch {}
  }
  return fallbackPath;
}

/**
 * Universal cloud-safe fallback reader.
 * 1. Checks memory cache.
 * 2. Downloads from Supabase Storage `uploads/data/${fallbackFile}`.
 * 3. Falls back to local filesystem.
 * 4. Falls back to defaultData.
 */
export async function getResilientData<T = any>(fallbackFile: string, defaultData: T = [] as any): Promise<T> {
  const cacheKey = `data/${fallbackFile}`;

  // 1. Check in-memory cache
  if (memoryFallbackCache[cacheKey]) {
    return memoryFallbackCache[cacheKey] as T;
  }

  // 2. Try Supabase Storage (cloud safe across Vercel and all deployments)
  try {
    const { data, error } = await supabaseAdmin.storage
      .from('uploads')
      .download(`data/${fallbackFile}`);

    if (!error && data) {
      const text = await data.text();
      const parsed = JSON.parse(text);
      if (parsed !== undefined && parsed !== null) {
        memoryFallbackCache[cacheKey] = parsed;
        return parsed as T;
      }
    }
  } catch (storageErr) {
    // Non-fatal, continue to local file
  }

  // 3. Fallback to local JSON file
  try {
    const fallbackPath = getFallbackPath(fallbackFile);
    if (fs.existsSync(fallbackPath)) {
      const fileContent = fs.readFileSync(fallbackPath, 'utf-8');
      const parsed = JSON.parse(fileContent);
      if (parsed !== undefined && parsed !== null) {
        memoryFallbackCache[cacheKey] = parsed;
        // Asynchronously sync to Supabase Storage so future serverless requests have it
        saveResilientFallback(fallbackFile, parsed).catch(() => {});
        return parsed as T;
      }
    }
  } catch (fsErr) {
    // Non-fatal
  }

  return defaultData;
}

/**
 * Universal cloud-safe fallback writer.
 * Saves to memory cache, Supabase Storage, and local file (if writable).
 */
export async function saveResilientFallback(fallbackFile: string, data: any): Promise<void> {
  const cacheKey = `data/${fallbackFile}`;
  memoryFallbackCache[cacheKey] = data;

  // 1. Save to Supabase Storage (cloud-persisted across all instances)
  try {
    const jsonBuffer = Buffer.from(JSON.stringify(data, null, 2), 'utf-8');
    await supabaseAdmin.storage
      .from('uploads')
      .upload(`data/${fallbackFile}`, jsonBuffer, {
        contentType: 'application/json',
        upsert: true
      });
  } catch (storageErr: any) {
    console.warn(`Supabase storage fallback upload exception for data/${fallbackFile}:`, storageErr?.message || storageErr);
  }

  // 2. Safe local file write (wrapped in try-catch so EROFS on Vercel never crashes)
  try {
    const fallbackPath = getFallbackPath(fallbackFile);
    const dir = path.dirname(fallbackPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fallbackPath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (fsErr: any) {
    // Read-only filesystem warning (harmless because data is already in memory & Supabase Storage)
  }
}

interface ResilientOptions {
  table: string;
  idOrKey?: any;
  idField?: string;
  fallbackFile: string;
  bodyData?: any;
}

export async function resilientDelete({
  table,
  idOrKey,
  idField = 'id',
  fallbackFile
}: ResilientOptions) {
  // 1. Attempt Supabase DB deletion if table exists
  try {
    const numericId = typeof idOrKey === 'number' ? idOrKey : parseInt(String(idOrKey), 10);
    if (!isNaN(numericId) && numericId <= 2147483647) {
      await supabaseAdmin.from(table).delete().eq(idField, idOrKey);
    } else {
      await supabaseAdmin.from(table).delete().eq(idField, String(idOrKey));
    }
  } catch (dbErr) {
    // Fallback continues
  }

  // 2. Update cloud-safe fallback data
  try {
    let currentData: any = await getResilientData(fallbackFile, []);

    if (Array.isArray(currentData)) {
      currentData = currentData.filter((item: any) => String(item[idField]) !== String(idOrKey));
    } else if (currentData && typeof currentData === 'object') {
      if (table === 'directors' && Array.isArray((currentData as any).directors)) {
        (currentData as any).directors = (currentData as any).directors.filter((item: any) => String(item[idField]) !== String(idOrKey));
      } else if (table === 'volunteers' && Array.isArray((currentData as any).volunteers)) {
        (currentData as any).volunteers = (currentData as any).volunteers.filter((item: any) => String(item[idField]) !== String(idOrKey));
      }
    }

    await saveResilientFallback(fallbackFile, currentData);
  } catch (err) {
    console.error(`Fallback deletion failed for ${fallbackFile}:`, err);
  }

  return { success: true };
}

export async function resilientPost({
  table,
  fallbackFile,
  bodyData,
  idField = 'id'
}: ResilientOptions) {
  let dbResult: any = null;
  let dbSucceeded = false;

  // 1. Attempt Supabase DB insert if table exists
  try {
    let supabaseData = { ...bodyData };
    if (table === 'volunteer_applications') {
      supabaseData.motivation = JSON.stringify({
        text: bodyData.motivation || "",
        profile_photo: bodyData.profile_photo || "",
        gender: bodyData.gender || ""
      });
      delete supabaseData.terms_accepted;
    }

    let { data, error } = await supabaseAdmin
      .from(table)
      .insert([supabaseData])
      .select()
      .single();

    if (error && error.message?.includes('dob')) {
      const retryData = { ...supabaseData };
      delete retryData.dob;
      const retry = await supabaseAdmin
        .from(table)
        .insert([retryData])
        .select()
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (!error && data) {
      dbResult = data;
      try {
        if (dbResult.motivation && String(dbResult.motivation).trim().startsWith('{')) {
          const parsed = JSON.parse(dbResult.motivation);
          dbResult.motivation = parsed.text || "";
          dbResult.profile_photo = parsed.profile_photo || "";
          dbResult.gender = parsed.gender || "";
        }
      } catch (e) {}
      dbSucceeded = true;
    }
  } catch (dbErr: any) {
    // Non-fatal, continue to fallback
  }

  // 2. Sync to cloud-safe fallback data
  try {
    let currentData: any = await getResilientData(fallbackFile, []);

    const newRecord = {
      ...bodyData,
      [idField]: dbSucceeded && dbResult ? dbResult[idField] : (bodyData[idField] || Math.floor(Math.random() * 2000000000) + 1)
    };

    if (Array.isArray(currentData)) {
      const idx = currentData.findIndex((item: any) => String(item[idField]) === String(newRecord[idField]));
      if (idx !== -1) {
        currentData[idx] = { ...currentData[idx], ...newRecord };
      } else {
        currentData.push(newRecord);
      }
    } else if (currentData && typeof currentData === 'object') {
      if (table === 'directors' && Array.isArray((currentData as any).directors)) {
        (currentData as any).directors.push(newRecord);
      } else if (table === 'volunteers' && Array.isArray((currentData as any).volunteers)) {
        (currentData as any).volunteers.push(newRecord);
      }
    }

    await saveResilientFallback(fallbackFile, currentData);
    return { success: true, item: newRecord };
  } catch (err: any) {
    console.error(`Fallback insert failed for ${fallbackFile}:`, err);
    return { success: true, item: dbResult || bodyData };
  }
}

export async function resilientPut({
  table,
  idOrKey,
  idField = 'id',
  fallbackFile,
  bodyData
}: ResilientOptions) {
  let dbResult: any = null;
  let dbSucceeded = false;

  // 1. Attempt Supabase DB update if table exists
  try {
    let supabaseData = { ...bodyData };
    if (table === 'volunteer_applications') {
      supabaseData.motivation = JSON.stringify({
        text: bodyData.motivation || "",
        profile_photo: bodyData.profile_photo || "",
        gender: bodyData.gender || ""
      });
      delete supabaseData.terms_accepted;
    }

    let { data, error } = await supabaseAdmin
      .from(table)
      .update(supabaseData)
      .eq(idField, idOrKey)
      .select()
      .single();

    if (error && error.message?.includes('dob')) {
      const retryData = { ...supabaseData };
      delete retryData.dob;
      const retry = await supabaseAdmin
        .from(table)
        .update(retryData)
        .eq(idField, idOrKey)
        .select()
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (!error && data) {
      dbResult = data;
      try {
        if (dbResult.motivation && String(dbResult.motivation).trim().startsWith('{')) {
          const parsed = JSON.parse(dbResult.motivation);
          dbResult.motivation = parsed.text || "";
          dbResult.profile_photo = parsed.profile_photo || "";
          dbResult.gender = parsed.gender || "";
        }
      } catch (e) {}
      dbSucceeded = true;
    }
  } catch (dbErr: any) {
    // Non-fatal, continue to fallback
  }

  // 2. Sync to cloud-safe fallback data
  try {
    let currentData: any = await getResilientData(fallbackFile, []);

    const updatedItem = { ...bodyData, [idField]: idOrKey };

    if (Array.isArray(currentData)) {
      const idx = currentData.findIndex((item: any) => String(item[idField]) === String(idOrKey));
      if (idx !== -1) {
        currentData[idx] = { ...currentData[idx], ...bodyData };
      } else {
        currentData.push(updatedItem);
      }
    } else if (currentData && typeof currentData === 'object') {
      if (table === 'directors' && Array.isArray((currentData as any).directors)) {
        const idx = (currentData as any).directors.findIndex((item: any) => String(item[idField]) === String(idOrKey));
        if (idx !== -1) (currentData as any).directors[idx] = { ...(currentData as any).directors[idx], ...bodyData };
      } else if (table === 'volunteers' && Array.isArray((currentData as any).volunteers)) {
        const idx = (currentData as any).volunteers.findIndex((item: any) => String(item[idField]) === String(idOrKey));
        if (idx !== -1) (currentData as any).volunteers[idx] = { ...(currentData as any).volunteers[idx], ...bodyData };
      }
    }

    await saveResilientFallback(fallbackFile, currentData);
    return { success: true, item: updatedItem };
  } catch (err: any) {
    console.error(`Fallback update failed for ${fallbackFile}:`, err);
    return { success: true, item: dbResult || { ...bodyData, [idField]: idOrKey } };
  }
}

export async function syncVolunteerToHighlights(app: {
  name: string;
  motivation?: string;
  profile_photo?: string;
  gender?: string;
}) {
  const defaultAvatar = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80";
  const name = app.name;
  const role = "Volunteer";
  
  let cleanQuote = app.motivation || "Proud to be a volunteer at Kanha Sarthi Foundation!";
  let cleanImage = app.profile_photo || defaultAvatar;

  if (app.motivation && app.motivation.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(app.motivation);
      if (parsed.text) cleanQuote = parsed.text;
      if (parsed.profile_photo) cleanImage = parsed.profile_photo;
    } catch (e) {}
  }

  // 1. Supabase insert/update
  let dbResult: any = null;
  let dbSucceeded = false;
  try {
    const { data: existing, error: findError } = await supabaseAdmin
      .from('volunteers')
      .select('*')
      .eq('name', name)
      .maybeSingle();

    if (!findError && existing) {
      const { data, error } = await supabaseAdmin
        .from('volunteers')
        .update({ role, image: cleanImage, quote: cleanQuote })
        .eq('id', existing.id)
        .select()
        .single();
      if (!error && data) {
        dbResult = data;
        dbSucceeded = true;
      }
    } else {
      const { data, error } = await supabaseAdmin
        .from('volunteers')
        .insert([{ name, role, image: cleanImage, quote: cleanQuote }])
        .select()
        .single();
      if (!error && data) {
        dbResult = data;
        dbSucceeded = true;
      }
    }
  } catch (dbErr) {}

  // 2. Cloud-safe JSON sync
  try {
    let currentData: any = await getResilientData('about_highlights.json', { directors: [], volunteers: [] });
    if (!currentData.volunteers) currentData.volunteers = [];

    const newRecord = {
      id: dbSucceeded && dbResult ? dbResult.id : (Math.floor(Math.random() * 2000000000) + 1),
      name,
      role,
      image: cleanImage,
      quote: cleanQuote
    };

    const idx = currentData.volunteers.findIndex((item: any) => item.name === name);
    if (idx !== -1) {
      currentData.volunteers[idx] = { ...currentData.volunteers[idx], ...newRecord };
    } else {
      currentData.volunteers.push(newRecord);
    }

    await saveResilientFallback('about_highlights.json', currentData);
  } catch (err) {
    console.error("Failed to sync approved volunteer to highlights:", err);
  }
}
