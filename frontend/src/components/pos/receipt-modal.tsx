"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import JsBarcode from "jsbarcode";
import type { SaleReceipt } from "@/lib/api";

const money = (v: number | string) => `Rs. ${Number(v).toFixed(2)}`;
const THERMAL_ROLL_WIDTH_MM = 80;
const THERMAL_PRINTABLE_WIDTH_MM = 72.1;
const RECEIPT_PRINT_FONT_SIZE_PX = 12.5;
const RECEIPT_BOTTOM_TEAR_SPACE_MM = 45;
const RECEIPT_PRINT_FALLBACK_FEED_MM = 8;

interface ReceiptModalProps {
  receipt: SaleReceipt | null;
  onClose: () => void;
}

export function ReceiptModal({ receipt, onClose }: ReceiptModalProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!receipt) return null;

  const handlePrint = () => window.print();

  const totalDiscount =
    receipt.items.reduce((sum, line) => sum + Number(line.discount), 0) +
    Number(receipt.discountAmt);

  const cashLegs = receipt.payments.flatMap((pt) =>
    pt.legs.filter((l) => l.method === "CASH"),
  );
  const totalCashPaid = cashLegs.reduce((s, l) => s + Number(l.amount), 0);
  const totalChange = cashLegs.reduce((s, l) => s + Number(l.change), 0);

  return (
    <>
      {/* ── Print styles injected once ── */}
      <style>{`
        @page {
          size: ${THERMAL_ROLL_WIDTH_MM}mm auto;
          margin: 0;
        }
        @media print {
          body > *:not(#pos-receipt-print) { display: none !important; }
          #pos-receipt-print { display: block !important; }
          #pos-receipt-print * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          #pos-receipt-print::after { content: ""; display: block; height: ${RECEIPT_PRINT_FALLBACK_FEED_MM}mm; }
          html, body { width: ${THERMAL_ROLL_WIDTH_MM}mm; margin: 0; padding: 0; }
        }
        #pos-receipt-print { display: none; }
      `}</style>

      {/* ── Screen overlay ── */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 print:hidden">
        <div className="relative w-full max-w-sm overflow-y-auto rounded-[28px] bg-white shadow-2xl max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-line px-6 py-4">
            <h2 className="text-base font-bold">Receipt</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-muted transition hover:text-ink"
            >
              ✕ Close
            </button>
          </div>

          {/* Receipt body (screen preview) */}
          <div className="px-6 py-5 font-mono text-xs">
            <ReceiptBody receipt={receipt} totalDiscount={totalDiscount} totalCashPaid={totalCashPaid} totalChange={totalChange} />
          </div>

          {/* Actions */}
          <div className="flex gap-3 border-t border-line px-6 py-4">
            <button
              type="button"
              onClick={handlePrint}
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

      {/* ── Print-only version — portalled to <body> so print CSS can isolate it ── */}
      {mounted && createPortal(
        <div
          id="pos-receipt-print"
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
          <ReceiptBody receipt={receipt} totalDiscount={totalDiscount} totalCashPaid={totalCashPaid} totalChange={totalChange} />
        </div>,
        document.body,
      )}
    </>
  );
}

function ReceiptBody({
  receipt,
  totalDiscount,
  totalCashPaid,
  totalChange,
}: {
  receipt: SaleReceipt;
  totalDiscount: number;
  totalCashPaid: number;
  totalChange: number;
}) {
  const date = new Date(receipt.createdAt);
  const dateStr = date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const timeStr = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-3">
      {/* Shop header */}
      <div className="text-center">
        <p className="text-sm font-bold uppercase tracking-widest">{receipt.outlet.name}</p>
        <p className="mt-0.5 text-[10px] text-gray-500">Point of Sale Receipt</p>
      </div>

      <Divider />

      {/* Meta */}
      <div className="space-y-0.5">
        <Row label="Receipt" value={`#${receipt.receiptNo}`} />
        <Row label="Date" value={`${dateStr} ${timeStr}`} />
        <Row label="Cashier" value={receipt.cashier.fullName} />
        {receipt.customer && (
          <Row label="Customer" value={`${receipt.customer.name} (${receipt.customer.phone})`} />
        )}
      </div>

      <Divider />

      {/* Items */}
      <div className="space-y-1.5">
        {receipt.items.map((line) => {
          const lineTotal = Number(line.unitPrice) * line.quantity - Number(line.discount);
          return (
            <div key={line.id}>
              <p className="font-semibold leading-tight">{line.item.name}</p>
              <div className="flex justify-between text-gray-500">
                <span>
                  {line.quantity} × {money(line.unitPrice)}
                  {Number(line.discount) > 0 && ` − ${money(line.discount)}`}
                </span>
                <span className="font-semibold text-black">{money(lineTotal)}</span>
              </div>
            </div>
          );
        })}
      </div>

      <Divider />

      {/* Totals */}
      <div className="space-y-0.5">
        <Row label="Subtotal" value={money(receipt.subtotal)} />
        {totalDiscount > 0 && (
          <Row label="Discount" value={`− ${money(totalDiscount)}`} className="text-rose-600" />
        )}
        <div className="flex justify-between border-t border-black pt-1 text-sm font-bold">
          <span>TOTAL</span>
          <span>{money(receipt.total)}</span>
        </div>
      </div>

      <Divider />

      {/* Payments */}
      <div className="space-y-0.5">
        {receipt.payments.flatMap((pt) =>
          pt.legs.map((leg, i) => (
            <Row
              key={`${pt.id}-${i}`}
              label={leg.reference ? `${leg.method} (${leg.reference})` : leg.method}
              value={money(leg.amount)}
            />
          )),
        )}
        {totalCashPaid > 0 && Number(receipt.total) < totalCashPaid && (
          <Row label="Change" value={money(totalChange)} className="font-semibold" />
        )}
      </div>

      {receipt.note && (
        <>
          <Divider />
          <p className="text-center text-gray-500">{receipt.note}</p>
        </>
      )}

      <Divider />
      <Barcode value={receipt.receiptNo} />
      <Divider />
      <p className="text-center text-gray-400">Thank you for your purchase!</p>
      <div className="border-t-2 border-dashed border-black" />
      {/* <FeedSpacer heightMm={RECEIPT_BOTTOM_TEAR_SPACE_MM} /> */}
    </div>
  );
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

function Divider() {
  return <div className="border-t border-dashed border-gray-400" />;
}

function FeedSpacer({ heightMm }: { heightMm: number }) {
  return (
    <div
      style={{
        height: `${heightMm}mm`,
        width: "100%",
        backgroundImage: "radial-gradient(circle, #000 0.16mm, transparent 0.2mm)",
        backgroundSize: "100% 6mm",
        backgroundPosition: "left top",
        backgroundRepeat: "repeat-y",
      }}
    />
  );
}

function Row({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={`flex justify-between ${className ?? ""}`}>
      <span className="text-gray-500">{label}</span>
      <span>{value}</span>
    </div>
  );
}
