# Plan: Fix Activity Grouping and OM Persistence

The goal is to ensure that RDOs remain grouped within their correct activity "cards" by correctly persisting and passing Maintenance Order (OM) details throughout the creation and editing process.

## User Review Required

> [!IMPORTANT]
> The fix involves ensuring that when you click "Novo Relatório" inside a card, the activity details (OM number and title) are correctly pre-filled and saved to the database.

## Proposed Changes

### Database Persistence
- **src/pages/ReportForm.tsx**: Ensure `maintenance_order_number` and `maintenance_order_title` are included in both `insert` and `update` Supabase calls.
- **src/pages/SimplifiedReportForm.tsx**: Ensure OM details are included in the `createReportMutation` and `updateReportMutation`.

### Context Propagation
- **src/hooks/useReportTabs.ts**: Update the hook to accept an optional `omContext` so that the first tab of a new report is correctly seeded with OM details.
- **src/pages/SimplifiedReportForm.tsx**: Pass the OM details from the navigation state to the `useReportTabs` hook.
- **src/pages/ReportForm.tsx**: Fix a bug where editing an existing report would clear the OM fields in the local state.

### UI Improvements
- **src/pages/client/ClientActivityList.tsx**: Update the "Novo Relatório" button to explicitly pass the `omNumber` and `omTitle` from the group metadata instead of trying to parse them from the display name.
- **src/components/reports/DocumentCabinet.tsx**: (Already verified, but ensuring consistency) Pass explicit OM details to the wizard.

## Technical Details

- **OM Metadata**: Standardizing the use of `maintenance_order_number` (database) and `maintenanceOrderNumber` (frontend state).
- **Tabbed Creation**: Ensuring the tabbed creation flow in the simplified form respects the folder context.
- **Edit Mode Safety**: Preventing data loss by correctly mapping DB fields back to form state during initialization.

## Verification Plan

### Manual Verification
1. Go to "Meus RDOs" or "Área do Cliente".
2. Open an activity card (e.g., "OM 12345 — Reparo").
3. Click "Novo Relatório".
4. Verify that "OM 12345" and "Reparo" are pre-filled in the form.
5. Save the RDO.
6. Return to the list and verify the RDO is inside the same card, not in a new one.
7. Edit the RDO and verify the OM fields are still there.
