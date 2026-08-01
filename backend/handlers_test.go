package main

import (
	"net/http/httptest"
	"testing"
)

func TestClientIPUsesXForwardedFor(t *testing.T) {
	req := httptest.NewRequest("GET", "/api/health", nil)
	req.RemoteAddr = "10.0.0.1:1234"
	req.Header.Set("X-Forwarded-For", "203.0.113.7, 10.0.0.1")
	if got := clientIP(req); got != "203.0.113.7" {
		t.Fatalf("clientIP() = %q, want first X-Forwarded-For hop %q", got, "203.0.113.7")
	}
}

func TestClientIPFallsBackToRemoteAddr(t *testing.T) {
	req := httptest.NewRequest("GET", "/api/health", nil)
	req.RemoteAddr = "203.0.113.99:5678"
	if got := clientIP(req); got != "203.0.113.99" {
		t.Fatalf("clientIP() = %q, want RemoteAddr-derived IP %q", got, "203.0.113.99")
	}
}

func TestIsRateLimitedTracksPerIP(t *testing.T) {
	// The limiter allows 60 requests/min; the 61st is blocked.
	ip := "198.51.100.10"
	for i := 0; i < 60; i++ {
		if isRateLimited(ip) {
			t.Fatalf("request %d unexpectedly rate limited", i+1)
		}
	}
	if !isRateLimited(ip) {
		t.Fatal("61st request from same IP should be rate limited")
	}
}
