import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import PrintControls from "./PrintControls";

export default async function LandscapeChallan({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const challanId = Number.parseInt(id, 10);
  if (!Number.isInteger(challanId) || challanId <= 0) return notFound();

  const challan = await prisma.feeChallan.findUnique({
    where: { id: challanId },
    include: {
      student: true,
      campus: true,
      organization: true,
    },
  });

  if (!challan) return notFound();

  const copies = ["Bank Copy", "School Copy", "Student/Parent Copy"];

  return (
    <div className="challan-print-page bg-gray-100 min-h-screen p-4 print:p-0 print:bg-white text-slate-900">
      {/* Top Bar - Hidden on Print */}
      <div className="max-w-5xl mx-auto mb-4 flex justify-between items-center bg-white p-4 shadow-sm border border-slate-300 print:hidden">
        <div>
          <h2 className="text-lg font-bold">Challan Preview: {challan.challanNo}</h2>
          <p className="text-sm text-slate-700">Status: {challan.status}</p>
        </div>
        <PrintControls />
      </div>

      {/* The Challan Container */}
      <div className="max-w-[1100px] mx-auto bg-white shadow-lg print:shadow-none flex flex-row border-2 border-slate-700 border-collapse">
        {copies.map((copyTitle, index) => (
          <div
            key={index}
            className="flex-1 p-4 border-r-2 border-dashed border-slate-600 last:border-r-0 flex flex-col min-h-[700px] relative"
          >
            {/* 1. Header with Logo Area */}
            <div className="flex items-center gap-2 mb-2">
              <div className="w-12 h-12 bg-slate-200 border border-slate-500 flex items-center justify-center text-[10px] text-center font-semibold">
                LOGO
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold leading-tight uppercase">{challan.organization.organizationName}</h3>
                <p className="text-[10px] font-semibold">{challan.campus.name}</p>
              </div>
            </div>

            <div className="text-center bg-slate-200 py-1 mb-2 border border-slate-500">
              <span className="text-[11px] font-bold uppercase">{copyTitle}</span>
            </div>

            {/* 2. Bank & Account Info */}
            <div className="text-[10px] mb-3 border-b-2 border-slate-500 pb-2">
              <p>
                <strong>Bank:</strong> Habib Bank Limited (HBL)
              </p>
              <p>
                <strong>A/C Title:</strong> {challan.organization.organizationName} Main Account
              </p>
              <p>
                <strong>A/C No:</strong> 1234-56789012-03
              </p>
            </div>

            {/* 3. Student Details */}
            <div className="space-y-1 text-[11px] mb-4">
              <div className="flex justify-between border-b border-slate-300">
                <span>Challan No:</span> <span className="font-bold">{challan.challanNo}</span>
              </div>
              <div className="flex justify-between border-b border-slate-300">
                <span>Issue Date:</span> <span>{new Date(challan.issueDate).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between border-b border-slate-300">
                <span>Due Date:</span> <span className="font-bold">{new Date(challan.dueDate).toLocaleDateString()}</span>
              </div>
              <div className="mt-2 flex justify-between">
                <span>Student:</span> <span className="font-bold">{challan.student.fullName}</span>
              </div>
              <div className="flex justify-between">
                <span>Reg No:</span> <span>{challan.student.admissionNo}</span>
              </div>
              <div className="flex justify-between">
                <span>Grade:</span> <span>{challan.student.grade}</span>
              </div>
            </div>

            {/* 4. Fee Breakdown */}
            <div className="flex-1">
              <table className="w-full text-[10px] border-collapse text-slate-900">
                <thead>
                  <tr className="border-y-2 border-black">
                    <th className="text-left py-1">Description</th>
                    <th className="text-right py-1">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-2">Tuition Fee (Monthly)</td>
                    <td className="text-right font-semibold">{challan.totalAmount.toString()}</td>
                  </tr>
                  {/* You can map additional fee heads here later */}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-black font-bold">
                    <td className="py-2">TOTAL PAYABLE</td>
                    <td className="text-right">{challan.totalAmount.toString()}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* 5. Instructions & Stamps */}
            <div className="mt-4 text-[9px] text-slate-700 leading-tight italic">
              <p>* Payment must be made by the due date.</p>
              <p>* Late fee of 500 PKR applies after due date.</p>
            </div>

            {challan.status === "PAID" && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-4 border-green-700 text-green-700 text-2xl font-black opacity-40 rotate-12 p-2">
                PAID
              </div>
            )}

            <div className="mt-8 flex justify-between items-end">
              <div className="w-20 border-t border-black text-center text-[8px]">Cashier</div>
              <div className="w-20 border-t border-black text-center text-[8px]">Authorized</div>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }

          .challan-print-page,
          .challan-print-page * {
            visibility: visible;
          }

          .challan-print-page {
            position: absolute;
            inset: 0;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}