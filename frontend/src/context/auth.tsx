import { useRouter, useSegments } from "expo-router";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";

import { api, loadToken, persistToken, type User } from "@/src/api/client";

type AuthState = {
  user: User | null;
  initializing: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (body: {
    email: string;
    password: string;
    username: string;
    display_name: string;
    language: "pt" | "es";
  }) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await loadToken();
      if (token) {
        try {
          const me = await api.me();
          setUser(me);
        } catch {
          await persistToken(null);
        }
      }
      setInitializing(false);
    })();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      initializing,
      signIn: async (email, password) => {
        const res = await api.login({ email, password });
        await persistToken(res.access_token);
        setUser(res.user);
      },
      signUp: async (body) => {
        const res = await api.register(body);
        await persistToken(res.access_token);
        setUser(res.user);
      },
      signOut: async () => {
        await persistToken(null);
        setUser(null);
      },
    }),
    [user, initializing],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Redirect based on auth state.
export function useProtectedRoute() {
  const { user, initializing } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const didRedirect = useRef(false);

  useEffect(() => {
    if (initializing) return;
    const inAuthGroup = segments[0] === "(auth)";
    if (!user && !inAuthGroup) {
      router.replace("/(auth)/welcome");
    } else if (user && inAuthGroup) {
      router.replace("/(app)/chats");
    }
    didRedirect.current = true;
  }, [user, initializing, segments]);
}
