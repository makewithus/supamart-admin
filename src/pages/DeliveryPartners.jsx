import React, { useState, useEffect } from 'react';
import { Package, UserPlus, MapPin } from 'lucide-react';
import { db } from '../config/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { apiPost } from '../services/api';
import toast from 'react-hot-toast';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Loader from '../components/ui/Loader';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';

export default function DeliveryPartners() {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'deliveryPartners'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setPartners(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleAddPartner = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiPost('/delivery-partners', { name, mobile, email, password });
      toast.success('Delivery partner created successfully!');
      setIsModalOpen(false);
      setName(''); setMobile(''); setEmail(''); setPassword('');
    } catch (err) {
      toast.error(err.message || 'Failed to create partner');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-neutral-50 min-h-screen">
      <PageHeader
        title="Delivery Partners"
        subtitle={`Manage your delivery fleet`}
        action={
          <Button variant="primary" onClick={() => setIsModalOpen(true)}>
            <UserPlus size={18} className="mr-2" />
            Add Partner
          </Button>
        }
      />

      <Card>
        {loading ? (
          <Loader text="Loading partners…" />
        ) : partners.length === 0 ? (
          <EmptyState icon={Package} title="No Delivery Partners" message="Add a delivery partner to get started." />
        ) : (
          <div className="overflow-x-auto -mx-6 -mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100">
                  <th className="px-6 py-3.5 text-left text-[11px] font-semibold uppercase tracking-widest text-neutral-400">Name</th>
                  <th className="px-6 py-3.5 text-left text-[11px] font-semibold uppercase tracking-widest text-neutral-400">Email</th>
                  <th className="px-6 py-3.5 text-left text-[11px] font-semibold uppercase tracking-widest text-neutral-400">Phone</th>
                  <th className="px-6 py-3.5 text-left text-[11px] font-semibold uppercase tracking-widest text-neutral-400">Status</th>
                  <th className="px-6 py-3.5 text-left text-[11px] font-semibold uppercase tracking-widest text-neutral-400">Location</th>
                </tr>
              </thead>
              <tbody>
                {partners.map(p => (
                  <tr key={p.id} className="border-b border-neutral-50">
                    <td className="px-6 py-4 font-medium text-primary-900">{p.name}</td>
                    <td className="px-6 py-4 text-neutral-500">{p.email || '—'}</td>
                    <td className="px-6 py-4 text-neutral-500">{p.mobile || '—'}</td>
                    <td className="px-6 py-4">
                      <Badge variant={p.isActive ? 'success' : 'neutral'}>
                        {p.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      {p.currentLocation?.lat ? (
                        <a 
                          href={`https://maps.google.com/?q=${p.currentLocation.lat},${p.currentLocation.lng}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="flex items-center text-primary-600 hover:text-primary-800 text-sm font-medium"
                        >
                          <MapPin size={16} className="mr-1.5" />
                          View Map
                        </a>
                      ) : (
                        <span className="text-neutral-400 text-sm flex items-center">
                          <MapPin size={16} className="mr-1.5 opacity-50" />
                          Unknown
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => !saving && setIsModalOpen(false)} title="Add Delivery Partner">
        <form onSubmit={handleAddPartner} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-500 mb-1">Name</label>
            <input required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 border rounded-xl" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-500 mb-1">Email</label>
            <input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-3 py-2 border rounded-xl" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-500 mb-1">Mobile (10 digits)</label>
            <input required pattern="[0-9]{10}" type="text" value={mobile} onChange={e => setMobile(e.target.value)} className="w-full px-3 py-2 border rounded-xl" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-500 mb-1">Password</label>
            <input required minLength={6} type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-3 py-2 border rounded-xl" />
          </div>
          <div className="pt-4 flex justify-end gap-3 border-t">
            <Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)} disabled={saving}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Add Partner'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
