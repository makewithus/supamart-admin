import React, { useState, useEffect } from 'react';
import { Users, Search, UserCircle2 } from 'lucide-react';
import { db } from '../config/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Loader from '../components/ui/Loader';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';
import toast from 'react-hot-toast';

function timeAgo(ms) {
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [search,    setSearch]    = useState('');
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setCustomers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      console.error(err);
      toast.error('Failed to load customers');
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const filtered = customers.filter((c) =>
    !search ||
    (c.phone || '').includes(search) ||
    (c.name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 bg-neutral-50 min-h-screen">
      <PageHeader title="Customers" subtitle={`${customers.length} registered users`} />

      <Card>
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search by name or phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 text-sm text-primary-900
                placeholder:text-neutral-400 focus:outline-none focus:border-primary-900 focus:ring-2 focus:ring-primary-900/10 transition-all"
            />
          </div>
          <Badge variant="neutral">{filtered.length} shown</Badge>
        </div>

        {loading ? <Loader text="Loading customers…" /> : filtered.length === 0 ? (
          <EmptyState icon={Users} title="No customers found" message={search ? 'Try a different search.' : 'No users have signed up yet.'} />
        ) : (
          <div className="overflow-x-auto -mx-6 -mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100">
                  {['Customer', 'Phone', 'Role', 'Addresses', 'Joined'].map((h) => (
                    <th key={h} className="px-6 py-3.5 text-left text-[11px] font-semibold uppercase tracking-widest text-neutral-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b border-neutral-50 hover:bg-neutral-50/80 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-secondary-100 flex items-center justify-center flex-shrink-0">
                          {c.photoURL
                            ? <img src={c.photoURL} alt={c.name} className="w-full h-full rounded-full object-cover" />
                            : <UserCircle2 size={16} className="text-secondary-700" />
                          }
                        </div>
                        <span className="font-medium text-primary-900">{c.name || 'Unknown'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-neutral-500 font-mono text-xs">{c.phone || '—'}</td>
                    <td className="px-6 py-4">
                      <Badge variant={c.role === 'ADMIN' ? 'dark' : c.role === 'PARTNER' ? 'info' : 'neutral'}>
                        {c.role || 'CUSTOMER'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-neutral-500">{c.addressCount ?? '—'}</td>
                    <td className="px-6 py-4 text-neutral-400 text-xs">{timeAgo(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
