# Plan: Fix RDO Creation Folder Mismatch

The user is reporting that when creating a new RDO from within an existing activity card (OM), it sometimes creates a new card instead of staying within the original one. This happens because the "OM Number" and "OM Title" context from the "Meus RDOs" folder is not being correctly propagated to the new RDO, or it's being normalized differently, causing a s

## P

### 1. DocumentCabinet.tsx

- In the "Novo Relatório" (New Report) button or context, ensure that if we are inside a specific project/activity folder, the  and `omTitle` are explicitly passed to the `QuickReportWizard` are explicitly passed to the `QuickReportWizard`.
- Update the context object passed to `navigate('/reports/wizard', { state: { ... } })` to include the specific  and `omTitle` of the currently selected activity group.`omTitle` of the currently selected activity group.

### 2. ProjectSelector.tsx (Step 3: Activity Selection)

- Ensure that the activity selection logic uses the same grouping and normalization logic as `DocumentCabinet.tsx`.
- If a report is being created from an existing context, pre-select or highlight that specific activity to prevent the user from accidentally creating a "new" version of the same OM.prevent the user from accidentally creating a "new" version of the same OM.

### 3. ReportForm.tsx / StepActivities.tsx

- When initializing a new report with `omNumber` and `omTitle`, ensure these fields are strictly tied to the record.
- If an `omTitle` is provided from the wizard context, it should automatically seed the first activity in `StepActivities` (this was implemented previously, but we should verify it handles renamed folders correctly).

## Technical Details

- Use `useActivityNames` hook to resolve the correct (possibly renamed) title for the OM.
- Ensure `normalizeOmKeyNumber` and `normalizeOmTitle` from `src/lib/rdoActivityGroups.ts` are applied consistently during the creation flow.
- The issue often stems from "SEM Nº DE OM" vs a specific number, or slight variations in the title that `buildActivityGroups` handles by merging, but the manual creation flow might miss.

## Verification Plan

- Create a report from an existing OM folder.
- Verify the `maintenance_order_number` and `maintenance_order_title` in the database match the folder's attributes exactly.
- Check if the new RDO appears inside the same folder in "Meus RDOs".