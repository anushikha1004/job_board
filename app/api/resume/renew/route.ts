import { NextRequest, NextResponse } from 'next/server';

const SIGNED_URL_EXPIRY_SECONDS = 60 * 60 * 24 * 30; // 30 days

type FirebaseLookupResponse = {
  users?: Array<{
    localId?: string;
    email?: string;
  }>;
};

async function verifyFirebaseToken(idToken: string): Promise<{ uid: string }> {
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

  if (!response.ok) throw new Error('Invalid Firebase token');
  const payload = (await response.json()) as FirebaseLookupResponse;
  const firstUser = payload.users?.[0];
  if (!firstUser?.localId) throw new Error('Invalid Firebase user payload');
  return { uid: firstUser.localId };
}

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseBucket = process.env.SUPABASE_RESUME_BUCKET || 'resumes';

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json({ error: 'Supabase resume upload is not configured.' }, { status: 500 });
    }

    const authHeader = request.headers.get('authorization') || '';
    const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!tokenMatch) {
      return NextResponse.json({ error: 'Missing authentication token.' }, { status: 401 });
    }

    const { uid } = await verifyFirebaseToken(tokenMatch[1]);
    const body = (await request.json()) as { resume_path?: string };
    const resumePath = (body.resume_path || '').trim();

    if (!resumePath || !resumePath.startsWith(`${uid}/`)) {
      return NextResponse.json({ error: 'Invalid resume path.' }, { status: 400 });
    }

    const signUrl = `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/sign/${supabaseBucket}/${resumePath}`;
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
      return NextResponse.json({ error: `Signed URL generation failed: ${signError}` }, { status: 502 });
    }

    const signedPayload = (await signResponse.json()) as { signedURL?: string; signedUrl?: string };
    const signedPath = signedPayload.signedURL || signedPayload.signedUrl;
    if (!signedPath) {
      return NextResponse.json({ error: 'Failed to read signed URL from Supabase.' }, { status: 502 });
    }

    const signedUrl = `${supabaseUrl.replace(/\/$/, '')}/storage/v1${signedPath}`;
    const expiresAt = new Date(Date.now() + SIGNED_URL_EXPIRY_SECONDS * 1000).toISOString();
    return NextResponse.json({
      resume_url: signedUrl,
      expires_in_seconds: SIGNED_URL_EXPIRY_SECONDS,
      expires_at: expiresAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected renew error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
