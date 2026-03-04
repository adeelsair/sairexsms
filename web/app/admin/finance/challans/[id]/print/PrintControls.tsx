"use client";

import { useRouter } from "next/navigation";

export default function PrintControls() {
  const router = useRouter();

  return (
    <div className="flex gap-2">
      <button
        onClick={() => window.print()}
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-all"
      >
        Print Challan
      </button>
      <button
        onClick={() => router.push("/admin/finance?tab=challans")}
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-all"
      >
        Close Challan
      </button>
    </div>
  );
}
