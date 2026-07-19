package main

import (
	"bytes"
	"encoding/json"
	"fmt"
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

type FirestoreStringValue struct {
	StringValue string `json:"stringValue"`
}

type APIKeyFields struct {
	UserID    FirestoreStringValue `json:"userId"`
	UserEmail FirestoreStringValue `json:"userEmail"`
}

type APIKeyDoc struct {
	Fields APIKeyFields `json:"fields"`
}

type APIKeyQueryResult struct {
	Document *APIKeyDoc `json:"document"`
}

type FirestoreDoc struct {
	Name string `json:"name"`
}

type RunQueryResult struct {
	Document *FirestoreDoc `json:"document"`
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

func handleNotify(w http.ResponseWriter, r *http.Request) {
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

	projectID := getProjectID()
	userEmail := r.Header.Get("X-User-Email")
	accessToken := getAccessToken()

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

		url := fmt.Sprintf("https://firestore.googleapis.com/v1/projects/%s/databases/(default)/documents/notifications", projectID)
		body := map[string]any{
			"fields": map[string]any{
				"userEmail": map[string]string{"stringValue": userEmail},
				"type":      map[string]string{"stringValue": notif.Type},
				"source":    map[string]string{"stringValue": notif.Source},
				"title":     map[string]string{"stringValue": notif.Title},
				"message":   map[string]string{"stringValue": notif.Message},
				"category":  map[string]string{"stringValue": notif.Category},
				"createdAt": map[string]string{"timestampValue": time.Now().UTC().Format(time.RFC3339)},
			},
		}
		bodyBytes, err := json.Marshal(body)
		if err != nil {
			http.Error(w, "Internal error", http.StatusInternalServerError)
			return
		}
		req, err := http.NewRequest("POST", url, bytes.NewBuffer(bodyBytes))
		if err != nil {
			http.Error(w, "Internal error", http.StatusInternalServerError)
			return
		}
		req.Header.Set("Content-Type", "application/json")
		if accessToken != "" {
			req.Header.Set("Authorization", "Bearer "+accessToken)
		}
		client := &http.Client{Timeout: 10 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			http.Error(w, "Firestore failed", http.StatusInternalServerError)
			return
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			http.Error(w, "Firestore failed", http.StatusInternalServerError)
			return
		}
		var res struct {
			Name string `json:"name"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
			http.Error(w, "Firestore decode failed", http.StatusInternalServerError)
			return
		}
		parts := strings.Split(res.Name, "/")
		docID := parts[len(parts)-1]
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(map[string]string{"id": docID}); err != nil {
			http.Error(w, "Response encode failed", http.StatusInternalServerError)
		}

	case "DELETE":
		queryUrl := fmt.Sprintf("https://firestore.googleapis.com/v1/projects/%s/databases/(default)/documents:runQuery", projectID)
		query := map[string]any{
			"structuredQuery": map[string]any{
				"from": []any{map[string]string{"collectionId": "notifications"}},
				"where": map[string]any{
					"fieldFilter": map[string]any{
						"field": map[string]string{"fieldPath": "userEmail"},
						"op":    "EQUAL",
						"value": map[string]string{"stringValue": userEmail},
					},
				},
			},
		}
		bodyBytes, err := json.Marshal(query)
		if err != nil {
			http.Error(w, "Internal error", http.StatusInternalServerError)
			return
		}
		req, err := http.NewRequest("POST", queryUrl, bytes.NewBuffer(bodyBytes))
		if err != nil {
			http.Error(w, "Internal error", http.StatusInternalServerError)
			return
		}
		req.Header.Set("Content-Type", "application/json")
		if accessToken != "" {
			req.Header.Set("Authorization", "Bearer "+accessToken)
		}
		client := &http.Client{Timeout: 10 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			http.Error(w, "Firestore failed", http.StatusInternalServerError)
			return
		}
		defer resp.Body.Close()
		var results []RunQueryResult
		if err := json.NewDecoder(resp.Body).Decode(&results); err != nil {
			http.Error(w, "Firestore decode failed", http.StatusInternalServerError)
			return
		}
		var writes []any
		for _, item := range results {
			if item.Document != nil && item.Document.Name != "" {
				writes = append(writes, map[string]string{"delete": item.Document.Name})
			}
		}
		if len(writes) == 0 {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]int{"count": 0})
			return
		}
		if len(writes) > maxNotificationsPerDelete {
			writes = writes[:maxNotificationsPerDelete]
		}
		commitUrl := fmt.Sprintf("https://firestore.googleapis.com/v1/projects/%s/databases/(default)/documents:commit", projectID)
		commitBody := map[string]any{"writes": writes}
		commitBytes, err := json.Marshal(commitBody)
		if err != nil {
			http.Error(w, "Internal error", http.StatusInternalServerError)
			return
		}
		creq, err := http.NewRequest("POST", commitUrl, bytes.NewBuffer(commitBytes))
		if err != nil {
			http.Error(w, "Internal error", http.StatusInternalServerError)
			return
		}
		creq.Header.Set("Content-Type", "application/json")
		if accessToken != "" {
			creq.Header.Set("Authorization", "Bearer "+accessToken)
		}
		cresp, err := client.Do(creq)
		if err != nil {
			http.Error(w, "Firestore failed", http.StatusInternalServerError)
			return
		}
		defer cresp.Body.Close()
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(map[string]int{"count": len(writes)}); err != nil {
			http.Error(w, "Response encode failed", http.StatusInternalServerError)
		}

	default:
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
	}
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
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
		ProjectID: getProjectID(),
		Timestamp: time.Now().UTC(),
	}
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(resp); err != nil {
		http.Error(w, "Response encode failed", http.StatusInternalServerError)
	}
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(v); err != nil {
		http.Error(w, "Response encode failed", http.StatusInternalServerError)
	}
}
