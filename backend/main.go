package main

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

var gcsPath = "/mnt/gcs"

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	http.HandleFunc("/", handleRequest)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}

func handleRequest(w http.ResponseWriter, r *http.Request) {
	reqPath := filepath.Clean(r.URL.Path)
	fullPath := filepath.Join(gcsPath, reqPath)

	if !strings.HasPrefix(fullPath, gcsPath) {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	switch r.Method {
	case http.MethodGet:
		serveRead(w, r, reqPath, fullPath)
	case http.MethodPut:
		serveWrite(w, r.Body, fullPath)
	case http.MethodPost:
		serveMultipartUpload(w, r, fullPath)
	case http.MethodDelete:
		serveDelete(w, fullPath)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func serveRead(w http.ResponseWriter, r *http.Request, reqPath, fullPath string) {
	info, err := os.Stat(fullPath)
	if err != nil {
		http.Error(w, "Not found", http.StatusNotFound)
		return
	}

	if !info.IsDir() {
		http.ServeFile(w, r, fullPath)
		return
	}

	files, err := os.ReadDir(fullPath)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	var entries []map[string]interface{}
	for _, f := range files {
		fi, _ := f.Info()
		entry := map[string]interface{}{
			"name":   f.Name(),
			"is_dir": f.IsDir(),
		}
		if fi != nil {
			entry["size"] = fi.Size()
			entry["modified"] = fi.ModTime().UTC().Format(time.RFC3339)
		}
		entries = append(entries, entry)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"path":  reqPath,
		"files": entries,
	})
}

func serveWrite(w http.ResponseWriter, src io.Reader, dest string) {
	dst, err := os.Create(dest)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, src); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
}

func serveMultipartUpload(w http.ResponseWriter, r *http.Request, fullPath string) {
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	defer file.Close()

	destPath := filepath.Join(fullPath, header.Filename)
	serveWrite(w, file, destPath)
}

func serveDelete(w http.ResponseWriter, fullPath string) {
	if err := os.Remove(fullPath); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
