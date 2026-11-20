import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://cwpfhfcxpeqiihiqxqtu.supabase.co";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3cGZoZmN4cGVxaWloaXF4cXR1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzA1ODQ2NSwiZXhwIjoyMDk4NjM0NDY1fQ.7Wrh-UUcFSe7fMmCMYeySPOtEnH-Lew-CV-MWI8reDA";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

function hashPassword(password) {
  if (!password) return '';
  if (typeof password === 'string' && password.startsWith('pbkdf2$')) {
    return password;
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(String(password), salt, 10000, 64, 'sha512').toString('hex');
  return `pbkdf2$${salt}$${hash}`;
}

async function uploadToStorage(filename, data) {
  try {
    const storagePath = `data/${filename}`;
    const fileBuffer = Buffer.from(JSON.stringify(data, null, 2), 'utf-8');
    const { error } = await supabase.storage
      .from('uploads')
      .upload(storagePath, fileBuffer, {
        contentType: 'application/json',
        upsert: true
      });
    if (error) {
      console.warn(`Storage upload warning for ${filename}:`, error.message);
    } else {
      console.log(`Uploaded ${filename} to Supabase storage successfully.`);
    }
  } catch (err) {
    console.warn(`Storage upload exception for ${filename}:`, err.message);
  }
}

async function migrate() {
  console.log("=== STARTING PASSWORD ENCRYPTION & HASHING MIGRATION ===");

  // 1. Migrate Local JSON files
  const dataDir = path.resolve('frontend/data');

  // A. users.json
  const usersPath = path.join(dataDir, 'users.json');
  if (fs.existsSync(usersPath)) {
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
    let changed = 0;
    users.forEach(u => {
      if (u.password && !u.password.startsWith('pbkdf2$')) {
        u.password = hashPassword(u.password);
        changed++;
      }
    });
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2), 'utf-8');
    console.log(`users.json: Encrypted ${changed} passwords.`);
    await uploadToStorage('users.json', users);
  }

  // B. admin_users.json
  const adminsPath = path.join(dataDir, 'admin_users.json');
  if (fs.existsSync(adminsPath)) {
    const admins = JSON.parse(fs.readFileSync(adminsPath, 'utf-8'));
    let changed = 0;
    admins.forEach(a => {
      if (a.password && !a.password.startsWith('pbkdf2$')) {
        a.password = hashPassword(a.password);
        changed++;
      }
    });
    fs.writeFileSync(adminsPath, JSON.stringify(admins, null, 2), 'utf-8');
    console.log(`admin_users.json: Encrypted ${changed} passwords.`);
    await uploadToStorage('admin_users.json', admins);
  }

  // C. volunteer_applications.json
  const volsPath = path.join(dataDir, 'volunteer_applications.json');
  if (fs.existsSync(volsPath)) {
    const vols = JSON.parse(fs.readFileSync(volsPath, 'utf-8'));
    let changed = 0;
    vols.forEach(v => {
      if (v.password && !v.password.startsWith('pbkdf2$')) {
        v.password = hashPassword(v.password);
        changed++;
      }
    });
    fs.writeFileSync(volsPath, JSON.stringify(vols, null, 2), 'utf-8');
    console.log(`volunteer_applications.json: Encrypted ${changed} passwords.`);
    await uploadToStorage('volunteer_applications.json', vols);
  }

  // 2. Migrate Supabase Database Tables
  // A. Supabase users
  try {
    const { data: dbUsers, error } = await supabase.from('users').select('id, email, password');
    if (!error && Array.isArray(dbUsers)) {
      let dbCount = 0;
      for (const u of dbUsers) {
        if (u.password && !u.password.startsWith('pbkdf2$')) {
          const hashed = hashPassword(u.password);
          await supabase.from('users').update({ password: hashed }).eq('id', u.id);
          dbCount++;
        }
      }
      console.log(`Supabase 'users' table: Encrypted ${dbCount} passwords.`);
    }
  } catch (e) {
    console.warn("Supabase users migration notice:", e.message);
  }

  // B. Supabase admin_users
  try {
    const { data: dbAdmins, error } = await supabase.from('admin_users').select('id, email, password');
    if (!error && Array.isArray(dbAdmins)) {
      let dbCount = 0;
      for (const a of dbAdmins) {
        if (a.password && !a.password.startsWith('pbkdf2$')) {
          const hashed = hashPassword(a.password);
          await supabase.from('admin_users').update({ password: hashed }).eq('id', a.id);
          dbCount++;
        }
      }
      console.log(`Supabase 'admin_users' table: Encrypted ${dbCount} passwords.`);
    }
  } catch (e) {
    console.warn("Supabase admin_users migration notice:", e.message);
  }

  // C. Supabase volunteer_applications
  try {
    const { data: dbVols, error } = await supabase.from('volunteer_applications').select('id, email, password');
    if (!error && Array.isArray(dbVols)) {
      let dbCount = 0;
      for (const v of dbVols) {
        if (v.password && !v.password.startsWith('pbkdf2$')) {
          const hashed = hashPassword(v.password);
          await supabase.from('volunteer_applications').update({ password: hashed }).eq('id', v.id);
          dbCount++;
        }
      }
      console.log(`Supabase 'volunteer_applications' table: Encrypted ${dbCount} passwords.`);
    }
  } catch (e) {
    console.warn("Supabase volunteer_applications migration notice:", e.message);
  }

  console.log("=== MIGRATION COMPLETE ===");
}

migrate();
