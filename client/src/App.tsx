import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { OWNER_DASHBOARD_PATH } from "./const";
import Dashboard from "./pages/Dashboard";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import Settings from "./pages/Settings";

function Router() {
  return <Switch>
    <Route path={OWNER_DASHBOARD_PATH} component={Dashboard} />
    <Route path={`${OWNER_DASHBOARD_PATH}/site/:slug/settings`}>{(params) => <Settings slug={params.slug} />}</Route>
    <Route path="/site/:slug">{(params) => <Home slug={params.slug} />}</Route>
    <Route path="/">{() => <Home slug="main-memory" />}</Route>
    <Route path="/404" component={NotFound} />
    <Route component={NotFound} />
  </Switch>;
}

export default function App() { return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Router /><Toaster richColors position="top-center" /></TooltipProvider></ThemeProvider></ErrorBoundary>; }
