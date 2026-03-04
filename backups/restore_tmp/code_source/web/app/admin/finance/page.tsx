'use client';

import { useState, useEffect } from 'react';

export default function FinancePage() {
  // --- UI STATE ---
  const [activeTab, setActiveTab] = useState<'HEADS' | 'STRUCTURES' | 'CHALLANS'>('HEADS');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Payment State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedChallan, setSelectedChallan] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  
  // --- DATA STATE ---
  const [orgs, setOrgs] = useState<any[]>([]);
  const [campuses, setCampuses] = useState<any[]>([]);
  const [heads, setHeads] = useState<any[]>([]);
  const [structures, setStructures] = useState<any[]>([]);

  // New State for Challans
  const [challans, setChallans] = useState<any[]>([]);

  // --- FORM STATE ---
  const [headForm, setHeadForm] = useState({ name: '', type: 'RECURRING', organizationId: '' });
  const [structForm, setStructForm] = useState({ 
    name: '', amount: '', frequency: 'MONTHLY', applicableGrade: '', 
    organizationId: '', campusId: '', feeHeadId: '' 
  });

  // New Form for Generator
  const [generatorForm, setGeneratorForm] = useState({
    organizationId: '',
    campusId: '',
    targetGrade: '',
    billingMonth: 'March',
    dueDate: ''
  });

  // --- FETCH DATA ---
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [o, c, h, s, ch] = await Promise.all([
      fetch('/api/organizations').then(res => res.json()),
      fetch('/api/campuses').then(res => res.json()),
      fetch('/api/finance/heads').then(res => res.json()),
      fetch('/api/finance/structures').then(res => res.json()),
      fetch('/api/finance/challans').then(res => res.json())
    ]);
    setOrgs(o); setCampuses(c); setHeads(h); setStructures(s); setChallans(ch);
  };

  // --- SUBMIT HANDLERS ---
  const handleHeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    await fetch('/api/finance/heads', {
      method: 'POST', body: JSON.stringify(headForm), headers: {'Content-Type': 'application/json'}
    });
    setIsModalOpen(false);
    setHeadForm({ name: '', type: 'RECURRING', organizationId: '' });
    fetchData();
    setIsLoading(false);
  };

  const handleStructureSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    await fetch('/api/finance/structures', {
      method: 'POST', body: JSON.stringify(structForm), headers: {'Content-Type': 'application/json'}
    });
    setIsModalOpen(false);
    setStructForm({ name: '', amount: '', frequency: 'MONTHLY', applicableGrade: '', organizationId: '', campusId: '', feeHeadId: '' });
    fetchData();
    setIsLoading(false);
  };

  const handleGenerateChallans = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const res = await fetch('/api/finance/challans', {
        method: 'POST', body: JSON.stringify(generatorForm), headers: {'Content-Type': 'application/json'}
      });
      
      const data = await res.json();
      
      if (res.ok) {
        alert(`✅ ${data.message}`);
        setIsModalOpen(false);
        fetchData(); // Refresh the list to show new bills
      } else {
        alert(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      alert("System Error during generation.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReceivePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const res = await fetch('/api/finance/challans', {
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          challanId: selectedChallan.id, 
          paymentMethod: paymentMethod 
        })
      });
      
      if (res.ok) {
        alert('✅ Payment Received Successfully!');
        setIsPaymentModalOpen(false);
        setSelectedChallan(null);
        fetchData(); // Refresh to show it as PAID
      } else {
        alert('❌ Error processing payment.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Finance Module</h1>
          <p className="text-slate-500">Manage Categories and Pricing Rules.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-all"
        >
          {activeTab === 'HEADS' && '+ Add Fee Category'}
          {activeTab === 'STRUCTURES' && '+ Add Pricing Rule'}
          {activeTab === 'CHALLANS' && '⚡ Generate Bills'}
        </button>
      </div>

      {/* --- TAB NAVIGATION --- */}
      <div className="flex space-x-6 mb-6 border-b border-slate-200">
        <button onClick={() => setActiveTab('HEADS')} className={`pb-3 font-medium transition-colors ${activeTab === 'HEADS' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>
          1. Fee Categories
        </button>
        <button onClick={() => setActiveTab('STRUCTURES')} className={`pb-3 font-medium transition-colors ${activeTab === 'STRUCTURES' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>
          2. Pricing Rules
        </button>
        <button onClick={() => setActiveTab('CHALLANS')} className={`pb-3 font-medium transition-colors ${activeTab === 'CHALLANS' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>
          3. Generate Bills
        </button>
      </div>

      {/* --- CONTENT: FEE HEADS TABLE --- */}
      {activeTab === 'HEADS' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold text-slate-700">Category Name</th>
                <th className="px-6 py-4 font-semibold text-slate-700">Type</th>
                <th className="px-6 py-4 font-semibold text-slate-700">Organization</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-900">
              {heads.map((head) => (
                <tr key={head.id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-4 font-medium">{head.name}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${head.type === 'RECURRING' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                      {head.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500">{head.organization?.name}</td>
                </tr>
              ))}
              {heads.length === 0 && (
                <tr><td colSpan={3} className="px-6 py-8 text-center text-slate-400">No Categories found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* --- CONTENT: PRICING RULES TABLE --- */}
      {activeTab === 'STRUCTURES' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold text-slate-700">Rule Name</th>
                <th className="px-6 py-4 font-semibold text-slate-700">Amount</th>
                <th className="px-6 py-4 font-semibold text-slate-700">Category</th>
                <th className="px-6 py-4 font-semibold text-slate-700">Campus</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-900">
              {structures.map((st) => (
                <tr key={st.id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-4">
                    <div className="font-medium">{st.name}</div>
                    <div className="text-xs text-slate-400 mt-1">Grade: {st.applicableGrade || 'All Grades'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-green-600 font-mono">{st.amount} PKR</div>
                    <div className="text-xs text-slate-500">{st.frequency}</div>
                  </td>
                  <td className="px-6 py-4">{st.feeHead?.name}</td>
                  <td className="px-6 py-4 text-slate-500">{st.campus?.name}</td>
                </tr>
              ))}
              {structures.length === 0 && (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-400">No Pricing Rules found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* --- CONTENT: CHALLANS (GENERATED BILLS) --- */}
      {activeTab === 'CHALLANS' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold text-slate-700">Challan No.</th>
                <th className="px-6 py-4 font-semibold text-slate-700">Student Name</th>
                <th className="px-6 py-4 font-semibold text-slate-700">Due Date</th>
                <th className="px-6 py-4 font-semibold text-slate-700">Amount</th>
                <th className="px-6 py-4 font-semibold text-slate-700">Status</th>
                <th className="px-6 py-4 font-semibold text-slate-700 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-900">
              {challans.map((challan) => (
                <tr key={challan.id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-4 font-mono text-xs text-blue-600 font-bold">{challan.challanNo}</td>
                  <td className="px-6 py-4">
                    <div className="font-medium">{challan.student?.fullName}</div>
                    <div className="text-xs text-slate-400">{challan.campus?.name}</div>
                  </td>
                  <td className="px-6 py-4 text-slate-500">{new Date(challan.dueDate).toLocaleDateString()}</td>
                  <td className="px-6 py-4 font-mono font-bold text-slate-700">{challan.totalAmount} PKR</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                      challan.status === 'PAID' ? 'bg-green-100 text-green-700' : 
                      challan.status === 'OVERDUE' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                    }`}>
                      {challan.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {challan.status !== 'PAID' ? (
                      <button 
                        onClick={() => {
                          setSelectedChallan(challan);
                          setIsPaymentModalOpen(true);
                        }}
                        className="bg-green-100 hover:bg-green-200 text-green-700 px-3 py-1 rounded-lg text-xs font-bold transition-colors"
                      >
                        Receive Payment
                      </button>
                    ) : (
                      <span className="text-slate-400 text-xs italic">Cleared</span>
                    )}
                  </td>
                </tr>
              ))}
              {challans.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400">No generated bills found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* --- DYNAMIC MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm overflow-y-auto pt-20 pb-10">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-slate-800 mb-4">
              {activeTab === 'HEADS' && 'New Fee Category'}
              {activeTab === 'STRUCTURES' && 'New Pricing Rule'}
              {activeTab === 'CHALLANS' && 'Generate Student Bills'}
            </h2>
            
            {/* Form 1: Category */}
            {activeTab === 'HEADS' && (
              <form onSubmit={handleHeadSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Organization</label>
                  <select required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 outline-none" 
                    value={headForm.organizationId} onChange={e => setHeadForm({...headForm, organizationId: e.target.value})}>
                    <option value="">Select Org</option>
                    {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Category Name</label>
                  <input required type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 outline-none" placeholder="e.g. Lab Fee"
                    value={headForm.name} onChange={e => setHeadForm({...headForm, name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fee Type</label>
                  <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 outline-none"
                    value={headForm.type} onChange={e => setHeadForm({...headForm, type: e.target.value})}>
                    <option value="RECURRING">Recurring (Monthly/Annual)</option>
                    <option value="ONE_TIME">One Time</option>
                  </select>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600">Cancel</button>
                  <button type="submit" disabled={isLoading} className="px-4 py-2 bg-blue-600 text-white rounded-lg">{isLoading ? 'Saving...' : 'Save Category'}</button>
                </div>
              </form>
            )}

            {/* Form 2: Pricing Rule */}
            {activeTab === 'STRUCTURES' && (
              <form onSubmit={handleStructureSubmit} className="space-y-4">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-3">
                  <div className="text-xs font-semibold text-slate-500 uppercase">Target Location</div>
                  <select required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 outline-none text-sm"
                    value={structForm.organizationId} onChange={e => setStructForm({...structForm, organizationId: e.target.value, campusId: '', feeHeadId: ''})}>
                    <option value="">1. Select Organization</option>
                    {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                  <select required disabled={!structForm.organizationId} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 outline-none text-sm disabled:bg-slate-100 disabled:text-slate-400"
                    value={structForm.campusId} onChange={e => setStructForm({...structForm, campusId: e.target.value})}>
                    <option value="">2. Select Campus</option>
                    {campuses.filter(c => c.organizationId.toString() === structForm.organizationId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fee Category</label>
                  <select required disabled={!structForm.organizationId} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                    value={structForm.feeHeadId} onChange={e => setStructForm({...structForm, feeHeadId: e.target.value})}>
                    <option value="">Select Category</option>
                    {heads.filter(h => h.organizationId.toString() === structForm.organizationId).map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                   <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Amount (PKR)</label>
                    <input type="number" required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 outline-none" placeholder="e.g. 5000"
                      value={structForm.amount} onChange={e => setStructForm({...structForm, amount: e.target.value})} />
                   </div>
                   <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Frequency</label>
                    <select 
                      required
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 outline-none"
                      value={structForm.frequency} 
                      onChange={e => setStructForm({...structForm, frequency: e.target.value})}
                    >
                      <option value="MONTHLY">Monthly (12 times/year)</option>
                      <option value="BI_MONTHLY">Bi-Monthly (Every 2 Months)</option>
                      <option value="QUARTERLY">Quarterly (Every 3 Months)</option>
                      <option value="HALF_YEARLY">Half-Yearly (Every 6 Months)</option>
                      <option value="ANNUALLY">Annually (Once a Year)</option>
                      <option value="ONCE">Once (Non-Recurring)</option>
                    </select>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Rule Name</label>
                    <input required type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 outline-none" placeholder="e.g. Standard Tuition"
                      value={structForm.name} onChange={e => setStructForm({...structForm, name: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Grade (Optional)</label>
                    <input type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 outline-none" placeholder="e.g. Grade 10"
                      value={structForm.applicableGrade} onChange={e => setStructForm({...structForm, applicableGrade: e.target.value})} />
                  </div>
                </div>
                
                <div className="flex justify-end gap-3 mt-6">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600">Cancel</button>
                  <button type="submit" disabled={isLoading} className="px-4 py-2 bg-blue-600 text-white rounded-lg">{isLoading ? 'Saving...' : 'Save Pricing Rule'}</button>
                </div>
              </form>
            )}

            {/* Form 3: Generate Bills Engine */}
            {activeTab === 'CHALLANS' && (
              <form onSubmit={handleGenerateChallans} className="space-y-4">
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 mb-4">
                  <p className="text-sm text-blue-800 font-medium">
                    This engine will find all students in the selected Grade and automatically generate their invoices based on active Pricing Rules.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Organization</label>
                    <select required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 outline-none"
                      value={generatorForm.organizationId} onChange={e => setGeneratorForm({...generatorForm, organizationId: e.target.value, campusId: ''})}>
                      <option value="">Select Org</option>
                      {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Campus</label>
                    <select required disabled={!generatorForm.organizationId} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                      value={generatorForm.campusId} onChange={e => setGeneratorForm({...generatorForm, campusId: e.target.value})}>
                      <option value="">Select Campus</option>
                      {campuses.filter(c => c.organizationId.toString() === generatorForm.organizationId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                   <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Target Grade</label>
                    <input type="text" required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 outline-none" placeholder="e.g. Grade 10"
                      value={generatorForm.targetGrade} onChange={e => setGeneratorForm({...generatorForm, targetGrade: e.target.value})} />
                   </div>
                   <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Billing Month</label>
                    <select required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 outline-none"
                      value={generatorForm.billingMonth} onChange={e => setGeneratorForm({...generatorForm, billingMonth: e.target.value})}>
                      <option value="January">January</option>
                      <option value="February">February</option>
                      <option value="March">March</option>
                      <option value="April">April</option>
                      <option value="May">May</option>
                      <option value="June">June</option>
                      <option value="July">July</option>
                      <option value="August">August</option>
                      <option value="September">September</option>
                      <option value="October">October</option>
                      <option value="November">November</option>
                      <option value="December">December</option>
                    </select>
                   </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
                  <input type="date" required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 outline-none"
                    value={generatorForm.dueDate} onChange={e => setGeneratorForm({...generatorForm, dueDate: e.target.value})} />
                </div>
                
                <div className="flex justify-end gap-3 mt-6">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600">Cancel</button>
                  <button type="submit" disabled={isLoading} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold shadow-sm">
                    {isLoading ? 'Processing...' : 'Generate Bills Now'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* --- RECEIVE PAYMENT MODAL --- */}
      {isPaymentModalOpen && selectedChallan && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="text-xl font-bold text-slate-800 mb-2">Receive Payment</h2>
            
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6">
              <p className="text-sm text-slate-500 mb-1">Student: <span className="font-bold text-slate-900">{selectedChallan.student.fullName}</span></p>
              <p className="text-sm text-slate-500 mb-1">Challan No: <span className="font-mono text-slate-900">{selectedChallan.challanNo}</span></p>
              <p className="text-sm text-slate-500">Amount Due: <span className="text-lg font-bold text-green-600">{selectedChallan.totalAmount} PKR</span></p>
            </div>

            <form onSubmit={handleReceivePayment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payment Method</label>
                <select 
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 outline-none"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="CASH">Cash at Counter</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="ONLINE">Online Portal</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setIsPaymentModalOpen(false)} className="px-4 py-2 text-slate-600">Cancel</button>
                <button type="submit" disabled={isLoading} className="px-4 py-2 bg-green-600 text-white rounded-lg font-bold">
                  {isLoading ? 'Processing...' : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

