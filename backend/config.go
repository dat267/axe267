package main

import (
	"bufio"
	"encoding/json"
	"net/http"
	"os"
	"os/exec"
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
