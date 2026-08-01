package main

import "testing"

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
