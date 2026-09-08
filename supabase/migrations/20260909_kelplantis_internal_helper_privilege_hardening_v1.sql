-- Internal Kelplantis helpers are implementation details, not browser API.
-- Keep browser access limited to the explicit public game RPC contract.
revoke all on function public.kelplantis__gen_floor1_dungeon() from public, anon, authenticated;
revoke all on function public.kelplantis__pick_flavor(text) from public, anon, authenticated;
revoke all on function public.kelplantis__pick_flavor_tagged(text,text) from public, anon, authenticated;
revoke all on function public.kelplantis__pick_room_modifier() from public, anon, authenticated;
revoke all on function public.kelplantis__pick_room_modifier(boolean) from public, anon, authenticated;
revoke all on function public.kelplantis__room_modifier_meta(text) from public, anon, authenticated;
revoke all on function public.kelplantis_sync_floor_gate() from public, anon, authenticated;
