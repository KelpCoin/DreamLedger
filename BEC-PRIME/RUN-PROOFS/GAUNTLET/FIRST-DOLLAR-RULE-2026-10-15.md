# Gauntlet rule — first dollar

status: ACTIVE

accept_when:
  - stripe_payment_settled OR physical_deck_claim_cleared
  - receipt_fossil_written

reject_when:
  - revenue_claimed_without_settlement
  - silo_activated_without_supply_atom
  - template_outside_CUBE_CLONE_CONTRACT

edge_validation: settlement_only
