# Plan: Filter Collaborator Search by Site/Unit

The goal is to ensure that when adding collaborators to an RDO, the search results are restricted to workers associated with the specific site (unit) where the RDO is being created, preventing confusion with workers from other units.

## User Review Required
> [!IMPORTANT]
> I will restrict the collaborator search in the RDO form to only show workers linked to the same "Unidade" (site) as the current activity. If a worker is not linked to any site, they will still appear as a fallback.

## Proposed Changes

### Database & Logic
- No database changes required as `profiles.site_id` or `user_companies` (linking users to sites) already exists in the schema.

### Frontend Components

#### `src/pages/ReportForm.tsx`
- Update the `allProfiles` query to fetch the worker's site association (if not already fully leveraged).
- Pass the current `siteId` (derived from the selected project/activity) down to the `StepAttendance` component.

#### `src/components/reports/StepAttendance.tsx`
- Add a `siteId` prop to the component.
- Modify the filtering logic for `availableProfiles` and `filteredProfiles`:
  - Filter `allProfiles` to only include those whose `siteId` matches the report's `siteId`.
  - Maintain the fallback for workers with no assigned site if needed, or strictly enforce the unit filter as requested.

#### `src/components/reports/QuickReportFormContent.tsx` (for the Quick Wizard)
- Apply similar filtering logic to the `allProfiles` query or the local filtering step to ensure the site-based restriction is consistent across all report creation entry points.

#### `src/components/reports/ParseReportModal.tsx`
- Ensure the AI-assisted matching also prioritizes or restricts matches to the current site to improve accuracy when multiple workers have similar names across different units.

## Verification Plan
1. **Manual Test**: Open the RDO creation form for a specific unit (e.g., "Suzano").
2. **Search Verification**: Type a name that exists in multiple units. Verify that only the worker belonging to the "Suzano" unit appears in the search results.
3. **Cross-Unit Check**: Verify that workers from a different unit (e.g., "Arcelor") do not appear in the "Suzano" RDO search.
4. **Quick Wizard Test**: Repeat the verification in the "Novo Relatório" quick wizard.
