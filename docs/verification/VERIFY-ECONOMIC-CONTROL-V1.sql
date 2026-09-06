-- Economic Control v1 verifier
SELECT * FROM public.control_dashboard;

SELECT control_id, family, level, name, active
FROM public.control_registry
ORDER BY control_id;

SELECT invariant_id, severity, active, statement
FROM public.control_invariants
ORDER BY invariant_id;

SELECT note_id, from_agent, to_agent, note_type, subject, requires_response, created_at
FROM public.control_bridge_notes
ORDER BY created_at DESC
LIMIT 20;

SELECT type, status, count(*) AS count
FROM public.jobs
WHERE type = 'REVENUE_PROSPECTING'
GROUP BY type, status
ORDER BY status;
