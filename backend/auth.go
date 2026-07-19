package main

import (
	"bytes"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
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
	query := map[string]any{
		"structuredQuery": map[string]any{
			"from": []any{map[string]string{"collectionId": "api_keys"}},
			"where": map[string]any{
				"fieldFilter": map[string]any{
					"field": map[string]string{"fieldPath": "key"},
					"op":    "EQUAL",
					"value": map[string]string{"stringValue": apiKey},
				},
			},
			"limit": 1,
		},
	}
	bodyBytes, err := json.Marshal(query)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal query: %w", err)
	}
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
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
		setCORSHeaders(w)
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
