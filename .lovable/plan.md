# Plan: Fix Workforce Database Filters

The user reported that the "Atividade / Projeto" (Project) filter is not searchable ("não dá pra escrever") and that filtering by "Fábrica" (Site) is not working as expected.

## Proposed Changes

### 1. Enable Searchable Project Filter
Replace the standard `Select` for "Atividade / Projeto" with a `Combobox` (using `Popover` + `Command`) to allow users to type and search through projects. This is especially important for sites with many projects.

### 2. Improve Site Filtering Logic
Review and reinforce the `useEffect` dependencies and the `loadRecords`/`loadDelays` logic to ensure that selecting a site immediately and correctly filters all data.
- Ensure `selectedSite` change correctly triggers `loadRecords`.
- Verify that `loadRecords` uses the `selectedSite` to filter projects correctly in the Supabase query.
- Add a reset for `selectedProject` when `selectedSite` changes (already exists but will double-check).

### 3. Verification Plan
- Use the preview to select different "Fábricas" and verify the "Atividade / Projeto" list updates.
- Verify that typing in the new search box filters the projects.
- Check console logs for "WorkforceDatabase: Loading records with filters" to confirm the correct parameters are sent to Supabase.
