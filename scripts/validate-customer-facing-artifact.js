'use strict';

const fs = require('node:fs');

const DECISION = Object.freeze({
  PASS: 'PASS_TO_HUMAN_REVIEW',
  HOLD: 'HOLD',
  REJECT: 'REJECT'
});

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateCustomerFacingArtifact(artifact) {
  const issues = [];
  const reject = [];
  const addHold = (code, message) => issues.push({ code, message, decision: DECISION.HOLD });
  const addReject = (code, message) => reject.push({ code, message, decision: DECISION.REJECT });

  if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) {
    return {
      schema: 'dreamledger/customer-facing-voice-checkpoint-result/v1',
      decision: DECISION.HOLD,
      issues: [{ code: 'ARTIFACT_NOT_OBJECT', message: 'Input must be a JSON object.', decision: DECISION.HOLD }]
    };
  }

  if (artifact.schema !== 'dreamledger/customer-facing-artifact/v1') {
    addHold('ARTIFACT_SCHEMA_MISMATCH', 'Expected schema dreamledger/customer-facing-artifact/v1.');
  }

  const ai = artifact.ai_contribution;
  if (!ai || typeof ai !== 'object' || !Array.isArray(ai.sections) || ai.sections.length === 0) {
    addHold('SECTION_PROVENANCE_MISSING', 'List every artifact section and identify its origin.');
  } else {
    const ids = new Set();
    for (const section of ai.sections) {
      if (!section || typeof section !== 'object') {
        addHold('INVALID_SECTION_RECORD', 'Every section needs a structured provenance record.');
        continue;
      }
      if (!nonEmpty(section.section_id)) {
        addHold('SECTION_ID_MISSING', 'Every section requires a stable section_id.');
      } else if (ids.has(section.section_id)) {
        addHold('DUPLICATE_SECTION_ID', 'Section IDs must be unique.');
      } else {
        ids.add(section.section_id);
      }

      if (!['HUMAN', 'AI_ASSISTED', 'AI_GENERATED', 'MIXED'].includes(section.origin)) {
        addHold('SECTION_ORIGIN_INVALID', 'Section ' + (section.section_id || '(unknown)') + ' has an invalid origin.');
      }
      if (!nonEmpty(section.model_or_tool)) {
        addHold('MODEL_OR_TOOL_MISSING', 'Section ' + (section.section_id || '(unknown)') + ' must name the model/tool, or explicitly state none.');
      }
      if (!nonEmpty(section.contribution)) {
        addHold('CONTRIBUTION_MISSING', 'Section ' + (section.section_id || '(unknown)') + ' must describe the contribution.');
      }
    }

    const hasAI = ai.sections.some(s => s && ['AI_ASSISTED', 'AI_GENERATED', 'MIXED'].includes(s.origin));
    if (!nonEmpty(ai.disclosure_text)) {
      addHold('AI_DISCLOSURE_MISSING', 'Record an accurate, plain-language disclosure or explicitly state that no AI was used.');
    } else if (hasAI && /\b(?:no ai|not ai-assisted|no ai assistance)\b/i.test(ai.disclosure_text)) {
      addHold('DISCLOSURE_CONFLICT', 'Disclosure says no AI was used but one or more sections are AI-assisted.');
    } else if (!hasAI && !/\b(?:no ai|not ai-assisted|no ai assistance|human-authored only)\b/i.test(ai.disclosure_text)) {
      addHold('HUMAN_ONLY_DISCLOSURE_AMBIGUOUS', 'Human-only artifacts must say so accurately.');
    }
  }

  const voice = artifact.operator_voice;
  if (!voice || typeof voice !== 'object' || !nonEmpty(voice.anchor_text) ||
      !nonEmpty(voice.source_ref) || voice.confirmed_by_operator !== true) {
    addHold('OPERATOR_VOICE_NOT_CONFIRMED', 'Provide a genuine operator-authored judgment/line, its source reference, and operator confirmation. Do not invent lived experience.');
  }
  if (voice && (voice.fabricated_experience === true || voice.fabricated_customer_quote === true)) {
    addReject('FABRICATED_EXPERIENCE', 'Personal experience or customer testimony may not be invented.');
  }

  const review = artifact.review;
  if (!review || typeof review !== 'object') {
    addHold('REVIEW_RECORD_MISSING', 'Review record is required.');
  } else {
    if (review.detector_evasion_requested === true) {
      addReject('DETECTOR_EVASION_REQUESTED', 'The checkpoint must not be used to conceal AI involvement or game AI detectors.');
    }
    if (!Array.isArray(review.transformation_rules)) {
      addHold('TRANSFORMATION_RULES_MISSING', 'Record the truth-preserving transformations applied.');
    }
    if (!Array.isArray(review.fact_trail_refs) || review.fact_trail_refs.length === 0) {
      addHold('FACT_TRAIL_MISSING', 'Provide at least one fact/source trail reference, or a reference explicitly marking the artifact as opinion-only.');
    }
    if (review.meaning_preserved !== true) {
      addHold('MEANING_PRESERVATION_UNCONFIRMED', 'Meaning, factual scope, and material caveats must be confirmed as preserved.');
    }
    if (review.operator_approved !== true) {
      addHold('OPERATOR_REVIEW_PENDING', 'The operator has not approved the artifact for human review/publishing workflow.');
    }
  }

  const decision = reject.length ? DECISION.REJECT : issues.length ? DECISION.HOLD : DECISION.PASS;
  return {
    schema: 'dreamledger/customer-facing-voice-checkpoint-result/v1',
    decision,
    authority: 'NON_AUTHORITATIVE_FOR_ECONOMIC_TRUTH',
    may_publish: false,
    may_enable_checkout: false,
    revenue_truth_effect: 'NONE',
    issues: [...reject, ...issues]
  };
}

if (require.main === module) {
  const inputPath = process.argv[2];
  if (!inputPath) {
    process.stderr.write('Usage: node scripts/validate-customer-facing-artifact.js path/to/artifact.json\n');
    process.exitCode = 2;
  } else {
    try {
      const artifact = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
      const result = validateCustomerFacingArtifact(artifact);
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
      if (result.decision !== DECISION.PASS) process.exitCode = 1;
    } catch (error) {
      process.stderr.write('Invalid input: ' + error.message + '\n');
      process.exitCode = 2;
    }
  }
}

module.exports = { validateCustomerFacingArtifact, DECISION };
