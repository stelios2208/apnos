import { useState } from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "apnos.theme";

// Must match the inline <head> script in src/routes/__root.tsx, which applies
// the stored theme before first paint to avoid a flash of the wrong theme.
export function getStoredTheme(): Theme {
  if (typeof localStorage === "undefined") return "dark";
  try {
    return localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function applyTheme(theme: Theme): void {
  const cls = document.documentElement.classList;
  cls.toggle("dark", theme === "dark");
  cls.toggle("light", theme === "light");
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => getStoredTheme());

  const setTheme = (next: Theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    applyTheme(next);
    setThemeState(next);
  };

  return { theme, setTheme };
}
