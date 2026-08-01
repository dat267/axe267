package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"time"
)

func main() {
	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	loadEnv()
	ctx := context.Background()

	app, err := initApp(ctx)
	if err != nil {
		logger.Error("failed to initialize Firebase", "error", err)
		os.Exit(1)
	}

	authClient, err := app.Auth(ctx)
	if err != nil {
		logger.Error("failed to initialize auth client", "error", err)
		os.Exit(1)
	}

	firestoreClient, err := app.Firestore(ctx)
	if err != nil {
		logger.Error("failed to initialize Firestore client", "error", err)
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
	logger.Info("starting server", "port", port)
	if err := server.ListenAndServe(); err != nil {
		logger.Error("server failed", "error", err)
	}
}
