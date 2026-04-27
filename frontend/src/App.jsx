import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { BookingProvider } from './context/BookingContext';

import HomePage from './pages/HomePage';
import CarModelSelectPage from './pages/CarModelSelectPage';
import VendorSelectPage from './pages/VendorSelectPage';
import ReturnVendorPage from './pages/ReturnVendorPage';
import AddonsPage from './pages/AddonsPage';
import ConfirmBookingPage from './pages/ConfirmBookingPage';
import CustomerDashboard from './pages/CustomerDashboard';
import VendorDashboard from './pages/VendorDashboard';
import AdminDashboard from './pages/AdminDashboard';
import AuthModal from './components/auth/AuthModal';

function RequireAuth({ children, role }) {
  const { user, loading } = useAuth();
  const [showAuth, setShowAuth] = useState(false);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--clr-bg)', color: 'var(--clr-muted)', fontFamily: 'var(--font-body)' }}>
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, background: 'var(--clr-bg)' }}>
          <div style={{ fontSize: 48 }}>🔐</div>
          <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--clr-text)', fontSize: 28 }}>Sign in required</h2>
          <p style={{ color: 'var(--clr-muted)', fontFamily: 'var(--font-body)' }}>Please sign in to access this page.</p>
          <button onClick={() => setShowAuth(true)} style={{ background: 'var(--clr-accent)', color: '#000', fontWeight: 700, fontSize: 15, padding: '14px 36px', borderRadius: '32px', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
            Sign In
          </button>
        </div>
        {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      </>
    );
  }

  if (role && user.role !== role) {
    return <Navigate to={user.role === 'admin' ? '/admin' : user.role === 'vendor' ? '/vendor' : '/customer'} replace />;
  }

  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <BookingProvider>
          <Routes>
            {/* Public homepage */}
            <Route path="/" element={<HomePage />} />

            {/* Booking wizard — new flow */}
            <Route path="/book/select-car" element={<CarModelSelectPage />} />
            <Route path="/book/select-vendor" element={<VendorSelectPage />} />
            <Route path="/book/return-vendor" element={<ReturnVendorPage />} />
            <Route path="/book/addons" element={<AddonsPage />} />
            <Route path="/book/confirm" element={<RequireAuth><ConfirmBookingPage /></RequireAuth>} />

            {/* Role dashboards */}
            <Route path="/customer" element={<RequireAuth role="customer"><CustomerDashboard /></RequireAuth>} />
            <Route path="/vendor" element={<RequireAuth role="vendor"><VendorDashboard /></RequireAuth>} />
            <Route path="/admin" element={<RequireAuth role="admin"><AdminDashboard /></RequireAuth>} />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BookingProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}