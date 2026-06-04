package main

import (
	"bufio"
	"bytes"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"time"
)

type FirebaseUser struct {
	UID   string `json:"uid"`
	Email string `json:"email"`
}
type JwkKey struct {
	Kid string `json:"kid"`
	N   string `json:"n"`
	E   string `json:"e"`
}
type JwkSet struct {
	Keys []JwkKey `json:"keys"`
}
type Claims struct {
	Sub   string `json:"sub"`
	Email string `json:"email"`
	Exp   int64  `json:"exp"`
	Iss   string `json:"iss"`
	Aud   string `json:"aud"`
}
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

func loadEnv() {
	f, err := os.Open(".env")
	if err != nil {
		return
	}
	defer f.Close()
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "#") || !strings.Contains(line, "=") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		key := strings.TrimSpace(parts[0])
		val := strings.TrimSpace(parts[1])
		if os.Getenv(key) == "" {
			os.Setenv(key, val)
		}
	}
}

func getProjectID() string {
	if id := os.Getenv("PROJECT_ID"); id != "" {
		return id
	}
	return os.Getenv("VITE_FIREBASE_PROJECT_ID")
}

func getAccessToken() string {
	if token := os.Getenv("ACCESS_TOKEN"); token != "" {
		return token
	}
	// Try metadata server (GCP)
	client := &http.Client{Timeout: 1 * time.Second}
	req, _ := http.NewRequest("GET", "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token", nil)
	req.Header.Set("Metadata-Flavor", "Google")
	if resp, err := client.Do(req); err == nil {
		defer resp.Body.Close()
		var res map[string]interface{}
		if err := json.NewDecoder(resp.Body).Decode(&res); err == nil {
			if token, ok := res["access_token"].(string); ok {
				return token
			}
		}
	}
	// Try gcloud (Local)
	if out, err := exec.Command("gcloud", "auth", "print-access-token").Output(); err == nil {
		return strings.TrimSpace(string(out))
	}
	return ""
}
func decodeSegment(seg string) ([]byte, error) {
	if l := len(seg) % 4; l > 0 {
		seg += strings.Repeat("=", 4-l)
	}
	return base64.URLEncoding.DecodeString(seg)
}
func verifyFirebaseToken(token, projectID string) (*FirebaseUser, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return nil, fmt.Errorf("invalid token format")
	}
	headerBytes, err := decodeSegment(parts[0])
	if err != nil {
		return nil, err
	}
	payloadBytes, err := decodeSegment(parts[1])
	if err != nil {
		return nil, err
	}
	var header struct {
		Kid string `json:"kid"`
	}
	if err := json.Unmarshal(headerBytes, &header); err != nil {
		return nil, err
	}
	var claims Claims
	if err := json.Unmarshal(payloadBytes, &claims); err != nil {
		return nil, err
	}
	if time.Now().Unix() > claims.Exp {
		return nil, fmt.Errorf("token expired")
	}
	if claims.Iss != "https://securetoken.google.com/"+projectID {
		return nil, fmt.Errorf("invalid issuer")
	}
	if claims.Aud != projectID {
		return nil, fmt.Errorf("invalid audience")
	}
	resp, err := http.Get("https://www.googleapis.com/robot/v1/metadata/jwk/securetoken@system.gserviceaccount.com")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var jwkSet JwkSet
	if err := json.NewDecoder(resp.Body).Decode(&jwkSet); err != nil {
		return nil, err
	}
	var targetKey *JwkKey
	for _, key := range jwkSet.Keys {
		if key.Kid == header.Kid {
			targetKey = &key
			break
		}
	}
	if targetKey == nil {
		return nil, fmt.Errorf("key not found")
	}
	nBytes, err := decodeSegment(targetKey.N)
	if err != nil {
		return nil, err
	}
	eBytes, err := decodeSegment(targetKey.E)
	if err != nil {
		return nil, err
	}
	var eVal int
	for _, b := range eBytes {
		eVal = (eVal << 8) + int(b)
	}
	pubKey := &rsa.PublicKey{
		N: new(big.Int).SetBytes(nBytes),
		E: eVal,
	}
	h := sha256.New()
	h.Write([]byte(parts[0] + "." + parts[1]))
	hashed := h.Sum(nil)
	sigBytes, err := decodeSegment(parts[2])
	if err != nil {
		return nil, err
	}
	err = rsa.VerifyPKCS1v15(pubKey, crypto.SHA256, hashed, sigBytes)
	if err != nil {
		return nil, err
	}
	return &FirebaseUser{UID: claims.Sub, Email: claims.Email}, nil
}
func verifyAPIKey(apiKey, projectID, accessToken string) (*FirebaseUser, error) {
	url := fmt.Sprintf("https://firestore.googleapis.com/v1/projects/%s/databases/(default)/documents:runQuery", projectID)
	query := map[string]interface{}{
		"structuredQuery": map[string]interface{}{
			"from": []interface{}{map[string]string{"collectionId": "api_keys"}},
			"where": map[string]interface{}{
				"fieldFilter": map[string]interface{}{
					"field": map[string]string{"fieldPath": "key"},
					"op":    "EQUAL",
					"value": map[string]string{"stringValue": apiKey},
				},
			},
			"limit": 1,
		},
	}
	bodyBytes, _ := json.Marshal(query)
	req, _ := http.NewRequest("POST", url, bytes.NewBuffer(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	if accessToken != "" {
		req.Header.Set("Authorization", "Bearer "+accessToken)
	}
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var results []APIKeyQueryResult
	if err := json.NewDecoder(resp.Body).Decode(&results); err != nil {
		return nil, err
	}
	if len(results) == 0 || results[0].Document == nil {
		return nil, fmt.Errorf("invalid key")
	}
	uID := results[0].Document.Fields.UserID.StringValue
	email := results[0].Document.Fields.UserEmail.StringValue
	if uID == "" || email == "" {
		return nil, fmt.Errorf("invalid user fields")
	}
	return &FirebaseUser{UID: uID, Email: email}, nil
}
func authMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		projectID := getProjectID()
		authHeader := r.Header.Get("Authorization")
		apiKey := r.Header.Get("x-api-key")
		var user *FirebaseUser
		var err error
		if apiKey != "" {
			accessToken := getAccessToken()
			user, err = verifyAPIKey(apiKey, projectID, accessToken)
		} else if strings.HasPrefix(authHeader, "Bearer ") {
			token := strings.TrimPrefix(authHeader, "Bearer ")
			user, err = verifyFirebaseToken(token, projectID)
		}
		if err != nil || user == nil {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		r.Header.Set("X-User-UID", user.UID)
		r.Header.Set("X-User-Email", user.Email)
		next.ServeHTTP(w, r)
	}
}
func handleNotify(w http.ResponseWriter, r *http.Request) {
	projectID := getProjectID()
	userEmail := r.Header.Get("X-User-Email")
	accessToken := getAccessToken()
	if r.Method == "POST" {
		var notif Notification
		if err := json.NewDecoder(r.Body).Decode(&notif); err != nil {
			http.Error(w, "Bad Request", http.StatusBadRequest)
			return
		}
		url := fmt.Sprintf("https://firestore.googleapis.com/v1/projects/%s/databases/(default)/documents/notifications", projectID)
		body := map[string]interface{}{
			"fields": map[string]interface{}{
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
	} else if r.Method == "DELETE" {
		queryUrl := fmt.Sprintf("https://firestore.googleapis.com/v1/projects/%s/databases/(default)/documents:runQuery", projectID)
		query := map[string]interface{}{
			"structuredQuery": map[string]interface{}{
				"from": []interface{}{map[string]string{"collectionId": "notifications"}},
				"where": map[string]interface{}{
					"fieldFilter": map[string]interface{}{
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
		var writes []interface{}
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
		commitBody := map[string]interface{}{"writes": writes}
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

type HealthResponse struct {
	Status    string    `json:"status"`
	Service   string    `json:"service"`
	ProjectID string    `json:"projectId"`
	Timestamp time.Time `json:"timestamp"`
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
func main() {
	loadEnv()
	mux := http.NewServeMux()
	mux.HandleFunc("/api/notify", authMiddleware(handleNotify))
	mux.HandleFunc("/api/health", handleHealth)
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	server := &http.Server{
		Addr:         ":" + port,
		Handler:      mux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}
	fmt.Printf("Starting server on port %s...\n", port)
	if err := server.ListenAndServe(); err != nil {
		fmt.Printf("Server failed: %v\n", err)
	}
}
