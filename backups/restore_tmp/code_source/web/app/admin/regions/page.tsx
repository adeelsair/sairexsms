'use client';

import { useState, useEffect } from 'react';

export default function RegionsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [regions, setRegions] = useState<any[]>([]);
  const [formData, setFormData] = useState({ name: '', city: '', organizationId: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [orgRes, regRes] = await Promise.all([
      fetch('/api/organizations'),
      fetch('/api/regions')
    ]);
    setOrgs(await orgRes.json());
    setRegions(await regRes.json());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/regions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });
    if (res.ok) {
      setIsModalOpen(false);
      setFormData({ name: '', city: '', organizationId: '' });
      fetchData();
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Regional Offices</h1>
          <p className="text-slate-500">Define geographic management layers for your Organizations.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-all"
        >
          + Add Regional Office
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 font-semibold text-slate-700">Region Name</th>
              <th className="px-6 py-4 font-semibold text-slate-700">City</th>
              <th className="px-6 py-4 font-semibold text-slate-700">Parent Organization</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-900">
            {regions.map((reg) => (
              <tr key={reg.id} className="hover:bg-slate-50/50">
                <td className="px-6 py-4 font-medium">{reg.name}</td>
                <td className="px-6 py-4">{reg.city}</td>
                <td className="px-6 py-4 text-slate-500">{reg.organization?.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Add Regional Office</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Parent Organization</label>
                <select 
                  required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 outline-none"
                  value={formData.organizationId}
                  onChange={(e) => setFormData({...formData, organizationId: e.target.value})}
                >
                  <option value="">Select Organization</option>
                  {orgs.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Region Name</label>
                <input 
                  type="text" required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 outline-none"
                  placeholder="e.g. Punjab South Region"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                <input 
                  type="text" required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 outline-none"
                  placeholder="e.g. Multan"
                  value={formData.city}
                  onChange={(e) => setFormData({...formData, city: e.target.value})}
                />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg">Create Region</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
