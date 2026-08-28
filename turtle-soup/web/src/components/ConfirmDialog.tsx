// 手绘风确认/提示对话框(替代浏览器原生 confirm/alert)
interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  /** 通知类弹窗(如房间已关闭)不显示取消按钮 */
  showCancel?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title = "提示",
  message,
  confirmText = "确定",
  cancelText = "取消",
  danger = false,
  showCancel = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <div className="dlg-mask" onClick={onCancel}>
      <div className="dlg-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="dlg-tape" />
        <h3 className="dlg-title">{title}</h3>
        <p className="dlg-msg">{message}</p>
        <div className="dlg-btns">
          {showCancel && (
            <button className="secondary" onClick={onCancel}>
              {cancelText}
            </button>
          )}
          <button className={danger ? "primary danger" : "primary"} onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
