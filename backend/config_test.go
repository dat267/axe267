package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadEnvFindsFileRelativeToRepoRoot(t *testing.T) {
	tmp := t.TempDir()
	backendDir := filepath.Join(tmp, "backend")
	if err := os.MkdirAll(backendDir, 0o755); err != nil {
		t.Fatal(err)
	}
	rootEnv := filepath.Join(tmp, ".env")
	if err := os.WriteFile(rootEnv, []byte("PROJECT_ID=from-root\n"), 0o644); err != nil {
		t.Fatal(err)
	}

	// Simulate running from backend/ (as npm run dev does) with the .env at the repo root.
	oldWd, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Chdir(backendDir); err != nil {
		t.Fatal(err)
	}
	defer os.Chdir(oldWd)

	loadEnv()

	if got := os.Getenv("PROJECT_ID"); got != "from-root" {
		t.Fatalf("PROJECT_ID = %q, want %q (env file at repo root not loaded)", got, "from-root")
	}
	os.Unsetenv("PROJECT_ID")
}

func TestLoadEnvRespectsExistingEnv(t *testing.T) {
	tmp := t.TempDir()
	envPath := filepath.Join(tmp, ".env")
	if err := os.WriteFile(envPath, []byte("PROJECT_ID=file-value\n"), 0o644); err != nil {
		t.Fatal(err)
	}

	oldWd, _ := os.Getwd()
	if err := os.Chdir(tmp); err != nil {
		t.Fatal(err)
	}
	defer os.Chdir(oldWd)

	t.Setenv("PROJECT_ID", "already-set")
	loadEnv()
	if got := os.Getenv("PROJECT_ID"); got != "already-set" {
		t.Fatalf("loadEnv overrode existing PROJECT_ID: %q", got)
	}
	os.Unsetenv("PROJECT_ID")
}
