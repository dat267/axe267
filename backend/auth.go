package main

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"cloud.google.com/go/firestore"
	"firebase.google.com/go/v4/auth"
)

type FirebaseUser struct {
	UID   string
	Email string
}

// Verifier authenticates requests via Firebase ID tokens or API keys.
type Verifier interface {
	VerifyIDToken(ctx context.Context, token string) (*FirebaseUser, error)
	VerifyAPIKey(ctx context.Context, apiKey string) (*FirebaseUser, error)
}

type firebaseVerifier struct {
	auth *auth.Client
	db   *firestore.Client
}

func (v *firebaseVerifier) VerifyIDToken(ctx context.Context, token string) (*FirebaseUser, error) {
	decoded, err := v.auth.VerifyIDToken(ctx, token)
	if err != nil {
		return nil, fmt.Errorf("invalid ID token: %w", err)
	}
	email, _ := decoded.Claims["email"].(string)
	return &FirebaseUser{UID: decoded.UID, Email: email}, nil
}

func (v *firebaseVerifier) VerifyAPIKey(ctx context.Context, apiKey string) (*FirebaseUser, error) {
	docs, err := v.db.Collection("api_keys").Where("key", "==", apiKey).Limit(1).Documents(ctx).GetAll()
	if err != nil {
		return nil, fmt.Errorf("api key lookup failed: %w", err)
	}
	if len(docs) == 0 {
		return nil, fmt.Errorf("invalid key")
	}
	data := docs[0].Data()
	uID, _ := data["userId"].(string)
	email, _ := data["userEmail"].(string)
	if uID == "" || email == "" {
		return nil, fmt.Errorf("invalid user fields")
	}
	return &FirebaseUser{UID: uID, Email: email}, nil
}

func authMiddleware(v Verifier, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		setCORSHeaders(w)
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		authHeader := r.Header.Get("Authorization")
		apiKey := r.Header.Get("x-api-key")
		var user *FirebaseUser
		var err error
		if apiKey != "" {
			user, err = v.VerifyAPIKey(r.Context(), apiKey)
		} else if strings.HasPrefix(authHeader, "Bearer ") {
			token := strings.TrimPrefix(authHeader, "Bearer ")
			user, err = v.VerifyIDToken(r.Context(), token)
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
