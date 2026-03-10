"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { getDictionary, t as translate, type Dict } from "@/lib/i18n";

interface LocaleContext {
  locale: string;
  setLocale: (id: string) => void;
  t: (key: string) => string;
}

const Ctx = createContext<LocaleContext>({
  locale: "en",
  setLocale: () => {},
  t: (key) => key,
});

export const useLocale = () => useContext(Ctx);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState("en");
  const [dict, setDict] = useState<Dict>(() => getDictionary("en"));

  useEffect(() => {
    const saved = localStorage.getItem("catbus-locale") || "en";
    setLocaleState(saved);
    setDict(getDictionary(saved));
  }, []);

  const setLocale = useCallback((id: string) => {
    setLocaleState(id);
    setDict(getDictionary(id));
    localStorage.setItem("catbus-locale", id);
  }, []);

  const t = useCallback((key: string) => translate(dict, key), [dict]);

  return (
    <Ctx.Provider value={{ locale, setLocale, t }}>
      {children}
    </Ctx.Provider>
  );
}
