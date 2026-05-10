class ThemeStore {
  #darkMode = $state(true);

  constructor() {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("theme");
      const prefers = window.matchMedia("(prefers-color-scheme: dark)").matches;
      this.#darkMode = saved === "dark" || (!saved && prefers);
      this.applyTheme();
    }
  }

  get darkMode() {
    return this.#darkMode;
  }

  toggleTheme() {
    this.#darkMode = !this.#darkMode;
    localStorage.setItem("theme", this.#darkMode ? "dark" : "light");
    this.applyTheme();
  }

  private applyTheme() {
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      root.classList.toggle("dark", this.#darkMode);
      
      // Align with GEMINI.md: Flat UI, no complex layers
      root.style.backgroundColor = this.#darkMode 
        ? "hsl(220 10% 10%)" 
        : "hsl(0 0% 98%)";
    }
  }
}

export const themeStore = new ThemeStore();
