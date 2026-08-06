# Plan: Fix Site-to-Project Filtering in Workforce Database

The user reported that when selecting "Suzano" as a site, not all projects are being correctly filtered or loaded. Looking at the code, there are two main areas to address:

## 1. Site-to-Project Filtering in UI
- The `filteredProjects` list depends on `selectedSite`.
- When `selectedSite` changes, `selectedProject` is correctly reset to `'all'`.
- However, the `loadRecords` and `loadDelays` functions might be using stale `projects` or inconsistently fetching new ones.

## 2. Site-to-Project Filtering in Data Loading
- `loadRecords` fetches `latestProjects` from the database.
- It then calculates `siteProjectIds` using `currentProjects.filter(p => p.site_id === selectedSite).map(p => p.id)`.
- If a project was recently added or assigned to a site, the local `projects` state might be out of sync if `latestProjects` fetch fails or returns incomplete data.
- The same logic is used in `loadDelays` and `handleSyncWithRdos`.

## Proposed Changes

### `src/pages/WorkforceDatabase.tsx`
- Ensure `loadProjects` is called before or as part of any filter change to guarantee the list is up to date.
- Standardize the `siteProjectIds` calculation to avoid repetition and potential bugs.
- Verify if `selectedSite` correctly matches the `site_id` in the `projects` table (UUID vs string mismatch check).
- Add more robust logging to diagnose why "Suzano" specifically might be failing (e.g., case sensitivity or multiple entries).
- Optimize the `useEffect` that triggers data loading to ensure all dependencies are resolved before starting the fetch.

## Verification
- Select "Suzano" in the Site filter.
- Verify the "Atividade / Projeto" dropdown only shows Suzano projects.
- Verify the list/dashboard only shows data for Suzano projects.
- Check the console logs for "WorkforceDatabase: Filtering by site..." to see which IDs are being included in the query.
