"use client";

import { RefObject, useEffect, useRef } from "react";

type BarcodeScannerOptions = {
  enabled?: boolean;
  minLength?: number;
  idleMs?: number;
  maxAvgCharMs?: number;
  targetRef?: RefObject<HTMLInputElement | null>;
  onScan: (value: string) => void;
};

const isEditableElement = (el: Element | null) => {
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || (el as HTMLElement).isContentEditable;
};

export const useBarcodeScanner = ({
  enabled = true,
  minLength = 4,
  idleMs = 80,
  maxAvgCharMs = 45,
  targetRef,
  onScan,
}: BarcodeScannerOptions) => {
  const bufferRef = useRef("");
  const startedAtRef = useRef(0);
  const lastAtRef = useRef(0);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const resetBuffer = () => {
      bufferRef.current = "";
      startedAtRef.current = 0;
      lastAtRef.current = 0;
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const finishScan = () => {
      const value = bufferRef.current.trim();
      if (!value || value.length < minLength) {
        resetBuffer();
        return;
      }

      const totalMs = Math.max(1, lastAtRef.current - startedAtRef.current);
      const avgCharMs = totalMs / Math.max(1, value.length);

      // Barcode scanners type much faster than humans.
      if (avgCharMs <= maxAvgCharMs) {
        targetRef?.current?.focus();
        onScan(value);
      }

      resetBuffer();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.altKey || event.metaKey) return;

      const active = document.activeElement;
      const isTargetFocused = !!targetRef?.current && active === targetRef.current;

      // Ignore typing into other editable fields; allow the target input itself.
      if (!isTargetFocused && isEditableElement(active)) return;

      const now = Date.now();
      if (now - lastAtRef.current > idleMs) {
        bufferRef.current = "";
        startedAtRef.current = 0;
      }

      if (event.key === "Enter") {
        finishScan();
        return;
      }

      // Typical scanner content is letters, numbers and common separators.
      if (event.key.length !== 1) return;
      if (!/^[A-Za-z0-9\-_.\/:]$/.test(event.key)) return;

      if (!startedAtRef.current) startedAtRef.current = now;
      bufferRef.current += event.key;
      lastAtRef.current = now;

      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => {
        finishScan();
      }, idleMs);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      resetBuffer();
    };
  }, [enabled, idleMs, maxAvgCharMs, minLength, onScan, targetRef]);
};
