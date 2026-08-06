# Plan: Fix Workforce Function Role Export and System Display

The user reports that the exported workforce database spreadsheet contains incorrect functions and wants to ensure consistency between the system and the downloaded files.

## Problems Identified
1.  **Export Normalization**: The `WorkforceDatabase.tsx` export logic uses `getBaseFunction` which strips specificity (e.g., "PINTOR ESCALADOR N1" becomes just "PINTOR").
2.  **Function Resolution Logic**: The `resolveWorkerFunction` utility might be incorrectly defaulting to "MEIO OFICIAL" or misidentifying users due to fuzzy matching.
3.  **Data Source**: The system prioritizes RDO data, but if `function_role` is NULL in `report_attendance`, it falls back to profile matching or a default.

## Proposed Changes

### 1. Update `src/lib/resolveWorkerFunction.ts`
- Improve `matchProfileByName` to be more strict when finding a profile to get the job title.
- Prioritize the profile's `job_title` more aggressively.

### 2. Update `src/pages/WorkforceDatabase.tsx`
- In `exportExcel`, change the "FUNÇÃO" column to use the full normalized role instead of just the base function. This provides the specific job title (e.g., "PINTOR ESCALADOR N1") which is often what is required for billing/audit.
- Update the "Resumo por Função" worksheet to also use full roles or ensure the grouping is logical for the user.
- Fix the logic in `loadRecords` to ensure `functionRole` is correctly resolved and displayed.

### 3. Database Audit & Cleanup
- Check for common mismappings in the `profiles` table that might be causing "MEIO OFICIAL" fallbacks.

## Verification Plan
1.  **Manual Test**: Trigger the "Exportar Excel" in the Workforce Database page and verify the "FUNÇÃO" column.
2.  **UI Check**: Verify that workers in the Workforce Database table show the correct roles based on their profiles.
3.  **Code Review**: Ensure `stripAccents` and `normalizeFunction` are applied everywhere roles are handled.
