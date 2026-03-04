'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function ChallanPrintPage() {
  const { id } = useParams();
  const [challan, setChallan] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/finance/challans/${id}`)
      .then(res => res.json())
      .then(data => setChallan(data));
  }, [id]);

  if (!challan) return <div className="p-10">Loading Receipt...</div>;

  return (
    <div className="bg-white min-h-screen p-8 text-slate-900 font-sans">
      {/* Print Button (Hidden during actual print) */}
      <div className="mb-8 flex justify-center print:hidden">
        <button 
          onClick={() => window.print()}
          className="bg-blue-600
          