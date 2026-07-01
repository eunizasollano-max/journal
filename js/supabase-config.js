const SUPABASE_URL = 'https://ezyvguvvntxdkwrjkqsa.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_IYPoELgtZDnBQmeGu2At7g_WetIIuAd';
const STRIPE_PUBLISHABLE_KEY = 'pk_test_51ToGjLKtZkEjMDWMuDzMJezzPTR9DvmtSBwxHuWzinzIkfTVm24AVCsK11WGOmnEcAAhxzDPKkc79kawq94kaYiV00fH0cKpRI';

const SupabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Keep FIREBASE_ENABLED=false so db.js continues using IndexedDB
window.FIREBASE_ENABLED = false;
window.SupabaseClient = SupabaseClient;
window.SUPABASE_URL = SUPABASE_URL;
window.STRIPE_PUBLISHABLE_KEY = STRIPE_PUBLISHABLE_KEY;
