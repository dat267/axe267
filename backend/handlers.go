package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
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

func handleNotify(w http.ResponseWriter, r *http.Request) {
	projectID := getProjectID()
	userEmail := r.Header.Get("X-User-Email")
	accessToken := getAccessToken()
	switch r.Method {
	case "POST":
		var notif Notification
		if err := json.NewDecoder(r.Body).Decode(&notif); err != nil {
			http.Error(w, "Bad Request", http.StatusBadRequest)
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
		bodyBytes, _ := json.Marshal(body)
		req, _ := http.NewRequest("POST", url, bytes.NewBuffer(bodyBytes))
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
		json.NewDecoder(resp.Body).Decode(&res)
		parts := strings.Split(res.Name, "/")
		docID := parts[len(parts)-1]
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"id": docID})
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
		bodyBytes, _ := json.Marshal(query)
		req, _ := http.NewRequest("POST", queryUrl, bytes.NewBuffer(bodyBytes))
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
		json.NewDecoder(resp.Body).Decode(&results)
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
		commitUrl := fmt.Sprintf("https://firestore.googleapis.com/v1/projects/%s/databases/(default)/documents:commit", projectID)
		commitBody := map[string]any{"writes": writes}
		commitBytes, _ := json.Marshal(commitBody)
		creq, _ := http.NewRequest("POST", commitUrl, bytes.NewBuffer(commitBytes))
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
		json.NewEncoder(w).Encode(map[string]int{"count": len(writes)})
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
	json.NewEncoder(w).Encode(resp)
}
