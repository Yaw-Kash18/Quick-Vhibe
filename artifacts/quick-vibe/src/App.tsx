import { createContext, useContext, useState } from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { setAuthTokenGetter } from "@workspace/api-client-react";

import Home from "./pages/home";
import SignInPage from "./pages/sign-in";
import SignUpPage from "./pages/sign-up";
import ForgotPasswordPage from "./pages/forgot-password";
import ResetPasswordPage from "./pages/reset-password";
import Chat from "./pages/chat";
import Settings from "./pages/settings";
import AdminPage from "./pages/admin";
import SetupPage from "./pages/setup";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface AuthContextType {
  isSignedIn: boolean;
  needsSetup: boolean;
  userRole: string;
  signIn: (token: string, isNewUser?: boolean, role?: string) => void;
  signOut: () => void;
  completeSetup: () => void;
  requireSetup: () => void;
  setUserRole: (role: string) => void;
}

const AuthContext = createContext<AuthContextType>({
  isSignedIn: false,
  needsSetup: false,
  userRole: "user",
  signIn: () => {},
  signOut: () => {},
  completeSetup: () => {},
  requireSetup: () => {},
  setUserRole: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  // Critical: init token getter synchronously so the first API call on page
  // refresh already has the Bearer token attached (not waiting for useEffect).
  const [isSignedIn, setIsSignedIn] = useState(() => {
    setAuthTokenGetter(() => localStorage.getItem("auth_token"));
    return !!localStorage.getItem("auth_token");
  });

  const [needsSetup, setNeedsSetup] = useState(() => !!localStorage.getItem("qv_needs_setup"));
  const [userRole, _setUserRole] = useState(() => localStorage.getItem("user_role") || "user");

  const setUserRole = (role: string) => {
    localStorage.setItem("user_role", role);
    _setUserRole(role);
  };

  const signIn = (token: string, isNewUser?: boolean, role?: string) => {
    localStorage.setItem("auth_token", token);
    setAuthTokenGetter(() => localStorage.getItem("auth_token"));
    setIsSignedIn(true);
    if (isNewUser) {
      localStorage.setItem("qv_needs_setup", "1");
      setNeedsSetup(true);
    }
    if (role) {
      localStorage.setItem("user_role", role);
      _setUserRole(role);
    }
  };

  const signOut = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("qv_needs_setup");
    localStorage.removeItem("user_role");
    setIsSignedIn(false);
    setNeedsSetup(false);
    _setUserRole("user");
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
    <AuthContext.Provider value={{ isSignedIn, needsSetup, userRole, signIn, signOut, completeSetup, requireSetup, setUserRole }}>
      {children}
    </AuthContext.Provider>
  );
}

function isAdminOrAbove(role: string) { return role === "admin" || role === "super_admin"; }

function HomeRedirect() {
  const { isSignedIn, needsSetup, userRole } = useAuth();
  if (!isSignedIn) return <Home />;
  if (needsSetup) return <Redirect to="/setup" />;
  if (isAdminOrAbove(userRole)) return <Redirect to="/admin" />;
  return <Redirect to="/chat" />;
}

// Chat and Settings: accessible to ALL signed-in users (including admins)
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isSignedIn, needsSetup } = useAuth();
  if (!isSignedIn) return <Redirect to="/" />;
  if (needsSetup) return <Redirect to="/setup" />;
  return <Component />;
}

// Admin: for admin and super_admin roles
function AdminRoute() {
  const { isSignedIn, needsSetup, userRole } = useAuth();
  if (!isSignedIn) return <Redirect to="/" />;
  if (needsSetup) return <Redirect to="/setup" />;
  if (!isAdminOrAbove(userRole)) return <Redirect to="/chat" />;
  return <AdminPage />;
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
        <Route path="/forgot-password" component={ForgotPasswordPage} />
        <Route path="/reset-password" component={ResetPasswordPage} />
        <Route path="/setup" component={SetupRoute} />
        <Route path="/chat" component={() => <ProtectedRoute component={Chat} />} />
        <Route path="/settings" component={() => <ProtectedRoute component={Settings} />} />
        <Route path="/admin" component={AdminRoute} />
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
