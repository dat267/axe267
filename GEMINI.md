# Project axe: Design & Performance Guidelines

## Design Principles
- **Minimalism:** Keep the UI as clean and focused as possible. Avoid unnecessary subtitles, counters, or branding elements.
- **Consistency:** All pages must use standardized layouts and typography.
    - Headers: `text-2xl font-bold tracking-tight mb-8`.
    - Content Padding: Global `p-8` for main sections.
    - Buttons: `h-10 w-10` with standardized borders and icon sizes (`20`).
- **Launcher Style:** The Home page serves as a high-level launcher displaying apps in a clean, vertical list.

## Performance Mandates (Extreme Optimization)
- **Zero Motion:** Absolutely no CSS transitions, animations, or Svelte transition directives. This ensures instant interaction and reduces CPU/GPU load.
- **Flat UI:** Avoid shadows (`shadow-*`), backdrop blurs (`backdrop-blur-*`), and semi-transparent layers that require heavy composition.
- **Static Loading:** The loading screen is a minimal, static text indicator ("loading...") rather than an animated spinner.

## Feature Management
- **Notes:** The Notes feature has been entirely removed to focus the application on core notifications and integrations.
- **Integrations:** Maintain CLI integration and API key management as core features.
