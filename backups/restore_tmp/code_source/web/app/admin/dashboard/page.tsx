export default function DashboardPage() {
    return (
      <div>
        <h1 className="text-3xl font-bold text-slate-800 mb-8">Admin Dashboard</h1>
  
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-sm font-medium text-slate-500">Total Organizations</h3>
            <p className="text-3xl font-bold text-blue-600 mt-2">1</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-sm font-medium text-slate-500">Active Campuses</h3>
            <p className="text-3xl font-bold text-green-600 mt-2">1</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-sm font-medium text-slate-500">Total Students</h3>
            <p className="text-3xl font-bold text-purple-600 mt-2">1</p>
          </div>
        </div>
  
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-64 flex items-center justify-center text-slate-400">
          Chart Placeholder (Revenue)
        </div>
      </div>
    );
  }
  