# Plan: Fix Missing Report History

The user reported that the report history has disappeared ("o historio não esta funcionando sumiu tudo que foi feito"). My investigation revealed that the `public.report_history` table was missing from the database. I have already restored the table, its indexes, RLS policies, and the trigger function via a migration. 

Now, I need to ensure the history is correctly displayed in the UI, particularly for the client view, and verify that actions are being logged.

## Proposed Changes

### Database & Backend
- Already executed: Restored `public.report_history` table and `report_changes_trigger`.
- Already executed: Synchronized existing reports into the history table.

### Components
- **Client Report View (`src/pages/ClientReportView.tsx`)**:
    - The client view currently lacks the `ApprovalTimeline` component which displays the history.
    - I will add a new card section for "Histórico" in the client portal, similar to the admin view but scoped for client visibility.
- **Approval Timeline (`src/components/reports/ApprovalTimeline.tsx`)**:
    - Ensure the component handles loading and empty states gracefully (it already does).

## Verification Plan

### Automated Checks
- Run a `supabase--read_query` to verify that `public.report_history` contains records for the report being tested.
- Verify that the `report_changes_trigger` is active.

### Manual Verification
- View the "Report Detail" page as an admin and confirm the "Histórico" card is present and populated.
- View the "Client Report View" page and confirm the "Histórico" card is now visible and matches the report's timeline.
