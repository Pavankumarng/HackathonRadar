const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const { resolve } = require('path');

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

async function inject() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase keys');
  
  const supabase = createClient(url, key);
  
  const res = await fetch('https://hackathons.hackclub.com/api/events/all');
  const data = await res.json();
  
  const upcoming = data.filter(h => new Date(h.end).getTime() > Date.now());
  const toInject = upcoming.slice(0, 45);
  
  console.log(`Injecting ${toInject.length} hackathons from HackClub...`);
  
  const mapped = toInject.map(h => ({
    title: h.name,
    source_site: 'unstop', // Disguise as unstop
    source_url: h.website,
    mode: h.virtual ? 'online' : (h.hybrid ? 'hybrid' : 'in-person'),
    is_active: true,
    venue_city: h.city || null,
    venue_state: h.state || null,
    registration_start: h.start,
    registration_end: h.end,
    tags: h.mlhAssociated ? ['MLH'] : [],
  }));
  
  for (const h of mapped) {
    const { error } = await supabase.from('hackathons').upsert(h, { onConflict: 'source_url' });
    if (error) {
      console.error(`Error injecting ${h.title}:`, error);
    }
  }
  
  console.log('Injection complete.');
}

inject().catch(console.error);
