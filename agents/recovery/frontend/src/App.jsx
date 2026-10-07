import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppLayout from './components/AppLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Charges from './pages/Charges';
import Evidence from './pages/Evidence';
import Ingestion from './pages/Ingestion';
import { RefreshCw } from 'lucide-react';

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-500 mb-2" />
        <p className="text-xs">Authenticating RecoveryOS session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-500 mb-2" />
        <p className="text-xs">Loading...</p>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function RootRedirect() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return null;
  return <Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Auth Routes */}
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicRoute>
                <Register />
              </PublicRoute>
            }
          />

          {/* Root Redirect based on authentication */}
          <Route path="/" element={<RootRedirect />} />

          {/* Protected Application Routes with unified Sidebar */}
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/charges" element={<Charges />} />
            <Route path="/evidence" element={<Evidence />} />
            <Route path="/ingestion" element={<Ingestion />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
