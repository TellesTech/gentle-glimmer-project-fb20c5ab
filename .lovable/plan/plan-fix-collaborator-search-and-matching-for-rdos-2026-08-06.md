# Plan: Fix Collaborator Search and Matching for RDOs

The user reports that when adding a collaborator to an RDO, the search is failing to find existing collaborators. This is likely related to the recent accent-insensitive changes or a scoping issue (e.g., filtering by company/site).

## Proposed Changes

### 1. Investigate and Fix Search Logic
- **Component Review**: Inspect `src/components/reports/AttendanceSection.tsx` (or the equivalent component used in the RDO wizard/form) to see how it fetches and filters collaborators.
- **Normalization Consistency**: Ensure the search input and the collaborator list are normalized using the same `stripAccents` utility implemented in the previous turn.
- **Scope Verification**: Check if the query is restricted to a specific `site_id` or `company_id` that might be incorrectly set or missing.

### 2. Refine Matching Logic
- **Workforce Resolver**: Double-check `src/lib/resolveWorkerFunction.ts` to ensure that even with accent stripping, the matching remains robust and doesn't return empty results for valid inputs.
- **Frontend Filter**: Update any client-side filtering in the RDO attendance picker to be accent-insensitive.

### 3. Verification Plan
- **Manual Test**: Navigate to "Novo Relatório" -> "Mão de Obra" and search for a collaborator with and without accents (e.g., "Fabio" vs "Fábio").
- **Console Audit**: Monitor for any 403 (RLS) or 400 (Bad Request) errors during the search request.
