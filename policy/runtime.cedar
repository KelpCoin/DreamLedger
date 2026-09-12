// DreamLedger runtime policy guardrails.
// These are enforcement rules, not advisory red-team findings.

forbid(principal, action, resource)
when {
    action == Action::"send_email" && !context has approval_id
};

forbid(principal, action, resource)
when {
    action == Action::"publish" && !context has approval_id
};

forbid(principal, action, resource)
when {
    action == Action::"charge_card" && !context has approval_id
};

forbid(principal, action, resource)
when {
    context has parameters_json &&
    context.parameters_json like "*rm -rf*"
};
