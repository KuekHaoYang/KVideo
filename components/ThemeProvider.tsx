'use client';

import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  actualTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ViewTransitionHandle {
  finished: Promise<void>;
  skipTransition?: () => void;
}

type DocumentWithViewTransition = Document & {
  startViewTransition?: (callback: () => void) => ViewTransitionHandle;
};

function isTheme(value: string | null): value is Theme {
  return value === 'light' || value === 'dark' || value === 'system';
}

function subscribeToSystemTheme(listener: () => void) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', listener);
  return () => mediaQuery.removeEventListener('change', listener);
}

function getSystemThemeSnapshot() {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') {
      return 'system';
    }

    const savedTheme = localStorage.getItem('theme');
    return isTheme(savedTheme) ? savedTheme : 'system';
  });
  const transitionRef = useRef<ViewTransitionHandle | null>(null);
  const prefersDark = useSyncExternalStore(
    subscribeToSystemTheme,
    getSystemThemeSnapshot,
    () => true,
  );
  const actualTheme = useMemo<'light' | 'dark'>(() => {
    if (theme === 'system') {
      return prefersDark ? 'dark' : 'light';
    }

    return theme;
  }, [prefersDark, theme]);

  useEffect(() => {
    const applyTheme = () => {
      document.documentElement.classList.toggle('dark', actualTheme === 'dark');
    };

    const applyThemeWithTransition = () => {
      if (transitionRef.current) {
        try {
          transitionRef.current.skipTransition?.();
        } catch {
          // Ignore if the previous transition already finished.
        }
      }

      if (document.hidden) {
        applyTheme();
        return;
      }

      const transitionDocument = document as DocumentWithViewTransition;
      if (typeof transitionDocument.startViewTransition === 'function') {
        try {
          transitionRef.current = transitionDocument.startViewTransition(() => {
            applyTheme();
          });

          if (transitionRef.current) {
            transitionRef.current.finished
              .then(() => { transitionRef.current = null; })
              .catch(() => {
                transitionRef.current = null;
              });
          }
        } catch {
          applyTheme();
        }
      } else {
        applyTheme();
      }
    };

    applyThemeWithTransition();
    localStorage.setItem('theme', theme);

    const handleVisibilityChange = () => {
      if (document.hidden && transitionRef.current) {
        try {
          transitionRef.current.skipTransition?.();
        } catch {
          // Ignore transition cleanup failures.
        }
        transitionRef.current = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (transitionRef.current) {
        try {
          transitionRef.current.skipTransition?.();
        } catch {
          // Ignore transition cleanup failures.
        }
      }
    };
  }, [actualTheme, theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, actualTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
