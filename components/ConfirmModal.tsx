"use client";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/55 px-4">
      <div className="w-full max-w-md rounded-xl border border-glass-border bg-background-secondary p-6 shadow-2xl">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="mt-2 text-sm text-foreground-muted">{description}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="btn-secondary text-sm py-2 px-4">
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} className="btn-primary text-sm py-2 px-4">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
