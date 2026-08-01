package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestValidateNotification(t *testing.T) {
	valid := Notification{
		Type:     "info",
		Source:   "cli",
		Title:    "Deploy",
		Message:  "done",
		Category: "system",
	}
	if errMsg := validateNotification(valid); errMsg != "" {
		t.Fatalf("expected valid notification, got error: %q", errMsg)
	}

	tests := []struct {
		name    string
		mutate  func(*Notification)
		wantSub string
	}{
		{"missing title", func(n *Notification) { n.Title = "" }, "title"},
		{"title too long", func(n *Notification) { n.Title = strings.Repeat("x", 501) }, "title"},
		{"missing message", func(n *Notification) { n.Message = "" }, "message"},
		{"message too long", func(n *Notification) { n.Message = strings.Repeat("x", 501) }, "message"},
		{"missing source", func(n *Notification) { n.Source = "" }, "source"},
		{"source too long", func(n *Notification) { n.Source = strings.Repeat("x", 501) }, "source"},
		{"invalid type", func(n *Notification) { n.Type = "loud" }, "type"},
		{"missing type", func(n *Notification) { n.Type = "" }, "type"},
		{"invalid category", func(n *Notification) { n.Category = "telegram" }, "category"},
		{"missing category", func(n *Notification) { n.Category = "" }, "category"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			n := valid
			tt.mutate(&n)
			errMsg := validateNotification(n)
			if errMsg == "" {
				t.Fatal("expected validation error, got none")
			}
			if !strings.Contains(errMsg, tt.wantSub) {
				t.Fatalf("error %q does not mention %q", errMsg, tt.wantSub)
			}
		})
	}
}

type mockVerifier struct {
	user *FirebaseUser
	err  error
}

func (m *mockVerifier) VerifyIDToken(ctx context.Context, token string) (*FirebaseUser, error) {
	if m.err != nil {
		return nil, m.err
	}
	if token == "invalid" {
		return nil, errors.New("bad token")
	}
	return m.user, nil
}

func (m *mockVerifier) VerifyAPIKey(ctx context.Context, apiKey string) (*FirebaseUser, error) {
	if m.err != nil {
		return nil, m.err
	}
	if apiKey == "invalid" {
		return nil, errors.New("bad key")
	}
	return m.user, nil
}

func TestAuthMiddleware(t *testing.T) {
	user := &FirebaseUser{UID: "uid123", Email: "me@example.com"}
	tests := []struct {
		name       string
		verifier   Verifier
		headers    map[string]string
		wantStatus int
		wantEmail  string
	}{
		{
			name:       "valid bearer token",
			verifier:   &mockVerifier{user: user},
			headers:    map[string]string{"Authorization": "Bearer validtoken"},
			wantStatus: http.StatusOK,
			wantEmail:  "me@example.com",
		},
		{
			name:       "valid api key",
			verifier:   &mockVerifier{user: user},
			headers:    map[string]string{"x-api-key": "validkey"},
			wantStatus: http.StatusOK,
			wantEmail:  "me@example.com",
		},
		{
			name:       "api key takes precedence over bad bearer",
			verifier:   &mockVerifier{user: user},
			headers:    map[string]string{"Authorization": "Bearer invalid", "x-api-key": "validkey"},
			wantStatus: http.StatusOK,
			wantEmail:  "me@example.com",
		},
		{
			name:       "invalid bearer token",
			verifier:   &mockVerifier{user: user},
			headers:    map[string]string{"Authorization": "Bearer invalid"},
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "invalid api key",
			verifier:   &mockVerifier{user: user},
			headers:    map[string]string{"x-api-key": "invalid"},
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "missing credentials",
			verifier:   &mockVerifier{user: user},
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "verifier error",
			verifier:   &mockVerifier{err: errors.New("boom")},
			headers:    map[string]string{"Authorization": "Bearer validtoken"},
			wantStatus: http.StatusUnauthorized,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var gotEmail string
			next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				gotEmail = r.Header.Get("X-User-Email")
				w.WriteHeader(http.StatusOK)
			})
			handler := authMiddleware(tt.verifier, next)
			req := httptest.NewRequest("POST", "/api/notify", nil)
			for k, v := range tt.headers {
				req.Header.Set(k, v)
			}
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, req)
			if rec.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d", rec.Code, tt.wantStatus)
			}
			if tt.wantEmail != "" && gotEmail != tt.wantEmail {
				t.Fatalf("X-User-Email = %q, want %q", gotEmail, tt.wantEmail)
			}
		})
	}
}

func TestAuthMiddlewareOptions(t *testing.T) {
	verifier := &mockVerifier{err: errors.New("should not be called")}
	handler := authMiddleware(verifier, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("next should not be called for OPTIONS")
	}))
	req := httptest.NewRequest("OPTIONS", "/api/notify", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if rec.Header().Get("Access-Control-Allow-Origin") != "*" {
		t.Fatal("missing CORS header on OPTIONS")
	}
}

type mockStore struct {
	createID    string
	createErr   error
	created     []Notification
	deleteCount int
	deleteErr   error
	deletedFrom string
}

func (m *mockStore) Create(ctx context.Context, userEmail string, notif Notification) (string, error) {
	m.created = append(m.created, notif)
	if m.createErr != nil {
		return "", m.createErr
	}
	return m.createID, nil
}

func (m *mockStore) DeleteByEmail(ctx context.Context, userEmail string, limit int) (int, error) {
	m.deletedFrom = userEmail
	if m.deleteErr != nil {
		return 0, m.deleteErr
	}
	return m.deleteCount, nil
}

func doNotify(t *testing.T, store NotificationStore, method, body string, xff string) *httptest.ResponseRecorder {
	t.Helper()
	var reader *bytes.Reader
	if body != "" {
		reader = bytes.NewReader([]byte(body))
	} else {
		reader = bytes.NewReader(nil)
	}
	req := httptest.NewRequest(method, "/api/notify", reader)
	if xff != "" {
		req.Header.Set("X-Forwarded-For", xff)
	}
	req.Header.Set("X-User-Email", "me@example.com")
	rec := httptest.NewRecorder()
	handleNotify(context.Background(), store, rec, req)
	return rec
}

func TestHandleNotifyPost(t *testing.T) {
	store := &mockStore{createID: "doc123"}
	body := `{"type":"info","source":"cli","title":"Deploy","message":"done","category":"system"}`
	rec := doNotify(t, store, "POST", body, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body: %s)", rec.Code, rec.Body.String())
	}
	var res map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if res["id"] != "doc123" {
		t.Fatalf("id = %q, want doc123", res["id"])
	}
	if len(store.created) != 1 {
		t.Fatalf("store.Create called %d times, want 1", len(store.created))
	}
	if store.created[0].Title != "Deploy" {
		t.Fatalf("created notification title = %q, want Deploy", store.created[0].Title)
	}
}

func TestHandleNotifyPostValidationError(t *testing.T) {
	store := &mockStore{}
	rec := doNotify(t, store, "POST", `{"type":"info"}`, "")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
	if len(store.created) != 0 {
		t.Fatal("store.Create should not be called for invalid input")
	}
}

func TestHandleNotifyPostInvalidJSON(t *testing.T) {
	store := &mockStore{}
	rec := doNotify(t, store, "POST", `{"type":`, "")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
}

func TestHandleNotifyPostStoreError(t *testing.T) {
	store := &mockStore{createErr: errors.New("firestore down")}
	body := `{"type":"info","source":"cli","title":"Deploy","message":"done","category":"system"}`
	rec := doNotify(t, store, "POST", body, "")
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", rec.Code)
	}
}

func TestHandleNotifyDelete(t *testing.T) {
	store := &mockStore{deleteCount: 3}
	rec := doNotify(t, store, "DELETE", "", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body: %s)", rec.Code, rec.Body.String())
	}
	var res map[string]int
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if res["count"] != 3 {
		t.Fatalf("count = %d, want 3", res["count"])
	}
	if store.deletedFrom != "me@example.com" {
		t.Fatalf("deleted for %q, want me@example.com", store.deletedFrom)
	}
}

func TestHandleNotifyDeleteStoreError(t *testing.T) {
	store := &mockStore{deleteErr: errors.New("firestore down")}
	rec := doNotify(t, store, "DELETE", "", "")
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", rec.Code)
	}
}

func TestHandleNotifyRateLimited(t *testing.T) {
	store := &mockStore{}
	ip := "203.0.113.50"
	rec := doNotify(t, store, "POST", `{"type":"info","source":"cli","title":"Deploy","message":"done","category":"system"}`, ip)
	if rec.Code != http.StatusOK {
		t.Fatalf("initial request status = %d, want 200", rec.Code)
	}
	for i := 0; i < 60; i++ {
		doNotify(t, store, "POST", `{"type":"info","source":"cli","title":"Deploy","message":"done","category":"system"}`, ip)
	}
	rec = doNotify(t, store, "POST", `{"type":"info","source":"cli","title":"Deploy","message":"done","category":"system"}`, ip)
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("status after burst = %d, want 429", rec.Code)
	}
}

func TestHandleNotifyMethodNotAllowed(t *testing.T) {
	store := &mockStore{}
	rec := doNotify(t, store, "PUT", "", "")
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status = %d, want 405", rec.Code)
	}
}

func TestHandleHealth(t *testing.T) {
	req := httptest.NewRequest("GET", "/api/health", nil)
	rec := httptest.NewRecorder()
	handleHealth("my-project", rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	var res HealthResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatalf("failed to decode health response: %v", err)
	}
	if res.Status != "ok" || res.ProjectID != "my-project" {
		t.Fatalf("unexpected health response: %+v", res)
	}
}

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
