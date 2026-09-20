# DreamLedger Agent Action Receipt v1

## Purpose
A factual, tamper-evident receipt for consequential agent actions and transactions.

## Primitive
AUTHORIZATION → ACTION → EXTERNAL EFFECT → EVIDENCE → VERIFICATION

## Required fields
- receipt_id
- version
- issued_at
- issuer
- claim
- classification
- principal
- agent
- action
- stages
- evidence
- contradictions
- unverified_fields
- signature
- verify_url

## Classification
VERIFIED means the claim is supported by independently observable external evidence. UNVERIFIED means required evidence is absent. CONTRADICTED means evidence conflicts with the claim. TEST, SIMULATED, INTERNAL, UNMATCHED and STALE remain explicit non-verified states.

## Commerce stages
AUTHORIZED → INITIATED → SUCCEEDED → SETTLED → FULFILLED → VERIFIED

A successful API response is not settlement. A database row is not external economic proof. A test payment is not revenue.

## First experiment
Publish exactly one real receipt from a real external action. Put its permalink on one external surface. Do not publish a second receipt for one week. Record external reactions only: stranger reply, share, inquiry, referral, or payment.

## Scope discipline
This document is a product specification and evidence-format definition. It does not authorize live financial actions, public release, new payment rails, or deployment.
