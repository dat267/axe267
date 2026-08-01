package main

import (
	"bufio"
	"context"
	"os"
	"strings"
	"sync"

	firebase "firebase.google.com/go/v4"
	"golang.org/x/oauth2"
	"google.golang.org/api/option"
)

var (
	appOnce sync.Once
	app     *firebase.App
	appErr  error
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

// initApp builds the Firebase app once, using Application Default Credentials
// (which resolve automatically on Cloud Run) or a static ACCESS_TOKEN for
// local development.
func initApp(ctx context.Context) (*firebase.App, error) {
	appOnce.Do(func() {
		var opts []option.ClientOption
		if token := os.Getenv("ACCESS_TOKEN"); token != "" {
			opts = append(opts, option.WithTokenSource(oauth2.StaticTokenSource(&oauth2.Token{AccessToken: token})))
		}
		app, appErr = firebase.NewApp(ctx, &firebase.Config{ProjectID: getProjectID()}, opts...)
	})
	return app, appErr
}
