import './App.css'
import { Suspense, lazy, useMemo, useEffect } from 'react';
import { installGlobalNavigationGuard } from '@/lib/navigationGuard';
import { ThemeProvider, useTheme as useNextTheme } from 'next-themes'
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { buildMuiTheme } from './theme'
import { Toaster } from "@/components/ui/sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import VisualEditAgent from '@/lib/VisualEditAgent'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
const ItineraryBuilder = lazy(() => import('./pages/ItineraryBuilder'));
const SupplierBookings = lazy(() => import('./pages/SupplierBookings'));
const ImportHub = lazy(() => import('./pages/ImportHub'));
const CalendarView = lazy(() => import('./pages/CalendarView'));
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { I18nProvider } from '@/lib/i18n/I18nContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { CartProvider } from '@/lib/b2bCart';
import ErrorBoundary from '@/lib/ErrorBoundary';
import MockLogin from '@/pages/MockLogin';
import MicrosoftCallback from '@/pages/MicrosoftCallback';
import OutlookCallback from '@/pages/OutlookCallback';
import ClientItinerary from '@/pages/ClientItinerary';
import RequestQuote from '@/pages/RequestQuote';
import AcceptInvite from '@/pages/AcceptInvite';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

// Mirrors the isClientPortal check in Layout.jsx — pages a client-tier
// portal account is allowed to land on without being bounced to ClientPortal.
const CLIENT_PORTAL_PREFIXES = ['ClientPortal', 'ClientProposal', 'ClientTrip', 'ClientInvoice', 'ClientCatalog', 'ClientSupplier', 'ClientQuoteBuilder', 'ClientQuote'];
// Standalone routes (magic-link / pre-auth pages) that aren't part of the
// Pages registry and should never trigger the client-portal redirect.
const NON_REDIRECT_ROUTES = ['/mock-login', '/auth/microsoft/callback', '/accept-invite', '/auth/outlook-callback', '/client-itinerary', '/request-quote'];

function isClientPortalPage(pageName) {
  return CLIENT_PORTAL_PREFIXES.some(p => pageName?.startsWith(p));
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated, user, navigateToLogin } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Don't redirect if already on the login page (breaks redirect loop)
      if (['/mock-login', '/accept-invite', '/auth/microsoft/callback'].includes(window.location.pathname)) {
        // Allow the login page to render without a valid session
      } else {
        navigateToLogin();
        return null;
      }
    }
  }

  // Client-portal accounts (user_tier 'client') have no staff permissions and
  // land nowhere useful on the default Dashboard — send them straight to
  // their portal instead. Staff previewing the client portal (via the
  // "Client Portal (Preview)" nav link) are unaffected since their own
  // account tier is never 'client'.
  if (isAuthenticated && user?.user_tier === 'client'
    && !NON_REDIRECT_ROUTES.includes(location.pathname)
    && !isClientPortalPage(location.pathname.replace(/^\//, ''))) {
    return <Navigate to="/ClientPortal" replace />;
  }

  // Render the main app
  return (
    <Suspense fallback={
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    }>
    <Routes>
      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
          }
        />
      ))}
      <Route path="/ItineraryBuilder" element={
        <LayoutWrapper currentPageName="ItineraryBuilder">
          <ItineraryBuilder />
        </LayoutWrapper>
      } />
      <Route path="/SupplierBookings" element={
        <LayoutWrapper currentPageName="SupplierBookings">
          <SupplierBookings />
        </LayoutWrapper>
      } />
      <Route path="/ImportHub" element={
        <LayoutWrapper currentPageName="ImportHub">
          <ImportHub />
        </LayoutWrapper>
      } />
      <Route path="/CalendarView" element={
        <LayoutWrapper currentPageName="CalendarView">
          <CalendarView />
        </LayoutWrapper>
      } />
      <Route path="/mock-login" element={<MockLogin />} />
      <Route path="/auth/microsoft/callback" element={<MicrosoftCallback />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />
      <Route path="/auth/outlook-callback" element={<OutlookCallback />} />
      <Route path="/client-itinerary" element={<ClientItinerary />} />
      <Route path="/request-quote" element={<RequestQuote />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
    </Suspense>
  );
};

function MuiThemeSync({ children }) {
  const { resolvedTheme } = useNextTheme();
  const muiTheme = useMemo(() => buildMuiTheme(resolvedTheme === 'dark' ? 'dark' : 'light'), [resolvedTheme]);
  return <MuiThemeProvider theme={muiTheme}><CssBaseline />{children}</MuiThemeProvider>;
}

function App() {
  useEffect(() => { installGlobalNavigationGuard(); }, []);

  return (
    <ErrorBoundary>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
    <MuiThemeSync>
    <I18nProvider>
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <CartProvider>
          <Router>
            <NavigationTracker />
            <AuthenticatedApp />
          </Router>
          <Toaster richColors closeButton />
          <VisualEditAgent />
        </CartProvider>
      </QueryClientProvider>
    </AuthProvider>
    </I18nProvider>
    </MuiThemeSync>
    </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App