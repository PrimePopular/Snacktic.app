import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** id of the heading inside, so screen readers announce the dialog's title. */
  labelledBy: string;
  /** Extra class, for example "modal--sheet" for a nearly full-height sheet. */
  className?: string;
  children: ReactNode;
}

/**
 * A pop-up in front of the page. Uses the browser's built-in dialog, which traps focus, closes with
 * the Escape key and keeps the page behind it still. Tapping the dark area outside also closes it.
 */
export function Modal({ open, onClose, labelledBy, className = '', children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`modal ${className}`.trim()}
      aria-labelledby={labelledBy}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      {open && <div className="modal__panel">{children}</div>}
    </dialog>
  );
}
