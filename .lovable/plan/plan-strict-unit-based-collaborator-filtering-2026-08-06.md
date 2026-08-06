# Plan: Strict Unit-Based Collaborator Filtering

Restrict collaborator searches in RDO forms to only show workers explicitly assigned to the current project's unit (site).

## User Feedback Analysis
- The user reports that the system is still "searching everyone" instead of restricting to the specific unit.
- This is caused by a fallback in the filtering logic that includes collaborators without any site assignments.
- The user wants strict filtering: only show collaborators registered in the unit.

## Proposed Changes

### 1. RDO Form (`src/pages/ReportForm.tsx`)
- Update the `allProfiles` filtering logic to be strict.
- If a `currentSiteId` is active, only include profiles whose `siteIds` contains that ID.
- Remove the fallback that includes profiles with no site assignments.

### 2. Quick Wizard (`src/components/reports/QuickReportFormContent.tsx`)
- Update the `filteredSiteProfiles` logic to be strict.
- If `projectMeta.site_id` is present, only include profiles with a matching site assignment.

### 3. Attendance Step UI (`src/components/reports/StepAttendance.tsx`)
- Update the search button label to explicitly mention it is filtering by unit (e.g., "Buscar colaboradores nesta unidade").

### 4. AI Matching (`src/components/reports/ParseReportModal.tsx`)
- Ensure the AI matching also respects this strict filtering by using the pre-filtered `allProfiles` list provided by the parent.

## Verification Plan
- Open the RDO creation form.
- Select a project linked to a specific site.
- Verify that the collaborator search only shows workers assigned to that site.
- Verify that workers with no site assignments or different site assignments are excluded.
- Repeat for the Quick Report Wizard.
