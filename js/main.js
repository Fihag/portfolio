/* Fihag · 作品集交互
   光标光晕 / 卡片 3D 倾斜 / 磁性按钮 / 打字机 / 逐字标题 / 数字滚动 / 渐显
   全部渐进增强：触屏与 prefers-reduced-motion 下自动关闭 */

(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const enabled = () => !reduceMotion.matches && finePointer.matches;

  /* ---------- 光标跟随光晕 ---------- */
  const glow = document.querySelector(".cursor-glow");
  if (glow) {
    let targetX = -300, targetY = -300;
    let curX = -300, curY = -300;
    let rafId = null;

    const render = () => {
      // lerp 追踪，产生柔和的拖尾感
      curX += (targetX - curX) * 0.12;
      curY += (targetY - curY) * 0.12;
      glow.style.transform = `translate(${curX - 280}px, ${curY - 280}px)`;
      if (Math.abs(targetX - curX) > 0.5 || Math.abs(targetY - curY) > 0.5) {
        rafId = requestAnimationFrame(render);
      } else {
        rafId = null;
      }
    };

    window.addEventListener("pointermove", (e) => {
      if (!enabled()) return;
      targetX = e.clientX;
      targetY = e.clientY;
      if (rafId === null) rafId = requestAnimationFrame(render);
    }, { passive: true });
  }

  /* ---------- 卡片 3D 倾斜 + 跟随高光 ---------- */
  const MAX_TILT = 5;

  document.querySelectorAll(".card.tilt").forEach((card) => {
    card.addEventListener("pointermove", (e) => {
      if (!enabled()) return;
      const rect = card.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      const rotateY = (px - 0.5) * 2 * MAX_TILT;
      const rotateX = (0.5 - py) * 2 * MAX_TILT;
      card.style.transform =
        `perspective(1200px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale(1.02)`;
      card.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
      card.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
    });

    card.addEventListener("pointerleave", () => {
      card.style.transform = "";
    });
  });

  /* ---------- 磁性按钮 ---------- */
  const MAGNET_RANGE = 1.6;   // 感应半径倍数
  const MAGNET_PULL = 0.22;   // 吸附力度

  document.querySelectorAll(".magnetic").forEach((el) => {
    el.addEventListener("pointermove", (e) => {
      if (!enabled()) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      el.style.setProperty("--magx", `${(dx * MAGNET_PULL).toFixed(1)}px`);
      el.style.setProperty("--magy", `${(dy * MAGNET_PULL).toFixed(1)}px`);
    });

    el.addEventListener("pointerleave", () => {
      el.style.setProperty("--magx", "0px");
      el.style.setProperty("--magy", "0px");
    });
  });

  /* ---------- Hero kicker 打字机 ---------- */
  const typeEl = document.querySelector(".type-text");
  if (typeEl && !reduceMotion.matches) {
    const text = typeEl.textContent;
    typeEl.textContent = "";
    typeEl.setAttribute("aria-hidden", "true");
    let i = 0;
    const tick = () => {
      if (i <= text.length) {
        typeEl.textContent = text.slice(0, i);
        i++;
        setTimeout(tick, text[i - 2] === " " ? 220 : 75);
      }
    };
    setTimeout(tick, 400);
  }

  /* ---------- Hero 标题逐字浮现 ---------- */
  document.querySelectorAll("[data-split]").forEach((el) => {
    const split = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        for (const ch of node.textContent) {
          if (ch === "\n" || ch === " ") {
            frag.appendChild(document.createTextNode(ch));
          } else {
            const span = document.createElement("span");
            span.className = "char";
            span.textContent = ch;
            frag.appendChild(span);
          }
        }
        node.replaceWith(frag);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        Array.from(node.childNodes).forEach(split);
      }
    };
    Array.from(el.childNodes).forEach(split);
    el.querySelectorAll(".char").forEach((ch, i) => {
      ch.style.setProperty("--char-delay", `${i * 45}ms`);
    });
    // 双击 rAF 确保初始样式先应用，再触发过渡
    requestAnimationFrame(() =>
      requestAnimationFrame(() => el.classList.add("is-split"))
    );
  });

  /* ---------- 数字滚动 ---------- */
  const counters = document.querySelectorAll("[data-count]");
  if (counters.length && "IntersectionObserver" in window && !reduceMotion.matches) {
    const animateCount = (el) => {
      const target = parseInt(el.dataset.count, 10);
      const dur = 1200;
      const t0 = performance.now();
      const step = (t) => {
        const p = Math.min((t - t0) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 4);
        el.textContent = Math.round(target * eased);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    const cio = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animateCount(entry.target);
          cio.unobserve(entry.target);
        }
      });
    }, { threshold: 0.6 });
    counters.forEach((el) => cio.observe(el));
  }

  /* ---------- 滚动渐显（含轻微交错） ---------- */
  const revealEls = Array.from(document.querySelectorAll(".reveal"));
  if ("IntersectionObserver" in window && !reduceMotion.matches) {
    let batchIndex = 0;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.style.setProperty("--reveal-delay", `${Math.min(batchIndex * 60, 240)}ms`);
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
          batchIndex++;
        }
      });
      if (batchIndex > 4) batchIndex = 0;
    }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });

    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("is-visible"));
  }
})();
