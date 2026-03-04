'use client';

import { useState, useEffect } from 'react';

export default function CampusesPage() {
  const [isCampusModalOpen, setIsCampusModalOpen] = useState(false);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [regions, setRegions] = useState<any[]>([]);
  const [campuses, setCampuses] = useState<any[]>([]);

  // Form States
  const [campusData, setCampusData] = useState({
    name: '',
    campusCode: '',
    city: '',
    organizationId: '',
    regionId: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [orgRes, regRes, camRes] = await Promise.all([
      fetch('/api/organizations'),
      fetch('/api/regions'),
      fetch('/api/campuses')
    ]);
    setOrgs(await orgRes.json());
    setRegions(await regRes.json());
    setCampuses(await camRes.json());
  };

  const handleAddCampus = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/campuses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(campusData),
    });
    if (res.ok) {
      setIsCampusModalOpen(false);
      fetchData();
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Campuses & Regions</h1>
          <p className="text-slate-500">Structure your regional offices and school branches.</p>
        </div>
        <button 
          onClick={() => setIsCampusModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-all"
        >
          + Add New Campus
        </button>
      </div>

      {/* --- CAMPUS LIST --- */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 font-semibold text-slate-700">Campus Name</th>
              <th className="px-6 py-4 font-semibold text-slate-700">Organization</th>
              <th className="px-6 py-4 font-semibold text-slate-700">Region</th>
              <th className="px-6 py-4 font-semibold text-slate-700">City</th>
              <th className="px-6 py-4 font-semibold text-slate-700">Code</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-900">
            {campuses.map((campus) => (
              <tr key={campus.id} className="hover:bg-slate-50/50">
                <td className="px-6 py-4 font-medium">{campus.name}</td>
                <td className="px-6 py-4 text-slate-500">{campus.organization?.name}</td>
                <td className="px-6 py-4">
                   {campus.region ? (
                     <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded text-xs font-bold">{campus.region.name}</span>
                   ) : (
                     <span className="text-slate-300 text-xs italic">No Region</span>
                   )}
                </td>
                <td className="px-6 py-4">{campus.city}</td>
                <td className="px-6 py-4 font-mono text-xs">{campus.campusCode}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* --- ADD CAMPUS MODAL --- */}
      {isCampusModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Register New Campus</h2>
            <form onSubmit={handleAddCampus} className="space-y-4">
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Parent Organization</label>
                <select 
                  required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 outline-none"
                  value={campusData.organizationId}
                  onChange={(e) => setCampusData({...campusData, organizationId: e.target.value})}
                >
                  <option value="">Select Organization</option>
                  {orgs.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Region (Optional)</label>
                <select 
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 outline-none"
                  value={campusData.regionId}
                  onChange={(e) => setCampusData({...campusData, regionId: e.target.value})}
                >
                  <option value="">No Region / Independent</option>
                  {regions.map(reg => <option key={reg.id} value={reg.id}>{reg.name} ({reg.city})</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Campus Name</label>
                  <input 
                    type="text" required
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 outline-none"
                    value={campusData.name}
                    onChange={(e) => setCampusData({...campusData, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Campus Code</label>
                  <input 
                    type="text" required
                    placeholder="e.g. ISB-01"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 outline-none"
                    value={campusData.campusCode}
                    onChange={(e) => setCampusData({...campusData, campusCode: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                <input 
                  type="text" required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 outline-none"
                  value={campusData.city}
                  onChange={(e) => setCampusData({...campusData, city: e.target.value})}
                />
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setIsCampusModalOpen(false)} className="px-4 py-2 text-slate-600">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg">Register Campus</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
