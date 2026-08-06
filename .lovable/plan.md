# Plan: Accent-Insensitive Search and Matching Improvements

The user wants to ensure that collaborator and RDO searches/filters are not restricted by accents (diacritics). This needs to be applied to the search UI and the background matching logic (HH database synchronization).

## User Review Required

> [!IMPORTANT]
> This will make searches for "Fabio" also return "Fábio", and "Jose" return "José", etc. This is generally preferred for ease of use.

- Do you want this accent-insensitive behavior applied to *all* search bars in the system, or just the Workforce (HH) and Users pages?

## Proposed Changes

### 1. Shared Utility
- Create a `stripAccents` utility function in `src/lib/utils.ts` (or use an existing one if available in a common lib) to normalize strings by removing diacritics.

### 2. Frontend Search (UI)
- **Users Page (`src/pages/Users.tsx`)**: Update the filtering logic to use `stripAccents` on both the search term and the worker names/titles.
- **Reports Page (`src/pages/Reports.tsx`)**: Update the search filter to be accent-insensitive.
- **Workforce Database (`src/pages/WorkforceDatabase.tsx`)**: Ensure any client-side filtering (like the `matchCollaborator` calls in imports or synchronization) ignores accents.

### 3. Background Matching (AI/Webhooks)
- **Workforce Resolver (`src/lib/resolveWorkerFunction.ts`)**: Update `matchProfileByName` to use accent-insensitive comparison.
- **UAZAPI Webhook (`supabase/functions/uazapi-webhook/index.ts`)**: Verify and reinforce `stripAccents` in `matchCollaborator` and `normalizeName`. (It already seems to have a `stripAccents` function, but I will ensure it's used consistently).
- **RDO Parser (`supabase/functions/_shared/rdoParser.ts`)**: Ensure its `normKey` and matching helpers are robust against accents.

## Verification Plan
- **Automated Tests**: Run existing parser tests (if any) or add unit tests for `stripAccents`.
- **Manual Verification**:
  - Search for "Fabio" in the Users page and verify "Fábio" appears.
  - Run a "Sync from RDO" in Workforce Database for a worker with an accented name and verify they link to the correct profile even if the WhatsApp message omitted the accent.
