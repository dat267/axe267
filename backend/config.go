package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"
)

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
	client := &http.Client{Timeout: 1 * time.Second}
	req, err := http.NewRequest("GET", "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token", nil)
	if err != nil {
		return ""
	}
	req.Header.Set("Metadata-Flavor", "Google")
	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("Warning: metadata server not available: %v\n", err)
		return ""
	}
	defer resp.Body.Close()
	var res map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		fmt.Printf("Warning: failed to decode metadata response: %v\n", err)
		return ""
	}
	token, ok := res["access_token"].(string)
	if !ok {
		fmt.Printf("Warning: no access_token in metadata response\n")
		return ""
	}
	return token
}
