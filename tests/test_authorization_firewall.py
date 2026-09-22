from runtime.authorization_firewall import AuthorizationFirewall

def test_unknown_action_is_denied():
    fw = AuthorizationFirewall()
    assert fw.authorize({"action":"delete_everything","principal":"cortex","scope":[]})["verdict"] == "DENY"

def test_missing_scope_is_denied():
    fw = AuthorizationFirewall()
    r = fw.authorize({"action":"publish_offer","principal":"cortex","scope":[]})
    assert r == {"verdict":"DENY","reason":"missing_scope"}

def test_amber_publication_requires_approval():
    fw = AuthorizationFirewall()
    r = fw.authorize({"action":"publish_offer","principal":"cortex","scope":["offer:publish"]})
    assert r["verdict"] == "REQUIRE_APPROVAL"

def test_green_read_is_allowed():
    fw = AuthorizationFirewall()
    r = fw.authorize({"action":"read_public_observation","principal":"oracle","scope":["observation:read"]})
    assert r["verdict"] == "ALLOW"

def test_wrong_principal_is_denied():
    fw = AuthorizationFirewall()
    r = fw.authorize({"action":"publish_offer","principal":"worker","scope":["offer:publish"]})
    assert r["verdict"] == "DENY"
