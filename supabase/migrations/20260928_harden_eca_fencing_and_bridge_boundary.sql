BEGIN;

REVOKE EXECUTE ON FUNCTION public.finalize_economic_model_task(uuid,bigint,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_economic_model_task(uuid,bigint,uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.record_fenced_economic_assessment(uuid,bigint,numeric,text,integer,boolean,boolean,boolean,boolean,boolean,numeric,text,jsonb,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_fenced_economic_assessment(uuid,bigint,numeric,text,integer,boolean,boolean,boolean,boolean,boolean,numeric,text,jsonb,text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.complete_control_bridge_note(uuid,text,text,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_control_bridge_note(uuid,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_control_bridge_note(uuid,text,text,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_control_bridge_note(uuid,text,text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.complete_control_bridge_note(
  p_note_id uuid,
  p_task_id uuid,
  p_run_lease bigint,
  p_worker_id text,
  p_response_body text,
  p_response_subject text DEFAULT 'Bridge execution response',
  p_response_note_type text DEFAULT 'FINDING',
  p_from_agent text DEFAULT NULL
)
RETURNS TABLE(response_note_id uuid, completed_note_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_task public.economic_model_tasks;
  v_note public.control_bridge_notes;
  v_response_id uuid;
  v_from_agent text;
BEGIN
  IF p_run_lease IS NULL THEN RAISE EXCEPTION 'run_lease is required'; END IF;
  IF p_worker_id IS NULL OR btrim(p_worker_id) = '' THEN RAISE EXCEPTION 'p_worker_id is required'; END IF;
  IF p_response_note_type NOT IN ('HANDOFF','QUESTION','FINDING','WARNING','DECISION','LOVE_NOTE') THEN
    RAISE EXCEPTION 'invalid response note type';
  END IF;

  SELECT e.* INTO v_task
  FROM public.economic_model_tasks e
  WHERE e.task_id = p_task_id
    AND e.status = 'completed'
    AND e.run_lease = p_run_lease
    AND e.assessment_id IS NOT NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'STALE_ECONOMIC_TASK_EXECUTION: task %, run_lease % is not finalized by this fence', p_task_id, p_run_lease;
  END IF;

  SELECT n.* INTO v_note
  FROM public.control_bridge_notes n
  WHERE n.note_id = p_note_id
    AND n.task_id = p_task_id
    AND n.requires_response = true
    AND n.response_note_id IS NULL
    AND n.execution_status IN ('CLAIMED','RUNNING')
    AND n.claimed_by = p_worker_id
    AND (n.lease_until IS NULL OR n.lease_until > now())
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BRIDGE_FENCE_REJECTED: note %, task %, worker ownership or lease invalid', p_note_id, p_task_id;
  END IF;

  v_from_agent := coalesce(nullif(btrim(p_from_agent), ''), p_worker_id);

  INSERT INTO public.control_bridge_notes (
    from_agent,to_agent,note_type,subject,body,requires_response,
    correlation_id,lane,priority,silo_id,source_system,task_id
  ) VALUES (
    v_from_agent,v_note.from_agent,p_response_note_type,p_response_subject,p_response_body,false,
    v_note.correlation_id,v_note.lane,v_note.priority,v_note.silo_id,'BECK_LOCAL_PRIMARY',p_task_id
  )
  RETURNING note_id INTO v_response_id;

  UPDATE public.control_bridge_notes n
  SET response_note_id = v_response_id,
      execution_status = 'SUCCEEDED',
      completed_at = now(),
      lease_until = null,
      last_error = null
  WHERE n.note_id = v_note.note_id
    AND n.task_id = p_task_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BRIDGE_FENCE_REJECTED_DURING_COMPLETE: note %, task %', p_note_id, p_task_id;
  END IF;

  RETURN QUERY SELECT v_response_id, v_note.note_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.complete_control_bridge_note(uuid,uuid,bigint,text,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_control_bridge_note(uuid,uuid,bigint,text,text,text,text,text) TO service_role;

COMMIT;
