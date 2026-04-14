"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import JsBarcode from "jsbarcode";
import type { RepairJobDetail } from "@/lib/api";

const money = (value: number) => `Rs. ${value.toFixed(2)}`;
const THERMAL_ROLL_WIDTH_MM = 80;
const THERMAL_PRINTABLE_WIDTH_MM = 72.1;
const RECEIPT_PRINT_FONT_SIZE_PX = 12.5;
const REPAIR_BOTTOM_TEAR_SPACE_MM = 10;
const REPAIR_PRINT_FALLBACK_FEED_MM = 8;

type RepairReceiptModalProps = {
  job: RepairJobDetail | null;
  onClose: () => void;
};

export function RepairReceiptModal({ job, onClose }: RepairReceiptModalProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const summary = useMemo(() => {
    if (!job) {
      return { partsTotal: 0, labor: 0, total: 0, advance: 0, balance: 0 };
    }

    const partsTotal = job.parts.reduce((sum, part) => part.used === true ? sum + (Number(part.quantity) * Number(part.unitCost) - Number(part.discount)) : sum, 0);
    const labor = Number(job.laborCost ?? 0);
    const total = partsTotal + labor;
    const advance = Number(job.advancePaid ?? 0);

    return {
      partsTotal,
      labor,
      total,
      advance,
      balance: Math.max(0, total - advance),
    };
  }, [job]);

  if (!job) return null;

  return (
    <>
      <style>{`
        @page {
          size: ${THERMAL_ROLL_WIDTH_MM}mm auto;
          margin: 0;
        }
        @media print {
          body > *:not(#repair-receipt-print) { display: none !important; }
          #repair-receipt-print { display: block !important; }
          #repair-receipt-print * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          #repair-receipt-print::after { content: ""; display: block; height: ${REPAIR_PRINT_FALLBACK_FEED_MM}mm; }
          html, body { width: ${THERMAL_ROLL_WIDTH_MM}mm; margin: 0; padding: 0; }
        }
        #repair-receipt-print { display: none; }
      `}</style>

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 print:hidden">
        <div className="relative w-full max-w-sm overflow-y-auto rounded-[28px] bg-white shadow-2xl max-h-[90vh]">
          <div className="flex items-center justify-between border-b border-line px-6 py-4">
            <h2 className="text-base font-bold">Repair Receipt</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-muted transition hover:text-ink"
            >
              Close
            </button>
          </div>

          <div className="px-6 py-5 font-mono text-xs">
            <RepairReceiptBody job={job} summary={summary} />
          </div>

          <div className="flex gap-3 border-t border-line px-6 py-4">
            <button
              type="button"
              onClick={() => window.print()}
              className="btn-primary flex-1"
            >
              Print
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {mounted && createPortal(
        <div
          id="repair-receipt-print"
          style={{
            fontFamily: "monospace",
            fontSize: `${RECEIPT_PRINT_FONT_SIZE_PX}px`,
            width: `${THERMAL_PRINTABLE_WIDTH_MM}mm`,
            color: "#000",
            margin: "0 auto",
            padding: "2mm 0",
            boxSizing: "border-box",
          }}
        >
          <RepairReceiptBody job={job} summary={summary} />
        </div>,
        document.body,
      )}
    </>
  );
}

function RepairReceiptBody({
  job,
  summary,
}: {
  job: RepairJobDetail;
  summary: {
    partsTotal: number;
    labor: number;
    total: number;
    advance: number;
    balance: number;
  };
}) {
  const createdAt = new Date(job.createdAt);
  const dateStr = createdAt.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const timeStr = createdAt.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="space-y-3">
      <div className="text-center">
        <p className="text-sm font-bold uppercase tracking-widest">{job.outlet?.name ?? "Outlet"}</p>
        <p className="mt-0.5 text-[10px] text-gray-500">Repair Job Receipt</p>
      </div>

      <Divider />

      <div className="space-y-0.5">
        <Row label="Job" value={job.jobNo} />
        <Row label="Date" value={`${dateStr} ${timeStr}`} />
        <Row label="Status" value={job.status.replace("_", " ")} />
        <Row label="Customer" value={job.customer?.name ?? "N/A"} />
        <Row label="Phone" value={job.customer?.phone ?? "N/A"} />
      </div>

      <Divider />

      <div className="space-y-0.5">
        <Row label="Device" value={`${job.deviceBrand} ${job.deviceModel}`} />
        <Row label="Serial" value={job.serialNo || "N/A"} />
        <Row label="Technician" value={job.technician?.fullName ?? "Unassigned"} />
      </div>

      <Divider />

      <div className="space-y-0.5">
        <p className="text-[10px] uppercase tracking-[0.14em] text-gray-500">Problem</p>
        <p className="leading-snug">{job.problemDesc}</p>
      </div>

      <Divider />

      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-[0.14em] text-gray-500">Parts Used</p>
        {job.parts.length === 0 ? (
          <p className="text-gray-500">No parts used.</p>
        ) : (
          job.parts.map((part) => {
            const partLineTotal = Number(part.quantity) * Number(part.unitCost) - Number(part.discount);
            return (
              <div key={part.id} className="space-y-0.5">
                <div className="flex justify-between">
                  <span>
                    {part.item.name} x{part.quantity}
                  </span>
                  <span>{money(Number(part.quantity) * Number(part.unitCost))}</span>
                </div>
                {Number(part.discount) > 0 && (
                  <div className="flex justify-between pl-2 text-gray-500">
                    <span className="text-[9px]">Discount</span>
                    <span className="text-[9px]">− {money(Number(part.discount))}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-dashed border-gray-300 pt-0.5 text-xs font-semibold">
                  <span>Subtotal</span>
                  <span>{money(partLineTotal)}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <Divider />

      <div className="space-y-0.5">
        <Row label="Labor" value={money(summary.labor)} />
        <Row label="Parts" value={money(summary.partsTotal)} />
        <div className="flex justify-between border-t border-black pt-1 text-sm font-bold">
          <span>TOTAL</span>
          <span>{money(summary.total)}</span>
        </div>
        <Row label="Advance" value={money(summary.advance)} />
        <Row label="Balance" value={money(summary.balance)} className="font-semibold" />
      </div>

      <Divider />
      <Barcode value={job.jobNo} />
      <Divider />
      <p className="text-center text-gray-400">Thank you for your repair order!</p>
      <div className="border-t-2 border-dashed border-black" />
      <div style={{ height: `${REPAIR_BOTTOM_TEAR_SPACE_MM}mm` }} />
    </div>
  );
}

function Divider() {
  return <div className="border-t border-dashed border-gray-400" />;
}

function Barcode({ value }: { value: string }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (svgRef.current) {
      JsBarcode(svgRef.current, value, {
        format: "CODE128",
        width: 1.5,
        height: 40,
        displayValue: true,
        fontSize: 10,
        margin: 0,
        background: "#ffffff",
        lineColor: "#000000",
      });
    }
  }, [value]);

  return <svg ref={svgRef} className="w-full" />;
}

function Row({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={`flex justify-between ${className ?? ""}`}>
      <span className="text-gray-500">{label}</span>
      <span>{value}</span>
    </div>
  );
}
