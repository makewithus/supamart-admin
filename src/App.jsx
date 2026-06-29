import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Zap, ShieldOff } from 'lucide-react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { Toaster } from 'react-hot-toast';
import { auth } from './config/firebase';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Orders from './pages/Orders';
import Categories from './pages/Categories';
import Customers from './pages/Customers';
import Offers from './pages/Offers';
import Login from './pages/Login';

function AppShell() {
  return (
    <div className="flex h-screen bg-neutral-50 overflow-hidden">
      <Navbar />
      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/"           element={<Dashboard />} />
          <Route path="/dashboard"  element={<Dashboard />} />
          <Route path="/products"   element={<Products />}  />
          <Route path="/orders"     element={<Orders />}    />
          <Route path="/categories" element={<Categories />}/>
          <Route path="/customers"  element={<Customers />} />
          <Route path="/offers"     element={<Offers />}    />
        </Routes>
      </main>
    </div>
  );
}

function AccessDenied({ onSignOut }) {
  return (
    <div className="flex h-screen items-center justify-center bg-neutral-50">
      <div className="flex flex-col items-center gap-4 text-center max-w-sm px-6">
        <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center">
          <ShieldOff size={26} className="text-red-500" />
        </div>
        <div>
          <p className="text-lg font-bold text-primary-900 mb-1">Access Denied</p>
          <p className="text-sm text-neutral-400">
            This account does not have admin privileges. Please sign in with an admin account.
          </p>
        </div>
        <button
          onClick={onSignOut}
          className="mt-2 px-5 py-2.5 rounded-xl bg-primary-900 text-white text-sm font-semibold hover:bg-primary-800 transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser]     = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let currentReq = 0;
    const unsub = onAuthStateChanged(auth, async (u) => {
      const reqId = ++currentReq;
      if (u) {
        setLoading(true); // Prevent UI from rendering before claims are checked
        try {
          const result = await u.getIdTokenResult();
          if (reqId !== currentReq) return;
          setIsAdmin(result.claims.role === 'ADMIN');
          setUser(u);
        } catch (error) {
          if (reqId !== currentReq) return;
          setIsAdmin(false);
          setUser(u);
        }
      } else {
        if (reqId !== currentReq) return;
        setUser(null);
        setIsAdmin(false);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-24 h-24 flex items-center justify-center animate-pulse">
            <img src="/logo.png" alt="Loading" className="w-full h-full object-contain" />
          </div>
          <p className="text-sm text-neutral-400 font-medium">Loading SupaMart…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Router>
        <Login />
      </Router>
    );
  }

  if (!isAdmin) {
    return <AccessDenied onSignOut={() => signOut(auth)} />;
  }

  return (
    <Router>
      <AppShell />
      <Toaster
        position="top-right"
        containerStyle={{ top: 20, right: 20 }}
        toastOptions={{
          duration: 3500,
          style: {
            background: '#121212',
            color: '#ffffff',
            borderRadius: '14px',
            padding: '12px 18px',
            fontSize: '13px',
            fontWeight: '500',
            boxShadow: '0 4px 24px rgba(0,0,0,0.22)',
            fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
            maxWidth: '360px',
          },
          success: {
            duration: 3000,
            iconTheme: { primary: '#67b364', secondary: '#ffffff' },
          },
          error: {
            duration: 5000,
            iconTheme: { primary: '#ef4444', secondary: '#ffffff' },
          },
        }}
      />
    </Router>
  );
}
