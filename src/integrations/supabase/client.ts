import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://epvmtsrsgwltxycpkwtz.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVwdm10c3JzZ3dsdHh5Y3Brd3R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MTk4NjQsImV4cCI6MjA5NzI5NTg2NH0.5gA4F4l_bo8OJXcRmIRaZlGyZAYFSWhc3gvBsc31k0g";

const isBrowser = typeof window !== "undefined";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: isBrowser,
    autoRefreshToken: isBrowser,
    storage: isBrowser ? window.localStorage : undefined,
    detectSessionInUrl: isBrowser,
  },
});
