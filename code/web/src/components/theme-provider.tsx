"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { colorThemes, getThemeById, type ColorTheme } from "@/lib/color-themes";

interface ThemeContext {
  colorTheme: string;
  setColorTheme: (id: string) => void;
  themes: ColorTheme[];
}

const Ctx = createContext<ThemeContext>({
  colorTheme: "evolution",
  setColorTheme: () => {},
  themes: colorThemes,
});

export const useTheme = () => useContext(Ctx);

function applyColorTheme(id: string) {
  const theme = getThemeById(id);
  const root = document.documentElement;
  // Always dark
  root.classList.add("dark");
  // Apply theme CSS variables
  for (const [key, value] of Object.entries(theme.vars)) {
    root.style.setProperty(key, value);
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [colorTheme, setColorThemeState] = useState("evolution");

  useEffect(() => {
    const saved = localStorage.getItem("catbus-color-theme") || "evolution";
    setColorThemeState(saved);
    applyColorTheme(saved);
  }, []);

  const setColorTheme = useCallback((id: string) => {
    setColorThemeState(id);
    applyColorTheme(id);
    localStorage.setItem("catbus-color-theme", id);
  }, []);

  return (
    <Ctx.Provider value={{ colorTheme, setColorTheme, themes: colorThemes }}>
      {children}
    </Ctx.Provider>
  );
}
