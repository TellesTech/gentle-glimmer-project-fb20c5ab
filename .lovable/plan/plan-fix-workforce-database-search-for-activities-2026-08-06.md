# Plan: Fix Workforce Database Search for Activities

The user wants the search field in the "Base de Dados" (Workforce Database) to include the same activities found in the "Meus RDOs" (Reports) section. Currently, the search isn't pulling all relevant activities correctly.

## Proposed Changes

### 1. `src/pages/WorkforceDatabase.tsx`
- **Improve `loadProjects`**: Ensure that the list of projects fetched for the search dropdown includes all activities that have RDOs, even if they aren't explicitly in the `projects` table (though they should be).
- **Synchronize logic with `Reports.tsx`**: In `Reports.tsx`, the project filter includes names derived from `location` or `maintenance_order_title` if the project name is generic. I will apply similar logic to the `WorkforceDatabase` projects list.
- **Enhance Search String**: Update the `searchString` generation to include OM numbers and titles more explicitly.
- **Update UI Labels**: Change "body" text as requested.

### 2. `src/lib/resolveWorkerFunction.ts` (Review)
- Ensure the logic for resolving functions is consistent with the latest user request regarding raw profile functions. (Already done in previous turns, but will verify context).

## Verification Plan

### Automated Tests
- I will not be able to run full end-to-end tests easily with the current setup, but I will verify the logic by inspecting the console logs added in `WorkforceDatabase.tsx`.

### Manual Verification
- Open the "Base de Dados" page.
- Select a site (e.g., Suzano Aracruz).
- Open the "Atividade / Projeto" search dropdown.
- Verify that activities like "Lançamento de cabo", "Limpeza de CCM", etc., appear in the list, even if they are only identified by their OM or location in RDOs.
