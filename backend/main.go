package main

import (
	"fmt"
	"net/http"
	"os"
	"time"
)

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
