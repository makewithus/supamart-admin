import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  X,
  Check,
  Save,
  RotateCcw,
  Volume2,
  Trash2,
  Edit2,
  Shield,
  Clock,
  CreditCard,
  Percent,
  Store,
  Truck,
  FileText,
  Users,
  Bell,
  ChevronDown,
  Info,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { db } from '../config/firebase';
import {
  doc,
  collection,
  query,
  orderBy,
  onSnapshot,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import { apiGet, apiPut } from '../services/api';
import Modal from '../components/ui/Modal';
import { playNotificationSound, getAudioContext } from '../utils/notificationSound';

const SETTINGS_SECTIONS = [
  { id: 'store-hours', label: 'Store & hours' },
  { id: 'delivery-fees', label: 'Delivery fees', dot: 'orange' },
  { id: 'payments', label: 'Payments' },
  { id: 'tax-gst', label: 'Tax (GST)', dot: 'orange' },
  { id: 'business-legal', label: 'Business & legal', dot: 'orange' },
  { id: 'staff-roles', label: 'Staff & roles' },
  { id: 'alerts', label: 'Alerts' },
];

const INITIAL_HOLIDAYS = [
  { id: 'h1', text: '1 Nov · Kerala Piravi' },
  { id: 'h2', text: '25 Dec · Christmas' },
];

const DEFAULT_DELIVERY_TIERS = [
  { maxKm: 1, charge: 10 },
  { maxKm: 2, charge: 15 },
  { maxKm: 3, charge: 20 },
  { maxKm: 4, charge: 25 },
  { maxKm: 5, charge: 30 },
];

const DEFAULT_SLOTS = [
  { id: 'slot-1', label: '9:00 AM – 11:00 AM', from: '09:00', to: '11:00', active: true },
  { id: 'slot-2', label: '11:00 AM – 1:00 PM', from: '11:00', to: '13:00', active: true },
  { id: 'slot-3', label: '4:00 PM – 6:00 PM', from: '16:00', to: '18:00', active: true },
  { id: 'slot-4', label: '6:00 PM – 8:00 PM', from: '18:00', to: '20:00', active: true },
];

const GST_RATES = ['0%', '5%', '12%', '18%', '28%'];

// Helper to guess appropriate GST for well-known groceries if unset
function getDefaultGstForCategory(name = '') {
  const lower = name.toLowerCase();
  if (lower.includes('vegetable') || lower.includes('fruit') || lower.includes('milk')) return '0%';
  if (lower.includes('rice') || lower.includes('atta') || lower.includes('grain') || lower.includes('oil') || lower.includes('ghee') || lower.includes('spice') || lower.includes('dal') || lower.includes('pulse')) return '5%';
  if (lower.includes('sauce') || lower.includes('spread') || lower.includes('jam') || lower.includes('pickle') || lower.includes('tea') || lower.includes('coffee') || lower.includes('mix')) return '12%';
  if (lower.includes('snack') || lower.includes('personal') || lower.includes('detergent') || lower.includes('soap') || lower.includes('cleaning') || lower.includes('chocolate') || lower.includes('biscuit')) return '18%';
  return '18%';
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState('tax-gst');
  const [saving, setSaving] = useState(false);

  // 1. Store & Hours
  const [storeAddress, setStoreAddress] = useState(
    'M S TRADERS, HV76+F39, Menamkulam, Thiruvananthapuram, Kerala 695582'
  );
  const [latitude, setLatitude] = useState('8.5636625');
  const [longitude, setLongitude] = useState('76.8602344');
  const [deliveryRadius, setDeliveryRadius] = useState('5');
  const [monSatOpen, setMonSatOpen] = useState('8:30 AM');
  const [monSatClose, setMonSatClose] = useState('8:30 PM');
  const [sunOpen, setSunOpen] = useState('9:00 AM');
  const [sunClose, setSunClose] = useState('1:00 PM');
  const [holidays, setHolidays] = useState(INITIAL_HOLIDAYS);
  const [showAddHolidayInput, setShowAddHolidayInput] = useState(false);
  const [newHolidayText, setNewHolidayText] = useState('');

  // 2. Delivery fees
  const [minOrderValue, setMinOrderValue] = useState('149');
  const [baseDeliveryFee, setBaseDeliveryFee] = useState('25');
  const [freeDeliveryThreshold, setFreeDeliveryThreshold] = useState('299');
  const [deliveryTiers, setDeliveryTiers] = useState(DEFAULT_DELIVERY_TIERS);

  // 3. Delivery slots
  const [deliveryMode, setDeliveryMode] = useState('ON_DEMAND');
  const [prepMinutes, setPrepMinutes] = useState('15');
  const [slots, setSlots] = useState(DEFAULT_SLOTS);
  const [newSlotLabel, setNewSlotLabel] = useState('');
  const [showAddSlot, setShowAddSlot] = useState(false);

  // 4. Payments
  const [codEnabled, setCodEnabled] = useState(true);
  const [codMaxLimit, setCodMaxLimit] = useState('2000');
  const [upiManualEnabled, setUpiManualEnabled] = useState(true);
  const [upiId, setUpiId] = useState('SBIBHIM.INSTANT06905003255577185@sbipay');
  const [upiTimeoutMins, setUpiTimeoutMins] = useState('30');
  const [onlineGatewayEnabled, setOnlineGatewayEnabled] = useState(true);
  const [gatewayMode, setGatewayMode] = useState('LIVE');

  // 5. Tax (GST)
  const [categories, setCategories] = useState([]);
  const [categoryTaxRates, setCategoryTaxRates] = useState({});
  const [categoryPricesIncludeGst, setCategoryPricesIncludeGst] = useState({});
  const [globalTaxPercent, setGlobalTaxPercent] = useState('18');

  // 6. Business & legal details (Source of truth from Customer App Terms & Privacy)
  const [legalEntityName, setLegalEntityName] = useState('M S TRADERS');
  const [gstin, setGstin] = useState('32AABCS1429B1Z8');
  const [fssaiLicenceNumber, setFssaiLicenceNumber] = useState('');
  const [invoicePrefix, setInvoicePrefix] = useState('MST/26–27/');
  const [grievanceOfficerName, setGrievanceOfficerName] = useState('ANSAR HASSAN, Grievance Officer');
  const [grievanceOfficerEmail, setGrievanceOfficerEmail] = useState('hassanramla31@gmail.com');
  const [grievanceOfficerPhone, setGrievanceOfficerPhone] = useState('+91 9037655180');
  const [supportHours, setSupportHours] = useState('9 AM – 6 PM, Mon–Sat');

  // 7. Staff & roles
  const [staffList, setStaffList] = useState([]);
  const [requireOtpForAdmin, setRequireOtpForAdmin] = useState(true);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffRole, setNewStaffRole] = useState('Manager');

  // 8. Alerts
  const [alerts, setAlerts] = useState({
    newOrderSound: localStorage.getItem('ms_alert_sound_enabled') !== 'false',
    newOrderWhatsapp: true,
    paymentReminder30Min: true,
    lowStock: true,
    dailySummaryEmail: false,
    whatsappNumber: '+91 90376 55180',
    lowStockThreshold: 10,
    dailyEmailRecipient: 'hassanramla31@gmail.com',
  });

  // Live Firestore subscription: config/global
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'global'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.storeAddress) setStoreAddress(data.storeAddress);
        if (data.storeLat != null) setLatitude(String(data.storeLat));
        if (data.storeLng != null) setLongitude(String(data.storeLng));
        if (data.serviceRadiusKm != null) setDeliveryRadius(String(data.serviceRadiusKm));
        if (data.minOrderValue != null) setMinOrderValue(String(data.minOrderValue));
        if (data.freeDeliveryThreshold != null) setFreeDeliveryThreshold(String(data.freeDeliveryThreshold));
        if (data.baseDeliveryFee != null) setBaseDeliveryFee(String(data.baseDeliveryFee));
        if (data.taxPercent != null) setGlobalTaxPercent(String(data.taxPercent));
        if (Array.isArray(data.deliveryTiers) && data.deliveryTiers.length) setDeliveryTiers(data.deliveryTiers);
        if (data.deliveryMode) setDeliveryMode(data.deliveryMode);
        if (data.preparationMinutes != null) setPrepMinutes(String(data.preparationMinutes));
        if (Array.isArray(data.slots) && data.slots.length) setSlots(data.slots);
        if (data.openingHours) {
          if (data.openingHours.monSatOpen) setMonSatOpen(data.openingHours.monSatOpen);
          if (data.openingHours.monSatClose) setMonSatClose(data.openingHours.monSatClose);
          if (data.openingHours.sunOpen) setSunOpen(data.openingHours.sunOpen);
          if (data.openingHours.sunClose) setSunClose(data.openingHours.sunClose);
        }
        if (Array.isArray(data.holidays) && data.holidays.length) setHolidays(data.holidays);
        if (data.businessLegal) {
          const b = data.businessLegal;
          if (b.legalEntityName) setLegalEntityName(b.legalEntityName);
          if (b.gstin) setGstin(b.gstin);
          if (b.fssaiLicenceNumber !== undefined) setFssaiLicenceNumber(b.fssaiLicenceNumber);
          if (b.invoicePrefix) setInvoicePrefix(b.invoicePrefix);
          if (b.grievanceOfficerName) setGrievanceOfficerName(b.grievanceOfficerName);
          if (b.grievanceOfficerEmail) setGrievanceOfficerEmail(b.grievanceOfficerEmail);
          if (b.grievanceOfficerPhone) setGrievanceOfficerPhone(b.grievanceOfficerPhone);
          if (b.supportHours) setSupportHours(b.supportHours);
        }
        if (data.paymentConfig) {
          const p = data.paymentConfig;
          if (p.codEnabled !== undefined) setCodEnabled(p.codEnabled);
          if (p.codMaxLimit != null) setCodMaxLimit(String(p.codMaxLimit));
          if (p.upiManualEnabled !== undefined) setUpiManualEnabled(p.upiManualEnabled);
          if (p.upiId) setUpiId(p.upiId);
          if (p.onlineGatewayEnabled !== undefined) setOnlineGatewayEnabled(p.onlineGatewayEnabled);
          if (p.gatewayMode) setGatewayMode(p.gatewayMode);
        }
        if (data.alertsConfig) {
          setAlerts((prev) => ({ ...prev, ...data.alertsConfig }));
          if (data.alertsConfig.newOrderSound !== undefined) {
            localStorage.setItem('ms_alert_sound_enabled', String(data.alertsConfig.newOrderSound));
          }
        }
        if (data.requireOtpForAdmin !== undefined) {
          setRequireOtpForAdmin(data.requireOtpForAdmin);
        }
        if (data.categoryTaxRates) {
          setCategoryTaxRates((prev) => ({ ...prev, ...data.categoryTaxRates }));
        }
      }
    });
    return () => unsub();
  }, []);

  // Live Firestore subscription: categories collection
  useEffect(() => {
    const q = query(collection(db, 'categories'), orderBy('order', 'asc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setCategories(list);
        // Build initial tax rates map
        const initialTaxMap = {};
        const initialIncludeGstMap = {};
        list.forEach((cat) => {
          initialTaxMap[cat.id] = cat.gstRate || getDefaultGstForCategory(cat.name);
          initialIncludeGstMap[cat.id] = cat.pricesIncludeGst || 'Yes';
        });
        setCategoryTaxRates((prev) => ({ ...initialTaxMap, ...prev }));
        setCategoryPricesIncludeGst((prev) => ({ ...initialIncludeGstMap, ...prev }));
      },
      (err) => {
        console.error('Failed to subscribe to categories', err);
      }
    );
    return () => unsub();
  }, []);

  // Live Firestore subscription: staff collection
  useEffect(() => {
    const q = query(collection(db, 'staff'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setStaffList(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => {
        console.error('Staff listener error', err);
      }
    );
    return () => unsub();
  }, []);

  // Filter root categories for Tax Table
  const rootCategories = useMemo(() => {
    return categories.filter((c) => !c.parentId);
  }, [categories]);

  // Check if all products/categories have a single rate (e.g. 18%)
  const hasUniformRateWarning = useMemo(() => {
    const rates = Object.values(categoryTaxRates);
    if (!rates.length) return true;
    return rates.every((r) => r === '18%');
  }, [categoryTaxRates]);

  // Handle Save for all sections
  const handleSaveAll = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const configPayload = {
        storeAddress,
        storeLat: parseFloat(latitude) || 8.5636625,
        storeLng: parseFloat(longitude) || 76.8602344,
        serviceRadiusKm: parseFloat(deliveryRadius) || 5,
        minOrderValue: parseFloat(minOrderValue) || 149,
        baseDeliveryFee: parseFloat(baseDeliveryFee) || 25,
        freeDeliveryThreshold: parseFloat(freeDeliveryThreshold) || 299,
        deliveryTiers,
        deliveryMode,
        preparationMinutes: parseInt(prepMinutes, 10) || 15,
        slots,
        openingHours: {
          monSatOpen,
          monSatClose,
          sunOpen,
          sunClose,
        },
        holidays,
        taxPercent: parseFloat(globalTaxPercent) || 18,
        categoryTaxRates,
        businessLegal: {
          legalEntityName: legalEntityName.trim(),
          gstin: gstin.trim(),
          fssaiLicenceNumber: fssaiLicenceNumber.trim(),
          invoicePrefix: invoicePrefix.trim(),
          grievanceOfficerName: grievanceOfficerName.trim(),
          grievanceOfficerEmail: grievanceOfficerEmail.trim(),
          grievanceOfficerPhone: grievanceOfficerPhone.trim(),
          supportHours: supportHours.trim(),
        },
        paymentConfig: {
          codEnabled,
          codMaxLimit: parseFloat(codMaxLimit) || 2000,
          upiManualEnabled,
          upiId: upiId.trim(),
          onlineGatewayEnabled,
          gatewayMode,
        },
        alertsConfig: alerts,
        requireOtpForAdmin,
        updatedAt: Date.now(),
      };

      // 1. Direct Firestore write for instant real-time client sync
      await setDoc(doc(db, 'config', 'global'), configPayload, { merge: true });

      // 2. Also update categories with their specific gstRate in Firestore
      if (categories.length > 0) {
        const batch = writeBatch(db);
        categories.forEach((cat) => {
          const rate = categoryTaxRates[cat.id] || getDefaultGstForCategory(cat.name);
          const pricesIncludeGst = categoryPricesIncludeGst[cat.id] || 'Yes';
          const ref = doc(db, 'categories', cat.id);
          batch.update(ref, { gstRate: rate, pricesIncludeGst });
        });
        await batch.commit().catch(() => {});
      }

      // 3. Update backend API cache
      await apiPut('/config', configPayload).catch(() => {});

      // 4. Update local storage preferences
      localStorage.setItem('ms_alert_sound_enabled', String(alerts.newOrderSound));

      toast.success('Changes saved successfully!', {
        icon: '✅',
      });
    } catch (err) {
      console.error('Error saving settings:', err);
      toast.error('Failed to save settings: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Discard changes and revert to Firestore state
  const handleDiscard = async () => {
    try {
      toast('Changes discarded', { icon: '↩️' });
      // Reset by fetching active document
      const snap = await apiGet('/config').catch(() => null);
      if (snap) {
        if (snap.storeAddress) setStoreAddress(snap.storeAddress);
        if (snap.businessLegal) {
          setLegalEntityName(snap.businessLegal.legalEntityName || '');
          setGstin(snap.businessLegal.gstin || '');
          setFssaiLicenceNumber(snap.businessLegal.fssaiLicenceNumber || '');
        }
      }
    } catch (err) {
      // Ignored
    }
  };

  // Holiday management
  const removeHoliday = (id) => {
    setHolidays((prev) => prev.filter((h) => h.id !== id));
  };

  const addHoliday = () => {
    if (!newHolidayText.trim()) return;
    setHolidays((prev) => [
      ...prev,
      { id: `h-${Date.now()}`, text: newHolidayText.trim() },
    ]);
    setNewHolidayText('');
    setShowAddHolidayInput(false);
    toast.success('Holiday added');
  };

  // Slot management
  const toggleSlotActive = (id) => {
    setSlots((prev) =>
      prev.map((s) => (s.id === id ? { ...s, active: !s.active } : s))
    );
  };

  const addSlot = () => {
    if (!newSlotLabel.trim()) return;
    setSlots((prev) => [
      ...prev,
      {
        id: `slot-${Date.now()}`,
        label: newSlotLabel.trim(),
        active: true,
      },
    ]);
    setNewSlotLabel('');
    setShowAddSlot(false);
    toast.success('Delivery slot added');
  };

  // Staff management
  const handleInviteStaff = async (e) => {
    e.preventDefault();
    if (!newStaffName.trim()) {
      return toast.error('Staff name is required');
    }
    let canAccess = 'Orders, products, payments, customers';
    if (newStaffRole === 'Owner') canAccess = 'Everything';
    else if (newStaffRole === 'Packer') canAccess = 'Orders (packing only)';
    else if (newStaffRole === 'Delivery') canAccess = 'Deliveries & dispatch only';
    else if (newStaffRole === 'Cashier') canAccess = 'Orders & payments';

    const newStaff = {
      name: newStaffName.trim(),
      email: newStaffEmail.trim() || '—',
      phone: newStaffPhone.trim() || '',
      role: newStaffRole,
      canAccess,
      lastActive: 'Just invited',
      isOwner: newStaffRole === 'Owner',
      createdAt: Date.now(),
    };

    try {
      await addDoc(collection(db, 'staff'), newStaff);
      toast.success(`${newStaffRole} invitation created for ${newStaff.name}`);
      setIsInviteModalOpen(false);
      setNewStaffName('');
      setNewStaffEmail('');
      setNewStaffPhone('');
      setNewStaffRole('Manager');
    } catch (err) {
      toast.error('Failed to invite staff: ' + err.message);
    }
  };

  const handleDeleteStaff = async (id, staffMember) => {
    if (staffMember.isOwner || staffMember.role === 'Owner') {
      return toast.error('Cannot remove the store Owner');
    }
    try {
      await deleteDoc(doc(db, 'staff', id));
      toast.success(`Removed ${staffMember.name}`);
    } catch (err) {
      toast.error('Failed to remove staff');
    }
  };

  // Alerts toggle
  const toggleAlert = (key) => {
    setAlerts((prev) => {
      const next = !prev[key];
      if (key === 'newOrderSound') {
        localStorage.setItem('ms_alert_sound_enabled', String(next));
        if (next) {
          getAudioContext()?.resume();
          playNotificationSound();
          toast.success('New order sound enabled (test chime played)', { icon: '🔔' });
        } else {
          toast('New order sound disabled', { icon: '🔕' });
        }
      }
      return { ...prev, [key]: next };
    });
  };

  return (
    <div className="p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Top Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">Settings</h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">
          Changes apply to the customer app immediately
        </p>
      </div>

      {/* Two Column Layout: Left Pill Menu + Right Main Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Sub-navigation Pills */}
        <div className="lg:col-span-3 space-y-1">
          {SETTINGS_SECTIONS.map((sec) => {
            const active = activeTab === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => setActiveTab(sec.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-[13px] font-medium transition-all ${
                  active
                    ? 'bg-[#E6F4EA] text-[#0A7C47] font-semibold shadow-2xs'
                    : 'text-gray-700 hover:bg-gray-100/70 hover:text-gray-900'
                }`}
              >
                <span>{sec.label}</span>
                {sec.dot === 'orange' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {/* Right Settings Container Card */}
        <div className="lg:col-span-9 bg-white rounded-2xl border border-gray-200/80 p-6 lg:p-8 shadow-2xs min-h-[520px] flex flex-col justify-between">
          <div>
            {/* TAB 1: Store & hours */}
            {activeTab === 'store-hours' && (
              <form onSubmit={handleSaveAll} className="space-y-6">
                <div>
                  <h2 className="text-sm font-bold text-gray-900">Store & delivery area</h2>
                </div>

                {/* Store address */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Store address
                  </label>
                  <input
                    type="text"
                    value={storeAddress}
                    onChange={(e) => setStoreAddress(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all"
                  />
                </div>

                {/* Latitude, Longitude, Delivery Radius */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      Latitude
                    </label>
                    <input
                      type="text"
                      value={latitude}
                      onChange={(e) => setLatitude(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm text-gray-800 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      Longitude
                    </label>
                    <input
                      type="text"
                      value={longitude}
                      onChange={(e) => setLongitude(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm text-gray-800 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      Delivery radius (km)
                    </label>
                    <input
                      type="text"
                      value={deliveryRadius}
                      onChange={(e) => setDeliveryRadius(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm text-gray-800 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all"
                    />
                  </div>
                </div>

                {/* Opening hours */}
                <div className="space-y-2.5 pt-1">
                  <label className="block text-xs font-semibold text-gray-600">
                    Opening hours
                  </label>

                  {/* Monday - Saturday */}
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="w-36 text-xs font-medium text-gray-700">
                      Monday – Saturday
                    </span>
                    <input
                      type="text"
                      value={monSatOpen}
                      onChange={(e) => setMonSatOpen(e.target.value)}
                      className="w-32 px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-xs text-gray-800 focus:outline-none focus:border-emerald-600"
                    />
                    <span className="text-gray-400 text-xs">to</span>
                    <input
                      type="text"
                      value={monSatClose}
                      onChange={(e) => setMonSatClose(e.target.value)}
                      className="w-32 px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-xs text-gray-800 focus:outline-none focus:border-emerald-600"
                    />
                  </div>

                  {/* Sunday */}
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="w-36 text-xs font-medium text-gray-700">
                      Sunday
                    </span>
                    <input
                      type="text"
                      value={sunOpen}
                      onChange={(e) => setSunOpen(e.target.value)}
                      className="w-32 px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-xs text-gray-800 focus:outline-none focus:border-emerald-600"
                    />
                    <span className="text-gray-400 text-xs">to</span>
                    <input
                      type="text"
                      value={sunClose}
                      onChange={(e) => setSunClose(e.target.value)}
                      className="w-32 px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-xs text-gray-800 focus:outline-none focus:border-emerald-600"
                    />
                    <span className="text-xs text-gray-400 font-normal">
                      Half day
                    </span>
                  </div>
                </div>

                {/* Holidays */}
                <div className="space-y-2.5 pt-1">
                  <label className="block text-xs font-semibold text-gray-600">
                    Holidays (store closed, no slots shown)
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    {holidays.map((h) => (
                      <span
                        key={h.id}
                        className="inline-flex items-center gap-1.5 bg-[#F3F4F6] text-gray-800 text-xs px-2.5 py-1 rounded-lg font-medium"
                      >
                        <span>{h.text}</span>
                        <button
                          type="button"
                          onClick={() => removeHoliday(h.id)}
                          className="text-gray-400 hover:text-gray-700 focus:outline-none"
                        >
                          <X size={13} strokeWidth={2.5} />
                        </button>
                      </span>
                    ))}

                    {showAddHolidayInput ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          autoFocus
                          placeholder="e.g. 15 Aug · Independence Day"
                          value={newHolidayText}
                          onChange={(e) => setNewHolidayText(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && addHoliday()}
                          className="px-2.5 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-emerald-600"
                        />
                        <button
                          type="button"
                          onClick={addHoliday}
                          className="p-1 text-emerald-700 hover:bg-emerald-50 rounded"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowAddHolidayInput(false)}
                          className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowAddHolidayInput(true)}
                        className="inline-flex items-center gap-1 border border-dashed border-gray-300 hover:border-gray-400 text-gray-600 hover:text-gray-800 text-xs px-2.5 py-1 rounded-lg font-medium transition-colors"
                      >
                        <span>+ Add holiday</span>
                      </button>
                    )}
                  </div>
                </div>
              </form>
            )}

            {/* TAB 2: Delivery fees */}
            {activeTab === 'delivery-fees' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-sm font-bold text-gray-900">Delivery fees & rules</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Configure order value thresholds and tiered distance delivery charges
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      Minimum order value (₹)
                    </label>
                    <input
                      type="number"
                      value={minOrderValue}
                      onChange={(e) => setMinOrderValue(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm text-gray-800 focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      Base delivery fee (₹)
                    </label>
                    <input
                      type="number"
                      value={baseDeliveryFee}
                      onChange={(e) => setBaseDeliveryFee(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm text-gray-800 focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      Free delivery threshold (₹)
                    </label>
                    <input
                      type="number"
                      value={freeDeliveryThreshold}
                      onChange={(e) => setFreeDeliveryThreshold(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm text-gray-800 focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>

                {/* Distance slabs table */}
                <div className="pt-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-2">
                    Distance-based delivery tiers
                  </label>
                  <div className="overflow-x-auto rounded-xl border border-gray-200/80">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50/70 border-b border-gray-200 text-gray-500">
                        <tr>
                          <th className="py-2.5 px-4 font-semibold uppercase text-[11px] tracking-wider">
                            Distance Slab
                          </th>
                          <th className="py-2.5 px-4 font-semibold uppercase text-[11px] tracking-wider">
                            Delivery Charge (₹)
                          </th>
                          <th className="py-2.5 px-4 font-semibold uppercase text-[11px] tracking-wider">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {deliveryTiers.map((tier, idx) => {
                          const prevKm = idx === 0 ? 0 : deliveryTiers[idx - 1].maxKm;
                          return (
                            <tr key={tier.maxKm} className="hover:bg-gray-50/40">
                              <td className="py-2.5 px-4 text-gray-800 font-medium">
                                {prevKm} km – {tier.maxKm} km
                              </td>
                              <td className="py-2.5 px-4">
                                <div className="flex items-center gap-1.5 max-w-[120px]">
                                  <span className="text-gray-500 font-medium">₹</span>
                                  <input
                                    type="number"
                                    value={tier.charge}
                                    onChange={(e) => {
                                      const next = [...deliveryTiers];
                                      next[idx].charge = parseFloat(e.target.value) || 0;
                                      setDeliveryTiers(next);
                                    }}
                                    className="w-16 px-2 py-1 rounded-lg border border-gray-200 bg-white text-xs text-gray-900 font-semibold focus:outline-none focus:border-emerald-600"
                                  />
                                </div>
                              </td>
                              <td className="py-2.5 px-4">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700">
                                  Active
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: Payments */}
            {activeTab === 'payments' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-sm font-bold text-gray-900">Payment methods & rules</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Prepaid online payments & UPI verification configurations
                  </p>
                </div>

                <div className="space-y-4 max-w-xl">
                  {/* Prepaid Online notice */}
                  <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-1">
                    <div className="text-xs font-bold text-emerald-900">
                      100% Prepaid Online Store
                    </div>
                    <div className="text-[11px] text-emerald-700 leading-relaxed">
                      Cash on Delivery (COD) is permanently disabled. All orders must be paid online via UPI or card prior to dispatch.
                    </div>
                  </div>

                  {/* UPI Manual Verification */}
                  <div className="p-4 rounded-xl border border-gray-200 bg-white space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-gray-900">
                          Store UPI / QR Code Verification
                        </div>
                        <div className="text-[11px] text-gray-500">
                          Customers scan QR code or send to VPA, staff confirms on Accounts tab
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setUpiManualEnabled(!upiManualEnabled)}
                        className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                          upiManualEnabled
                            ? 'bg-[#056B38] text-white shadow-2xs'
                            : 'border border-gray-300 bg-white'
                        }`}
                      >
                        {upiManualEnabled && <Check size={14} strokeWidth={3} />}
                      </button>
                    </div>

                    {upiManualEnabled && (
                      <div className="pt-2 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                            Store UPI ID / VPA
                          </label>
                          <input
                            type="text"
                            value={upiId}
                            onChange={(e) => setUpiId(e.target.value)}
                            className="w-full px-2.5 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-600"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                            Awaiting verification timeout
                          </label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              value={upiTimeoutMins}
                              onChange={(e) => setUpiTimeoutMins(e.target.value)}
                              className="w-20 px-2.5 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-600"
                            />
                            <span className="text-xs text-gray-500">mins</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Online Gateway */}
                  <div className="p-4 rounded-xl border border-gray-200 bg-white space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-gray-900">
                          Online Payment Gateway (Cards / Netbanking / Wallets)
                        </div>
                        <div className="text-[11px] text-gray-500">
                          Instant automated order confirmation via integrated gateway
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setOnlineGatewayEnabled(!onlineGatewayEnabled)}
                        className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                          onlineGatewayEnabled
                            ? 'bg-[#056B38] text-white shadow-2xs'
                            : 'border border-gray-300 bg-white'
                        }`}
                      >
                        {onlineGatewayEnabled && <Check size={14} strokeWidth={3} />}
                      </button>
                    </div>

                    {onlineGatewayEnabled && (
                      <div className="pt-2 border-t border-gray-100 flex items-center gap-3">
                        <span className="text-xs text-gray-600 font-medium">Gateway Mode:</span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                          ● {gatewayMode} MODE
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: Tax (GST) - FROM SCREENSHOT 1 */}
            {activeTab === 'tax-gst' && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-sm font-bold text-gray-900">Tax (GST)</h2>
                </div>

                {/* Warning Red Alert Banner matching Screenshot 1 */}
                <div className="p-4 rounded-xl bg-[#FDF2F2] border border-[#FDE8E8] text-[#991B1B]">
                  <p className="text-xs sm:text-[13px] leading-relaxed">
                    <strong className="font-bold">
                      A single 18% rate is set for every product.
                    </strong>{' '}
                    Most groceries are 0% or 5%. Set the rate per category instead, and confirm the
                    rates with your accountant.
                  </p>
                </div>

                {/* Category GST Rate Table matching Screenshot 1 */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-500">
                        <th className="py-3 px-1 font-semibold text-[11px] tracking-wider uppercase">
                          CATEGORY
                        </th>
                        <th className="py-3 px-4 font-semibold text-[11px] tracking-wider uppercase">
                          GST RATE
                        </th>
                        <th className="py-3 px-4 font-semibold text-[11px] tracking-wider uppercase">
                          PRICES INCLUDE GST
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rootCategories.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-8 text-center text-gray-400">
                            No categories found in the database.
                          </td>
                        </tr>
                      ) : (
                        rootCategories.map((cat) => {
                        const currentRate =
                          categoryTaxRates[cat.id] ||
                          cat.gstRate ||
                          getDefaultGstForCategory(cat.name);
                        const pricesInclude =
                          categoryPricesIncludeGst[cat.id] ||
                          cat.pricesIncludeGst ||
                          'Yes';

                        return (
                          <tr key={cat.id} className="hover:bg-gray-50/40 transition-colors">
                            <td className="py-3.5 px-1 font-semibold text-gray-900 text-xs sm:text-sm">
                              {cat.name}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="relative inline-block w-28">
                                <select
                                  value={currentRate}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setCategoryTaxRates((prev) => ({
                                      ...prev,
                                      [cat.id]: val,
                                    }));
                                  }}
                                  className="w-full appearance-none px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-xs font-medium text-gray-800 pr-8 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 shadow-2xs cursor-pointer"
                                >
                                  {GST_RATES.map((rate) => (
                                    <option key={rate} value={rate}>
                                      {rate}
                                    </option>
                                  ))}
                                </select>
                                <ChevronDown
                                  size={13}
                                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                                />
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-xs font-normal text-gray-600">
                              {pricesInclude}
                            </td>
                          </tr>
                        );
                      })
                    )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 6: Business & legal details - FROM SCREENSHOT 2 */}
            {activeTab === 'business-legal' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-sm font-bold text-gray-900">Business & legal details</h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Shown on invoices and in the app’s Terms and Privacy Policy.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                  {/* Legal entity name */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      Legal entity name
                    </label>
                    <input
                      type="text"
                      placeholder="As on your GST certificate"
                      value={legalEntityName}
                      onChange={(e) => setLegalEntityName(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all"
                    />
                  </div>

                  {/* GSTIN */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      GSTIN
                    </label>
                    <input
                      type="text"
                      placeholder="15-character GST number"
                      value={gstin}
                      onChange={(e) => setGstin(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all"
                    />
                  </div>

                  {/* FSSAI licence number */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      FSSAI licence number
                    </label>
                    <input
                      type="text"
                      placeholder="14 digits"
                      value={fssaiLicenceNumber}
                      onChange={(e) => setFssaiLicenceNumber(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all"
                    />
                  </div>

                  {/* Invoice prefix */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      Invoice prefix
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. MST/26–27/"
                      value={invoicePrefix}
                      onChange={(e) => setInvoicePrefix(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all"
                    />
                  </div>

                  {/* Grievance officer name */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      Grievance officer name
                    </label>
                    <input
                      type="text"
                      placeholder="Shown in Terms and Privacy"
                      value={grievanceOfficerName}
                      onChange={(e) => setGrievanceOfficerName(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all"
                    />
                  </div>

                  {/* Grievance officer email */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      Grievance officer email
                    </label>
                    <input
                      type="email"
                      placeholder="support@..."
                      value={grievanceOfficerEmail}
                      onChange={(e) => setGrievanceOfficerEmail(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all"
                    />
                  </div>

                  {/* Grievance officer phone */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      Grievance officer phone
                    </label>
                    <input
                      type="text"
                      placeholder="+91"
                      value={grievanceOfficerPhone}
                      onChange={(e) => setGrievanceOfficerPhone(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all"
                    />
                  </div>

                  {/* Support hours */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      Support hours
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 9 AM – 6 PM, Mon–Sat"
                      value={supportHours}
                      onChange={(e) => setSupportHours(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 7: Staff & roles - FROM SCREENSHOT 3 */}
            {activeTab === 'staff-roles' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-gray-900">Staff & roles</h2>
                  <button
                    type="button"
                    onClick={() => setIsInviteModalOpen(true)}
                    className="px-4 py-2 rounded-xl bg-[#056B38] hover:bg-[#04552C] text-white text-xs font-semibold transition-colors shadow-2xs flex items-center gap-1.5"
                  >
                    <span>Invite staff</span>
                  </button>
                </div>

                {/* Staff Table matching Screenshot 3 */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-500">
                        <th className="py-3 px-1 font-semibold text-[11px] tracking-wider uppercase">
                          NAME
                        </th>
                        <th className="py-3 px-4 font-semibold text-[11px] tracking-wider uppercase">
                          ROLE
                        </th>
                        <th className="py-3 px-4 font-semibold text-[11px] tracking-wider uppercase">
                          CAN ACCESS
                        </th>
                        <th className="py-3 px-4 font-semibold text-[11px] tracking-wider uppercase">
                          LAST ACTIVE
                        </th>
                        <th className="py-3 px-2 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {staffList.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-gray-400">
                            No staff members added yet.
                          </td>
                        </tr>
                      ) : (
                        staffList.map((st) => {
                          let roleBadge = 'bg-[#E6F4EA] text-[#0A7C47]';
                          if (st.role === 'Manager') roleBadge = 'bg-[#E8F0FE] text-[#1A73E8]';
                          else if (st.role === 'Packer') roleBadge = 'bg-[#FEF7E0] text-[#B06000]';
                          else if (st.role === 'Delivery') roleBadge = 'bg-[#F3E8FD] text-[#7E22CE]';
                          else if (st.role === 'Cashier') roleBadge = 'bg-[#E0F2FE] text-[#0369A1]';

                          return (
                            <tr key={st.id} className="hover:bg-gray-50/40 transition-colors">
                              <td className="py-3.5 px-1">
                                <div className="font-bold text-gray-900 text-xs sm:text-sm">
                                  {st.name}
                                </div>
                                <div className="text-[11px] text-gray-500">{st.email}</div>
                              </td>
                              <td className="py-3.5 px-4">
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold ${roleBadge}`}
                                >
                                  {st.role}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-xs text-gray-700">
                                {st.canAccess || 'Standard access'}
                              </td>
                              <td className="py-3.5 px-4 text-xs text-gray-500">
                                {st.lastActive || 'Today'}
                              </td>
                              <td className="py-3.5 px-2 text-right">
                                {!st.isOwner && st.role !== 'Owner' && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteStaff(st.id, st)}
                                    className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors"
                                    title="Remove staff member"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Checkbox: Require a one-time code at sign-in for Owner and Manager */}
                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setRequireOtpForAdmin(!requireOtpForAdmin)}
                    className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                      requireOtpForAdmin
                        ? 'bg-[#056B38] text-white shadow-2xs'
                        : 'border border-gray-300 bg-white'
                    }`}
                  >
                    {requireOtpForAdmin && <Check size={14} strokeWidth={3} />}
                  </button>
                  <span
                    onClick={() => setRequireOtpForAdmin(!requireOtpForAdmin)}
                    className="text-xs sm:text-[13px] font-medium text-gray-800 cursor-pointer select-none"
                  >
                    Require a one-time code at sign-in for Owner and Manager
                  </span>
                </div>
              </div>
            )}

            {/* TAB 8: Alerts - FROM SCREENSHOT 4 */}
            {activeTab === 'alerts' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-sm font-bold text-gray-900">Alerts</h2>
                </div>

                <div className="divide-y divide-gray-100">
                  {/* 1. New order sound */}
                  <div className="py-4 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-xs sm:text-sm font-bold text-gray-900 flex items-center gap-2">
                        <span>New order sound</span>
                        <button
                          type="button"
                          onClick={() => {
                            getAudioContext()?.resume();
                            playNotificationSound();
                            toast.success('Playing alert chime', { icon: '🔔' });
                          }}
                          className="text-[11px] font-normal text-emerald-700 hover:underline flex items-center gap-1"
                        >
                          <Volume2 size={13} /> Test sound
                        </button>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        Plays in this browser when an order comes in
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleAlert('newOrderSound')}
                      className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                        alerts.newOrderSound
                          ? 'bg-[#056B38] text-white shadow-2xs'
                          : 'border border-gray-300 bg-white'
                      }`}
                    >
                      {alerts.newOrderSound && <Check size={14} strokeWidth={3} />}
                    </button>
                  </div>

                  {/* 2. New order on WhatsApp */}
                  <div className="py-4 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-xs sm:text-sm font-bold text-gray-900">
                        New order on WhatsApp
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        Send each order to the store’s WhatsApp number
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleAlert('newOrderWhatsapp')}
                      className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                        alerts.newOrderWhatsapp
                          ? 'bg-[#056B38] text-white shadow-2xs'
                          : 'border border-gray-300 bg-white'
                      }`}
                    >
                      {alerts.newOrderWhatsapp && <Check size={14} strokeWidth={3} />}
                    </button>
                  </div>

                  {/* 3. Payment not verified in 30 min */}
                  <div className="py-4 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-xs sm:text-sm font-bold text-gray-900">
                        Payment not verified in 30 min
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        Remind staff to check the UPI payment
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleAlert('paymentReminder30Min')}
                      className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                        alerts.paymentReminder30Min
                          ? 'bg-[#056B38] text-white shadow-2xs'
                          : 'border border-gray-300 bg-white'
                      }`}
                    >
                      {alerts.paymentReminder30Min && <Check size={14} strokeWidth={3} />}
                    </button>
                  </div>

                  {/* 4. Low stock */}
                  <div className="py-4 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-xs sm:text-sm font-bold text-gray-900">
                        Low stock
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        When a product drops below its alert level
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleAlert('lowStock')}
                      className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                        alerts.lowStock
                          ? 'bg-[#056B38] text-white shadow-2xs'
                          : 'border border-gray-300 bg-white'
                      }`}
                    >
                      {alerts.lowStock && <Check size={14} strokeWidth={3} />}
                    </button>
                  </div>

                  {/* 5. Daily summary email */}
                  <div className="py-4 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-xs sm:text-sm font-bold text-gray-900">
                        Daily summary email
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        Sales, orders and issues at 9 PM
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleAlert('dailySummaryEmail')}
                      className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                        alerts.dailySummaryEmail
                          ? 'bg-[#056B38] text-white shadow-2xs'
                          : 'border border-gray-300 bg-white'
                      }`}
                    >
                      {alerts.dailySummaryEmail && <Check size={14} strokeWidth={3} />}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Actions: Discard & Save changes buttons across all tabs */}
          <div className="pt-6 mt-6 flex items-center justify-end gap-3 border-t border-gray-100">
            <button
              type="button"
              onClick={handleDiscard}
              className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors shadow-2xs"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-[#056B38] hover:bg-[#04552C] active:bg-[#034423] text-white text-xs font-semibold transition-colors shadow-2xs disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Invite staff member */}
      <Modal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        title="Invite Staff Member"
      >
        <form onSubmit={handleInviteStaff} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Ramesh Kumar"
              value={newStaffName}
              onChange={(e) => setNewStaffName(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs text-gray-800 focus:outline-none focus:border-emerald-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              placeholder="staff@mstraders.in"
              value={newStaffEmail}
              onChange={(e) => setNewStaffEmail(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs text-gray-800 focus:outline-none focus:border-emerald-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              placeholder="+91 98470 00000"
              value={newStaffPhone}
              onChange={(e) => setNewStaffPhone(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs text-gray-800 focus:outline-none focus:border-emerald-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Staff Role & Permissions
            </label>
            <select
              value={newStaffRole}
              onChange={(e) => setNewStaffRole(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-800 bg-white focus:outline-none focus:border-emerald-600 cursor-pointer"
            >
              <option value="Manager">Manager — Orders, products, payments, customers</option>
              <option value="Packer">Packer — Orders (packing only)</option>
              <option value="Delivery">Delivery — Deliveries & dispatch only</option>
              <option value="Cashier">Cashier — Orders & payments</option>
            </select>
          </div>

          <div className="pt-3 flex justify-end gap-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setIsInviteModalOpen(false)}
              className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-[#056B38] hover:bg-[#04552C] text-white text-xs font-semibold rounded-xl shadow-2xs"
            >
              Send Invitation
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
