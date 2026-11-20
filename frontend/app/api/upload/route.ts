import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkRateLimit, getClientIp } from '@/lib/rate-limiter';

// Allowed MIME types and extensions
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
]);

const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf']);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Validates file signature (magic bytes) to ensure file content matches claimed type
 */
function validateMagicBytes(buffer: Buffer, extension: string): boolean {
  if (buffer.length < 4) return false;

  // JPEG: FF D8 FF
  if (extension === 'jpg' || extension === 'jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  // PNG: 89 50 4E 47 (ASCII: .PNG)
  if (extension === 'png') {
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  }

  // GIF: GIF87a or GIF89a (47 49 46 38)
  if (extension === 'gif') {
    return buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38;
  }

  // WEBP: RIFF....WEBP
  if (extension === 'webp') {
    return (
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP'
    );
  }

  // PDF: %PDF- (25 50 44 46)
  if (extension === 'pdf') {
    return buffer.toString('ascii', 0, 4) === '%PDF';
  }

  return false;
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function POST(request: Request) {
  try {
    // 1. IP-based Rate Limiting (max 20 uploads per hour)
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`upload:${clientIp}`, 20, 60 * 60 * 1000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Upload rate limit exceeded. Please wait ${rateLimit.retryAfterSeconds} seconds.`,
        },
        { status: 429 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided.' },
        { status: 400 }
      );
    }

    // 2. File size limit enforcement (5 MB)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: `File size exceeds the 5 MB limit (current: ${(file.size / (1024 * 1024)).toFixed(2)} MB).`,
        },
        { status: 400 }
      );
    }

    // 3. File extension & name sanitization
    const originalName = file.name || 'upload.jpg';
    const ext = originalName.split('.').pop()?.toLowerCase() || '';

    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported file type (.${ext}). Allowed formats: JPG, PNG, WEBP, GIF, PDF.`,
        },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 4. Magic Byte Verification (prevent executable or malicious HTML disguised as image)
    if (!validateMagicBytes(buffer, ext)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Security verification failed: File content does not match the file extension.',
        },
        { status: 400 }
      );
    }

    // Determine strict Content-Type
    let contentType = file.type;
    if (!ALLOWED_MIME_TYPES.has(contentType)) {
      if (ext === 'pdf') contentType = 'application/pdf';
      else if (ext === 'png') contentType = 'image/png';
      else if (ext === 'webp') contentType = 'image/webp';
      else if (ext === 'gif') contentType = 'image/gif';
      else contentType = 'image/jpeg';
    }

    // Generate safe, randomized filename preventing path traversal
    const baseName = originalName.substring(0, originalName.lastIndexOf('.')) || 'file';
    const sanitizedBase = baseName.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 40);
    const filename = `${Date.now()}_${sanitizedBase}.${ext}`;

    // Attempt 1: Upload to Supabase Storage
    try {
      if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
        const bucketName = 'uploads';
        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
          .from(bucketName)
          .upload(filename, buffer, {
            contentType,
            upsert: true,
          });

        if (!uploadError && uploadData) {
          const { data: publicUrlData } = supabaseAdmin.storage
            .from(bucketName)
            .getPublicUrl(filename);

          if (publicUrlData?.publicUrl) {
            return NextResponse.json({ success: true, url: publicUrlData.publicUrl });
          }
        } else if (uploadError) {
          console.warn('Supabase storage upload error:', uploadError.message || uploadError);
        }
      }
    } catch (supabaseError: any) {
      console.warn('Supabase storage exception:', supabaseError.message || supabaseError);
    }

    // Attempt 2: Base64 data URL fallback
    const base64Data = buffer.toString('base64');
    const base64Url = `data:${contentType};base64,${base64Data}`;
    return NextResponse.json({ success: true, url: base64Url });
  } catch (error: any) {
    console.error('Upload security error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal upload processing error.' },
      { status: 500 }
    );
  }
}
