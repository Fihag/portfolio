// AI 谜题生成:OpenAI 兼容适配器
// 密钥只从环境变量读取,不提供默认值(源码不落任何密钥);未配置时 AI 功能不可用
const BASE = process.env.LLM_BASE_URL || "https://opencode.ai/zen/go";
const KEY = process.env.LLM_API_KEY || "";
const MODEL = process.env.LLM_MODEL || "deepseek-v4-flash";

/** 修复 LLM 常见问题:JSON 字符串值内的裸换行(替换为 \n 转义) */
function fixJsonNewlines(s) {
  let out = "";
  let inStr = false;
  let esc = false;
  for (const ch of s) {
    if (esc) {
      out += ch;
      esc = false;
      continue;
    }
    if (ch === "\\") {
      out += ch;
      esc = true;
      continue;
    }
    if (ch === '"') {
      inStr = !inStr;
      out += ch;
      continue;
    }
    if (inStr && (ch === "\n" || ch === "\r")) {
      out += "\\n";
      continue;
    }
    out += ch;
  }
  return out;
}

/** 从模型输出中提取 JSON 对象:尝试所有 JSON 块(非贪婪逐个解析),容错 ```json 包裹与思考过程 */
function extractJson(text) {
  const src = String(text);
  const candidates = [];
  const re = /\{[\s\S]*?\}/g;
  let m;
  while ((m = re.exec(src))) candidates.push(m[0]);
  const greedy = src.match(/\{[\s\S]*\}/);
  if (greedy) candidates.push(greedy[0]);
  for (const c of candidates) {
    for (const candidate of [c, fixJsonNewlines(c)]) {
      try {
        const obj = JSON.parse(candidate);
        if (obj && typeof obj === "object" && (obj.surface || obj.truth || obj.title)) {
          const surface = String(obj.surface || "").trim();
          const truth = String(obj.truth || "").trim();
          // 拒绝照抄示例占位文字
          const placeholder = surface === "汤面" || truth === "汤底";
          if (surface && truth && !placeholder) {
            return {
              title: String(obj.title || "").trim() || undefined,
              surface,
              truth,
            };
          }
        }
      } catch {
        /* 尝试下一个候选块 */
      }
    }
  }
  throw new Error(`AI 输出中未找到有效 JSON,原文: ${src.slice(0, 300)}`);
}

/** 把分类/难度转成提示词里的风格约束;未选择时返回空串 */
function describeStyle({ category, difficulty } = {}) {
  const parts = [];
  if (category) {
    const map = {
      horror: "风格:恐怖惊悚,氛围阴森、细思极恐",
      suspense: "风格:悬疑推理,线索环环相扣、可推理性强",
      warmth: "风格:温情催泪,真相悲伤但感人,反转暖心",
      mind: "风格:脑洞反转,设定新奇、结局出人意料",
      social: "风格:现实社会,贴近生活、引人深思",
    };
    if (map[category]) parts.push(map[category]);
  }
  if (difficulty) {
    const map = {
      easy: "难度:简单,汤底 1~3 步即可推理出,适合新手",
      medium: "难度:中等,需要 3~5 个线索才能还原真相",
      hard: "难度:困难,多重反转或冷知识,极难猜中",
    };
    if (map[difficulty]) parts.push(map[difficulty]);
  }
  return parts.length ? parts.join(";") + "。" : "";
}

/** 归一化 Base URL:去掉末尾斜杠 */
function normalizeBase(base) {
  return String(base || "").trim().replace(/\/+$/, "");
}

/** 校验自定义配置:合法返回规范化配置,非法返回 null */
function resolveConfig(cfg) {
  if (!cfg || typeof cfg !== "object") return null;
  const base = normalizeBase(cfg.baseUrl);
  const key = String(cfg.apiKey || "").trim();
  const model = String(cfg.model || "").trim();
  // base 必须 http/https 开头;key 与 model 非空
  if (!/^https?:\/\//.test(base) || !key || !model) return null;
  return { base, key, model };
}

async function chat(messages, temperature, cfg = null) {
  const c = cfg || { base: BASE, key: KEY, model: MODEL };
  if (!c.key) throw new Error("未配置 LLM_API_KEY 环境变量,AI 功能不可用");
  const body = {
    model: c.model,
    messages,
    temperature,
    max_tokens: 2048,
    reasoning_effort: "low", // 抑制推理模型过长思考,确保 content 直接输出 JSON(非推理模型会忽略此参数)
  };
  const url = `${c.base}/v1/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${c.key}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`AI 请求失败: HTTP ${res.status}`);
  const data = await res.json();
  const msg = data?.choices?.[0]?.message || {};
  // 推理型模型:content 为空时回退 reasoning_content
  const text = String(msg.content || msg.reasoning_content || "").trim();
  if (!text) throw new Error("AI 响应缺少内容");
  return text;
}

/** 生成一道海龟汤谜题(失败自动重试一次);opts.category/difficulty 影响出题方向 */
export async function generateSoup(topic, opts = {}) {
  const topicText = String(topic || "").trim() || "不限主题";
  const style = describeStyle(opts);
  const prompt = `你是海龟汤出题专家。围绕主题「${topicText}」创作一道海龟汤。
要求:
- 汤面(surface):离奇吊胃口的情景,1~4 句;
- 汤底(truth):完整合理的真相,可稍长,需自洽;
- 标题(title):4~12 字。
${style}
现在直接给出最终答案,只输出一个 JSON 对象,不要任何其他文字、不要思考过程、不要代码块:
{"title":"标题","surface":"汤面","truth":"汤底"}`;
  let lastErr = null;
  const messages = [
    { role: "system", content: "你是一位海龟汤出题专家。你的回答必须只包含一个 JSON 对象,禁止输出任何思考过程、解释、代码块标记或其他文字。" },
    { role: "user", content: prompt },
  ];
  const temps = [0.5, 0.4, 0.6, 0.3, 0.7]; // 低温优先,减少推理模型思考溢出
  for (let i = 0; i < temps.length; i++) {
    try {
      const text = await chat(messages, temps[i]);
      return extractJson(text);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

/** 对已有谜题自动判断分类/难度(用于审核入库前打标)。cfg 为可选自定义 AI 配置 { baseUrl, apiKey, model };失败抛错 */
export async function classifySoup({ surface, truth, config } = {}) {
  const s = String(surface || "").trim();
  const t = String(truth || "").trim();
  if (!s || !t) throw new Error("缺少汤面或汤底");
  const cfg = resolveConfig(config); // 非法/未提供时退回默认配置
  const prompt = `判断下面这道海龟汤谜题的分类与难度。
分类可选:horror(恐怖)/suspense(悬疑)/warmth(温情)/mind(脑洞)/social(现实)。
难度可选:easy(简单)/medium(中等)/hard(困难)。
只输出一个 JSON 对象,不要任何其他文字:
{"category":"分类","difficulty":"难度"}

汤面:${s}
汤底:${t}`;
  const messages = [
    { role: "system", content: "你是一位海龟汤谜题分类专家。你的回答必须只包含一个 JSON 对象,禁止输出任何思考过程、解释或其他文字。" },
    { role: "user", content: prompt },
  ];
  const allowedC = ["horror", "suspense", "warmth", "mind", "social"];
  const allowedD = ["easy", "medium", "hard"];
  let lastErr = null;
  const temps = [0.2, 0.3, 0.1];
  for (let i = 0; i < temps.length; i++) {
    try {
      const text = await chat(messages, temps[i], cfg);
      // 分类结果不含 surface/truth,不能复用 extractJson(其校验字段),单独提取
      const obj = pickJson(text, (o) => o && (o.category || o.difficulty));
      const category = obj && allowedC.includes(obj.category) ? obj.category : undefined;
      const difficulty = obj && allowedD.includes(obj.difficulty) ? obj.difficulty : undefined;
      if (!category || !difficulty) throw new Error("分类结果不在枚举内");
      return { category, difficulty };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

/** 从文本中解析第一个满足校验的 JSON 对象(校验函数判定);与 extractJson 区别:不强制 surface/truth 字段 */
function pickJson(text, isValid) {
  const src = String(text);
  const re = /\{[\s\S]*?\}/g;
  let m;
  while ((m = re.exec(src))) {
    for (const candidate of [m[0], fixJsonNewlines(m[0])]) {
      try {
        const obj = JSON.parse(candidate);
        if (isValid(obj)) return obj;
      } catch {
        /* 尝试下一个候选块 */
      }
    }
  }
  const greedy = src.match(/\{[\s\S]*\}/);
  if (greedy) {
    for (const candidate of [greedy[0], fixJsonNewlines(greedy[0])]) {
      try {
        const obj = JSON.parse(candidate);
        if (isValid(obj)) return obj;
      } catch {
        /* 忽略 */
      }
    }
  }
  throw new Error(`AI 输出中未找到有效 JSON,原文: ${src.slice(0, 300)}`);
}
