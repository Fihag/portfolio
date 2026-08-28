// 手绘风反馈对话框:标题 + 建议/反馈内容,提交到 /api/feedback
import { useState } from "react";
import { getToken } from "../socket";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
}

export default function FeedbackDialog({ open, onClose, onSubmitted }: Props) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  if (!open) return null;

  async function submit() {
    setErr("");
    if (!content.trim()) {
      setErr("请填写建议/反馈内容");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ title: title.trim(), content: content.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "提交失败,请稍后再试");
      setTitle("");
      setContent("");
      onSubmitted?.();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "提交失败,请检查网络");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dlg-mask" onClick={onClose}>
      <div className="dlg-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="dlg-tape" />
        <h3 className="dlg-title">意见反馈</h3>
        <p className="dlg-msg" style={{ marginBottom: 12 }}>
          你的建议会同步给管理员,感谢反馈!
        </p>
        <label className="field">
          <span>标题(可选)</span>
          <input value={title} maxLength={40} onChange={(e) => setTitle(e.target.value)} placeholder="一句话概括你的建议" />
        </label>
        <label className="field">
          <span>建议/反馈</span>
          <textarea
            value={content}
            rows={4}
            maxLength={500}
            onChange={(e) => setContent(e.target.value)}
            placeholder="想说的话…(最多 500 字)"
          />
        </label>
        {err && <div className="error" style={{ marginTop: 0 }}>{err}</div>}
        <div className="dlg-btns" style={{ marginTop: 14 }}>
          <button className="secondary" onClick={onClose} disabled={busy}>
            取消
          </button>
          <button className="primary" onClick={submit} disabled={busy}>
            {busy ? "提交中…" : "提交反馈"}
          </button>
        </div>
      </div>
    </div>
  );
}
