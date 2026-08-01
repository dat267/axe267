package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"time"
)

func main() {
	loadEnv()
	ctx := context.Background()

	app, err := initApp(ctx)
	if err != nil {
		fmt.Printf("Failed to initialize Firebase: %v\n", err)
		os.Exit(1)
	}

	authClient, err := app.Auth(ctx)
	if err != nil {
		fmt.Printf("Failed to initialize auth client: %v\n", err)
		os.Exit(1)
	}

	firestoreClient, err := app.Firestore(ctx)
	if err != nil {
		fmt.Printf("Failed to initialize Firestore client: %v\n", err)
		os.Exit(1)
	}
	defer firestoreClient.Close()

	verifier := &firebaseVerifier{auth: authClient, db: firestoreClient}
	store := &firestoreStore{db: firestoreClient}
	projectID := getProjectID()

	mux := http.NewServeMux()
	mux.HandleFunc("/api/notify", authMiddleware(verifier, func(w http.ResponseWriter, r *http.Request) {
		handleNotify(ctx, store, w, r)
	}))
	mux.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		handleHealth(projectID, w, r)
	})

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
