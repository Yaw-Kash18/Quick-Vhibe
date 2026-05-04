import { createContext, useContext, useState } from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { setAuthTokenGetter } from "@workspace/api-client-react";

import Home from "./pages/home";
import SignInPage from "./pages/sign-in";
import SignUpPage from "./pages/sign-up";
import Chat from "./pages/chat";
import Settings from "./pages/settings";
import AdminPage from "./pages/admin";
import SetupPage from "./pages/setup";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface AuthContextType {
  isSignedIn: boolean;
  needsSetup: boolean;
  signIn: (token: string, isNewUser?: boolean) => void;
  signOut: () => void;
  completeSetup: () => void;
  requireSetup: () => void;
}

const AuthContext = createContext<AuthContextType>({
  isSignedIn: false,
  needsSetup: false,
  signIn: () => {},
  signOut: () => {},
  completeSetup: () => {},
  requireSetup: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  // Critical fix: initialize the token getter SYNCHRONOUSLY so the very first
  // API call (fired by React Query on mount after a page refresh) already has
  // the Bearer token attached — not waiting for useEffect to run.
  const [isSignedIn, setIsSignedIn] = useState(() => {
    setAuthTokenGetter(() => localStorage.getItem("auth_token"));
    return !!localStorage.getItem("auth_token");
  });

  const [needsSetup, setNeedsSetup] = useState(() => !!localStorage.getItem("qv_needs_setup"));

  const signIn = (token: string, isNewUser?: boolean) => {
    localStorage.setItem("auth_token", token);
    setAuthTokenGetter(() => localStorage.getItem("auth_token"));
    setIsSignedIn(true);
    if (isNewUser) {
      localStorage.setItem("qv_needs_setup", "1");
      setNeedsSetup(true);
    }
  };

  const signOut = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("qv_needs_setup");
    setIsSignedIn(false);
    setNeedsSetup(false);
    queryClient.clear();
  };

  const completeSetup = () => {
    localStorage.removeItem("qv_needs_setup");
    setNeedsSetup(false);
  };

  const requireSetup = () => {
    localStorage.setItem("qv_needs_setup", "1");
    setNeedsSetup(true);
  };

  return (
    <AuthContext.Provider value={{ isSignedIn, needsSetup, signIn, signOut, completeSetup, requireSetup }}>
      {children}
    </AuthContext.Provider>
  );
}

function HomeRedirect() {
  const { isSignedIn, needsSetup } = useAuth();
  if (isSignedIn && needsSetup) return <Redirect to="/setup" />;
  if (isSignedIn) return <Redirect to="/chat" />;
  return <Home />;
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isSignedIn, needsSetup } = useAuth();
  if (!isSignedIn) return <Redirect to="/" />;
  if (needsSetup) return <Redirect to="/setup" />;
  return <Component />;
}

function SetupRoute() {
  const { isSignedIn, needsSetup } = useAuth();
  if (!isSignedIn) return <Redirect to="/" />;
  if (!needsSetup) return <Redirect to="/chat" />;
  return <SetupPage />;
}

function AppRoutes() {
  return (
    <QueryClientProvider client={queryClient}>
      <Switch>
        <Route path="/" component={HomeRedirect} />
        <Route path="/sign-in" component={SignInPage} />
        <Route path="/sign-up" component={SignUpPage} />
        <Route path="/setup" component={SetupRoute} />
        <Route path="/chat" component={() => <ProtectedRoute component={Chat} />} />
        <Route path="/settings" component={() => <ProtectedRoute component={Settings} />} />
        <Route path="/admin" component={() => <ProtectedRoute component={AdminPage} />} />
      </Switch>
    </QueryClientProvider>
  );
}

export default function App() {
  return (
    <WouterRouter base={basePath}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </WouterRouter>
  );
}
