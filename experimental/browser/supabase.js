import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm';

export const SUPABASE_URL = 'https://xkguvpwhfpksaltjdofv.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_rA4N5-KX3A_ACZHbylEjBw_WvokXs85';

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);
