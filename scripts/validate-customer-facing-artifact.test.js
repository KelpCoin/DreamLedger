'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { validateCustomerFacingArtifact, DECISION } = require('./validate-customer-facing-artifact');

function validArtifact() {
  return {
    schema: 'dreamledger/customer-facing-artifact/v1',
    artifact_id: 'test-artifact-001',
    ai_contribution: {
      sections: [
        { section_id: 'summary', origin: 'AI_ASSISTED', model_or_tool: 'local-tri-llm-proxy', contribution: 'Drafted initial summary; operator edited and checked claims.' },
        { section_id: 'operator-note', origin: 'HUMAN', model_or_tool: 'none', contribution: 'Operator-authored observation.' }
      ],
      disclosure_text: 'AI assisted with the first draft. The operator edited the text and checked the cited facts.'
    },
    operator_voice: {
      anchor_text: 'I spent the afternoon tracing the webhook fallback because an empty key behaved differently from a missing key.',
      source_ref: 'operator-notes/stripe-investigation-2026-10-16.md#observation-1',
      confirmed_by_operator: true,
      fabricated_experience: false,
      fabricated_customer_quote: false
    },
    review: {
      transformation_rules: ['remove excess punctuation', 'split long sentence without changing meaning'],
      fact_trail_refs: ['github:main:BEC-PRIME/start.js', 'incident:STRIPE_CONFIG_MISSING'],
      meaning_preserved: true,
      operator_approved: true,
      detector_evasion_requested: false
    }
  };
}

test('accepts complete provenance and sends artifact only to human review', () => {
  const result = validateCustomerFacingArtifact(validArtifact());
  assert.equal(result.decision, DECISION.PASS);
  assert.equal(result.may_publish, false);
  assert.equal(result.may_enable_checkout, false);
  assert.equal(result.revenue_truth_effect, 'NONE');
});

test('holds AI-assisted artifact when contribution disclosure is absent', () => {
  const artifact = validArtifact();
  artifact.ai_contribution.disclosure_text = '';
  const result = validateCustomerFacingArtifact(artifact);
  assert.equal(result.decision, DECISION.HOLD);
  assert.ok(result.issues.some(x => x.code === 'AI_DISCLOSURE_MISSING'));
});

test('holds when a section has no model/tool provenance', () => {
  const artifact = validArtifact();
  artifact.ai_contribution.sections[0].model_or_tool = '';
  const result = validateCustomerFacingArtifact(artifact);
  assert.equal(result.decision, DECISION.HOLD);
  assert.ok(result.issues.some(x => x.code === 'MODEL_OR_TOOL_MISSING'));
});

test('holds when operator voice is not sourced and confirmed', () => {
  const artifact = validArtifact();
  artifact.operator_voice.confirmed_by_operator = false;
  artifact.operator_voice.source_ref = '';
  const result = validateCustomerFacingArtifact(artifact);
  assert.equal(result.decision, DECISION.HOLD);
  assert.ok(result.issues.some(x => x.code === 'OPERATOR_VOICE_NOT_CONFIRMED'));
});

test('rejects fabricated lived experience or customer testimony', () => {
  const artifact = validArtifact();
  artifact.operator_voice.fabricated_experience = true;
  const result = validateCustomerFacingArtifact(artifact);
  assert.equal(result.decision, DECISION.REJECT);
  assert.ok(result.issues.some(x => x.code === 'FABRICATED_EXPERIENCE'));
});

test('rejects detector evasion as a rewrite objective', () => {
  const artifact = validArtifact();
  artifact.review.detector_evasion_requested = true;
  const result = validateCustomerFacingArtifact(artifact);
  assert.equal(result.decision, DECISION.REJECT);
  assert.ok(result.issues.some(x => x.code === 'DETECTOR_EVASION_REQUESTED'));
});

test('holds when meaning preservation or operator approval is missing', () => {
  const artifact = validArtifact();
  artifact.review.meaning_preserved = false;
  artifact.review.operator_approved = false;
  const result = validateCustomerFacingArtifact(artifact);
  assert.equal(result.decision, DECISION.HOLD);
  assert.ok(result.issues.some(x => x.code === 'MEANING_PRESERVATION_UNCONFIRMED'));
  assert.ok(result.issues.some(x => x.code === 'OPERATOR_REVIEW_PENDING'));
});

test('holds on conflicting disclosure and duplicate section IDs', () => {
  const artifact = validArtifact();
  artifact.ai_contribution.disclosure_text = 'No AI assistance was used.';
  artifact.ai_contribution.sections.push({ ...artifact.ai_contribution.sections[0] });
  const result = validateCustomerFacingArtifact(artifact);
  assert.equal(result.decision, DECISION.HOLD);
  assert.ok(result.issues.some(x => x.code === 'DISCLOSURE_CONFLICT'));
  assert.ok(result.issues.some(x => x.code === 'DUPLICATE_SECTION_ID'));
});

test('malformed input fails closed', () => {
  const result = validateCustomerFacingArtifact(null);
  assert.equal(result.decision, DECISION.HOLD);
  assert.ok(result.issues.some(x => x.code === 'ARTIFACT_NOT_OBJECT'));
});
