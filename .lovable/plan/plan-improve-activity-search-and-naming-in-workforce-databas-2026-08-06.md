# Plan: Improve Activity Search and Naming in Workforce Database

The user wants to fix two issues:
1. **Searchability**: Searching for "Suzano" in the activities filter of the Workforce Database doesn't find specific activities (like "OM 22461261 — Transportadora 09") because the search only looks at the activity name.
2. **Naming**: The page/concept should be referred to as "Base de Dados" (Database) instead of "Banco de Colaboradores" (Collaborator Bank).

## Proposed Changes

### 1. Workforce Database Page (`src/pages/WorkforceDatabase.tsx`)
- **Update Page Header/Title**: Change references from "Banco de Colaboradores" (or similar) to "Base de Dados".
- **Update Data Fetching**: Modify `loadProjects` to fetch site and company names along with project data.
- **Enhance Searchability**: 
    - Update the `CommandItem`'s `value` in the project filter `Combobox` to include the project name, site name, and company name. This ensures that typing "Suzano" will match all activities belonging to any Suzano site.
    - If "Todos os sites" is selected, show the site name as a secondary label in the project list for better context.
- **Improve Loading Feedback**: Ensure that when filters change, the user sees a clear loading state while records and projects are synchronized.

### 2. Validation
- Verify that searching for "Suzano" now returns all activities associated with Suzano sites.
- Verify that selecting a specific site correctly restricts the activity list to only that site's projects.
- Confirm that the page title and labels now reflect "Base de Dados".

## Technical Details
- Use `supabase.from('projects').select('id, name, site_id, sites(name, companies(name))')` for data loading.
- Join the names with a delimiter (e.g., `|`) in the `CommandItem`'s `value` prop to ensure `Command`'s internal filtering works across all fields.
