# Economic Tomography Sensory Layer
## 777 functional specification · 2026-10-07

### Purpose
Add a multi-axial observation layer to 777 without replacing the existing economic truth, BECK, CUBE, Gauntlet, authority or payment boundaries.

### Core pipeline
BEAM → REGISTRATION → CONVERGENCE / DIVERGENCE → DELTA → ECONOMIC INTERPRETATION → GAUNTLET.

### Proposed Supabase logical model
This is a schema specification, not a production migration. Production DDL must be applied only after the Supabase connection is restored and verified.

#### economic_objects
One canonical latent economic object.
- object_id
- object_type
- canonical_name
- jurisdiction
- canonical_entity_id
- created_at
- current_state
- state_as_of
- truth_status

#### observation_beams
Immutable source observations. Never overwrite the original observation with an inference.
- beam_id
- object_id
- beam_type
- source_uri
- source_identity
- observed_at
- effective_from
- effective_to
- captured_at
- observation_hash
- raw_reference
- observation_status

#### beam_registrations
The identity/time/structure alignment between a beam and an economic object.
- registration_id
- beam_id
- object_id
- entity_match_confidence
- temporal_match_confidence
- relationship_type
- registration_status
- registration_reason
- registered_at

#### reconstruction_runs
A reproducible attempt to reconstruct state from registered observations.
- reconstruction_id
- object_id
- as_of
- beam_count
- independent_beam_count
- convergence_score
- divergence_score
- reconstruction_status
- model_version
- created_at

#### perception_artifacts
First-class records of synthetic or source-side distortion.
- artifact_id
- reconstruction_id
- artifact_type
- severity
- affected_beam_ids
- affected_registration_ids
- evidence
- mitigation
- status
- created_at

Artifact types:
MOTION_BLUR, REGISTRATION_ERROR, RING_DOWN, SHADOW, SPECKLE, ALIASING, DOPPLER_SHIFT.

#### signal_divergences
Material disagreements between registered observations.
- divergence_id
- reconstruction_id
- left_beam_id
- right_beam_id
- divergence_type
- magnitude
- time_delta
- identity_delta
- economic_delta
- evidence
- status

#### gauntlet_reconstructions
The Gauntlet's decision over a reconstruction.
- evaluation_id
- reconstruction_id
- independence_pass
- registration_pass
- temporal_pass
- artifact_pass
- economic_consequence_pass
- buyer_identified
- action_path_identified
- decision
- reason
- evaluated_at

### Registration rules
1. An observation is never promoted merely because its text resembles the target object.
2. Parent/subsidiary relationships must be explicit.
3. Every observation carries observed_at and captured_at where available.
4. Effective dates must remain distinct from publication dates.
5. Correlated copies of one source event do not count as independent beams.
6. Inference must never overwrite observation.
7. Unknown identity or incompatible time windows force UNVERIFIED or rejection.

### Ring-down suppression
Build a source-dependency graph. If multiple observations trace back to the same primary event, they are correlated echoes. Count the primary event once for independence scoring.

### Divergence trigger
A divergence becomes Gauntlet-significant only when:
- the observations are independently sourced;
- identity registration passes;
- temporal compatibility passes;
- the discrepancy is material;
- the discrepancy can be tied to an economic consequence;
- an affected party or economic object is identifiable;
- an action path can be tested.

### Promotion rule
OBSERVED → REGISTERED → RECONSTRUCTED → DIVERGENCE / CONVERGENCE → ECONOMIC CONSEQUENCE → GAUNTLET PASS → AUTHORITY → EXTERNAL TEST → RESPONSE → PAYMENT → FULFILLMENT → VERIFIED OUTCOME.

### Non-negotiable truth rules
- Multiple weak echoes do not become strong evidence by multiplication.
- A high convergence score does not equal truth.
- A divergence does not equal fraud.
- A reconstruction does not equal an observed fact.
- A prepared action is not an external action.
- A simulated payment is not revenue.
- VERIFIED_EXTERNAL_REVENUE remains NZ$0.00 until an independent external payment settles and the existing economic observation contract verifies it.

### First implementation experiment
Use one economic object and exactly three independent beams. Register identity and time before interpretation. Produce one convergence/divergence report. Run the artifact registry. Submit the result to the existing Gauntlet. Do not build an enterprise platform before this experiment demonstrates that the sensory layer reduces reconstruction error or creates a materially better economic action path.
