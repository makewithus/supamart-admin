import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiGet, apiPut } from '../services/api';
import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Loader from '../components/ui/Loader';

export default function Settings() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form states
  const [storeLat, setStoreLat] = useState('');
  const [storeLng, setStoreLng] = useState('');
  const [serviceRadiusKm, setServiceRadiusKm] = useState('');
  const [minOrderValue, setMinOrderValue] = useState('');
  const [taxPercent, setTaxPercent] = useState('');

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const data = await apiGet('/config');
        setConfig(data);
        setStoreLat(data.storeLat?.toString() || '');
        setStoreLng(data.storeLng?.toString() || '');
        setServiceRadiusKm(data.serviceRadiusKm?.toString() || '');
        setMinOrderValue(data.minOrderValue?.toString() || '');
        setTaxPercent(data.taxPercent?.toString() || '');
      } catch (err) {
        toast.error('Failed to load settings');
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        storeLat: parseFloat(storeLat),
        storeLng: parseFloat(storeLng),
        serviceRadiusKm: parseFloat(serviceRadiusKm),
        minOrderValue: parseFloat(minOrderValue),
        taxPercent: parseFloat(taxPercent)
      };
      
      const updatedConfig = await apiPut('/config', payload);
      setConfig(updatedConfig);
      toast.success('Settings updated successfully!');
    } catch (err) {
      toast.error(err.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    
    const toastId = toast.loading('Detecting location...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setStoreLat(position.coords.latitude.toString());
        setStoreLng(position.coords.longitude.toString());
        toast.success('Location detected!', { id: toastId });
      },
      (error) => {
        toast.error('Failed to get location. Please allow location permissions.', { id: toastId });
        console.error('Geolocation error:', error);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  if (loading) {
    return <div className="p-8"><Loader text="Loading Settings..." /></div>;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-neutral-50 min-h-screen">
      <PageHeader
        title="Settings"
        subtitle="Manage store location and global rules"
      />

      <div className="max-w-2xl">
        <Card className="p-6">
          <form onSubmit={handleSave} className="space-y-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-primary-900 flex items-center">
                <SettingsIcon size={18} className="mr-2 text-primary-600" />
                Store Delivery Configuration
              </h3>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={handleGetLocation}
                className="text-primary-600 border-primary-200 bg-primary-50 hover:bg-primary-100"
              >
                <MapPin size={16} className="mr-2" />
                Use Current Location
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-neutral-500 mb-1">Store Latitude</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={storeLat}
                  onChange={e => setStoreLat(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl"
                  placeholder="e.g. 28.7041"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-500 mb-1">Store Longitude</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={storeLng}
                  onChange={e => setStoreLng(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl"
                  placeholder="e.g. 77.1025"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-500 mb-1">Service Radius (KM)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                required
                value={serviceRadiusKm}
                onChange={e => setServiceRadiusKm(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl"
                placeholder="e.g. 5"
              />
              <p className="text-xs text-neutral-400 mt-1">Customers outside this radius will not be able to place orders.</p>
            </div>
            
            <hr className="border-neutral-100 my-4" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-neutral-500 mb-1">Minimum Order Value (₹)</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={minOrderValue}
                  onChange={e => setMinOrderValue(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-500 mb-1">Global Tax Percent (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  required
                  value={taxPercent}
                  onChange={e => setTaxPercent(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>
            </div>

            <div className="pt-6 border-t border-neutral-100 flex justify-end">
              <Button type="submit" variant="primary" disabled={saving}>
                <Save size={16} className="mr-2" />
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
