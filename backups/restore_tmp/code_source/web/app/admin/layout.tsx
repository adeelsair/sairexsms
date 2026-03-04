import Link from 'next/link';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-gray-100">
      {/* --- SIDEBAR (The Tabs) --- */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col">
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-2xl font-bold text-blue-400">SAIREX SMS</h1>
          <p className="text-xs text-slate-400 mt-1">Super Admin Console</p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {/* Dashboard */}
          <Link href="/admin/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-800 transition-colors">
            <span>📊</span> Dashboard
          </Link>

          {/* Core Setup */}
          <div className="text-xs font-semibold text-slate-500 uppercase mt-6 mb-2 px-4">Core Setup</div>
          
          <Link href="/admin/organizations" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-800 transition-colors">
            <span>🏢</span> Organizations
          </Link>

          <Link href="/admin/regions" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-800 transition-colors">
            <span>🗺️</span> Regional Offices
          </Link>

          <Link href="/admin/campuses" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-800 transition-colors">
            <span>🏫</span> Campuses / Schools
          </Link>

          {/* Management */}
          <div className="text-xs font-semibold text-slate-500 uppercase mt-6 mb-2 px-4">Management</div>
          
          <Link href="/admin/students" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-800 transition-colors">
            <span>🎓</span> Students
          </Link>

          <Link href="/admin/finance" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-800 transition-colors">
            <span>💰</span> Fee Module
          </Link>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800">
          <button className="w-full text-left px-4 py-2 text-sm text-red-400 hover:text-red-300">
            🚪 Logout
          </button>
        </div>
      </aside>

      {/* --- MAIN CONTENT AREA (Where pages load) --- */}
      <main className="flex-1 overflow-y-auto p-8">
        {children}
      </main>
    </div>
  );
}
