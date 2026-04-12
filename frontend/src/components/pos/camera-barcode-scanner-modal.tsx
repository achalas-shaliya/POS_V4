"use client";

import { useEffect, useRef, useState } from "react";

type CameraBarcodeScannerModalProps = {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
  title?: string;
};

type BarcodeDetectorLike = {
  detect: (image: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};

type BarcodeDetectorCtorLike = new (opts?: { formats?: string[] }) => BarcodeDetectorLike;

const BARCODE_FORMATS = [
  "code_128",
  "code_39",
  "code_93",
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "itf",
  "codabar",
  "qr_code",
];

const getBarcodeDetectorCtor = (): BarcodeDetectorCtorLike | null => {
  const candidate = (window as Window & { BarcodeDetector?: BarcodeDetectorCtorLike }).BarcodeDetector;
  return candidate ?? null;
};

export function CameraBarcodeScannerModal({
  open,
  onClose,
  onDetected,
  title = "Scan barcode",
}: CameraBarcodeScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    const stopAll = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };

    const start = async () => {
      setError(null);

      const BarcodeDetectorCtor = getBarcodeDetectorCtor();
      if (!BarcodeDetectorCtor) {
        setError("This browser does not support camera barcode detection.");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        const detector = new BarcodeDetectorCtor({ formats: BARCODE_FORMATS });

        const scanLoop = async () => {
          if (cancelled || !videoRef.current) return;

          try {
            const barcodes = await detector.detect(videoRef.current);
            const first = barcodes.find((b) => b.rawValue && b.rawValue.trim().length > 0);
            if (first?.rawValue) {
              onDetected(first.rawValue.trim());
              stopAll();
              onClose();
              return;
            }
          } catch {
            // Ignore transient frame decode errors.
          }

          rafRef.current = requestAnimationFrame(scanLoop);
        };

        rafRef.current = requestAnimationFrame(scanLoop);
      } catch {
        setError("Unable to access camera. Please allow camera permission and try again.");
      }
    };

    void start();

    return () => {
      cancelled = true;
      stopAll();
    };
  }, [onClose, onDetected, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 p-4 sm:items-center">
      <div className="w-full max-w-lg rounded-2xl border border-line bg-white p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-bold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-muted transition hover:text-ink"
          >
            Close
          </button>
        </div>

        <p className="mb-3 text-xs text-muted">Point the camera at the barcode. Detection runs automatically.</p>

        <div className="overflow-hidden rounded-xl border border-line bg-black">
          <video
            ref={videoRef}
            playsInline
            muted
            className="h-[320px] w-full object-cover"
          />
        </div>

        {error && <p className="mt-3 text-sm font-medium text-rose-600">{error}</p>}
      </div>
    </div>
  );
}
