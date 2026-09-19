-- BECK objective persistence acceptance probes.
select public.beck_success_condition_hash();
select id,type,status,beck_lifecycle,beck_objective_id,beck_success_condition_hash from public.jobs where type='beck_objective' order by created_at desc;
select public.beck_verify_objective('4a6b91c6-7409-4486-ade8-9c90f241f901');
select evidence_id,source,verification_status,content_hash from public.cube_evidence_vault where evidence_id='553c9166-b3f1-4ab8-aa7f-414219cb4f84';
select id,event_type,payload,event_timestamp from public.telemetry_events where id='640fe074-2b33-4db1-9764-37de0f957a00';
select id,type,status,worker_id,lease_token,leased_until,attempt_count from public.jobs where id in ('61d4a6e6-11e8-4d49-87f4-6c134349665b','d878e885-bff1-4061-98c9-231322948f6d','06fa4298-89bb-414f-8e7a-c3c86ce6a2e5','98943171-b0bb-4f2b-8d44-b2fe3c53ea74');