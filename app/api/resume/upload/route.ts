import { NextRequest, NextResponse } from 'next/server';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx'];
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const SIGNED_URL_EXPIRY_SECONDS = 60 * 60 * 24 * 30; // 30 days

type FirebaseLookupResponse = {
  users?: Array<{
    localId?: string;
    email?: string;
  }>;
};

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^\w.\-]/g, '_').toLowerCase();
}

function getFileExtension(fileName: string): string {
  const parts = fileName.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

async function verifyFirebaseToken(idToken: string): Promise<{ uid: string; email: string }> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) {
    throw new Error('Missing NEXT_PUBLIC_FIREBASE_API_KEY');
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    throw new Error('Invalid Firebase token');
  }

  const payload = (await response.json()) as FirebaseLookupResponse;
  const firstUser = payload.users?.[0];
  if (!firstUser?.localId || !firstUser?.email) {
    throw new Error('Invalid Firebase user payload');
  }

  return { uid: firstUser.localId, email: firstUser.email };
}

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseBucket = process.env.SUPABASE_RESUME_BUCKET || 'resumes';
    const scanWebhook = process.env.RESUME_SCAN_WEBHOOK_URL;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      const missingKeys = [
        !supabaseUrl ? 'SUPABASE_URL' : null,
        !supabaseServiceRoleKey ? 'SUPABASE_SERVICE_ROLE_KEY' : null,
      ].filter(Boolean);
      return NextResponse.json(
        {
          error: 'Supabase resume upload is not configured.',
          missing_env: missingKeys,
        },
        { status: 500 }
      );
    }

    const authHeader = request.headers.get('authorization') || '';
    const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!tokenMatch) {
      return NextResponse.json({ error: 'Missing authentication token.' }, { status: 401 });
    }

    const { uid } = await verifyFirebaseToken(tokenMatch[1]);

    const formData = await request.formData();
    const file = formData.get('resume');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Resume file is required.' }, { status: 400 });
    }

    if (file.size <= 0 || file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'File size must be between 1 byte and 5MB.' },
        { status: 400 }
      );
    }

    const extension = getFileExtension(file.name);
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      return NextResponse.json(
        { error: 'Only PDF, DOC, and DOCX files are allowed.' },
        { status: 400 }
      );
    }

    if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Unsupported file MIME type.' },
        { status: 400 }
      );
    }

    const filePath = `${uid}/${Date.now()}-${sanitizeFileName(file.name)}`;
    const uploadUrl = `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/${supabaseBucket}/${filePath}`;
    const fileBytes = await file.arrayBuffer();

    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        apikey: supabaseServiceRoleKey,
        Authorization: `Bearer ${supabaseServiceRoleKey}`,
        'Content-Type': file.type || 'application/octet-stream',
        'x-upsert': 'true',
      },
      body: fileBytes,
    });

    if (!uploadResponse.ok) {
      const uploadError = await uploadResponse.text();
      return NextResponse.json(
        { error: `Upload failed: ${uploadError}` },
        { status: 502 }
      );
    }

    const signUrl = `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/sign/${supabaseBucket}/${filePath}`;
    const signResponse = await fetch(signUrl, {
      method: 'POST',
      headers: {
        apikey: supabaseServiceRoleKey,
        Authorization: `Bearer ${supabaseServiceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expiresIn: SIGNED_URL_EXPIRY_SECONDS }),
    });

    if (!signResponse.ok) {
      const signError = await signResponse.text();
      return NextResponse.json(
        { error: `Signed URL generation failed: ${signError}` },
        { status: 502 }
      );
    }

    const signedPayload = (await signResponse.json()) as { signedURL?: string; signedUrl?: string };
    const signedPath = signedPayload.signedURL || signedPayload.signedUrl;
    if (!signedPath) {
      return NextResponse.json(
        { error: 'Failed to read signed URL from Supabase.' },
        { status: 502 }
      );
    }

    const signedUrl = `${supabaseUrl.replace(/\/$/, '')}/storage/v1${signedPath}`;
    const expiresAt = new Date(Date.now() + SIGNED_URL_EXPIRY_SECONDS * 1000).toISOString();

    // Optional scan hook. Non-blocking so upload UX remains stable.
    if (scanWebhook) {
      fetch(scanWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: uid,
          file_name: file.name,
          file_size: file.size,
          file_type: file.type || extension,
          resume_path: filePath,
        }),
      }).catch(() => undefined);
    }

    return NextResponse.json({
      resume_url: signedUrl,
      resume_path: filePath,
      expires_in_seconds: SIGNED_URL_EXPIRY_SECONDS,
      expires_at: expiresAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected upload error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
