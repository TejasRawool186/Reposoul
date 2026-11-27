'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface TokenContextValue {
  token: string;
  setToken: (t: string) => void;
  hasToken: boolean;
}

const TokenContext = createContext<TokenContextValue>({
  token: '',
  setToken: () => {},
  hasToken: false,
});

export function TokenProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState('');

  // Load from sessionStorage on mount (client-only — never persisted to server)
  useEffect(() => {
    const stored = sessionStorage.getItem('reposoul_github_token') ?? '';
    setTokenState(stored);
  }, []);

  const setToken = (t: string) => {
    setTokenState(t);
    if (t) {
      sessionStorage.setItem('reposoul_github_token', t);
    } else {
      sessionStorage.removeItem('reposoul_github_token');
    }
  };

  return (
    <TokenContext.Provider value={{ token, setToken, hasToken: token.length > 0 }}>
      {children}
    </TokenContext.Provider>
  );
}

export function useToken() {
  return useContext(TokenContext);
}
