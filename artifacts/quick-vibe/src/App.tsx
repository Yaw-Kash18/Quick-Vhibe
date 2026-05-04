import { createContext, useContext, useState, useEffect, useRef } from "react";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { setAuthTokenGetter } from "@workspace/api-client-react";

import Home from "./pages/home";
import SignInPage from "./pages/sign-in";
import SignUpPage from "./pages/sign-up";
import Chat from "./pages/chat";
import Settings from "./pages/settings";
import AdminPage from "./pages/admin";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface AuthContextType {
  isSignedIn: boolean;
  signIn: (token: string) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType>({
  isSignedIn: false,
  signIn: () => {},
  signOut: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isSignedIn, setIsSignedIn] = useState(() => !!localStorage.getItem("auth_token"));

  useEffect(() => {
    setAuthTokenGetter(() => localStorage.getItem("auth_token"));
  }, []);

  const signIn = (token: string) => {
    localStorage.setItem("auth_token", token);
    setAuthTokenGetter(() => localStorage.getItem("auth_token"));
    setIsSignedIn(true);
  };

  const signOut = () => {
    localStorage.removeItem("auth_token");
    setIsSignedIn(false);
    queryClient.clear();
  };

  return (
    <AuthContext.Provider value={{ isSignedIn, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

function HomeRedirect() {
  const { isSignedIn } = useAuth();
  if (isSignedIn) return <Redirect to="/chat" />;
  return <Home />;
}

function ProtectedRoute({ component: Component }: { component: any }) {
  const { isSignedIn } = useAuth();
  if (!isSignedIn) return <Redirect to="/" />;
  return <Component />;
}

function AppRoutes() {
  return (
    <QueryClientProvider client={queryClient}>
      <Switch>
        <Route path="/" component={HomeRedirect} />
        <Route path="/sign-in" component={SignInPage} />
        <Route path="/sign-up" component={SignUpPage} />
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
