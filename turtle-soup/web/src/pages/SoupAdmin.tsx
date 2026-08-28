import { useEffect, useMemo, useState } from "react";
import { IconLock, IconSparkles } from "@tabler/icons-react";
import type { Soup } from "../types";
import ConfirmDialog from "../components/ConfirmDialog";

const TOKEN_KEY = "turtle-soup-admin-token";

interface FormState {
  id: number | null;
  title: string;
  surface: string;
  truth: string;
  category: string;
  difficulty: string;
}


const EMPTY: FormState = { id: null, title: "", surface: "", truth: "", category: "", difficulty: "" };

// 分类/难度枚举兜底(页面加载时尝试从 /api/soup-meta 获取,失败则用这里)
const DEFAULT_CATEGORIES = ["horror", "suspense", "warmth", "mind", "social"];
const DEFAULT_CATEGORY_LABELS: Record<string, string> = {
  horror: "恐怖",
  suspense: "悬疑",
  warmth: "温情",
  mind: "脑洞",
  social: "现实",
};
const DEFAULT_DIFFICULTIES = ["easy", "medium", "hard"];
const DEFAULT_DIFFICULTY_LABELS: Record<string, string> = {
  easy: "简单",
  medium: "中等",
  hard: "困难",
};

interface SoupMeta {
  categories: string[];
  categoryLabels: Record<string, string>;
  difficulties: string[];
  difficultyLabels: Record<string, string>;
}

// 用户反馈(管理端审批)
async function api(url: string, method: string, token: string, body?: unknown) {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers["X-Admin-Token"] = token;
  return fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export default function SoupAdmin() {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) || "");
  const [pwdInput, setPwdInput] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [soups, setSoups] = useState<Soup[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [aiTopic, setAiTopic] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  // 题库搜索关键字与分类/难度筛选
  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [diffFilter, setDiffFilter] = useState("all");
  // 分类/难度枚举(从 /api/soup-meta 拉取,接口不可用时用兜底枚举)
  const [meta, setMeta] = useState<SoupMeta>({
    categories: DEFAULT_CATEGORIES,
    categoryLabels: DEFAULT_CATEGORY_LABELS,
    difficulties: DEFAULT_DIFFICULTIES,
    difficultyLabels: DEFAULT_DIFFICULTY_LABELS,
  });

  async function load() {
    try {
      // 管理端需要含汤底(truth)的完整数据,走管理专用接口
      const r = await api("/api/admin/soups", "GET", token);
      const data = await r.json();
      if (!r.ok) {
        if (r.status === 401) {
          // 管理令牌过期/后端重启后失效:清掉残留 token,回到登录界面
          sessionStorage.removeItem(TOKEN_KEY);
          setToken("");
          return;
        }
        setMsg({ kind: "err", text: data?.error || "题库加载失败" });
        return;
      }
      setSoups(Array.isArray(data) ? data : []);
    } catch {
      setMsg({ kind: "err", text: "题库加载失败" });
    }
  }

  /** 拉取分类/难度枚举;接口不可用或无响应时保留兜底枚举 */
  async function loadMeta() {
    try {
      const r = await fetch("/api/soup-meta");
      if (!r.ok) return;
      const d = await r.json();
      setMeta({
        categories: Array.isArray(d.categories) ? d.categories : DEFAULT_CATEGORIES,
        categoryLabels: d.categoryLabels || DEFAULT_CATEGORY_LABELS,
        difficulties: Array.isArray(d.difficulties) ? d.difficulties : DEFAULT_DIFFICULTIES,
        difficultyLabels: d.difficultyLabels || DEFAULT_DIFFICULTY_LABELS,
      });
    } catch {
      /* 保留兜底枚举 */
    }
  }

  // 题库列表:按标题/汤面关键字 + 分类 + 难度前端过滤(本地数据,不调接口)
  const visibleSoups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = Array.isArray(soups) ? soups : [];
    return list.filter((s) => {
      if (q) {
        const hit =
          (s.title || "").toLowerCase().includes(q) ||
          s.surface.toLowerCase().includes(q);
        if (!hit) return false;
      }
      if (catFilter !== "all" && s.category !== catFilter) return false;
      if (diffFilter !== "all" && s.difficulty !== diffFilter) return false;
      return true;
    });
  }, [soups, query, catFilter, diffFilter]);

  useEffect(() => {
    if (token) {
      load();
    }
    loadMeta();
  }, [token]);

  function flash(kind: "ok" | "err", text: string) {
    setMsg({ kind, text });
    setTimeout(() => setMsg(null), 3000);
  }

  /** 向后端验证密码,成功后只保存令牌(密码不留存在前端) */
  async function login() {
    if (!pwdInput.trim()) return flash("err", "请输入管理密码");
    setLoggingIn(true);
    try {
      const r = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwdInput }),
      });
      const data = await r.json();
      if (!r.ok) return flash("err", data.error || "登录失败");
      sessionStorage.setItem(TOKEN_KEY, data.token);
      setPwdInput("");
      setToken(data.token);
    } finally {
      setLoggingIn(false);
    }
  }

  async function logout() {
    try {
      await fetch("/api/admin/logout", { method: "POST", headers: { "X-Admin-Token": token } });
    } catch {
      /* 忽略登出网络错误 */
    }
    sessionStorage.removeItem(TOKEN_KEY);
    setToken("");
    setForm(EMPTY);
  }

  async function save() {
    setBusy(true);
    try {
      const body = {
        title: form.title,
        surface: form.surface,
        truth: form.truth,
        category: form.category,
        difficulty: form.difficulty,
      };
      const r =
        form.id === null
          ? await api("/api/soups", "POST", token, body)
          : await api(`/api/soups/${form.id}`, "PUT", token, body);
      const data = await r.json();
      if (r.status === 401) {
        sessionStorage.removeItem(TOKEN_KEY);
        setToken("");
        return flash("err", "登录已失效,请重新输入管理密码");
      }
      if (!r.ok) return flash("err", data.error || "保存失败");
      flash("ok", form.id === null ? "已新增谜题" : "已保存修改");
      setForm(EMPTY);
      load();
    } finally {
      setBusy(false);
    }
  }

  // 手绘风删除确认框:记录待删除的谜题
  const [delTarget, setDelTarget] = useState<Soup | null>(null);

  async function remove(s: Soup) {
    const r = await api(`/api/soups/${s.id}`, "DELETE", token);
    if (r.status === 401) {
      sessionStorage.removeItem(TOKEN_KEY);
      setToken("");
      return flash("err", "登录已失效,请重新输入管理密码");
    }
    if (r.ok) {
      flash("ok", "已删除");
      load();
    } else {
      flash("err", "删除失败");
    }
  }

  function edit(s: Soup) {
    setForm({
      id: s.id ?? null,
      title: s.title || "",
      surface: s.surface,
      truth: s.truth || "",
      category: s.category || "",
      difficulty: s.difficulty || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /** 分类/难度中文标签,如 [恐怖·中等];都没有则显示"未分类" */
  function soupTag(cat?: string, diff?: string) {
    const c = cat && (meta.categoryLabels[cat] || cat);
    const d = diff && (meta.difficultyLabels[diff] || diff);
    if (!c && !d) return "未分类";
    return c && d ? `[${c}·${d}]` : `[${c || d}]`;
  }

  async function aiGenerate() {
    if (!aiTopic.trim()) return flash("err", "请输入生成题材");
    setAiBusy(true);
    try {
      const r = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: aiTopic.trim() }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "生成失败");
      setForm((f) => ({
        ...f,
        title: data.title || f.title,
        surface: data.surface,
        truth: data.truth,
      }));
      flash("ok", "AI 生成完成,可修改后保存");
    } catch (e) {
      flash("err", `AI 生成失败:${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setAiBusy(false);
    }
  }

  // 未登录:密码门(必须后端验证通过才进入)
  if (!token) {
    return (
      <div className="admin">
        <h1>题库管理</h1>
        <div className="panel admin-login">
          <div className="preview-label"><IconLock size={16} stroke={2.5} className="inline-icon" /> 需要管理密码</div>
          <input
            type="password"
            value={pwdInput}
            onChange={(e) => setPwdInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
            placeholder="输入管理密码"
            autoFocus
          />
          <button className="primary" disabled={loggingIn} onClick={login}>
            {loggingIn ? "验证中…" : "进入管理"}
          </button>
          {msg && <div className={`flash ${msg.kind}`}>{msg.text}</div>}
          <div className="ai-hint">管理密码由管理员在服务端配置,请向管理员索取</div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin">
      <div className="admin-head">
        <div>
          <h1>题库管理</h1>
          <p className="admin-sub">共 {soups.length} 题 · 保存后实时生效</p>
        </div>
        <button onClick={logout}>退出管理</button>
      </div>

      {msg && <div className={`flash ${msg.kind}`}>{msg.text}</div>}

      <div className="admin-grid">
        {/* 表单 */}
        <section className="panel admin-form">
          <h2>{form.id === null ? "新增谜题" : `编辑谜题 #${form.id}`}</h2>

          <div className="ai-box">
            <div className="preview-label"><IconSparkles size={16} stroke={2.5} className="inline-icon" /> AI 生成谜题(deepseek-v4-flash)</div>
            <div className="ai-row">
              <input
                value={aiTopic}
                maxLength={30}
                onChange={(e) => setAiTopic(e.target.value)}
                placeholder="题材,如:复仇、校园、深夜"
                onKeyDown={(e) => e.key === "Enter" && aiGenerate()}
              />
              <button className="primary" disabled={aiBusy} onClick={aiGenerate}>
                {aiBusy ? "生成中…" : "生成"}
              </button>
            </div>
          </div>

          <label className="field">
            <span>标题(可选)</span>
            <input value={form.title} maxLength={30} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="《标题》" />
          </label>
          <label className="field">
            <span>汤面</span>
            <textarea value={form.surface} rows={4} onChange={(e) => setForm({ ...form, surface: e.target.value })} placeholder="离奇的情景…" />
          </label>
          <label className="field">
            <span>汤底</span>
            <textarea value={form.truth} rows={5} onChange={(e) => setForm({ ...form, truth: e.target.value })} placeholder="完整真相…" />
          </label>
          <div style={{ display: "flex", gap: 12 }}>
            <label className="field" style={{ flex: 1 }}>
              <span>分类</span>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="">未分类</option>
                {meta.categories.map((c) => (
                  <option key={c} value={c}>
                    {meta.categoryLabels[c] || c}
                  </option>
                ))}
              </select>
            </label>
            <label className="field" style={{ flex: 1 }}>
              <span>难度</span>
              <select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
                <option value="">未定</option>
                {meta.difficulties.map((d) => (
                  <option key={d} value={d}>
                    {meta.difficultyLabels[d] || d}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="form-btns">
            <button className="primary" disabled={busy} onClick={save}>
              {busy ? "保存中…" : form.id === null ? "新增" : "保存修改"}
            </button>
            {form.id !== null && (
              <button onClick={() => setForm(EMPTY)}>取消编辑</button>
            )}
          </div>
        </section>

        {/* 列表 */}
        <section className="soup-list">
          <div className="sub-toolbar">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索标题或汤面关键字"
              style={{ flex: 1, minWidth: 180 }}
            />
            <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
              <option value="all">全部分类</option>
              {meta.categories.map((c) => (
                <option key={c} value={c}>
                  {meta.categoryLabels[c] || c}
                </option>
              ))}
            </select>
            <select value={diffFilter} onChange={(e) => setDiffFilter(e.target.value)}>
              <option value="all">全部难度</option>
              {meta.difficulties.map((d) => (
                <option key={d} value={d}>
                  {meta.difficultyLabels[d] || d}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                const blob = new Blob([JSON.stringify(visibleSoups, null, 2)], { type: "application/json" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = `题库导出-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(a.href);
              }}
              title="把当前筛选结果导出为 JSON"
            >
              导出题库
            </button>
            <button
              onClick={async () => {
                try {
                  const r = await fetch("/api/submissions/export", {
                    headers: { "X-Admin-Token": token },
                  });
                  if (!r.ok) {
                    setMsg({ kind: "err", text: "导出审核记录失败:" + (await r.text()) });
                    return;
                  }
                  const blob = await r.blob();
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = `审核记录-${new Date().toISOString().slice(0, 10)}.csv`;
                  a.click();
                  URL.revokeObjectURL(a.href);
                } catch {
                  setMsg({ kind: "err", text: "导出审核记录失败:网络错误" });
                }
              }}
              title="导出全部审核记录为 CSV"
            >
              导出审核记录
            </button>
          </div>
          {visibleSoups.map((s) => (
            <div key={s.id} className="soup-item">
              <div className="soup-item-head">
                <span className="soup-item-title">
                  {s.title ? `《${s.title}》` : `第 ${s.id} 题`}
                  <span
                    className="badge"
                    style={{
                      marginLeft: 8,
                      fontSize: 11,
                      padding: "1px 8px",
                      fontWeight: 400,
                      color: "var(--text-dim)",
                      verticalAlign: "middle",
                    }}
                  >
                    {soupTag(s.category, s.difficulty)}
                  </span>
                </span>
                <div className="soup-item-actions">
                  <button onClick={() => edit(s)}>编辑</button>
                  <button className="bad" onClick={() => setDelTarget(s)}>
                    删除
                  </button>
                </div>
              </div>
              <div className="soup-item-surface">{s.surface}</div>
            </div>
          ))}
          {visibleSoups.length === 0 &&
            (soups.length === 0 ? (
              <div className="hint empty">题库为空</div>
            ) : (
              <div className="hint empty">没有符合条件的谜题</div>
            ))}
        </section>
      </div>

      {/* 删除谜题确认 */}
      <ConfirmDialog
        open={!!delTarget}
        title="删除谜题"
        message={`确定删除《${delTarget?.title || (delTarget ? `第 ${delTarget.id} 题` : "")}》?删除后不可恢复。`}
        confirmText="删除"
        danger
        onConfirm={() => {
          if (delTarget) remove(delTarget);
          setDelTarget(null);
        }}
        onCancel={() => setDelTarget(null)}
      />
    </div>
  );
}
