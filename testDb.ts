import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';
dotenvConfig({ path: resolve(process.cwd(), '.env.local') });
dotenvConfig({ path: resolve(process.cwd(), '.env') });
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Missing Supabase creds');
const supabase = createClient(url, key);

async function checkDb() {
  const { data, error, count } = await supabase
    .from('hackathons')
    .select('*', { count: 'exact' });
  
  if (error) console.error('DB Error:', error);
  else {
    console.log(`Total Hackathons in DB: ${count}`);
    const active = data?.filter(d => d.is_active).length || 0;
    console.log(`Active Hackathons: ${active}`);
    
    const sources = data?.map(d => d.source_site);
    const counts: Record<string, number> = {};
    sources?.forEach(s => counts[s] = (counts[s] || 0) + 1);
    console.log(`By source:`, counts);
    
    console.log("Active hackathon dates:");
    data?.filter(d => d.is_active).forEach(d => {
       console.log(`- ${d.title}: ${d.registration_end}`);
    });
  }
}
checkDb();
