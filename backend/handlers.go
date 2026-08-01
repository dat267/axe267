package main

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"sync"
	"time"
)

type Notification struct {
	Type     string `json:"type"`
	Source   string `json:"source"`
	Title    string `json:"title"`
	Message  string `json:"message"`
	Category string `json:"category"`
}

type HealthResponse struct {
	Status    string    `json:"status"`
	Service   string    `json:"service"`
	ProjectID string    `json:"projectId"`
	Timestamp time.Time `json:"timestamp"`
}

const maxBodySize = 1 << 16 // 64KB
const maxFieldLength = 500
const maxNotificationsPerDelete = 500

var (
	rateLimiters = sync.Map{}
	rateLimitMu  sync.Mutex
)

type ipLimiter struct {
	count  int
	last   time.Time
	limit  int
	window time.Duration
}

func getRateLimiter(ip string, limit int, window time.Duration) *ipLimiter {
	val, _ := rateLimiters.LoadOrStore(ip, &ipLimiter{limit: limit, window: window, last: time.Now()})
	lm := val.(*ipLimiter)
	rateLimitMu.Lock()
	defer rateLimitMu.Unlock()
	if time.Since(lm.last) > lm.window {
		lm.count = 0
		lm.last = time.Now()
	}
	lm.count++
	return lm
}

func isRateLimited(ip string) bool {
	lm := getRateLimiter(ip, 60, time.Minute)
	return lm.count > lm.limit
}

func validateNotification(notif Notification) string {
	if len(notif.Title) == 0 || len(notif.Title) > maxFieldLength {
		return "title is required and must be under 500 characters"
	}
	if len(notif.Message) == 0 || len(notif.Message) > maxFieldLength {
		return "message is required and must be under 500 characters"
	}
	if len(notif.Source) == 0 || len(notif.Source) > maxFieldLength {
		return "source is required and must be under 500 characters"
	}
	validTypes := map[string]bool{"info": true, "success": true, "warning": true, "error": true}
	if !validTypes[notif.Type] {
		return "type must be one of: info, success, warning, error"
	}
	validCategories := map[string]bool{"system": true, "mobile": true, "desktop": true}
	if !validCategories[notif.Category] {
		return "category must be one of: system, mobile, desktop"
	}
	return ""
}

func setCORSHeaders(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key")
}

func handleNotify(ctx context.Context, store NotificationStore, w http.ResponseWriter, r *http.Request) {
	setCORSHeaders(w)
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	ip := r.RemoteAddr
	if idx := strings.LastIndex(ip, ":"); idx >= 0 {
		ip = ip[:idx]
	}
	if isRateLimited(ip) {
		http.Error(w, "Rate limit exceeded", http.StatusTooManyRequests)
		return
	}

	userEmail := r.Header.Get("X-User-Email")

	switch r.Method {
	case "POST":
		r.Body = http.MaxBytesReader(w, r.Body, maxBodySize)
		var notif Notification
		if err := json.NewDecoder(r.Body).Decode(&notif); err != nil {
			http.Error(w, "Bad Request: invalid JSON or body too large", http.StatusBadRequest)
			return
		}
		if errMsg := validateNotification(notif); errMsg != "" {
			http.Error(w, errMsg, http.StatusBadRequest)
			return
		}

		docID, err := store.Create(ctx, userEmail, notif)
		if err != nil {
			http.Error(w, "Firestore failed", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(map[string]string{"id": docID}); err != nil {
			http.Error(w, "Response encode failed", http.StatusInternalServerError)
		}

	case "DELETE":
		count, err := store.DeleteByEmail(ctx, userEmail, maxNotificationsPerDelete)
		if err != nil {
			http.Error(w, "Firestore failed", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(map[string]int{"count": count}); err != nil {
			http.Error(w, "Response encode failed", http.StatusInternalServerError)
		}

	default:
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
	}
}

func handleHealth(projectID string, w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}
	if r.Method != "GET" {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}
	resp := HealthResponse{
		Status:    "ok",
		Service:   "axe-backend",
		ProjectID: projectID,
		Timestamp: time.Now().UTC(),
	}
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(resp); err != nil {
		http.Error(w, "Response encode failed", http.StatusInternalServerError)
	}
}
