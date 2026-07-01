import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Home() {
  const [offers, setOffers] = useState([]);
  useEffect(() => {
    async function loadOffers() {
      const { data } = await supabase
        .from('offers')
        .select('*')
        .eq('lifecycle_status', 'live')
        .eq('visibility', 'featured')
        .limit(12);
      if (data) setOffers(data);
    }
    loadOffers();
  }, []);
  return (
    <div style={{ background: '#0a0e17', color: '#00d4ff', fontFamily: 'monospace', minHeight: '100vh', padding: '2rem' }}>
      <h1 style={{ fontSize: '3rem', textAlign: 'center' }}> DreamLedger</h1>
      <p style={{ color: '#00ff88', textAlign: 'center' }}>Live Carousel Catalog</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', maxWidth: '1200px', margin: '2rem auto' }}>
        {offers.map(o => (
          <div key={o.id} style={{ background: '#1a1a2e', borderRadius: '12px', padding: '1.5rem', border: '1px solid #00d4ff33' }}>
            <h3>{o.title}</h3>
            <p>{o.description}</p>
            <div style={{ color: '#00ff88', fontSize: '1.5rem' }}>${(o.final_price_cents/100).toFixed(2)}</div>
            <a href={`/checkout?offer=${o.id}`} style={{ display: 'inline-block', background: '#00d4ff', color: '#000', padding: '0.5rem 1.5rem', borderRadius: '6px', textDecoration: 'none', marginTop: '1rem' }}>Buy Now</a>
          </div>
        ))}
      </div>
    </div>
  );
}
