import { readFileSync } from "fs";
import { join } from "path";
import { createContext, runInContext } from "vm";

function makeCtx() {
  const g = { addColorStop() {} };
  return new Proxy(
    {},
    {
      get(t, p) {
        if (p === "createRadialGradient" || p === "createLinearGradient") return () => g;
        if (p === "measureText") return () => ({ width: 10 });
        if (typeof p === "symbol") return undefined;
        if (!(p in t)) t[p] = () => g;
        return t[p];
      },
      set(t, p, v) {
        t[p] = v;
        return true;
      },
    }
  );
}
function makeEl() {
  const el = {
    style: {},
    value: "",
    disabled: false,
    __classes: new Set(),
    __listeners: {},
    children: [],
    addEventListener(ev, fn) {
      (el.__listeners[ev] = el.__listeners[ev] || []).push(fn);
    },
    removeEventListener() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    appendChild(c) {
      el.children.push(c);
    },
    querySelector() {
      return makeEl();
    },
    querySelectorAll() {
      return [];
    },
    width: 800,
    height: 600,
    getContext() {
      return makeCtx();
    },
  };
  let _h = "";
  Object.defineProperty(el, "innerHTML", {
    get() {
      return _h;
    },
    set(v) {
      _h = v;
      if (v === "") el.children.length = 0;
    },
  });
  el.classList = {
    add(c) {
      el.__classes.add(c);
    },
    remove(c) {
      el.__classes.delete(c);
    },
    toggle(c, f) {
      const s = el.__classes;
      if (f === undefined) {
        s.has(c) ? s.delete(c) : s.add(c);
      } else {
        f ? s.add(c) : s.delete(c);
      }
    },
    contains(c) {
      return el.__classes.has(c);
    },
  };
  return el;
}

export function loadGame() {
  const store = new Map();
  const localStorageStub = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => {
      store.set(k, String(v));
    },
    removeItem: k => {
      store.delete(k);
    },
  };
  const elementsMap = new Map();
  const sandbox = {
    console,
    setTimeout: () => 0,
    setInterval: () => 0,
    clearTimeout() {},
    clearInterval() {},
    requestAnimationFrame: () => 0,
    cancelAnimationFrame() {},
    performance: { now: () => Date.now() },
    localStorage: localStorageStub,
    navigator: { userAgent: "smoke", maxTouchPoints: 0 },
    location: { href: "" },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    devicePixelRatio: 1,
    innerWidth: 1280,
    innerHeight: 720,
    alert() {},
    confirm() {
      return false;
    },
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return true;
    },
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.parent = sandbox;
  sandbox.top = sandbox;
  sandbox.document = {
    getElementById(id) {
      if (!elementsMap.has(id)) elementsMap.set(id, makeEl());
      return elementsMap.get(id);
    },
    querySelector() {
      return makeEl();
    },
    querySelectorAll() {
      return [];
    },
    addEventListener() {},
    removeEventListener() {},
    createElement() {
      return makeEl();
    },
    body: makeEl(),
    documentElement: makeEl(),
    hidden: false,
    visibilityState: "visible",
  };
  createContext(sandbox);
  const files = [
    "00-const.js",
    "01-input.js",
    "02-utils.js",
    "config.js",
    "03-skills.js",
    "04-meta.js",
    "enemies/types.js",
    "enemies/core.js",
    "enemies/update.js",
    "enemies/draw.js",
    "06-player.js",
    "07-projectiles.js",
    "upgrades/choices.js",
    "upgrades/init.js",
    "upgrades/weapons.js",
    "09-deathmark.js",
    "10-events.js",
    "game/update.js",
    "game/render.js",
    "game/ui.js",
  ];
  for (const f of files) {
    const code = readFileSync(join(process.cwd(), "js", f), "utf8");
    runInContext(code, sandbox, { filename: f });
  }
  const R = expr => runInContext(expr, sandbox);
  R(`initGame(); game.state='playing'; game.enemies.length=0; game.altars.length=0; game.chests.length=0;`);
  R(`game.player.x=WORLD_W/2; game.player.y=WORLD_H/2; cam.x=game.player.x-W/2; cam.y=game.player.y-H/2;`);
  return { sandbox, R };
}
