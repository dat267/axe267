class ThemeStore {
  #mode = $state("dark");
  #mediaQuery = null;
  #onChange = null;

  constructor() {
    if (typeof window !== "undefined") {
      this.#mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const saved = localStorage.getItem("theme");
      this.#mode = saved === "light" || saved === "dark" || saved === "auto" ? saved : "auto";
      if (this.#mode === "auto") {
        this.#listenToSystem();
      }
      this.applyTheme();
    }
  }

  get darkMode() {
    if (this.#mode === "auto" && this.#mediaQuery) {
      return this.#mediaQuery.matches;
    }
    return this.#mode === "dark";
  }

  get mode() {
    return this.#mode;
  }

  #listenToSystem() {
    this.#onChange = () => this.applyTheme();
    this.#mediaQuery?.addEventListener("change", this.#onChange);
  }

  #stopListening() {
    if (this.#onChange) {
      this.#mediaQuery?.removeEventListener("change", this.#onChange);
      this.#onChange = null;
    }
  }

  cycleTheme() {
    const next = { dark: "light", light: "auto", auto: "dark" };
    this.#mode = next[this.#mode];
    localStorage.setItem("theme", this.#mode);
    if (this.#mode === "auto") {
      this.#listenToSystem();
    } else {
      this.#stopListening();
    }
    this.applyTheme();
  }

  applyTheme() {
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      root.classList.toggle("dark", this.darkMode);
      root.style.backgroundColor = this.darkMode ? "hsl(220 10% 10%)" : "hsl(0 0% 98%)";
    }
  }
}

export const themeStore = new ThemeStore();
