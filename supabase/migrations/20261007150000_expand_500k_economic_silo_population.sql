-- 500K ECONOMIC SILO POPULATION
-- Generated 2026-10-07
-- Purpose: expand the EXISTING CUBE substrate into 500,000 logical silo candidates.
-- This does NOT create public sites, buyers, payments, authorization, revenue, or verified outcomes.
-- It reuses existing substrate only:
--   100 CUBE economic events × existing money lanes × 7 lenses × 7 transforms × 7 experiment lanes
--   = 514,500 possible combinations; first 500,000 are materialized.
-- All rows remain CANDIDATE / UNQUALIFIED / UNVERIFIED / HIDDEN / externally blocked.
-- No new economic truth is manufactured.

begin;

with
events(event_id, domain_id, event_name, buyer_class) as (
  values
    ('EA-001','electronics-appliances','refurbished-phone-sale','NZ consumer'),
    ('EA-002','electronics-appliances','refurbished-laptop-sale','NZ student/professional'),
    ('EA-003','electronics-appliances','open-box-appliance-sale','NZ household'),
    ('EA-004','electronics-appliances','device-accessory-bundle','NZ consumer'),
    ('EA-005','electronics-appliances','compatibility-kit-sale','NZ consumer'),
    ('EA-006','electronics-appliances','setup-service','NZ household'),
    ('EA-007','electronics-appliances','trade-in-sale','NZ consumer'),
    ('EA-008','electronics-appliances','business-surplus-sale','NZ SME'),
    ('EA-009','electronics-appliances','clearance-bundle','NZ consumer'),
    ('EA-010','electronics-appliances','local-pickup-electronics','NZ local buyer'),
    ('HG-001','home-garden','secondhand-furniture-sale','NZ household'),
    ('HG-002','home-garden','garden-starter-kit','NZ homeowner'),
    ('HG-003','home-garden','diy-project-bundle','NZ DIY buyer'),
    ('HG-004','home-garden','decor-bundle','NZ household'),
    ('HG-005','home-garden','appliance-bundle','NZ household'),
    ('HG-006','home-garden','seasonal-garden-pack','NZ gardener'),
    ('HG-007','home-garden','installation-addon','NZ homeowner'),
    ('HG-008','home-garden','local-delivery-upgrade','NZ local buyer'),
    ('HG-009','home-garden','room-completion-bundle','NZ household'),
    ('HG-010','home-garden','surplus-homewares-sale','NZ consumer'),
    ('HB-001','health-beauty','compliant-skincare-bundle','NZ consumer'),
    ('HB-002','health-beauty','beauty-gift-set','NZ gift buyer'),
    ('HB-003','health-beauty','salon-surplus-stock','NZ salon'),
    ('HB-004','health-beauty','beauty-accessory-sale','NZ consumer'),
    ('HB-005','health-beauty','appointment-voucher','NZ consumer'),
    ('HB-006','health-beauty','consultation-voucher','NZ consumer'),
    ('HB-007','health-beauty','replenishment-pack','NZ consumer'),
    ('HB-008','health-beauty','seasonal-beauty-bundle','NZ consumer'),
    ('HB-009','health-beauty','curated-starter-kit','NZ beginner'),
    ('HB-010','health-beauty','local-beauty-product-sale','NZ consumer'),
    ('PET-001','pet','pet-starter-pack','NZ pet owner'),
    ('PET-002','pet','food-accessory-bundle','NZ pet owner'),
    ('PET-003','pet','grooming-voucher','NZ pet owner'),
    ('PET-004','pet','training-guide-sale','NZ pet owner'),
    ('PET-005','pet','secondhand-pet-equipment','NZ pet owner'),
    ('PET-006','pet','seasonal-pet-bundle','NZ pet owner'),
    ('PET-007','pet','replenishment-pack','NZ pet owner'),
    ('PET-008','pet','pet-gift-pack','NZ gift buyer'),
    ('PET-009','pet','convenience-bundle','NZ pet owner'),
    ('PET-010','pet','local-pet-delivery','NZ local buyer'),
    ('BS-001','books-stationery','used-book-lot','NZ reader'),
    ('BS-002','books-stationery','curated-genre-box','NZ reader'),
    ('BS-003','books-stationery','study-pack','NZ student'),
    ('BS-004','books-stationery','stationery-bundle','NZ student/professional'),
    ('BS-005','books-stationery','collector-edition-sale','NZ collector'),
    ('BS-006','books-stationery','school-supply-kit','NZ household'),
    ('BS-007','books-stationery','reading-guide-sale','NZ reader'),
    ('BS-008','books-stationery','signed-limited-material','NZ collector'),
    ('BS-009','books-stationery','local-pickup-book-lot','NZ local buyer'),
    ('BS-010','books-stationery','themed-reading-bundle','NZ reader'),
    ('SO-001','sports-outdoors','used-sporting-equipment','NZ athlete'),
    ('SO-002','sports-outdoors','outdoor-starter-kit','NZ outdoors buyer'),
    ('SO-003','sports-outdoors','club-surplus-sale','NZ club'),
    ('SO-004','sports-outdoors','team-merchandise','NZ team/fan'),
    ('SO-005','sports-outdoors','training-plan-sale','NZ athlete'),
    ('SO-006','sports-outdoors','coaching-session','NZ athlete'),
    ('SO-007','sports-outdoors','seasonal-gear-bundle','NZ outdoors buyer'),
    ('SO-008','sports-outdoors','equipment-lot','NZ athlete/club'),
    ('SO-009','sports-outdoors','recreation-accessory-sale','NZ recreation buyer'),
    ('SO-010','sports-outdoors','local-pickup-sporting-goods','NZ local buyer'),
    ('BK-001','baby-kids','secondhand-baby-equipment','NZ parent'),
    ('BK-002','baby-kids','childrens-clothing-lot','NZ parent'),
    ('BK-003','baby-kids','toy-bundle','NZ parent'),
    ('BK-004','baby-kids','school-starter-kit','NZ parent'),
    ('BK-005','baby-kids','parenting-guide-sale','NZ parent'),
    ('BK-006','baby-kids','party-kit','NZ parent'),
    ('BK-007','baby-kids','seasonal-kids-bundle','NZ parent'),
    ('BK-008','baby-kids','baby-starter-pack','NZ parent'),
    ('BK-009','baby-kids','local-pickup-lot','NZ local parent'),
    ('BK-010','baby-kids','gift-bundle','NZ gift buyer'),
    ('AU-001','automotive','vehicle-accessory-sale','NZ vehicle owner'),
    ('AU-002','automotive','used-tools-sale','NZ mechanic/DIY'),
    ('AU-003','automotive','detailing-kit','NZ vehicle owner'),
    ('AU-004','automotive','workshop-surplus','NZ workshop'),
    ('AU-005','automotive','parts-bundle','NZ vehicle owner'),
    ('AU-006','automotive','owner-guide-sale','NZ vehicle owner'),
    ('AU-007','automotive','replacement-consumable','NZ vehicle owner'),
    ('AU-008','automotive','service-voucher','NZ vehicle owner'),
    ('AU-009','automotive','fleet-equipment-bundle','NZ SME'),
    ('AU-010','automotive','local-pickup-parts','NZ local buyer'),
    ('FP-001','food-pantry','specialty-pantry-box','NZ household'),
    ('FP-002','food-pantry','local-producer-bundle','NZ consumer'),
    ('FP-003','food-pantry','gift-hamper','NZ gift buyer'),
    ('FP-004','food-pantry','subscription-pantry-box','NZ household'),
    ('FP-005','food-pantry','recipe-pack','NZ cook'),
    ('FP-006','food-pantry','regional-food-box','NZ consumer'),
    ('FP-007','food-pantry','corporate-gift-pack','NZ business'),
    ('FP-008','food-pantry','excess-stock-lot','NZ reseller'),
    ('FP-009','food-pantry','seasonal-food-bundle','NZ household'),
    ('FP-010','food-pantry','catering-deposit','NZ business/event'),
    ('EDU-001','education-courses','mini-course-sale','NZ learner'),
    ('EDU-002','education-courses','worksheet-sale','NZ learner/teacher'),
    ('EDU-003','education-courses','exam-prep-pack','NZ student'),
    ('EDU-004','education-courses','tutoring-session','NZ student/parent'),
    ('EDU-005','education-courses','lesson-plan-sale','NZ teacher'),
    ('EDU-006','education-courses','teacher-resource-bundle','NZ teacher'),
    ('EDU-007','education-courses','industry-skill-guide','NZ professional'),
    ('EDU-008','education-courses','cohort-seat','NZ learner'),
    ('EDU-009','education-courses','certification-prep','NZ professional'),
    ('EDU-010','education-courses','premium-research-report','NZ professional/business')
),
lanes(template_key, price_nzd) as (
  values
    ('QUOTE_COMPARE_49','49'),
    ('DOC_EXTRACT_50','50'),
    ('SUPPLIER_CHECK_50','50'),
    ('EVIDENCE_PACKET_10','10'),
    ('SELLER_PROFIT_AUDIT_29','29'),
    ('COMMERCIAL_TRUTH_STRESS_TEST_999','999'),
    ('ACNC_DUE_DILIGENCE_99','99'),
    ('BILLBOARD_FOUNDING_50','50'),
    ('COMMANDER_DIAGNOSTIC_29','29'),
    ('EDH_0001','400'),
    ('AGENTIC_COMMERCE_READINESS_AUDIT','49'),
    ('AI_COMMERCE_IMPLEMENTATION_STARTER','499'),
    ('AI_COMMERCE_PRODUCTIZED_BUILD','2500'),
    ('AI_COMMERCE_SYSTEM_DEPLOYMENT','10000'),
    ('AI_FAILURE_POST_MORTEM','2500')
),
lenses(lens) as (
  values
    ('BUYER'),
    ('PROBLEM'),
    ('OFFER'),
    ('CHANNEL'),
    ('PRICE'),
    ('FULFILLMENT'),
    ('PROOF')
),
transforms(transform) as (
  values
    ('NARROW'),
    ('BUNDLE'),
    ('SPLIT'),
    ('REPEAT'),
    ('MONITOR'),
    ('VERIFY'),
    ('BROKER')
),
experiment_lanes(lane_id) as (
  values
    ('LANE-A'),
    ('LANE-B'),
    ('LANE-C'),
    ('LANE-D'),
    ('LANE-E'),
    ('LANE-F'),
    ('LANE-G')
),
population as (
  select
    row_number() over (
      order by e.event_id, l.template_key, le.lens, tr.transform, ex.lane_id
    ) as rn,
    e.event_id,
    e.domain_id,
    e.event_name,
    e.buyer_class,
    l.template_key,
    l.price_nzd,
    le.lens,
    tr.transform,
    ex.lane_id
  from events e
  cross join lanes l
  cross join lenses le
  cross join transforms tr
  cross join experiment_lanes ex
),
selected as (
  select *
  from population
  where rn <= 500000
),
batch as (
  insert into public.silo_factory_batches
    (requested_count, inserted_count, source_signal_count, status, generator_version, metadata)
  values
    (
      500000,
      0,
      0,
      'CREATED',
      '500K-SUBSTRATE-EXPANSION-v1',
      jsonb_build_object(
        'substrate_events', 100,
        'money_lanes', 15,
        'lenses', 7,
        'transforms', 7,
        'experiment_lanes', 7,
        'possible_combinations', 514500,
        'materialized_target', 500000,
        'source', 'BEC-PRIME/economics/CUBE-ECONOMIC-EVENTS-100.json + runtime/cube/substrate_inventory.json',
        'truth_state', 'UNVERIFIED'
      )
    )
  returning batch_id
),
inserted as (
  insert into public.economic_silo_registry (
    silo_id,
    display_name,
    slug,
    source_signal_id,
    domain_id,
    template_key,
    market_region,
    buyer_problem,
    proposed_deliverable,
    lifecycle_stage,
    qualification_status,
    evidence_status,
    public_visibility,
    public_route,
    commerce_cell_id,
    offer_id,
    human_approval_required,
    external_action_allowed,
    origin,
    provenance,
    metrics
  )
  select
    'M500K-' || lpad(s.rn::text, 6, '0'),
    s.event_name || ' / ' || s.template_key || ' / ' || s.lens || ' / ' || s.transform,
    'm500k-' || lpad(s.rn::text, 6, '0'),
    null,
    s.domain_id,
    s.template_key,
    'SOURCE_DEFINED_NZ',
    s.event_name || ' | buyer class: ' || s.buyer_class,
    s.template_key || ' via ' || s.transform,
    'CANDIDATE',
    'UNQUALIFIED',
    'UNVERIFIED',
    'HIDDEN',
    '/silo/m500k-' || lpad(s.rn::text, 6, '0'),
    null,
    null,
    true,
    false,
    'DERIVED_FROM_EXISTING_SUBSTRATE',
    jsonb_build_object(
      'population_batch', '500K-SUBSTRATE-EXPANSION-v1',
      'economic_event_id', s.event_id,
      'money_lane', s.template_key,
      'price_hypothesis_nzd', s.price_nzd,
      'lens', s.lens,
      'transform', s.transform,
      'experiment_lane', s.lane_id,
      'buyer_class', s.buyer_class,
      'source_signal', null,
      'truth_state', 'UNVERIFIED',
      'public_launch', false
    ),
    jsonb_build_object(
      'impressions',0,
      'checkout_intents',0,
      'settled_payments',0,
      'fulfilled_orders',0,
      'verified_outcomes',0
    )
  from selected s
  on conflict (silo_id) do nothing
  returning silo_id
)
select 1;

update public.silo_factory_batches b
set
  inserted_count = (
    select count(*)
    from public.economic_silo_registry r
    where r.silo_id like 'M500K-%'
  ),
  status = 'LOADED',
  completed_at = now()
where b.generator_version = '500K-SUBSTRATE-EXPANSION-v1'
  and b.status = 'CREATED';

commit;
