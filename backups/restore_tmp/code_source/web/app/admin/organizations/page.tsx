'use client'; 

import { useState, useEffect } from 'react';

export default function OrganizationsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [orgs, setOrgs] = useState<any[]>([]);
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    orgCode: '',
    plan: 'FREE'
  });

  // Fetch Data on Load
  useEffect(() => {
    fetchOrgs();
  }, []);

  const fetchOrgs = async () => {
    try {
      const res = await fetch('/api/organizations');
      if (res.ok) {
        const data = await res.json();
        setOrgs(data);
      }
    } catch (error) {
      console.error("Failed to fetch", error);
    }
  };

  // Handle Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setIsModalOpen(false); // Close modal
        setFormData({ name: '', orgCode: '', plan: 'FREE' }); // Reset form
        fetchOrgs(); // Refresh list
        alert('✅ Organization Created Successfully!');
      } else {
        alert('❌ Error creating organization');
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Organizations</h1>
          <p className="text-slate-500">Manage your SaaS tenants here.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 shadow-sm transition-all"
        >
          + Add New Organization
        </button>
      </div>

      {/* --- DATA TABLE --- */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 font-semibold text-slate-700">Org Name</th>
              <th className="px-6 py-4 font-semibold text-slate-700">Code</th>
              <th className="px-6 py-4 font-semibold text-slate-700">Plan</th>
              <th className="px-6 py-4 font-semibold text-slate-700">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orgs.map((org) => (
              <tr key={org.id} className="hover:bg-slate-50/50">
                <td className="px-6 py-4 font-medium text-slate-900">{org.name}</td>
                <td className="px-6 py-4 text-slate-500">{org.orgCode}</td>
                <td className="px-6 py-4">
                  <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-full text-xs font-semibold">{org.subscriptionPlan}</span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${org.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {org.isActive ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </td>
              </tr>
            ))}
            {orgs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-slate-400">
                  No organizations found. Add one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* --- MODAL POPUP (The Form) --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 transform transition-all">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Add Organization</h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Organization Name</label>
                <input 
                  type="text" 
                  required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="e.g. Beaconhouse System"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Unique Code (Subdomain)</label>
                <input 
                  type="text" 
                  required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none uppercase"
                  placeholder="e.g. BSS-GLOBAL"
                  value={formData.orgCode}
                  onChange={(e) => setFormData({...formData, orgCode: e.target.value.toUpperCase()})}
                />
                <p className="text-xs text-slate-400 mt-1">This will be used for login links.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Subscription Plan</label>
                <select 
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.plan}
                  onChange={(e) => setFormData({...formData, plan: e.target.value})}
                >
                  <option value="FREE">Free Tier</option>
                  <option value="BASIC">Basic</option>
                  <option value="PRO">Pro (Enterprise)</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 transition-colors"
                >
                  {isLoading ? 'Creating...' : 'Create Organization'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

