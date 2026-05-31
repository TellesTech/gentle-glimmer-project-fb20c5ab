import { normalizeFunction } from '@/lib/jobFunctions';

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
  const needle = partialName.trim().toUpperCase();
  if (!needle) return null;

  // Exact match
  const exact = profiles.find(p => p.name.trim().toUpperCase() === needle);
  if (exact) return exact;

  // First name match (only if needle is a single word to avoid false positives)
  const needleParts = needle.split(/\s+/);
  if (needleParts.length === 1) {
    const firstNameMatch = profiles.find(p => {
      const firstName = p.name.trim().toUpperCase().split(/\s+/)[0];
      return firstName === needle;
    });
    if (firstNameMatch) return firstNameMatch;
  }

  // Partial / contains match
  const containsMatch = profiles.find(p => {
    const pName = p.name.trim().toUpperCase();
    return pName.includes(needle) || needle.includes(pName);
  });
  if (containsMatch) return containsMatch;

  return null;
}
