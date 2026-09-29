import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ReportsProvider } from './context/ReportsContext';
import { NotificationProvider } from './context/NotificationContext';
import { BotConversationsProvider } from './context/BotConversationsContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import Landing from './website/Landing-Page';
import Login from './pages/Login';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import PageLoader from './components/PageLoader';
import ProtectedRoute from './components/ProtectedRoute';

// Lazy-loaded pages — downloaded only when the user navigates to them
const IncidentReports = lazy(() => import('./pages/IncidentReports'));
const MessengerBotLogs = lazy(() => import('./pages/MessengerBotLogs'));
const ScraperFeed = lazy(() => import('./pages/ScraperFeed'));
const GeospatialMap = lazy(() => import('./pages/GeospatialMap'));
const Analytics = lazy(() => import('./pages/Analytics'));

// Redirect already-logged-in users away from /login to /dashboard
function LoginRoute() {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return <Login />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <ReportsProvider>
            <BotConversationsProvider>
              <Routes>
                {/* Public routes — no login required */}
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<LoginRoute />} />

                {/* Protected admin routes — require valid session cookie */}
                <Route element={<ProtectedRoute />}>
                  <Route element={<Layout />}>
                    <Route path="/dashboard" element={<Dashboard />} />
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
                    <Route path="/settings" element={<Settings />} />
                  </Route>
                </Route>
              </Routes>
            </BotConversationsProvider>
          </ReportsProvider>
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

