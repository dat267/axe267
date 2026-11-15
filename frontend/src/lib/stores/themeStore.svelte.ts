const THEME_MODES = ["light", "dark", "auto"] as const;

export type ThemeMode = (typeof THEME_MODES)[number];

function isThemeMode(value: string | null): value is ThemeMode {
  return value !== null && (THEME_MODES as readonly string[]).includes(value);
}

function readSavedMode(): ThemeMode {
  try {
    const saved = localStorage.getItem("theme");
    if (isThemeMode(saved)) return saved;
  } catch {
    // Storage unavailable (private mode, blocked site data): use the system theme.
  }
  return "auto";
}

class ThemeStore {
  #mode = $state<ThemeMode>("dark");
  #systemDark = $state(false);
  #mediaQuery: MediaQueryList | null = null;
  #onChange: (() => void) | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      this.#mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      this.#systemDark = this.#mediaQuery.matches;
      this.#mode = readSavedMode();
      if (this.#mode === "auto") {
        this.#listenToSystem();
      }
      this.applyTheme();
    }
  }

  get darkMode(): boolean {
    if (this.#mode === "auto") {
      return this.#systemDark;
    }
    return this.#mode === "dark";
  }

  get mode(): ThemeMode {
    return this.#mode;
  }

  #listenToSystem() {
    this.#systemDark = this.#mediaQuery?.matches ?? false;
    this.#onChange = () => {
      this.#systemDark = this.#mediaQuery?.matches ?? false;
      this.applyTheme();
    };
    this.#mediaQuery?.addEventListener("change", this.#onChange);
  }

  #stopListening() {
    if (this.#onChange) {
      this.#mediaQuery?.removeEventListener("change", this.#onChange);
      this.#onChange = null;
    }
  }

  cycleTheme(): void {
    const next: Record<ThemeMode, ThemeMode> = { dark: "light", light: "auto", auto: "dark" };
    this.#mode = next[this.#mode];
    try {
      localStorage.setItem("theme", this.#mode);
    } catch {
      // Non-essential preference; the theme still applies for this session.
    }
    if (this.#mode === "auto") {
      this.#listenToSystem();
    } else {
      this.#stopListening();
    }
    this.applyTheme();
  }

  applyTheme(): void {
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      root.classList.toggle("dark", this.darkMode);
      root.style.backgroundColor = this.darkMode ? "hsl(220 10% 10%)" : "hsl(0 0% 98%)";
    }
  }
}

export const themeStore = new ThemeStore();
