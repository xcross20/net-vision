'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const KEY = 'net-vision:watchlist:v1';

type WatchlistState = {
  categories: string[];
  tokens: string[];
};

const empty: WatchlistState = { categories: [], tokens: [] };

function load(): WatchlistState {
  if (typeof window === 'undefined') return empty;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<WatchlistState>;
    return {
      categories: Array.isArray(parsed.categories) ? parsed.categories : [],
      tokens: Array.isArray(parsed.tokens) ? parsed.tokens : [],
    };
  } catch {
    return empty;
  }
}

type Value = WatchlistState & {
  hydrated: boolean;
  isWatchingCategory: (slug: string) => boolean;
  isWatchingToken: (tokenId: string) => boolean;
  toggleCategory: (slug: string) => void;
  toggleToken: (tokenId: string) => void;
};

const WatchlistContext = createContext<Value | null>(null);

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WatchlistState>(empty);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(load());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const toggleCategory = useCallback((slug: string) => {
    setState((current) => {
      const has = current.categories.includes(slug);
      return {
        ...current,
        categories: has
          ? current.categories.filter((s) => s !== slug)
          : [...current.categories, slug],
      };
    });
  }, []);

  const toggleToken = useCallback((tokenId: string) => {
    setState((current) => {
      const has = current.tokens.includes(tokenId);
      return {
        ...current,
        tokens: has ? current.tokens.filter((s) => s !== tokenId) : [...current.tokens, tokenId],
      };
    });
  }, []);

  const value = useMemo<Value>(
    () => ({
      ...state,
      hydrated,
      isWatchingCategory: (slug) => state.categories.includes(slug),
      isWatchingToken: (tokenId) => state.tokens.includes(tokenId),
      toggleCategory,
      toggleToken,
    }),
    [state, hydrated, toggleCategory, toggleToken],
  );

  return <WatchlistContext.Provider value={value}>{children}</WatchlistContext.Provider>;
}

export function useWatchlist(): Value {
  const ctx = useContext(WatchlistContext);
  if (!ctx) throw new Error('useWatchlist must be used inside WatchlistProvider');
  return ctx;
}
