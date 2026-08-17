import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Zap, ShieldOff } from 'lucide-react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { Toaster } from 'react-hot-toast';
import { auth } from './config/firebase';
import Navbar from './components/Navbar';
import Loader from './components/ui/Loader';
import Login from './pages/Login';
import NewOrderBanner from './components/NewOrderBanner';
import EnableAlertsPrompt from './components/EnableAlertsPrompt';
import useIdleLogout from './hooks/useIdleLogout';
import useNewOrderAlert from './hooks/useNewOrderAlert';
import { autoUnlockOnFirstInteraction } from './utils/notificationSound';
import { initPushNotifications, teardownPushNotifications } from './services/pushNotifications';

// Persistent (not sessionStorage) — once dismissed, stays dismissed across reloads/new
// tabs/browser restarts. Combined with the Notification.permission check below, the
// "Enable Order Alerts" banner now shows at most once ever per browser, instead of
// re-appearing on every load.
const ALERTS_DISMISSED_KEY = 'ms_admin_alerts_prompt_dismissed';

function shouldShowEnablePrompt() {
  if (typeof Notification === 'undefined') return false;
  // 'granted' or 'denied' both mean the admin already made this decision once — the
  // browser itself remembers it permanently, so re-showing our own banner on top of that
  // is exactly the "asks every time" annoyance being fixed here. Only 'default' (never
  // asked) is worth prompting for.
  if (Notification.permission !== 'default') return false;
  return localStorage.getItem(ALERTS_DISMISSED_KEY) !== '1';
}

// Each admin page is its own chunk — only the page the admin is currently on
// gets downloaded, instead of one ~800kB bundle for all 7 pages up front.
const Dashboard  = lazy(() => import('./pages/Dashboard'));
const Products   = lazy(() => import('./pages/Products'));
const Orders     = lazy(() => import('./pages/Orders'));
const Accounts   = lazy(() => import('./pages/Accounts'));
const Categories = lazy(() => import('./pages/Categories'));
const Brands     = lazy(() => import('./pages/Brands'));
const Customers  = lazy(() => import('./pages/Customers'));
const Offers     = lazy(() => import('./pages/Offers'));

function PageFallback() {
  return (
    <div className="flex items-center justify-center h-full min-h-[60vh]">
      <Loader text="Loading…" />
    </div>
  );
}

function AppShell() {
  const navigate = useNavigate();
  const [orderAlert, setOrderAlert] = useState(null);
  const [showEnablePrompt, setShowEnablePrompt] = useState(shouldShowEnablePrompt);

  useNewOrderAlert(true, useCallback((order) => setOrderAlert(order), []));

  // The audio unlock itself doesn't need its own visible prompt — it happens the moment
  // the admin clicks/taps/types anywhere on the dashboard, which happens naturally within
  // seconds of opening it. Only Notification permission needs an explicit ask (see
  // shouldShowEnablePrompt above).
  useEffect(() => {
    autoUnlockOnFirstInteraction();
  }, []);

  const handleViewOrder = () => {
    if (orderAlert) navigate('/orders', { state: { openOrderId: orderAlert.id } });
    setOrderAlert(null);
  };

  const dismissEnablePrompt = () => {
    localStorage.setItem(ALERTS_DISMISSED_KEY, '1');
    setShowEnablePrompt(false);
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-neutral-50 overflow-hidden">
      <Navbar />
      <main className="flex-1 overflow-y-auto">
        {orderAlert ? (
          <NewOrderBanner order={orderAlert} onView={handleViewOrder} onDismiss={() => setOrderAlert(null)} />
        ) : (
          <EnableAlertsPrompt
            show={showEnablePrompt}
            onEnabled={() => setShowEnablePrompt(false)}
            onDismiss={dismissEnablePrompt}
          />
        )}
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/"           element={<Dashboard />} />
            <Route path="/dashboard"  element={<Dashboard />} />
            <Route path="/products"   element={<Products />}  />
            <Route path="/orders"     element={<Orders />}    />
            <Route path="/accounts"   element={<Accounts />}  />
            <Route path="/categories" element={<Categories />}/>
            <Route path="/brands"     element={<Brands />}    />
            <Route path="/customers"  element={<Customers />} />
            <Route path="/offers"     element={<Offers />}    />
            {/* Signed-in admin landing on the login URL (e.g. a stale bookmark) — send
                them to the dashboard instead of showing nothing (no route matches here). */}
            <Route path="/admin-login" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
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

  // Auto sign-out after inactivity (only while a signed-in admin is using it).
  useIdleLogout(!!user && isAdmin);
  // Foreground "new order" sound/toast — reliable as long as this tab is open, no setup required.
  useNewOrderAlert(!!user && isAdmin);

  useEffect(() => {
    let currentReq = 0;
    let sawUser = false; // for diagnostics only — tells the "u is null" log apart as a real
                          // sign-out vs. this being the very first check on page load
    const unsub = onAuthStateChanged(auth, async (u) => {
      const reqId = ++currentReq;
      if (u) {
        sawUser = true;
        setLoading(true); // Prevent UI from rendering before claims are checked

        // getIdTokenResult() right after a fresh sign-in should already have a valid
        // cached token and not need a network round-trip — but a transient network blip
        // (exactly the kind of thing that's more common on a shop's real-world
        // connection) can still make it throw. Retrying once, rather than immediately
        // concluding "not an admin," avoids a flaky network turning into a spurious
        // Access-Denied / bounce for an account that's actually fine.
        let result;
        try {
          result = await u.getIdTokenResult();
        } catch (err1) {
          console.error('getIdTokenResult() failed, retrying once:', err1);
          try {
            await new Promise((r) => setTimeout(r, 800));
            result = await u.getIdTokenResult(/* forceRefresh */ true);
          } catch (err2) {
            console.error('getIdTokenResult() failed again after retry — showing Access Denied, not signing out:', err2);
          }
        }

        if (reqId !== currentReq) return;

        if (!result) {
          // Both attempts failed. Deliberately NOT calling signOut() here — the Firebase
          // session itself is still perfectly valid, only reading its custom claims
          // failed, and forcing a sign-out on a transient/network error is exactly the
          // kind of surprise logout this whole investigation is about. Access Denied at
          // least keeps the session intact so the admin can just retry.
          setIsAdmin(false);
          setUser(u);
          setLoading(false);
          return;
        }

        const admin = result.claims.role === 'ADMIN';
        setIsAdmin(admin);
        setUser(u);
        // Silently RESTORE push registration if a past session already has Notification
        // permission granted (requestPermission: false — this never shows the OS prompt).
        // A first-time grant only ever happens via the explicit "Enable Order Alerts"
        // gesture in EnableAlertsPrompt.jsx, per the no-auto-prompt requirement.
        if (admin) {
          initPushNotifications({ requestPermission: false }).then((pushResult) => {
            if (!pushResult.ok && pushResult.reason !== 'permission-not-yet-requested' && pushResult.reason !== 'no-vapid-key') {
              console.error('Push notification silent restore failed:', pushResult.reason, pushResult.error || '');
            }
          });
        }
        setLoading(false);
      } else {
        if (reqId !== currentReq) return;
        if (sawUser) {
          // Firebase itself reported this session as signed-out — not one of our own
          // signOut() calls (Navbar/AccessDenied are user-clicks; useIdleLogout is now
          // 8h). If this fires moments after a successful login, the cause is upstream of
          // this app — most likely a persistence failure (see config/firebase.js) or the
          // Firebase project/session being invalidated some other way — check this log
          // plus whatever browserLocalPersistence fallback warning appears above it.
          console.error('Firebase Auth reported signed-out without an app-initiated signOut() call. If this followed a login within seconds, check the persistence warnings logged from config/firebase.js.');
        }
        setUser(null);
        setIsAdmin(false);
        teardownPushNotifications();
        setLoading(false);
      }
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
          <p className="text-sm text-neutral-400 font-medium">Loading MS Traders…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Router>
        <Routes>
          <Route path="/admin-login" element={<Login />} />
          {/* Any other URL while signed out — including a bookmark/direct link like
              /accounts or /products — lands on the login page, and the address bar
              rewrites to /admin-login instead of silently showing Login at whatever
              path was typed. */}
          <Route path="*" element={<Navigate to="/admin-login" replace />} />
        </Routes>
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
