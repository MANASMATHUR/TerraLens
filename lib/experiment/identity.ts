export const SCENARIO_ID = 'jaipur_monsoon_2026';
const PARTICIPANT_KEY = 'terralens_participant_uuid';
const VARIANT_KEY = 'terralens_assigned_variant';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Retrieves existing participant UUID from localStorage or creates a new stable UUIDv4.
 */
export function getOrCreateParticipantId(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
  const cookieId = document.cookie
    .split('; ')
    .find((part) => part.startsWith(`${PARTICIPANT_KEY}=`))
    ?.slice(PARTICIPANT_KEY.length + 1);
  let id = localStorage.getItem(PARTICIPANT_KEY) || cookieId || null;
  if (!id) {
    const rawUuid = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    id = `demo_${rawUuid}`;
  } else if (!/^(qa_sim|demo|pilot)_/.test(id)) {
    id = `demo_${id.replace(/^usr_/, '')}`;
  }
  localStorage.setItem(PARTICIPANT_KEY, id);
  document.cookie = `${PARTICIPANT_KEY}=${encodeURIComponent(id)}; Max-Age=${COOKIE_MAX_AGE}; Path=/; SameSite=Lax`;
  return id;
  } catch {
    return null;
  }
}

export function setCachedVariant(variant: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(VARIANT_KEY, variant);
  }
}

export function getCachedVariant(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(VARIANT_KEY);
}
