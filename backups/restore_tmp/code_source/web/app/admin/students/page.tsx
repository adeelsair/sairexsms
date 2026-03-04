'use client';

import { useState, useEffect } from 'react';

export default function StudentsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [campuses, setCampuses] = useState<any[]>([]);
  
  // State for filtering campuses based on selected organization
  const [filteredCampuses, setFilteredCampuses] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    fullName: '',
    admissionNo: '',
    grade: '',
    organizationId: '',
    campusId: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [stuRes, orgRes, camRes] = await Promise.all([
      fetch('/api/students'),
      fetch('/api/organizations'),
      fetch('/api/campuses')
    ]);
    setStudents(await stuRes.json());
    setOrgs(await orgRes.json());
    setCampuses(await camRes.json());
  };

  // When Organization changes, only show campuses belonging to that org
  const handleOrgChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const orgId = e.target.value;
    setFormData({ ...formData, organizationId: orgId, campusId: '' }); // Reset campus selection
    
    if (orgId) {
      const relevantCampuses = campuses.filter(c => c.organizationId.toString() === orgId);
      setFilteredCampuses(relevantCampuses);
    } else {
      setFilteredCampuses([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });
    
    if (res.ok) {
      setIsModalOpen(false);
      setFormData({ fullName: '', admissionNo: '', grade: '', organizationId: '', campusId: '' });
      fetchData(); // Refresh list
    } else {
      alert("Failed to admit student. Check if Admission Number is unique.");
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Student Directory</h1>
          <p className="text-slate-500">Manage admissions across all campuses.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-all"
        >
          + Admit Student
        </button>
      </div>

      {/* --- STUDENT LIST --- */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 font-semibold text-slate-700">Name</th>
              <th className="px-6 py-4 font-semibold text-slate-700">Admission No.</th>
              <th className="px-6 py-4 font-semibold text-slate-700">Grade</th>
              <th className="px-6 py-4 font-semibold text-slate-700">Campus</th>
              <th className="px-6 py-4 font-semibold text-slate-700">Fee Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-900">
            {students.map((student) => (
              <tr key={student.id} className="hover:bg-slate-50/50">
                <td className="px-6 py-4 font-medium">{student.fullName}</td>
                <td className="px-6 py-4 font-mono text-xs">{student.admissionNo}</td>
                <td className="px-6 py-4">{student.grade}</td>
                <td className="px-6 py-4">
                  <div>{student.campus?.name}</div>
                  <div className="text-xs text-slate-400">{student.organization?.name}</div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${student.feeStatus === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                    {student.feeStatus}
                  </span>
                </td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                  No students found. Admit a student to begin.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* --- ADMISSION MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-slate-800 mb-4">New Admission</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Placement Details */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-3 mb-4">
                <div className="text-xs font-semibold text-slate-500 uppercase">Placement</div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Organization</label>
                  <select 
                    required
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 outline-none bg-white"
                    value={formData.organizationId}
                    onChange={handleOrgChange}
                  >
                    <option value="">Select Organization</option>
                    {orgs.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Campus</label>
                  <select 
                    required
                    disabled={!formData.organizationId}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 outline-none bg-white disabled:bg-slate-100 disabled:text-slate-400"
                    value={formData.campusId}
                    onChange={(e) => setFormData({...formData, campusId: e.target.value})}
                  >
                    <option value="">{formData.organizationId ? "Select Campus" : "Select Org First"}</option>
                    {filteredCampuses.map(cam => <option key={cam.id} value={cam.id}>{cam.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Student Details */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                <input 
                  type="text" required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 outline-none"
                  placeholder="e.g. Zain Sheikh"
                  value={formData.fullName}
                  onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Admission No.</label>
                  <input 
                    type="text" required
                    placeholder="e.g. ISB-001"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 outline-none"
                    value={formData.admissionNo}
                    onChange={(e) => setFormData({...formData, admissionNo: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Grade / Class</label>
                  <input 
                    type="text" required
                    placeholder="e.g. Grade 10"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 outline-none"
                    value={formData.grade}
                    onChange={(e) => setFormData({...formData, grade: e.target.value})}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium">Admit Student</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
