import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function Page({ params }) {
  const { data: deck } = await supabase
    .from("decks")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!deck) return notFound();

  return (
    <div style={{ padding: 24 }}>
      <h1>{deck.name}</h1>
      <p>{deck.commander}</p>
      <p>${(deck.price_nzd / 100).toFixed(2)} NZD</p>
    </div>
  );
}