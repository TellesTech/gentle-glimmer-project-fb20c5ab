import { normalizeFunction } from '@/lib/jobFunctions';
import { stripAccents } from '@/lib/utils';

export interface ProfileEntry {
  id: string;
  name: string;
  job_title: string | null;
}

/**
 * Resolve a job function for an attendance record using intelligent name matching.
 * Priority: user_id profile > exact name > first name > partial match > function_role > fallback
 */
export function resolveWorkerFunction(
  userName: string | null,
  userId: string | null,
  functionRole: string | null,
  profilesById: Record<string, string>,
  allProfiles: ProfileEntry[],
): string {
  // 1. Direct user_id lookup
  if (userId && profilesById[userId]) {
    return normalizeFunction(profilesById[userId]) || profilesById[userId];
  }

  // 2. Intelligent name matching
  if (userName) {
    const matched = matchProfileByName(userName, allProfiles);
    if (matched?.job_title) {
      return normalizeFunction(matched.job_title) || matched.job_title;
    }
  }

  // 3. Use existing function_role from attendance
  if (functionRole && functionRole !== 'MEIO OFICIAL') {
    return normalizeFunction(functionRole) || functionRole;
  }

  return functionRole || 'MEIO OFICIAL';
}

function matchProfileByName(partialName: string, profiles: ProfileEntry[]): ProfileEntry | null {
  const needle = stripAccents(partialName.trim().toUpperCase());
  if (!needle) return null;

  // Exact match (after trim and accent stripping)
  const exact = profiles.find(p => stripAccents(p.name.trim().toUpperCase()) === needle);
  if (exact) return exact;

  // Multi-word exact match (handle potential variations in spacing)
  const normalizedNeedle = needle.replace(/\s+/g, ' ');
  const normalizedExact = profiles.find(p => stripAccents(p.name.trim().toUpperCase()).replace(/\s+/g, ' ') === normalizedNeedle);
  if (normalizedExact) return normalizedExact;

  // First name + Second name match (more specific than just first name)
  const needleParts = normalizedNeedle.split(/\s+/);
  if (needleParts.length >= 2) {
    const twoNameMatch = profiles.find(p => {
      const pParts = stripAccents(p.name.trim().toUpperCase()).split(/\s+/);
      return pParts[0] === needleParts[0] && pParts[1] === needleParts[1];
    });
    if (twoNameMatch) return twoNameMatch;
  }

  // First name match (only if needle is a single word to avoid false positives)
  if (needleParts.length === 1) {
    const firstNameMatch = profiles.find(p => {
      const firstName = stripAccents(p.name.trim().toUpperCase()).split(/\s+/)[0];
      return firstName === needle;
    });
    if (firstNameMatch) return firstNameMatch;
  }

  // Partial / contains match (as last resort)
  const containsMatch = profiles.find(p => {
    const pName = stripAccents(p.name.trim().toUpperCase());
    return pName.includes(needle) || needle.includes(pName);
  });
  if (containsMatch) return containsMatch;

  return null;
}
