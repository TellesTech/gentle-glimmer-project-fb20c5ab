// Helper to fix type inference broken by __InternalSupabase in auto-generated Database type.
// All files should import User, Session, and supabaseAuth from here.
import { supabase } from '@/integrations/supabase/client';

// Re-export auth types from the underlying auth library
export type { User, Session } from '@supabase/supabase-js';

// The auto-generated types.ts has __InternalSupabase with PostgrestVersion "14.1"
// which breaks supabase.auth type inference. This cast restores proper typing.
export const supabaseAuth = supabase.auth as any;
