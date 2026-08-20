# Plan: Standardize RDO Creation Flow from Activity Cards

The user is reporting that creating a new RDO from within an existing activity card (OM) sometimes creates a new card instead of staying within the original one. This happens because the "OM Number" and "OM Title" context from the card is not always correctly propagated to the creation wizard, or is normalized differently during the save process.

While this was partially addressed in a previous update, the client portal was missed, and the "Novo Relatório" (New Report) button in the client dashboard needs to be verified and synchronized with the core admin logic.

## Changes

### 1. Client Dashboard and Activity List

- Ensure that the "Novo Relatório" button (if present or when navigating to creation) explicitly passes the `omNumber` and `omTitle` from the active card/context to the `QuickReportWizard`.
- Synchronize the grouping logic in `ClientActivityList.tsx` and `ClientDashboard.tsx` with `DocumentCabinet.tsx` to ensure visual consistency.

### 2. QuickReportWizard & ProjectSelector

- Verify that `originOm` is correctly received and used for the divergence alert implemented in the previous turn.
- Ensure that the "Manter pasta de origem" (Keep original folder) option in the `QuickReportWizard` dialog correctly overrides any user selection with the exact `omNumber`/`omTitle` from the source card.

### 3. Report Form Seeding

- Reinforce the logic in `ReportForm.tsx` (and `SimplifiedReportForm.tsx`) to strictly use the `omNumber` and `omTitle` passed via router state when initializing a new report.

## Technical Details

- Use `normalizeOmKeyNumber` and `normalizeOmTitle` from `src/lib/rdoActivityGroups.ts` consistently across all components.
- Propagate `state: { omNumber, omTitle, ... }` through every step of the navigation flow: `DocumentCabinet` -> `QuickReportWizard` -> `ProjectSelector` -> `ReportForm`.

## Verification Plan

- Navigate to an activity card in the client portal or "Meus RDOs".
- Click "Novo Relatório".
- Choose a different activity in the selector and verify the alert appears.
- Choose "Manter pasta de origem" and save the report.
- Verify the new report appears inside the *original* card, not a new one.
