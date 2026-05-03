package main

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	firebase "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/auth"
	"google.golang.org/api/iterator"
)

var (
	gcsPath    = "/mnt/gcs"
	authClient *auth.Client
	ctx        = context.Background()
)

type ErrorResponse struct {
	Error string `json:"error"`
}

func sendJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(payload)
}

func sendError(w http.ResponseWriter, status int, message string) {
	sendJSON(w, status, ErrorResponse{Error: message})
}

func loggerMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		log.Printf("Started %s %s", r.Method, r.URL.Path)
		next(w, r)
		log.Printf("Completed %s %s in %v", r.Method, r.URL.Path, time.Since(start))
	}
}

func corsMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept")
		w.Header().Set("Access-Control-Max-Age", "86400")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		next(w, r)
	}
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	app, err := firebase.NewApp(ctx, nil)
	if err != nil {
		log.Fatalf("Fatal: Firebase app init failed: %v", err)
	}

	authClient, err = app.Auth(ctx)
	if err != nil {
		log.Fatalf("Fatal: Auth client init failed: %v", err)
	}

	ensureInitialAdmin()

	http.HandleFunc("/admin/users", loggerMiddleware(corsMiddleware(handleAdminUsers)))
	http.HandleFunc("/", loggerMiddleware(corsMiddleware(handleRequest)))

	log.Printf("Server listening on port %s", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatalf("Fatal: Server exit: %v", err)
	}
}

func ensureInitialAdmin() {
	email := strings.ToLower(os.Getenv("INITIAL_ADMIN_EMAIL"))
	if email == "" {
		return
	}
	user, err := authClient.GetUserByEmail(ctx, email)
	if err != nil {
		pw := make([]byte, 32)
		rand.Read(pw)
		params := (&auth.UserToCreate{}).
			Email(email).
			Password(base64.StdEncoding.EncodeToString(pw)).
			EmailVerified(true)
		user, err = authClient.CreateUser(ctx, params)
		if err != nil {
			log.Printf("Error: Bootstrap admin creation failed: %v", err)
			return
		}
	}
	isAdmin, _ := user.CustomClaims["admin"].(bool)
	if !isAdmin {
		authClient.SetCustomUserClaims(ctx, user.UID, map[string]interface{}{"admin": true})
	}
}

func getAuthStatus(r *http.Request) (*auth.Token, bool, bool) {
	header := r.Header.Get("Authorization")
	if !strings.HasPrefix(header, "Bearer ") {
		return nil, false, false
	}
	idToken := strings.TrimPrefix(header, "Bearer ")
	token, err := authClient.VerifyIDToken(ctx, idToken)
	if err != nil {
		log.Printf("Error: Token verification failed: %v", err)
		return nil, false, false
	}
	isAdmin, _ := token.Claims["admin"].(bool)
	emailVerified, _ := token.Claims["email_verified"].(bool)
	return token, isAdmin, emailVerified
}

func handleAdminUsers(w http.ResponseWriter, r *http.Request) {
	token, isAdmin, emailVerified := getAuthStatus(r)
	if token == nil || !emailVerified || !isAdmin {
		sendError(w, http.StatusForbidden, "Admin access required")
		return
	}
	switch r.Method {
	case http.MethodGet:
		users := []map[string]interface{}{}
		iter := authClient.Users(ctx, "")
		for {
			user, err := iter.Next()
			if err == iterator.Done {
				break
			}
			if err != nil {
				log.Printf("Error: User iteration failed: %v", err)
				sendError(w, http.StatusInternalServerError, "Failed to list users")
				return
			}
			adm, _ := user.CustomClaims["admin"].(bool)
			users = append(users, map[string]interface{}{
				"uid":           user.UID,
				"email":         user.Email,
				"admin":         adm,
				"emailVerified": user.EmailVerified,
			})
		}
		sendJSON(w, http.StatusOK, users)
	case http.MethodPost:
		var req struct {
			UID   string `json:"uid"`
			Admin bool   `json:"admin"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			sendError(w, http.StatusBadRequest, "Invalid request body")
			return
		}
		if req.UID == token.UID {
			sendError(w, http.StatusBadRequest, "Self-modification prohibited")
			return
		}
		if !req.Admin {
			if err := verifyAdminCount(req.UID); err != nil {
				sendError(w, http.StatusBadRequest, err.Error())
				return
			}
		}
		if err := authClient.SetCustomUserClaims(ctx, req.UID, map[string]interface{}{"admin": req.Admin}); err != nil {
			log.Printf("Error: Claim update failed: %v", err)
			sendError(w, http.StatusInternalServerError, "Failed to update role")
			return
		}
		w.WriteHeader(http.StatusOK)
	case http.MethodDelete:
		uid := r.URL.Query().Get("uid")
		if uid == "" {
			sendError(w, http.StatusBadRequest, "Missing user ID")
			return
		}
		if uid == token.UID {
			sendError(w, http.StatusBadRequest, "Self-deletion prohibited")
			return
		}
		if err := verifyAdminCount(uid); err != nil {
			sendError(w, http.StatusBadRequest, err.Error())
			return
		}
		if err := authClient.DeleteUser(ctx, uid); err != nil {
			log.Printf("Error: User deletion failed: %v", err)
			sendError(w, http.StatusInternalServerError, "Deletion failed")
			return
		}
		w.WriteHeader(http.StatusOK)
	default:
		sendError(w, http.StatusMethodNotAllowed, "Method not allowed")
	}
}

func verifyAdminCount(targetUID string) error {
	user, err := authClient.GetUser(ctx, targetUID)
	if err != nil {
		return fmt.Errorf("user not found")
	}
	isAdm, _ := user.CustomClaims["admin"].(bool)
	if !isAdm {
		return nil
	}
	admins := 0
	iter := authClient.Users(ctx, "")
	for {
		u, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return fmt.Errorf("system check failed")
		}
		if a, _ := u.CustomClaims["admin"].(bool); a {
			admins++
		}
	}
	if admins <= 1 {
		return fmt.Errorf("cannot remove last administrator")
	}
	return nil
}

func handleRequest(w http.ResponseWriter, r *http.Request) {
	reqPath := filepath.Clean(r.URL.Path)
	fullPath := filepath.Join(gcsPath, reqPath)
	if !strings.HasPrefix(fullPath, gcsPath) {
		sendError(w, http.StatusForbidden, "Path traversal forbidden")
		return
	}
	token, isAdmin, emailVerified := getAuthStatus(r)
	if r.Method != http.MethodGet && (token == nil || !isAdmin) {
		sendError(w, http.StatusForbidden, "Write access restricted")
		return
	}
	if token != nil && !emailVerified {
		sendError(w, http.StatusForbidden, "Email verification required")
		return
	}
	switch r.Method {
	case http.MethodGet:
		serveRead(w, r, reqPath, fullPath, token != nil)
	case http.MethodPut:
		serveWrite(w, r.Body, fullPath)
	case http.MethodPost:
		serveMultipartUpload(w, r, fullPath)
	case http.MethodDelete:
		serveDelete(w, fullPath)
	default:
		sendError(w, http.StatusMethodNotAllowed, "Method not allowed")
	}
}

func serveRead(w http.ResponseWriter, r *http.Request, reqPath, fullPath string, isAuth bool) {
	info, err := os.Stat(fullPath)
	if err != nil {
		sendError(w, http.StatusNotFound, "Resource not found")
		return
	}
	if !info.IsDir() {
		if !isAuth {
			sendError(w, http.StatusUnauthorized, "Authentication required")
			return
		}
		http.ServeFile(w, r, fullPath)
		return
	}
	files, err := os.ReadDir(fullPath)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Internal storage error")
		return
	}
	entries := []map[string]interface{}{}
	for _, f := range files {
		fi, _ := f.Info()
		entry := map[string]interface{}{"name": f.Name(), "is_dir": f.IsDir()}
		if fi != nil {
			entry["size"] = fi.Size()
			entry["modified"] = fi.ModTime().UTC().Format(time.RFC3339)
		}
		entries = append(entries, entry)
	}
	sendJSON(w, http.StatusOK, map[string]interface{}{"path": reqPath, "files": entries})
}

func serveWrite(w http.ResponseWriter, src io.Reader, dest string) {
	dst, err := os.Create(dest)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Write failed")
		return
	}
	defer dst.Close()
	if _, err := io.Copy(dst, src); err != nil {
		sendError(w, http.StatusInternalServerError, "Transfer failed")
		return
	}
	w.WriteHeader(http.StatusCreated)
}

func serveMultipartUpload(w http.ResponseWriter, r *http.Request, fullPath string) {
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		sendError(w, http.StatusBadRequest, "Upload too large")
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		sendError(w, http.StatusBadRequest, "No file provided")
		return
	}
	defer file.Close()
	serveWrite(w, file, filepath.Join(fullPath, header.Filename))
}

func serveDelete(w http.ResponseWriter, fullPath string) {
	if err := os.RemoveAll(fullPath); err != nil {
		sendError(w, http.StatusInternalServerError, "Deletion failed")
		return
	}
	w.WriteHeader(http.StatusOK)
}
