"use client";

import { X } from "lucide-react";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastMessage {
  id: number;
  type: "success" | "error";
  message: string;
  action?: ToastAction;
}

interface ToastProps {
  toast: ToastMessage | null;
  onClose: () => void;
}

export function Toast({ toast, onClose }: ToastProps) {
  if (!toast) return null;

  const baseClass =
    toast.type === "success"
      ? "border-neon-green/40 bg-neon-green/10 text-neon-green"
      : "border-red-500/40 bg-red-500/10 text-red-300";

  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${baseClass}`} role="status" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <p>{toast.message}</p>
        <button
          type="button"
          onClick={onClose}
          className="text-foreground-muted hover:text-foreground transition"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {toast.action && (
        <button
          type="button"
          onClick={toast.action.onClick}
          className="mt-2 inline-flex rounded-md border border-current/35 px-2 py-1 text-xs font-semibold hover:bg-white/5 transition"
        >
          {toast.action.label}
        </button>
      )}
    </div>
  );
}
