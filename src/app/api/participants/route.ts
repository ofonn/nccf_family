import crypto from 'crypto';
import { type NextRequest, NextResponse } from 'next/server';
import {
  createParticipant,
  deleteParticipant,
  isParticipantPersistenceAvailable,
  listParticipants,
  ParticipantsRepositoryError,
} from '@/lib/server/participantsRepository';
import { normalizeParticipantName } from '@/lib/participants';

export const dynamic = 'force-dynamic';

const MASTER_PASSWORD_HASH = '9d598ba5b4f3fda46daa17f9c0ff96ce72f6c6390a8b0488fcbc2ddd57dcdc0a';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isMasterRequest(request: NextRequest): boolean {
  const password = request.headers.get('x-auth-password') || '';
  const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
  return passwordHash === MASTER_PASSWORD_HASH;
}

function repositoryErrorResponse(error: unknown) {
  console.error('Participant API error:', error);
  if (error instanceof ParticipantsRepositoryError) {
    const safeStatus = error.status >= 400 && error.status <= 599 ? error.status : 500;
    return NextResponse.json({ error: error.message }, { status: safeStatus });
  }
  return NextResponse.json({ error: 'Unable to update house members.' }, { status: 500 });
}

export async function GET() {
  try {
    const participants = await listParticipants();
    return NextResponse.json(
      {
        participants,
        persistenceAvailable: isParticipantPersistenceAvailable(),
      },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } },
    );
  } catch (error) {
    return repositoryErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  if (!isMasterRequest(request)) {
    return NextResponse.json({ error: 'Only the Master Admin can add house members.' }, { status: 403 });
  }

  try {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      return NextResponse.json({ error: 'Expected a JSON request.' }, { status: 415 });
    }

    const body: unknown = await request.json();
    const rawName = body && typeof body === 'object'
      ? (body as Record<string, unknown>).name
      : null;
    const name = normalizeParticipantName(rawName);
    if (!name) {
      return NextResponse.json(
        { error: 'Enter a valid name without “&”; “General” is reserved.' },
        { status: 400 },
      );
    }

    const participant = await createParticipant(name);
    return NextResponse.json({ participant }, { status: 201 });
  } catch (error) {
    return repositoryErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  if (!isMasterRequest(request)) {
    return NextResponse.json({ error: 'Only the Master Admin can remove house members.' }, { status: 403 });
  }

  const id = request.nextUrl.searchParams.get('id') || '';
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: 'Invalid house member.' }, { status: 400 });
  }

  try {
    await deleteParticipant(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return repositoryErrorResponse(error);
  }
}
