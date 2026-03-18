import { NextRequest, NextResponse } from 'next/server';

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

    const deleteUrl = `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/${supabaseBucket}/${resumePath}`;
    const deleteResponse = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        apikey: supabaseServiceRoleKey,
        Authorization: `Bearer ${supabaseServiceRoleKey}`,
      },
    });

    if (!deleteResponse.ok) {
      const deleteError = await deleteResponse.text();
      return NextResponse.json({ error: `Delete failed: ${deleteError}` }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected delete error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
