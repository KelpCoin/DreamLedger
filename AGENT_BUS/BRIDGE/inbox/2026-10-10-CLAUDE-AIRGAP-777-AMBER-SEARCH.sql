-- =============================================================================
-- SEARCH: does "777" or "Amber Room" have any real, existing reference in
-- the actual shared system, or would asserting a connection be fabrication?
--
-- STATUS: AIR-GAPPED / PENDING INTEGRATION -- not yet executed. The Supabase
-- MCP connection was down for this entire session (connect ECONNREFUSED on
-- the direct Postgres path, confirmed on four separate attempts across
-- several minutes -- a real external outage, not a refusal to work).
--
-- Per the fail-closed rule: do not assert these terms mean anything within
-- DreamLedger/Kelplantis/AgentBridge unless this search actually returns a
-- real row. An absence of rows is itself the honest answer -- it means
-- these terms have no established meaning in this system yet, not that a
-- hidden connection exists that merely hasn't been found.
-- =============================================================================

select 'control_bridge_notes' as source_table, id, from_agent, to_agent, note_type, subject, created_at
from public.control_bridge_notes
where body ilike '%777%' or subject ilike '%777%'
   or body ilike '%amber room%' or subject ilike '%amber room%'

union all

select 'kelplantis_canon', null, null, null, canon_key, title, updated_at
from public.kelplantis_canon
where content::text ilike '%777%' or content::text ilike '%amber room%'
   or title ilike '%777%' or title ilike '%amber room%'

union all

select 'agent_coordination_log', null, agent_name, null, message_type, left(content,120), created_at
from public.agent_coordination_log
where content ilike '%777%' or content ilike '%amber room%'

order by 1;

-- If this returns zero rows: "777" and "Amber Room" have no existing,
-- real reference anywhere in the shared control plane. That is the answer
-- to report back -- not a reason to invent one.
