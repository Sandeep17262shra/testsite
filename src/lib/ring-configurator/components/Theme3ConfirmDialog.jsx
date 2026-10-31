export function Theme3ConfirmDialog({
  open,
  onClose,
  title,
  body,
  confirmLabel,
  onConfirm,
  closeAriaLabel = "Close",
}) {
  if (!open) return null;

  return (
    <div className="theme3-confirm-backdrop fixed inset-0 flex items-center justify-center z-50">
      <div
        className="confirm-popup theme3-confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="theme3-confirm-dialog-title"
      >
        <button
          type="button"
          className="close-cross theme3-confirm-dialog__close"
          onClick={onClose}
          aria-label={closeAriaLabel}
        >
          ✕
        </button>
        <h2 id="theme3-confirm-dialog-title" className="theme3-confirm-dialog__title theme3-section-heading">
          {title}
        </h2>
        <p className="theme3-confirm-dialog__body theme3-body-text">{body}</p>
        <button
          type="button"
          className="cnfm-btn theme3-confirm-dialog__confirm theme3-panel-footer-cta"
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
