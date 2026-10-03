import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ReportsProvider } from './context/ReportsContext';
import { NotificationProvider } from './context/NotificationContext';
import { BotConversationsProvider } from './context/BotConversationsContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import Landing from './website/Landing-Page';
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';
import Register from './pages/Register';
import Layout from './components/Layout';
import PageLoader from './components/PageLoader';
import ProtectedRoute from './components/ProtectedRoute';

// Lazy-loaded pages — downloaded only when the user navigates to them
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings = lazy(() => import('./pages/Settings'));
const IncidentReports = lazy(() => import('./pages/IncidentReports'));
const MessengerBotLogs = lazy(() => import('./pages/MessengerBotLogs'));
const ScraperFeed = lazy(() => import('./pages/ScraperFeed'));
const GeospatialMap = lazy(() => import('./pages/GeospatialMap'));
const Analytics = lazy(() => import('./pages/Analytics'));

// Scoped admin providers — mounted only after authentication to avoid background polling on public pages
function AdminLayout() {
  return (
    <NotificationProvider>
      <ReportsProvider>
        <BotConversationsProvider>
          <Layout />
        </BotConversationsProvider>
      </ReportsProvider>
    </NotificationProvider>
  );
}

// Redirect already-logged-in users away from /login to /dashboard
function LoginRoute() {
  const { user } = useAuth();
  if (user) return <Navigate to="/dashboard" replace />;
  return <Login />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes — no login required */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<LoginRoute />} />
          <Route path="/register" element={<Register />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* Protected admin routes — require valid session cookie */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AdminLayout />}>
              <Route path="/dashboard" element={
                <Suspense fallback={<PageLoader variant="dashboard" />}>
                  <Dashboard />
                </Suspense>
              } />
              <Route path="/incident-reports" element={
                <Suspense fallback={<PageLoader variant="incidents" />}>
                  <IncidentReports />
                </Suspense>
              } />
              <Route path="/messenger-bot-logs" element={
                <Suspense fallback={<PageLoader variant="messenger" />}>
                  <MessengerBotLogs />
                </Suspense>
              } />
              <Route path="/scraper-feed" element={
                <Suspense fallback={<PageLoader variant="scraper" />}>
                  <ScraperFeed />
                </Suspense>
              } />
              <Route path="/geospatial-map" element={
                <Suspense fallback={<PageLoader variant="geospatial" />}>
                  <GeospatialMap />
                </Suspense>
              } />
              <Route path="/geospatial" element={
                <Suspense fallback={<PageLoader variant="geospatial" />}>
                  <GeospatialMap />
                </Suspense>
              } />
              <Route path="/analytics" element={
                <Suspense fallback={<PageLoader variant="analytics" />}>
                  <Analytics />
                </Suspense>
              } />
              <Route path="/settings" element={
                <Suspense fallback={<PageLoader variant="dashboard" />}>
                  <Settings />
                </Suspense>
              } />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

