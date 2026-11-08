package main

import (
	"testing"

	"firebase.google.com/go/v4/auth"
)

func TestFirebaseUserFromTokenRequiresVerifiedEmail(t *testing.T) {
	decoded := &auth.Token{
		UID: "uid123",
		Claims: map[string]interface{}{
			"email":          "me@example.com",
			"email_verified": true,
		},
	}
	user, err := firebaseUserFromToken(decoded)
	if err != nil {
		t.Fatalf("verified token rejected: %v", err)
	}
	if user.UID != "uid123" || user.Email != "me@example.com" {
		t.Fatalf("unexpected user: %+v", user)
	}

	decoded.Claims["email_verified"] = false
	if _, err := firebaseUserFromToken(decoded); err == nil {
		t.Fatal("unverified email token should be rejected")
	}

	decoded.Claims["email_verified"] = true
	delete(decoded.Claims, "email")
	if _, err := firebaseUserFromToken(decoded); err == nil {
		t.Fatal("token without an email should be rejected")
	}
}

func TestHashKey(t *testing.T) {
	// The digest must be a 64-char hex string and stable for a given key.
	if got := hashKey("ntfy_testkey123"); len(got) != 64 {
		t.Fatalf("hashKey() length = %d, want 64", len(got))
	}
	if hashKey("ntfy_testkey123") != hashKey("ntfy_testkey123") {
		t.Fatal("hashKey() must be deterministic")
	}
	if hashKey("ntfy_key_a") == hashKey("ntfy_key_b") {
		t.Fatal("hashKey() must differ for different keys")
	}
}
