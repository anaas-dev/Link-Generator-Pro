import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import Dashboard from "@/pages/Dashboard";
import Campaigns from "@/pages/Campaigns";
import Links from "@/pages/Links";
import Settings from "@/pages/Settings";
import Login from "@/pages/Login";
import NotFound from "@/pages/not-found";
import { useAuth } from "@/hooks/useAuth";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    }
  }
});

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { data: user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f4f6fb] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#4f8ef7] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  return <Component />;
}

function PublicRoute({ component: Component }: { component: React.ComponentType }) {
  const { data: user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f4f6fb] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#4f8ef7] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user) {
    return <Redirect to="/" />;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login">
        <PublicRoute component={Login} />
      </Route>
      <Route path="/register">
        <Redirect to="/login" />
      </Route>
      <Route path="/">
        <ProtectedRoute component={Dashboard} />
      </Route>
      <Route path="/campaigns">
        <ProtectedRoute component={Campaigns} />
      </Route>
      <Route path="/links">
        <ProtectedRoute component={Links} />
      </Route>
      <Route path="/settings">
        <ProtectedRoute component={Settings} />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
