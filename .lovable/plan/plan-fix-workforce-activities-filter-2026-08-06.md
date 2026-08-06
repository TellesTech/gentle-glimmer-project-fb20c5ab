# Plan - Fix Workforce Activities Filter

The user reported that in the "Base de Dados HH" (Workforce Database), the system is not pulling the "real activities" (projects) of the selected unit (site). 

## Analysis
- In `WorkforceDatabase.tsx`, the `filteredProjects` variable is correctly computed based on `selectedSite`.
- However, when `loadRecords` or `syncFromRdos` is called, it filters by `selectedProject` or `selectedSite`.
- The `loadProjects` function loads ALL projects. 
- The `loadRecords` function uses `selectedSite` to filter projects:
  ```typescript
  } else if (selectedSite !== 'all') {
    const siteProjectIds = projects.filter(p => p.site_id === selectedSite).map(p => p.id);
    if (siteProjectIds.length > 0) {
      rdoQuery = rdoQuery.in('reports.project_id', siteProjectIds);
    } else {
      setRecords([]);
      setLoading(false);
      return;
    }
  }
  ```
- The issue might be that `projects` is populated once on mount, but if a site is selected later, it might not be reflecting the latest project-site relationships if they were changed, though this is unlikely given it's a simple list.
- A more likely scenario is that the UI for selecting a project is showing "Todos os projetos" by default, and when a site is selected, the list of projects *should* update but the user might still see records from other projects if the filter logic in `loadRecords` isn't strictly enforced or if there's a mismatch between the `projects` state and the actual DB state.
- Also, `loadLastReportDate` and other functions depend on `selectedSite` and `selectedProject`.
- Looking at the `loadRecords` implementation, it seems to be doing the right thing for `selectedSite` by finding all project IDs for that site.

## Proposed Changes
1.  **Strict Project Filtering in Select**: Ensure the project dropdown in `WorkforceDatabase.tsx` correctly clears or defaults when the site changes, and only shows projects for that site.
2.  **Audit Data Loading**: Verify if `loadRecords` is missing any data when a site is selected.
3.  **UI Feedback**: The user mentions "atividades reais". It's possible the `activity_name` being displayed is just "Sem projeto" or coming from a source that doesn't have the project link.
4.  **Sync Logic**: The `syncFromRdos` function also has a filter for `selectedSite`. I'll ensure it's robust.

## Plan
1.  Review `src/pages/WorkforceDatabase.tsx` to ensure `selectedProject` is reset to 'all' whenever `selectedSite` changes (already seems to be there: `handleSiteChange`).
2.  Verify the `reports!inner(id, date, project_id, projects!inner(id, name, site_id))` join in `syncFromRdos`. It's possible some reports don't have a `project_id` or the project doesn't have a `site_id` assigned.
3.  Add explicit project name fetching from the `reports -> projects` relationship if it's missing or defaulting incorrectly.
4.  Test the filtering logic with a targeted Playwright script to confirm if selecting a site indeed filters the activities correctly.

## Verification
1.  Run a Playwright test:
    - Load `/workforce-database`.
    - Select a specific site (e.g., "Suzano Aracruz").
    - Verify that the records shown and the "Atividade / Projeto" dropdown only contain projects belonging to that site.
    - Check the console for any query errors.
