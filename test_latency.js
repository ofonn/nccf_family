const SUPABASE_URL = 'https://klixdvlrktntdyzqvayx.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsaXhkdmxya3RudGR5enF2YXl4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDU1MDc3MywiZXhwIjoyMTAwMTI2NzczfQ.B8wzSewCrtZOhQZIZnTMjfurGb2BDEETl9VXQTX4xDA';

async function testSupabase() {
  const t1 = Date.now();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rosters_data?id=eq.1&select=data`, {
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
    }
  });
  await res.json();
  console.log("Direct Supabase GET Time:", Date.now() - t1, "ms");
}
testSupabase();
