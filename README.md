# axe

A professional, responsive notification dashboard built with **Svelte 5 (Runes)**, **Tailwind CSS v4**, and **Firebase**. Push alerts from any CLI environment via `curl` and receive them in real-time with native browser push support.

## 🚀 Quick Start (Local Development)

1.  **Clone & Install**
    ```bash
    git clone https://github.com/your-username/notifidash.git
    cd notifidash
    npm install
    ```

2.  **Environment Setup**
    Create a `.env` file in the root directory using your Firebase project credentials:
    ```env
    VITE_FIREBASE_API_KEY=...
    VITE_FIREBASE_AUTH_DOMAIN=...
    VITE_FIREBASE_PROJECT_ID=...
    VITE_FIREBASE_STORAGE_BUCKET=...
    VITE_FIREBASE_MESSAGING_SENDER_ID=...
    VITE_FIREBASE_APP_ID=...
    ```

3.  **Run Development Server**
    ```bash
    npm run dev
    ```

---

## 🌐 Production Deployment (Firebase)

This project is fully containerized for Firebase. All components (Hosting + Functions) are deployed via a single command.

### 1. Initialize Firebase
Ensure you have the Firebase CLI installed and are logged in:
```bash
npm install -g firebase-tools
firebase login
```

### 2. Deployment
1.  **Build & Deploy:**
    ```bash
    # Build Backend
    cd functions && npm install && npm run build && cd ..
    # Build Frontend
    npm install && npm run build
    # Deploy All
    npx firebase deploy
    ```

### 3. Firestore Security Rules
Ensure only authenticated users can access their own data. Paste these in the **Rules** tab of your Firestore Database:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /notifications/{docId} {
      allow write: if false; // Only Cloud Functions can write
      allow read, delete: if request.auth != null 
                          && request.auth.token.email == resource.data.userEmail;
    }
  }
}
```

### 4. Firestore Indexes
Firestore requires a composite index to sort notifications by time per user. 
- Open your browser console while running the app.
- Click the provided Firebase error link to auto-generate and enable the index.

---

## 🤖 CI/CD with GitHub Actions

A fully automated workflow is provided in `.github/workflows/deploy.yml`. 

**Required GitHub Secrets:**
- `FIREBASE_SERVICE_ACCOUNT`: Your Firebase Service Account JSON key.
- `VITE_FIREBASE_API_KEY`: Your Firebase API Key.
- `VITE_FIREBASE_AUTH_DOMAIN`: Your Auth Domain.
- `VITE_FIREBASE_PROJECT_ID`: Your Project ID.
- `VITE_FIREBASE_STORAGE_BUCKET`: Your Storage Bucket.
- `VITE_FIREBASE_MESSAGING_SENDER_ID`: Your Sender ID.
- `VITE_FIREBASE_APP_ID`: Your App ID.

---

## 🛠 Tech Stack
- **Frontend:** Svelte 5 (Runes), TypeScript, Vite
- **Backend:** Firebase Functions (TypeScript), Firestore, Auth
- **Hosting:** Firebase Hosting
- **Styling:** Tailwind CSS v4
- **Deployment:** GitHub Actions + Firebase
