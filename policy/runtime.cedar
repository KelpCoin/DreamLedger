// DreamLedger runtime policy guardrails.
// These are enforcement rules, not advisory red-team findings.

forbid(principal, action == Action::"send_email", resource)
when {
    !(context has approval_id)
};

forbid(principal, action == Action::"publish", resource)
when {
    !(context has approval_id)
};

forbid(principal, action == Action::"charge_card", resource)
when {
    !(context has approval_id)
};

forbid(principal, action == Action::"charge_card", resource)
when {
    context has amount && context.amount > 100000
};

forbid(principal, action, resource)
when {
    context has parameters_json &&
    context.parameters_json like "*rm -rf*"
};
