# Project axe: Design & Performance Guidelines

## Design Principles
- **Minimalism:** Keep the UI clean and focused. Headers like "axe" use lowercase `text-2xl font-bold tracking-tight`.
- **Consistency:**
    - Headers: Use `text-2xl font-bold tracking-tight`.
    - Content Padding: Standard `p-8` for main page sections.
    - Component Sizing: Header buttons are `h-10 w-10`. Home/List items are `h-20` with `h-12 w-12` icon containers.
- **Launcher Style:** The Home page acts as a vertical launcher for core applications.

## Performance Mandates (Extreme Optimization)
- **Minimal Motion:** Avoid unnecessary CSS transitions and animations. Interaction should feel instant.
- **Flat UI:** Avoid heavy composition effects like `shadow-*`, `backdrop-blur-*`, or complex semi-transparent layers.
- **Static Loading:** Use minimal, static text indicators ("loading...") instead of animated spinners for main application states.

## Feature Management
- **Notifications:** Core feature for managing system and integration alerts in real-time.
- **Reader:** Core feature. Minimalist EPUB reader driven purely by Firebase Storage folders.
- **Integrations:** Core feature for CLI integration and API key management.
- **Settings:** Core feature for account and profile management.
- **Notes:** This feature has been entirely removed from the application.
- **Music:** This feature has been entirely removed from the application.

## Workflows
- **Development:** Always run `npm run dev` at the start of a development session.
- **CLI Push:** CLI tools can push notifications via the Cloud Function API (using API Keys/Bearer tokens) or directly via the Firebase Admin SDK.
- **Library Management:** Manage the `books/` folder in Storage directly via CLI (rclone) or GCP Console. The app will sync automatically.
