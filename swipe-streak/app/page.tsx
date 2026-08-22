'use client';

import { useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

const products = [
  ['mtg-001','Sol Ring',3,'Iconic Commander mana acceleration.'],['mtg-002','Command Tower',1.5,'Flexible Commander fixing.'],['mtg-003','Arcane Signet',2.5,'Efficient colour fixing.'],['mtg-004','Rhystic Study',38,'Premium card advantage.'],['mtg-005','Smothering Tithe',34,'High-impact white ramp.'],['mtg-006','Cyclonic Rift',28,'Premium blue interaction.'],['mtg-007','Swiftfoot Boots',2,'Protects key creatures.'],['mtg-008','Lightning Greaves',3.5,'Haste and protection.'],['mtg-009','Beast Within',1.8,'Flexible green removal.'],['mtg-010','Swords to Plowshares',1.2,'Efficient creature removal.'],['mtg-011','Counterspell',1,'Classic blue interaction.'],['mtg-012','Cultivate',0.8,'Reliable ramp and fixing.'],['mtg-013','Blasphemous Act',2.4,'Efficient red board wipe.'],['mtg-014','Heroic Intervention',13,'Protects your board.'],['mtg-015','Esper Sentinel',26,'Efficient white card draw.'],['mtg-016','Dockside Extortionist',55,'Explosive red treasure engine.'],['mtg-017','Farewell',6,'Versatile board reset.'],['mtg-018','Mystic Remora',9,'Cheap blue card advantage.'],['mtg-019','Black Market Connections',18,'Flexible black value engine.'],['mtg-020','Panharmonicon',4.5,'Blink and ETB multiplier.']];

export default function Page() {
  const [index, setIndex] = useState(0); const [streak, setStreak] = useState(0); const [credits, setCredits] = useState(0); const [notice, setNotice] = useState('');
  const card = products[index % products.length];
  const progress = useMemo(() => Math.min(streak, 10), [streak]);
  async function swipe(direction: 'left'|'right') {
    const next = direction === 'right' ? streak + 1 : 0;
    setStreak(next);
    setIndex(i => i + 1);
    if (direction === 'right' && next % 10 === 0) { setCredits(c => c + 1); setNotice('Streak 10! +1 credit unlocked.'); }
    else setNotice(direction === 'right' ? `Streak ${next}` : 'Fresh deck.');
    if (supabase) {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        await supabase.from('swipe_swipes').insert({ user_id: data.user.id, product_id: card[0], direction });
        await supabase.from('swipe_game_state').upsert({ user_id: data.user.id, streak: next, rewards_unlocked: Math.floor(next / 10), updated_at: new Date().toISOString() });
        await supabase.from('swipe_user_state').upsert({ user_id: data.user.id, streak: next, credits: credits + (direction === 'right' && next % 10 === 0 ? 1 : 0), updated_at: new Date().toISOString() });
      }
    }
  }
  return <main className="shell"><header><div><span className="eyebrow">SWIPE STREAK EMPIRE</span><h1>Swipe. Streak. Unlock.</h1><p>20 MTG cards are live in the first silo. Right swipes build the streak.</p></div><div className="stats"><div><b>{streak}</b><span>streak</span></div><div><b>{credits}</b><span>credits</span></div></div></header><section className="arena"><div className="card"><div className="badge">MTG / Commander</div><div className="art">{card[1]}</div><div className="meta"><div><h2>{card[1]}</h2><p>{card[3]}</p></div><strong>NZD {Number(card[2]).toFixed(2)}</strong></div><div className="actions"><button onClick={() => swipe('left')} className="no">PASS</button><button onClick={() => swipe('right')} className="yes">LIKE</button></div></div><div className="progress"><span>{progress}/10 to reward</span><div className="bar"><i style={{ width: `${progress * 10}%` }} /></div>{notice && <p>{notice}</p>}</div></section><section className="worlds"><article><span>01</span><h3>Catalog</h3><p>Expand from MTG into every controlled product silo.</p></article><article><span>02</span><h3>Avatars</h3><p>Use streaks and credits to unlock collectible identities.</p></article><article><span>03</span><h3>Games</h3><p>Turn engagement into persistent reward loops.</p></article></section></main>;
}
