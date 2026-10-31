import React, { useState, useEffect, useRef } from 'react';
import { Search, Volume2, Bell, Menu, ShoppingBag, CreditCard, AlertCircle, Package, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getAudioContext, playNotificationSound } from '../utils/notificationSound';
import { useBadges } from '../context/BadgeContext';
import { apiGet, apiPut } from '../services/api';
import toast from 'react-hot-toast';

export default function TopBar({ onOpenMobileMenu }) {
  const navigate = useNavigate();
  const [storeOpen, setStoreOpen] = useState(() => {
    return localStorage.getItem('ms_admin_store_open') !== 'false';
  });
  const [togglePending, setTogglePending] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const notifRef = useRef(null);

  const { counts: alertCounts, recentAlerts } = useBadges();

  // The Admin SDK owns config writes. Load status through the authenticated API
  // so this admin client does not attempt a Firestore write forbidden by rules.
  useEffect(() => {
    let active = true;
    apiGet('/config').then((data) => {
      if (!active) return;
      const open = data.isStoreOpen !== false && data.storeOpen !== false;
      setStoreOpen(open);
      localStorage.setItem('ms_admin_store_open', String(open));
    }).catch((err) => console.error('Failed to load store status:', err));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotificationsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Global Ctrl+K hotkey to trigger search input focus
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const input = document.getElementById('global-search-input');
        if (input) input.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleStore = async () => {
    if (togglePending) return;
    const next = !storeOpen;
    const previous = storeOpen;
    setTogglePending(true);
    setStoreOpen(next);
    localStorage.setItem('ms_admin_store_open', String(next));
    try {
      const data = await apiPut('/config', { isStoreOpen: next, storeOpen: next });
      const confirmed = data.isStoreOpen !== false && data.storeOpen !== false;
      setStoreOpen(confirmed);
      localStorage.setItem('ms_admin_store_open', String(confirmed));
      toast.success(next ? 'Store is open for orders' : 'Store is closed for orders');
    } catch (err) {
      setStoreOpen(previous);
      localStorage.setItem('ms_admin_store_open', String(previous));
      console.error('Failed to sync store status:', err);
      toast.error(err.message || 'Failed to update store status');
    } finally {
      setTogglePending(false);
    }
  };

  const handleTestSound = () => {
    getAudioContext()?.resume();
    playNotificationSound();
    toast.success('Audio notification working (playing test chime)', {
      duration: 2000,
    });
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const q = searchQuery.trim();
    if (/^\d+$/.test(q)) {
      navigate('/orders', { state: { search: q } });
    } else {
      navigate('/products', { state: { search: q } });
    }
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-[60px] px-3 sm:px-6 lg:px-8 bg-white border-b border-gray-200/90 shrink-0 shadow-2xs">
      {/* Left: Mobile Menu Toggle + Global Search Bar */}
      <div className="flex items-center gap-2 sm:gap-3 flex-1 max-w-xl min-w-0">
        <button
          onClick={onOpenMobileMenu}
          className="md:hidden p-1.5 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors shrink-0"
          aria-label="Open sidebar"
        >
          <Menu size={20} />
        </button>

        <form onSubmit={handleSearchSubmit} className="relative w-full max-w-md min-w-0">
          <div className="relative flex items-center">
            <Search size={15} className="absolute left-3 text-gray-400 pointer-events-none" />
            <input
              id="global-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full pl-8 sm:pl-9 pr-4 sm:pr-14 py-1.5 sm:py-2 bg-gray-50/80 text-gray-800 placeholder-gray-400 text-xs sm:text-sm rounded-lg border border-gray-200 focus:outline-none focus:bg-white focus:border-[#0a7c47] focus:ring-1 focus:ring-[#0a7c47] transition-all shadow-2xs"
            />
            <div className="hidden sm:flex absolute right-2.5 items-center pointer-events-none">
              <kbd className="px-1.5 py-0.5 text-[10px] font-semibold text-gray-400 bg-white border border-gray-200 rounded shadow-2xs">
                Ctrl K
              </kbd>
            </div>
          </div>
        </form>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 ml-2">
        {/* Store Open Toggle */}
        <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 bg-white border border-gray-200 rounded-full shadow-2xs">
          <span className={`w-2 h-2 rounded-full shrink-0 ${storeOpen ? 'bg-[#0a7c47]' : 'bg-gray-300'}`} />
          <span className="hidden sm:inline text-xs font-semibold text-gray-800 select-none">
            {storeOpen ? 'Store open' : 'Store closed'}
          </span>
          <button
            onClick={toggleStore}
            type="button"
            disabled={togglePending}
            aria-label="Toggle store status"
            className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:cursor-wait disabled:opacity-70 ${
              storeOpen ? 'bg-[#0a7c47]' : 'bg-gray-300'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                storeOpen ? 'translate-x-3' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Audio Notification Test Button */}
        <button
          onClick={handleTestSound}
          type="button"
          aria-label="Test alert notification sound"
          className="hidden xs:flex sm:flex w-8 h-8 sm:w-9 sm:h-9 items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors shadow-2xs"
          title="Test audio chime"
        >
          <Volume2 size={15} strokeWidth={1.8} />
        </button>

        {/* Notifications Bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotificationsOpen((v) => !v)}
            type="button"
            aria-label="View notifications"
            className="relative w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors shadow-2xs"
          >
            <Bell size={15} strokeWidth={1.8} />
            {(alertCounts.orders + alertCounts.payments + alertCounts.issues + alertCounts.products) > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center rounded-full bg-[#ef4444] text-white text-[10px] font-bold shadow-2xs">
                {alertCounts.orders + alertCounts.payments + alertCounts.issues + alertCounts.products}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-sm bg-white rounded-xl shadow-card-hover border border-gray-200/90 py-3 z-50 animate-fade-in">
              <div className="flex items-center justify-between px-4 pb-2 border-b border-gray-100">
                <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">Alerts & Actions</span>
                <span className="text-[10px] font-semibold text-[#0a7c47] bg-[#e6f4ea] px-2 py-0.5 rounded-full">
                  Store Live
                </span>
              </div>
              <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
                {(alertCounts.orders + alertCounts.payments + alertCounts.issues + alertCounts.products) === 0 ? (
                  <div className="py-8 px-4 text-center text-xs text-gray-500 flex flex-col items-center justify-center gap-2">
                    <CheckCircle2 size={24} className="text-[#0a7c47]" />
                    <span>All caught up! No active alerts.</span>
                  </div>
                ) : (
                  <>
                    {alertCounts.orders > 0 && (
                      <button
                        onClick={() => { navigate('/orders'); setNotificationsOpen(false); }}
                        className="w-full text-left px-4 py-2.5 flex items-start gap-3 hover:bg-gray-50 transition-colors"
                      >
                        <div className="p-2 rounded-lg bg-red-50 text-[#ef4444] shrink-0 mt-0.5">
                          <ShoppingBag size={14} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-900">{alertCounts.orders} Orders Awaiting Action</p>
                          <p className="text-[11px] text-gray-500">New customer orders ready to pack or dispatch</p>
                        </div>
                      </button>
                    )}
                    {alertCounts.payments > 0 && (
                      <button
                        onClick={() => { navigate('/payments'); setNotificationsOpen(false); }}
                        className="w-full text-left px-4 py-2.5 flex items-start gap-3 hover:bg-gray-50 transition-colors"
                      >
                        <div className="p-2 rounded-lg bg-[#e6f4ea] text-[#0a7c47] shrink-0 mt-0.5">
                          <CreditCard size={14} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-900">{alertCounts.payments} Payments to Verify</p>
                          <p className="text-[11px] text-gray-500">Manual UPI claims awaiting bank confirmation</p>
                        </div>
                      </button>
                    )}
                    {alertCounts.issues > 0 && (
                      <button
                        onClick={() => { navigate('/issues'); setNotificationsOpen(false); }}
                        className="w-full text-left px-4 py-2.5 flex items-start gap-3 hover:bg-gray-50 transition-colors"
                      >
                        <div className="p-2 rounded-lg bg-red-50 text-[#ef4444] shrink-0 mt-0.5">
                          <AlertCircle size={14} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-900">{alertCounts.issues} Customer Issues Open</p>
                          <p className="text-[11px] text-gray-500">Damaged / missing items reported</p>
                        </div>
                      </button>
                    )}
                    {alertCounts.products > 0 && (
                      <div>
                        <button
                          onClick={() => { navigate('/products', { state: { stockFilter: 'LOW' } }); setNotificationsOpen(false); }}
                          className="w-full text-left px-4 py-2.5 flex items-start gap-3 hover:bg-gray-50 transition-colors"
                        >
                          <div className="p-2 rounded-lg bg-amber-50 text-[#d97706] shrink-0 mt-0.5">
                            <Package size={14} />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-gray-900">{alertCounts.products} Low Stock Items</p>
                            <p className="text-[11px] text-gray-500">Refill inventory to avoid stockouts</p>
                          </div>
                        </button>
                        {recentAlerts && recentAlerts.length > 0 && (
                          <div className="bg-amber-50/40 divide-y divide-amber-100/60 border-t border-amber-100/60">
                            {recentAlerts.slice(0, 3).map((a) => (
                              <button
                                key={a.id}
                                onClick={() => {
                                  navigate('/products', { state: { search: a.productName } });
                                  setNotificationsOpen(false);
                                }}
                                className="w-full text-left px-5 py-2 flex items-center justify-between text-xs hover:bg-amber-100/60 transition-colors"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${a.isOutOfStock ? 'bg-red-500' : 'bg-amber-500'}`} />
                                  <span className="font-semibold text-gray-800 truncate text-[11px]">{a.productName}</span>
                                </div>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ml-2 ${
                                  a.isOutOfStock ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {a.isOutOfStock ? 'Out of stock' : `${a.currentStock ?? a.stock} left`}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
              {/* Footer: View all notifications page */}
              <div className="p-2 border-t border-gray-100 bg-gray-50/70">
                <button
                  type="button"
                  onClick={() => {
                    navigate('/notifications');
                    setNotificationsOpen(false);
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-white hover:bg-gray-50 active:bg-gray-100 border border-gray-200 text-[#0A7C47] hover:text-emerald-800 text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <span>View all notifications & alerts</span>
                  <span aria-hidden="true">→</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
