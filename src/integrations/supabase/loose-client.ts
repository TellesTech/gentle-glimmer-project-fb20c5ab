// Loosely typed re-export of the supabase client.
// Used in files that touch tables/columns/RPCs not yet present in the
// auto-generated `./types` (e.g. project_weekly_progress, backup_schedules,
// backup_history, get_public_branding, get_login_stats, columns recently
// added to `reports`, `report_signatures`, `feature_suggestions`, etc.).
// This keeps the build green without weakening type safety elsewhere.
import { supabase as typedSupabase } from "./client";

export const supabase: any = typedSupabase;
export default supabase;