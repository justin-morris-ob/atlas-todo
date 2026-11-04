import { createHash, timingSafeEqual } from 'node:crypto';
import { introspect } from '@onebrief/atlas-bff-kit';

export function createAuthentication({ readToken, ownerId, sessionAuthenticate = introspect }) {
  if (typeof readToken !== 'string' || readToken.length < 32) throw new Error('TODO_BC_READ_TOKEN must contain at least 32 characters');
  if (typeof ownerId !== 'string' || !ownerId.trim() || ownerId.length > 200) throw new Error('TODO_BC_OWNER_ID is required and must be at most 200 characters');
  const hash = token => createHash('sha256').update(token).digest();
  const expected = hash(readToken);
  return async token => {
    if (!token) return null;
    if (timingSafeEqual(hash(token), expected)) return { id: ownerId, kind: 'service' };
    return sessionAuthenticate(token);
  };
}
