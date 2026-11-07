import * as React from "react";
import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import Matter from "matter-js";
import "./TumbleWall.css";
const i = { jsx, jsxs, Fragment };
const o = React;
const d = Matter;
const c = { cn: (...classes) => classes.filter(Boolean).join(" ") };
const a = {}, n = {}, l = {}, s = {};
let p = 1e3 / 120, u = ["top", "bottom", "left", "right"], h = ["circle", "square", "card", "chip", "mixed"], m = ["none", "border", "polaroid"], y = ["rain", "burst", "drop", "none"], f = ["circle", "square", "card"], g = (e, t, r) => Math.min(r, Math.max(t, e)), b = (e, t) => Number.isFinite(e) ? e : t, x = (e) => {
  let t = 43758.5453123 * Math.sin(127.1 * e + 311.7);
  return t - Math.floor(t);
}, w = (e, t) => "mixed" === e ? f[Math.floor(3 * x(7.31 * t + 2.1)) % 3] : e, v = [{ src: "/demo-media/portrait-sienna.webp", alt: "Studio portrait with short natural hair and a burnt-orange top", title: "Sienna" }, { src: "/demo-media/portrait-indigo.webp", alt: "Studio portrait with short dark hair and a cobalt jacket", title: "Indigo" }, { src: "/demo-media/portrait-olive.webp", alt: "Studio portrait with a dark bob and an olive top", title: "Olive" }, { src: "/demo-media/portrait-silver.webp", alt: "Studio portrait with cropped grey hair and a black shirt", title: "Silver" }, { src: "/demo-media/portrait-ochre.webp", alt: "Studio portrait with curly dark hair and an ochre knit", title: "Ochre" }, { src: "/demo-media/portrait-rose.webp", alt: "Studio portrait with curly red hair and burgundy clothing", title: "Rose" }, { src: "/demo-media/portrait-teal.webp", alt: "Studio portrait with a shaved head and a teal jacket", title: "Teal" }, { src: "/demo-media/portrait-pearl.webp", alt: "Studio portrait with long black hair and an ivory shirt", title: "Pearl" }], S = (e) => {
  let t = window.matchMedia("(prefers-reduced-motion: reduce)");
  return t.addEventListener("change", e), () => t.removeEventListener("change", e);
}, k = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches, M = (e) => [e.count, e.shape, e.size, e.sizeVariance, e.fill, e.radius, e.frame, e.frameWidth, e.showTitles, e.items.map((e2) => `${e2.src ?? ""}|${e2.title ?? ""}|${e2.alt ?? ""}`).join("\n")].join("~"), C = (e) => [e.gravity, e.gravityX, e.bounce, e.friction, e.airFriction, e.contain, e.paused, e.draggable, e.drift].join(","), F = (e) => ({ x: g(b(e.gravityX, 0), -3, 3), y: g(b(e.gravity, 1), -3, 3) }), j = (e) => {
  let t = F(e);
  return Math.abs(t.y) >= Math.abs(t.x) && Math.abs(t.y) > 0.05 ? t.y > 0 ? "top" : "bottom" : Math.abs(t.x) > 0.05 ? t.x > 0 ? "left" : "right" : null;
}, E = (e) => {
  let t = F(e), r = Math.hypot(t.x, t.y);
  return r > 0.05 ? { x: t.x / r, y: t.y / r } : { x: 0, y: 1 };
}, A = (e) => e <= 0 ? "none" : `0 1px 1.5px rgb(0 0 0 / ${(0.16 * e).toFixed(3)}), 0 4px 8px -2px rgb(0 0 0 / ${(0.16 * e).toFixed(3)}), 0 12px 26px -8px rgb(0 0 0 / ${(0.3 * e).toFixed(3)})`, B = { position: "absolute", width: 1, height: 1, margin: -1, padding: 0, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: 0 }, P = (0, o.forwardRef)(function({ items: e = v, count: t = 24, shape: r = "circle", size: a2 = 116, sizeVariance: n2 = 0.4, fill: l2 = 0.4, radius: s2 = 18, frame: f2 = "none", frameWidth: P2 = 6, frameColor: z = "#FFFFFF", textColor: V = "#0A0A0A", backgroundColor: I = "transparent", shadow: L = 0.5, showTitles: T = true, monochrome: W = false, hoverScale: R = 1.06, gravity: $ = 1, gravityX: q = 0, bounce: O = 0.32, friction: D = 0.3, airFriction: N = 0.012, spin: H = 0.5, drift: X = 0, entrance: G = "rain", stagger: U = 55, draggable: _ = true, dragStiffness: Y = 0.2, throwStrength: K = 1, popForce: Z = 1, contain: J = true, paused: Q = false, ariaLabel: ee = "Photo pile", onSelect: et, className: er, style: ei }, eo) {
  let ea, en = (0, o.useRef)(null), el = (0, o.useRef)(null), es = (0, o.useRef)(null), ed = (0, o.useSyncExternalStore)(S, k, () => false), ec = (0, o.useId)(), ep = e.length ? g(Math.round(b(t, 24)), 1, 80) : 0, eu = h.includes(r) ? r : "circle", eh = m.includes(f2) ? f2 : "none", em = { items: e, count: ep, shape: eu, size: a2, sizeVariance: n2, fill: l2, radius: s2, frame: eh, frameWidth: P2, showTitles: T, hoverScale: R, gravity: $, gravityX: q, bounce: O, friction: D, airFriction: N, spin: H, drift: X, entrance: y.includes(G) ? G : "rain", stagger: U, draggable: _, dragStiffness: Y, throwStrength: K, popForce: Z, contain: J, paused: Q, reduced: ed }, ey = (0, o.useRef)(em), ef = (0, o.useRef)((t2) => {
    et?.(e[t2 % e.length], t2);
  });
  (0, o.useEffect)(() => {
    ey.current = em, ef.current = (t2) => {
      e.length && et?.(e[t2 % e.length], t2);
    }, es.current?.sync();
  }), (0, o.useEffect)(() => {
    let e2 = en.current, t2 = el.current;
    if (!e2 || !t2) return;
    let r2 = (function(e3, t3, r3, i2) {
      let o2 = d.Engine.create({ enableSleeping: true, positionIterations: 10, velocityIterations: 8, constraintIterations: 3 }), a3 = e3.ownerDocument.defaultView ?? window, n3 = /* @__PURE__ */ new Map(), l3 = [], s3 = [], c2 = null, h2 = null, m2 = null, y2 = false, f3 = 0, v2 = 0, S2 = 1, k2 = 80, A2 = "", B2 = "", P3 = false, z2 = false, V2 = false, I2 = false, L2 = false, T2 = 0, W2 = 0, R2 = 0, $2 = 0, q2 = 1, O2 = 10, D2 = "", N2 = [], H2 = { x: 0, y: 0 }, X2 = null, G2 = null, U2 = null, _2 = null, Y2 = null, K2 = null, Z2 = null, J2 = 0, Q2 = 0, ee2 = false, et2 = (e4) => e4 && "function" == typeof e4.closest ? e4.closest("[data-tw-item]") : null, er2 = (e4) => {
        let t4 = et2(e4);
        return t4 ? n3.get(t4) ?? null : null;
      }, ei2 = (t4) => {
        let r4 = e3.getBoundingClientRect(), i3 = r4.width > 0 && f3 > 0 ? r4.width / f3 : 1, o3 = r4.height > 0 && v2 > 0 ? r4.height / v2 : 1;
        return { x: (t4.clientX - r4.left) / i3, y: (t4.clientY - r4.top) / o3 };
      }, eo2 = (e4, t4, r4) => "top" === e4 ? { x: t4, y: -r4 } : "bottom" === e4 ? { x: t4, y: v2 + r4 } : "left" === e4 ? { x: -r4, y: t4 } : { x: f3 + r4, y: t4 }, ea2 = (e4, t4) => {
        let r4 = e4.body;
        return !!r4 && ("top" === t4 ? r4.bounds.min.y >= 0 : "bottom" === t4 ? r4.bounds.max.y <= v2 : "left" === t4 ? r4.bounds.min.x >= 0 : r4.bounds.max.x <= f3);
      }, en2 = (e4, t4, r4) => {
        let i3 = "circle" === e4.kind ? e4.w / 2 : Math.min(e4.w, e4.h) / 2, o3 = b(t4, f3 / 2), a4 = b(r4, v2 / 2);
        return { x: g(o3, "left" === h2 ? -(2 * f3) : i3, "right" === h2 ? 3 * f3 : Math.max(i3, f3 - i3)), y: g(a4, "top" === h2 ? -(2 * v2) : i3, "bottom" === h2 ? 3 * v2 : Math.max(i3, v2 - i3)) };
      }, el2 = (e4) => {
        h2 !== e4 && (c2 && h2 && d.Composite.add(o2.world, c2[h2]), c2 && e4 && d.Composite.remove(o2.world, c2[e4]), h2 = e4);
      }, es2 = (e4) => y2 ? m2 : e4.contain ? null : j(e4), ed2 = (e4, t4, i3, o3) => {
        let a4 = r3.current, n4 = { angle: o3, restitution: g(b(a4.bounce, 0.3), 0, 0.95), friction: g(b(a4.friction, 0.3), 0, 1), frictionStatic: 0.7, frictionAir: g(b(a4.airFriction, 0.012), 0, 0.2), density: 12e-4, sleepThreshold: 45 };
        if ("circle" === e4.kind) return d.Bodies.circle(t4, i3, e4.w / 2, n4, 40);
        let l4 = "chip" === e4.kind ? e4.h / 2 - 0.25 : Math.min(e4.corner, Math.min(e4.w, e4.h) / 2 - 0.25);
        return d.Bodies.rectangle(t4, i3, e4.w, e4.h, l4 > 0.75 ? { ...n4, chamfer: { radius: l4 } } : n4);
      }, ec2 = (e4, t4, i3, o3) => {
        let a4 = r3.current, n4 = t4 / i3;
        if ("chip" === e4.kind) {
          let r4 = Math.max(18, 0.4 * t4), i4 = 0.38 * r4, a5 = 0.1 * r4, n5 = e4.img ? a5 + (r4 - 2 * a5) + 0.62 * i4 : 1.15 * i4;
          return { w: o3 ?? n5 + e4.label.length * i4 * 0.56 + 1.1 * i4, h: r4, fw: 0, bottom: 0, corner: r4 / 2, font: i4, inset: a5 };
        }
        let l4 = "none" === a4.frame ? 0 : g(b(a4.frameWidth, 6), 0, 48) * n4, s4 = g(b(a4.radius, 18), 0, 480) * n4, d2 = "card" === e4.kind ? 0.84 * t4 : t4;
        if ("polaroid" === a4.frame && "circle" !== e4.kind) {
          let t5 = Math.max(4, d2 - 2 * l4), r4 = Math.max(3 * l4, 0.19 * d2);
          return { w: d2, h: l4 + t5 * ("card" === e4.kind ? 4 / 3 : 1) + r4, fw: l4, bottom: r4, corner: Math.min(s4, d2 / 2), font: g(0.36 * r4, 8, 18), inset: 0 };
        }
        let c3 = "card" === e4.kind ? 4 * d2 / 3 : d2;
        return { w: d2, h: c3, fw: l4, bottom: l4, corner: "circle" === e4.kind ? d2 / 2 : Math.min(s4, Math.min(d2, c3) / 2), font: 12, inset: 0 };
      }, ep2 = (e4, t4) => {
        let r4 = e4.node.style;
        r4.setProperty("--tw-h", `${t4.h.toFixed(2)}px`), r4.setProperty("--tw-f", `${t4.font.toFixed(2)}px`), r4.setProperty("--tw-p", `${t4.inset.toFixed(2)}px`), r4.setProperty("--tw-r", `${(t4.h / 2).toFixed(2)}px`), r4.removeProperty("--tw-w");
      }, eu2 = (e4, t4) => {
        let r4 = e4.body;
        if (!r4) return;
        let i3 = e4.px + (r4.position.x - e4.px) * t4, o3 = e4.py + (r4.position.y - e4.py) * t4, a4 = e4.pa + (r4.angle - e4.pa) * t4;
        e4.rx = i3, e4.ry = o3, e4.ra = a4;
        let n4 = Math.abs(e4.scale - 1) > 5e-4, l4 = `translate3d(${(i3 - e4.w / 2).toFixed(2)}px,${(o3 - e4.h / 2).toFixed(2)}px,0) rotate(${a4.toFixed(4)}rad)${n4 ? ` scale(${e4.scale.toFixed(4)})` : ""}`;
        l4 !== e4.transform && (e4.transform = l4, e4.node.style.transform = l4);
      }, eh2 = () => {
        let e4 = Z2;
        if (!e4 || !e4.body) return;
        let r4 = Math.abs(Math.cos(e4.ra)), i3 = Math.abs(Math.sin(e4.ra)), o3 = ("circle" === e4.kind ? e4.w / 2 : (e4.w * i3 + e4.h * r4) / 2) * e4.scale, a4 = e4.ry - o3 - 10 > 34, n4 = a4 ? e4.ry - o3 - 10 : e4.ry + o3 + 10, l4 = g(e4.rx, 48, Math.max(48, f3 - 48));
        t3.style.transform = `translate3d(${l4.toFixed(1)}px,${n4.toFixed(1)}px,0) translate(-50%,${a4 ? "-100%" : "0"})`;
      }, em2 = (e4) => {
        let t4 = g(b(r3.current.hoverScale, 1.06), 1, 1.4);
        return X2?.piece === e4 ? 1.025 * t4 : U2 === e4 || _2 === e4 || Y2 === e4 ? t4 : 1;
      }, ey2 = (e4, t4) => {
        e4.node.style.zIndex = t4 ? String(O2 + 1) : e4.z ? String(e4.z) : "";
      }, ef2 = () => {
        let e4 = r3.current;
        for (let e5 of s3) {
          let t4 = X2?.piece === e5 || U2 === e5 || _2 === e5;
          t4 !== e5.mono && (e5.mono = t4, t4 ? e5.node.style.setProperty("--tw-mono", "0") : e5.node.style.removeProperty("--tw-mono"));
        }
        let i3 = X2?.piece ?? U2 ?? _2 ?? Y2, o3 = i3 && e4.showTitles && !i3.inline && i3.title ? i3 : null;
        o3 !== Z2 && (Z2 = o3, o3 ? (t3.textContent = o3.title, eh2(), t3.style.opacity = "1") : t3.style.opacity = "0"), ez();
      }, eg2 = (e4, t4) => s3.some((r4) => r4 !== t4 && null !== r4.body && Math.hypot(r4.body.position.x - e4.x, r4.body.position.y - e4.y) < r4.reach + t4.reach), eb2 = (e4) => {
        let t4, i3 = r3.current, a4 = Math.sqrt(S2), n4 = g(b(i3.spin, 0.5), 0, 2), l4 = x(1.91 * e4.lane + 3.1 * q2), s4 = x(4.37 * e4.lane + 1.3 * q2), c3 = x(2.63 * e4.lane + 0.7 * q2), p2 = 0, u2 = 0;
        if (e4.entry) if (t4 = e4.entry, e4.grow) {
          let e5 = t4.x - H2.x, r4 = t4.y - H2.y, o3 = Math.hypot(e5, r4) || 1, n5 = E(i3), s5 = (2.4 + 2.6 * l4) * a4, d2 = j(i3) ? 3.2 * a4 : 0;
          p2 = e5 / o3 * s5 - n5.x * d2, u2 = r4 / o3 * s5 - n5.y * d2;
        } else {
          let e5 = E(i3);
          p2 = 0.5 * e5.x, u2 = 0.5 * e5.y;
        }
        else {
          let r4 = m2 ?? "top";
          t4 = ((e5, t5) => {
            var r5;
            let i5, o4, a5 = "top" === t5 || "bottom" === t5 ? f3 : v2, n6 = Math.max(1, Math.floor(a5 / Math.max(1.05 * k2, 1))), l5 = g((i5 = Math.floor((r5 = e5.lane) / n6), (o4 = `${n6}:${i5}:${q2}`) !== D2 && (D2 = o4, N2 = Array.from({ length: n6 }, (e6, t6) => t6).sort((e6, t6) => x(7.7 * e6 + q2 + 13.1 * i5) - x(7.7 * t6 + q2 + 13.1 * i5))), (N2[r5 % n6] + 0.5 + (x(9.7 * e5.lane + q2) - 0.5) * 0.55) * a5 / n6), Math.min(e5.reach, a5 / 2), Math.max(a5 / 2, a5 - e5.reach)), s5 = e5.reach + 2;
            for (let r6 = 0; r6 < 10; r6 += 1) {
              let r7 = eo2(t5, l5, s5);
              if (!eg2(r7, e5)) return r7;
              s5 += 2 * e5.reach + 4;
            }
            return eo2(t5, l5, s5);
          })(e4, r4);
          let i4 = "top" === r4 ? { x: 0, y: 1 } : "bottom" === r4 ? { x: 0, y: -1 } : "left" === r4 ? { x: 1, y: 0 } : { x: -1, y: 0 }, o3 = (1.6 + 1.4 * l4) * a4, n5 = (s4 - 0.5) * 1.4;
          p2 = i4.x * o3 - i4.y * n5, u2 = i4.y * o3 + i4.x * n5;
        }
        let h3 = (c3 - 0.5) * 1.1 * n4, y3 = ed2(e4, t4.x, t4.y, h3);
        d.Body.setVelocity(y3, { x: p2, y: u2 }), d.Body.setAngularVelocity(y3, (s4 - 0.5) * 0.12 * n4), d.Composite.add(o2.world, y3), e4.body = y3, e4.spawned = true, e4.px = t4.x, e4.py = t4.y, e4.pa = h3, e4.grow && !i3.reduced && (e4.scale = 0.2), e4.transform = "", eu2(e4, 1), e4.node.style.visibility = "visible";
      }, ex2 = () => s3.map((e4) => e4.index).sort((e4, t4) => x(3.7 * e4 + 1.37 * q2) - x(3.7 * t4 + 1.37 * q2)), ew2 = (e4, t4, r4) => {
        let i3 = "top" === t4 || "bottom" === t4 ? f3 : v2, o3 = 1.16 * k2, a4 = Math.max(1, Math.floor(i3 / Math.max(o3, 1)));
        e4.forEach((e5, n4) => {
          let l4 = s3[e5], d2 = n4 % a4, c3 = Math.floor(n4 / a4), p2 = g((d2 + 0.5 + (x(5.3 * n4 + q2) - 0.5) * 0.5) * i3 / a4, Math.min(l4.reach, i3 / 2), Math.max(i3 / 2, i3 - l4.reach));
          l4.entry = eo2(t4, p2, -(r4 - c3 * o3 - (x(2.9 * n4 + q2) - 0.5) * o3 * 0.3)), l4.lane = n4, l4.grow = false;
        });
      }, ev2 = (e4) => {
        let t4 = r3.current, i3 = E(t4), o3 = 0.08 * !!j(t4);
        H2 = { x: f3 / 2 - i3.x * f3 * o3, y: v2 / 2 - i3.y * v2 * o3 };
        let a4 = 0.58 * k2;
        e4.forEach((e5, t5) => {
          let r4 = s3[e5], i4 = 2.39996 * t5 + q2, o4 = a4 * Math.sqrt(t5 + 0.5);
          r4.entry = { x: g(H2.x + Math.cos(i4) * o4, r4.reach, Math.max(r4.reach, f3 - r4.reach)), y: g(H2.y + Math.sin(i4) * o4, r4.reach, Math.max(r4.reach, v2 - r4.reach)) }, r4.lane = t5;
        });
      }, eS2 = () => {
        let e4 = r3.current;
        for (let e5 of (P3 = true, q2 += 1, D2 = "", X2 && eV(true), s3)) e5.body && d.Composite.remove(o2.world, e5.body), e5.body = null, e5.spawned = false, e5.entry = null, e5.grow = false, e5.transform = "", e5.node.style.visibility = "hidden";
        if (e4.reduced || "none" === e4.entrance) {
          (() => {
            let e5 = r3.current, t5 = ex2(), i4 = j(e5);
            if (y2 = false, m2 = null, i4) {
              let e6 = "top" === i4 || "bottom" === i4 ? v2 : f3;
              el2(i4), ew2(t5, i4, e6 - 0.62 * k2);
            } else el2(null), ev2(t5);
            for (let e6 of t5) {
              let t6 = s3[e6];
              t6.grow = false, eb2(t6), t6.body && (d.Body.setVelocity(t6.body, { x: 0, y: 0 }), d.Body.setAngularVelocity(t6.body, 0));
            }
            o2.gravity.x = F(e5).x, o2.gravity.y = F(e5).y;
            for (let e6 = 0; e6 < 1400 && (d.Engine.update(o2, p), !(e6 > 120 && e6 % 20 == 0 && s3.every((e7) => !e7.body || e7.body.isSleeping))); e6 += 1) ;
            for (let t6 of (i4 && s3.every((e6) => ea2(e6, i4)) ? el2(es2(e5)) : i4 && (y2 = true, m2 = i4), s3)) t6.body && (t6.px = t6.body.position.x, t6.py = t6.body.position.y, t6.pa = t6.body.angle, t6.scale = em2(t6), eu2(t6, 1));
          })(), ef2();
          return;
        }
        let t4 = j(e4), i3 = ex2();
        if ("burst" === e4.entrance || !t4) {
          y2 = false, m2 = null, el2(es2(e4)), ev2(i3), i3.forEach((e5, t5) => {
            let r4 = s3[e5];
            r4.grow = true, r4.spawnAt = T2 + 16 * t5;
          }), ef2();
          return;
        }
        if (y2 = true, m2 = t4, el2(t4), "drop" === e4.entrance) {
          let e5 = "top" === t4 || "bottom" === t4 ? v2 : f3;
          for (let r4 of (ew2(i3, t4, 0.55 * e5), s3)) r4.spawnAt = T2;
        } else {
          let t5 = g(b(e4.stagger, 55), 0, 1e3);
          i3.forEach((e5, r4) => {
            let i4 = s3[e5];
            i4.entry = null, i4.grow = false, i4.lane = r4, i4.spawnAt = T2 + r4 * t5;
          });
        }
        ef2();
      }, ek = () => {
        P3 || L2 || !z2 || !V2 || f3 <= 0 || v2 <= 0 || s3.length && eS2();
      }, eM = () => s3.some((e4) => null !== e4.img && !e4.img.complete), eC = (e4) => {
        let t4 = e4.currentTarget;
        t4.naturalWidth > 0 && (t4.style.opacity = "1"), V2 || eM() || (V2 = true, ek());
      }, eF = (i3) => {
        let c3 = r3.current;
        X2 && eV(true);
        let p2 = Array.from(e3.querySelectorAll("[data-tw-item]")), u2 = new Map(s3.map((e4) => [e4.index, e4]));
        for (let e4 of s3) e4.body && d.Composite.remove(o2.world, e4.body);
        n3.clear(), s3 = p2.map((e4, t4) => {
          let r4 = u2.get(t4), i4 = { index: t4, node: e4, img: e4.querySelector("img"), kind: w(c3.shape, t4), label: e4.getAttribute("data-tw-label") ?? "", title: e4.getAttribute("data-tw-title") ?? "", w: 0, h: 0, corner: 0, reach: 0, inline: false, body: null, px: 0, py: 0, pa: 0, rx: 0, ry: 0, ra: 0, scale: r4?.scale ?? 1, spawned: false, spawnAt: r4?.spawnAt ?? 0, entry: r4?.entry ?? null, lane: r4?.lane ?? t4, grow: r4?.grow ?? false, transform: "", z: r4?.z ?? 0, mono: r4?.mono ?? false, mass: 0, flung: 0 };
          return n3.set(e4, i4), i4;
        }), U2 = U2 ? s3[U2.index] ?? null : null, _2 = _2 ? s3[_2.index] ?? null : null, Y2 = Y2 ? s3[Y2.index] ?? null : null, Z2 = null, t3.style.opacity = "0", (() => {
          let e4 = r3.current, t4 = g(b(e4.size, 116), 16, 480), i4 = g(b(e4.sizeVariance, 0.4), 0, 1), o3 = g(b(e4.fill, 0.4), 0.05, 0.85) * Math.max(1, f3) * Math.max(1, Math.min(v2, 1.4 * f3)), n4 = Math.max(24, 0.46 * Math.min(f3, v2)), l4 = s3.map((e5) => t4 * g(1 + i4 * (x(3.17 * e5.index + 0.41) - 0.5) * 0.9, 0.5, 1.5)), d2 = s3.map(() => null), c4 = (e5) => s3.map((r4, i5) => ec2(r4, l4[i5] * e5, t4, d2[i5])), p3 = (e5) => {
            let t5 = Math.sqrt(o3 / Math.max(1, e5.reduce((e6, t6, r4) => {
              let i5;
              return e6 + (i5 = s3[r4].kind, "circle" === i5 ? Math.PI * t6.w * t6.w / 4 : "chip" === i5 ? t6.w * t6.h - (4 - Math.PI) * t6.h * t6.h / 4 : t6.w * t6.h - (4 - Math.PI) * t6.corner * t6.corner);
            }, 0)));
            for (let r4 = 0; r4 < e5.length; r4 += 1) {
              let i5 = e5[r4];
              t5 = Math.min(t5, n4 / Math.max(1, "chip" === s3[r4].kind ? i5.h : Math.max(i5.w, i5.h))), "chip" === s3[r4].kind && (t5 = Math.min(t5, 0.9 * f3 / Math.max(1, i5.w)));
            }
            return t5;
          }, u3 = Math.min(1, p3(c4(1))), h4 = s3.some((e5) => "chip" === e5.kind);
          for (let e5 = 0; h4 && e5 < 3; e5 += 1) {
            let r4 = s3.map((e6, r5) => ec2(e6, l4[r5] * u3, t4, null));
            if (s3.forEach((e6, t5) => {
              "chip" === e6.kind && ep2(e6, r4[t5]);
            }), s3.forEach((e6, t5) => {
              d2[t5] = "chip" === e6.kind ? Math.ceil(b(parseFloat(a3.getComputedStyle(e6.node).width), e6.node.offsetWidth) + 0.5) : null;
            }), 2 === e5) break;
            let i5 = u3 * Math.min(1, p3(c4(u3)));
            if (i5 > 0.985 * u3) break;
            u3 = i5;
          }
          let m3 = c4(u3), y3 = 0;
          s3.forEach((t5, r4) => {
            let i5 = m3[r4], o4 = t5.node.style, a4 = "chip" === t5.kind ? Math.min(i5.w, 0.92 * f3) : i5.w;
            t5.w = a4, t5.h = i5.h, t5.corner = i5.corner, t5.reach = "circle" === t5.kind ? a4 / 2 : Math.hypot(a4, i5.h) / 2, t5.inline = "chip" === t5.kind || "polaroid" === e4.frame && "circle" !== t5.kind && e4.showTitles, o4.setProperty("--tw-w", `${a4.toFixed(2)}px`), o4.setProperty("--tw-h", `${i5.h.toFixed(2)}px`), o4.setProperty("--tw-fw", `${i5.fw.toFixed(2)}px`), o4.setProperty("--tw-b", `${i5.bottom.toFixed(2)}px`), o4.setProperty("--tw-f", `${i5.font.toFixed(2)}px`), o4.setProperty("--tw-p", `${i5.inset.toFixed(2)}px`), o4.setProperty("--tw-r", "circle" === t5.kind ? "50%" : `${i5.corner.toFixed(2)}px`), o4.setProperty("--tw-ri", "circle" === t5.kind ? "50%" : `${Math.max(1.5, i5.corner - i5.fw).toFixed(2)}px`), y3 += Math.max(a4, i5.h);
          }), k2 = s3.length ? y3 / s3.length : 80;
        })();
        let h3 = [];
        for (let e4 of s3) {
          let t4 = u2.get(e4.index);
          if (e4.node.style.zIndex = e4.z ? String(e4.z) : "", i3 && t4?.body && t4.spawned) {
            let r4 = en2(e4, t4.body.position.x, t4.body.position.y), i4 = ed2(e4, r4.x, r4.y, t4.body.angle);
            d.Body.setVelocity(i4, d.Body.getVelocity(t4.body)), d.Body.setAngularVelocity(i4, d.Body.getAngularVelocity(t4.body)), d.Composite.add(o2.world, i4), e4.body = i4, e4.spawned = true, e4.px = r4.x, e4.py = r4.y, e4.pa = t4.body.angle, e4.node.style.visibility = "visible", eu2(e4, 1);
          } else e4.node.style.visibility = "hidden", P3 && !(i3 && t4 && !t4.spawned) && h3.push(e4);
        }
        if (h3.length) {
          let e4 = j(c3), t4 = g(b(c3.stagger, 55), 0, 1e3);
          h3.forEach((r4, i4) => {
            r4.spawnAt = T2 + i4 * Math.max(t4, 24), r4.lane = s3.length + i4, e4 ? (r4.entry = null, r4.grow = false) : (r4.entry = ((e5) => {
              for (let t5 = 0; t5 < 16; t5 += 1) {
                let r5 = { x: e5.reach + x(3.3 * e5.index + 1.7 * t5 + q2) * Math.max(1, f3 - 2 * e5.reach), y: e5.reach + x(5.1 * e5.index + 2.3 * t5 + q2) * Math.max(1, v2 - 2 * e5.reach) };
                if (!eg2(r5, e5)) return r5;
              }
              return { x: f3 / 2, y: v2 / 2 };
            })(r4), r4.grow = true);
          }), e4 && (y2 = true, el2(m2 = m2 ?? e4));
        }
        for (let e4 of s3) {
          let t4 = e4.img;
          t4 && (l3.includes(t4) || (l3.push(t4), t4.addEventListener("load", eC), t4.addEventListener("error", eC)), t4.complete && t4.naturalWidth > 0 && (t4.style.opacity = "1"));
        }
        V2 || eM() || (V2 = true, ek()), ef2();
      }, ej = () => {
        let t4 = e3.clientWidth, r4 = e3.clientHeight;
        if (t4 <= 0 || r4 <= 0 || 0.5 > Math.abs(t4 - f3) && 0.5 > Math.abs(r4 - v2)) return false;
        S2 = g(Math.min(f3 = t4, v2 = r4) / 560, 0.45, 1.6), c2 && d.Composite.remove(o2.world, Object.values(c2));
        let i3 = 7 * f3 + 1280, a4 = 7 * v2 + 1280, n4 = { isStatic: true, friction: 1, restitution: 0 };
        for (let e4 of (c2 = { top: d.Bodies.rectangle(f3 / 2, -320, i3, 640, n4), bottom: d.Bodies.rectangle(f3 / 2, v2 + 320, i3, 640, n4), left: d.Bodies.rectangle(-320, v2 / 2, 640, a4, n4), right: d.Bodies.rectangle(f3 + 320, v2 / 2, 640, a4, n4) }, u)) e4 !== h2 && d.Composite.add(o2.world, c2[e4]);
        return true;
      }, eE = (e4) => {
        let t4 = r3.current;
        e4.body && d.Composite.remove(o2.world, e4.body), e4.body = null, e4.spawned = false, e4.entry = null, e4.grow = false, e4.node.style.visibility = "hidden", e4.spawnAt = T2, y2 = true, el2(m2 = j(t4) ?? "top");
      }, eA = (e4) => {
        for (let e5 of (T2 += p, s3)) !e5.spawned && e5.spawnAt <= T2 && eb2(e5);
        for (let e5 of s3) {
          let t5 = e5.body;
          t5 && (e5.px = t5.position.x, e5.py = t5.position.y, e5.pa = t5.angle);
        }
        let t4 = F(e4);
        o2.gravity.x = t4.x, o2.gravity.y = t4.y;
        let r4 = e4.reduced ? 0 : g(b(e4.drift, 0), 0, 2);
        if (r4 > 0) {
          let e5 = T2, t5 = 4e-5 * r4 * S2;
          for (let r5 of s3) {
            let i4 = r5.body;
            if (!i4) continue;
            let o3 = 1.73 * r5.index;
            d.Body.applyForce(i4, i4.position, { x: i4.mass * t5 * (Math.sin(71e-5 * e5 + o3) + 0.5 * Math.sin(13e-4 * e5 + 2.1 * o3)), y: i4.mass * t5 * (Math.cos(63e-5 * e5 + 1.4 * o3) + 0.5 * Math.cos(11e-4 * e5 + 0.7 * o3)) });
          }
        }
        X2?.piece.body && d.Sleeping.set(X2.piece.body, false), d.Engine.update(o2, p);
        let i3 = 38 * Math.sqrt(S2) + 8, a4 = 24 * Math.sqrt(S2) + 4;
        for (let e5 of s3) {
          let t5 = e5.body;
          if (!t5 || t5.isSleeping) continue;
          let r5 = e5.flung > T2 || X2?.piece === e5 ? i3 : a4;
          if (!Number.isFinite(t5.position.x) || !Number.isFinite(t5.position.y) || t5.position.x < -(2.5 * f3) || t5.position.x > 3.5 * f3 || t5.position.y < -(2.5 * v2) || t5.position.y > 3.5 * v2) {
            eE(e5);
            continue;
          }
          if ("circle" === e5.kind) {
            let e6 = d.Body.getAngularVelocity(t5);
            0 !== e6 && d.Body.setAngularVelocity(t5, 0.996 * e6);
          }
          let o3 = d.Body.getSpeed(t5);
          if (o3 > r5) {
            let e6 = d.Body.getVelocity(t5);
            d.Body.setVelocity(t5, { x: e6.x * r5 / o3, y: e6.y * r5 / o3 });
          }
        }
        if (y2 && m2 && s3.every((e5) => e5.spawned)) {
          let e5 = m2;
          s3.every((t5) => ea2(t5, e5)) && (y2 = false, m2 = null);
        }
        el2(es2(e4));
      }, eB = (e4) => {
        if (L2 || !I2 || document.hidden) return false;
        if (X2) return true;
        for (let e5 of s3) if (e5.spawned && Math.abs(em2(e5) - e5.scale) > 6e-4) return true;
        return !e4.paused && !!P3 && (!!(s3.some((e5) => !e5.spawned) || !e4.reduced && b(e4.drift, 0) > 0) || s3.some((e5) => null !== e5.body && !e5.body.isSleeping));
      }, eP = (e4) => {
        if (W2 = 0, L2) return;
        let t4 = R2 && e4 - R2 < 100 ? Math.min(Math.max((e4 - R2) / 1e3, 0), 0.05) : 1 / 60;
        R2 = e4;
        let i3 = r3.current, o3 = 1;
        if (!i3.paused && P3) {
          $2 += 1e3 * t4;
          let e5 = 0;
          for (; $2 >= p && e5 < 6; ) eA(i3), $2 -= p, e5 += 1;
          e5 >= 6 && ($2 = 0), o3 = $2 / p;
        }
        let a4 = i3.reduced ? 1 : 1 - Math.exp(-(15 * t4));
        for (let e5 of s3) {
          if (!e5.spawned) continue;
          let t5 = em2(e5), r4 = t5 - e5.scale;
          e5.scale = 6e-4 > Math.abs(r4) ? t5 : e5.scale + r4 * a4;
        }
        for (let e5 of s3) e5.spawned && eu2(e5, o3);
        if (eh2(), eB(i3)) W2 = requestAnimationFrame(eP);
        else {
          for (let e5 of (R2 = 0, $2 = 0, s3)) e5.spawned && eu2(e5, 1);
          eh2();
        }
      };
      function ez() {
        !W2 && eB(r3.current) && (W2 = requestAnimationFrame(eP));
      }
      function eV(t4) {
        let i3 = X2;
        if (!i3) return;
        X2 = null, i3.constraint && d.Composite.remove(o2.world, i3.constraint);
        let a4 = i3.piece, n4 = a4.body, l4 = r3.current;
        if (n4 && a4.mass > 0 && d.Body.setMass(n4, a4.mass), a4.node.style.removeProperty("--tw-lift"), a4.node.style.cursor = "", e3.style.cursor = "", n4 && (d.Sleeping.set(n4, false), !t4 && i3.moved && !l4.paused)) if (l4.reduced) d.Body.setVelocity(n4, { x: 0, y: 0 }), d.Body.setAngularVelocity(n4, 0);
        else {
          let e4 = g(b(l4.throwStrength, 1), 0, 3), t5 = d.Body.getVelocity(n4), r4 = t5.x * e4, i4 = t5.y * e4, o3 = Math.hypot(r4, i4), s4 = 34 * Math.sqrt(S2) + 8;
          o3 > s4 && (r4 *= s4 / o3, i4 *= s4 / o3), d.Body.setVelocity(n4, { x: r4, y: i4 }), d.Body.setAngularVelocity(n4, g(d.Body.getAngularVelocity(n4) * Math.min(1, e4), -0.32, 0.32)), a4.flung = T2 + 700;
        }
        i3.moved && (ee2 = true, window.setTimeout(() => {
          ee2 = false;
        }, 0)), e3.hasPointerCapture(i3.id) && e3.releasePointerCapture(i3.id), ey2(a4, U2 === a4 || _2 === a4), ef2();
      }
      let eI = (e4) => {
        let t4 = r3.current, i3 = e4.body, o3 = g(b(t4.popForce, 1), 0, 3);
        if (!i3 || t4.reduced || t4.paused || o3 <= 0) return;
        let a4 = E(t4), n4 = d.Body.getVelocity(i3), l4 = 6.4 * o3 * Math.sqrt(S2), s4 = (x(0.37 * T2 + e4.index) - 0.5) * 2.4 * Math.sqrt(S2);
        d.Body.setVelocity(i3, { x: 0.3 * n4.x - a4.x * l4 - a4.y * s4, y: 0.3 * n4.y - a4.y * l4 + a4.x * s4 }), d.Body.setAngularVelocity(i3, (x(0.11 * T2 + 1.3 * e4.index) - 0.5) * 0.16 * o3), d.Sleeping.set(i3, false), ez();
      }, eL = (e4, t4, i3) => {
        let o3 = r3.current;
        if (o3.reduced || o3.paused || !(i3 > 0)) return;
        let a4 = E(o3), n4 = 2.8 * k2;
        for (let r4 of s3) {
          let o4 = r4.body;
          if (!o4 || !r4.spawned) continue;
          let l4 = o4.position.x - e4, s4 = o4.position.y - t4, c3 = Math.max(0, Math.hypot(l4, s4) - 0.8 * r4.reach);
          if (c3 > n4) continue;
          let p2 = (1 - c3 / n4) ** 1.5, u2 = g((-(l4 * a4.y) + s4 * a4.x) / n4, -1, 1), h3 = -a4.x - a4.y * u2 * 1.2, m3 = -a4.y + a4.x * u2 * 1.2, y3 = Math.hypot(h3, m3) || 1, f4 = 11 * i3 * Math.sqrt(S2) * p2, b2 = d.Body.getVelocity(o4);
          d.Body.setVelocity(o4, { x: 0.4 * b2.x + h3 / y3 * f4, y: 0.4 * b2.y + m3 / y3 * f4 }), d.Body.setAngularVelocity(o4, d.Body.getAngularVelocity(o4) + u2 * p2 * 0.12 * i3), d.Sleeping.set(o4, false);
        }
        ez();
      }, eT = (t4) => {
        if (!t4.isPrimary || X2 || "mouse" === t4.pointerType && 0 !== t4.button) return;
        let i3 = r3.current, a4 = er2(t4.target), n4 = ei2(t4);
        if (a4 && a4.body && a4.spawned && i3.draggable) {
          let r4 = a4.body;
          a4.z = O2 += 1, a4.node.style.zIndex = String(O2 + 1);
          let l4 = null;
          i3.paused || (l4 = d.Constraint.create({ pointA: { x: n4.x, y: n4.y }, bodyB: r4, pointB: { x: n4.x - r4.position.x, y: n4.y - r4.position.y }, length: 0, stiffness: g(b(i3.dragStiffness, 0.2), 0.02, 0.9), damping: 0.08 }), d.Composite.add(o2.world, l4)), d.Sleeping.set(r4, false), a4.mass = r4.mass, d.Body.setMass(r4, 0.3 * r4.mass), X2 = { id: t4.pointerId, piece: a4, constraint: l4, ox: n4.x - r4.position.x, oy: n4.y - r4.position.y, sx: n4.x, sy: n4.y, time: performance.now(), moved: false, touch: "mouse" !== t4.pointerType }, G2 = null, a4.node.style.setProperty("--tw-lift", "1"), a4.node.style.cursor = "grabbing", e3.style.cursor = "grabbing", e3.setPointerCapture(t4.pointerId), ef2();
          return;
        }
        G2 = { id: t4.pointerId, x: n4.x, y: n4.y, time: performance.now() }, K2 = a4 && a4.spawned ? a4 : null;
      }, eW = (e4) => {
        Y2 = e4, window.clearTimeout(J2), J2 = window.setTimeout(() => {
          Y2 === e4 && (Y2 = null, ef2());
        }, 1600), ef2();
      }, eR = (e4) => {
        let t4 = X2;
        if (t4 && e4.pointerId === t4.id) {
          let r5 = ei2(e4);
          !t4.moved && Math.hypot(r5.x - t4.sx, r5.y - t4.sy) > 6 && (t4.moved = true);
          let i4 = g(r5.x, 0, f3), o3 = g(r5.y, 0, v2), a4 = t4.piece.body;
          if (t4.constraint) t4.constraint.pointA = { x: i4, y: o3 }, a4 && d.Sleeping.set(a4, false);
          else if (a4) {
            let e5 = en2(t4.piece, i4 - t4.ox, o3 - t4.oy);
            d.Body.setPosition(a4, e5), d.Body.setVelocity(a4, { x: 0, y: 0 }), t4.piece.px = e5.x, t4.piece.py = e5.y, eu2(t4.piece, 1), eh2();
          }
          ez();
          return;
        }
        if (G2 && e4.pointerId === G2.id) {
          let t5 = ei2(e4);
          Math.hypot(t5.x - G2.x, t5.y - G2.y) > 8 && (G2 = null);
        }
        if ("touch" === e4.pointerType) return;
        let r4 = er2(e4.target), i3 = r4 && r4.spawned ? r4 : null;
        i3 !== U2 && (U2 && ey2(U2, _2 === U2), U2 = i3, i3 && ey2(i3, true), ef2());
      }, e$ = (e4) => {
        let t4 = X2;
        if (t4 && e4.pointerId === t4.id) {
          let e5 = !t4.moved && performance.now() - t4.time < 450;
          eV(false), e5 && (eI(t4.piece), t4.touch && eW(t4.piece));
          return;
        }
        let i3 = G2;
        if (i3 && e4.pointerId === i3.id) {
          if (G2 = null, performance.now() - i3.time > 600) return;
          K2 ? (eI(K2), "mouse" !== e4.pointerType && eW(K2)) : eL(i3.x, i3.y, g(b(r3.current.popForce, 1), 0, 3));
        }
      }, eq = (e4) => {
        X2 && e4.pointerId === X2.id && eV(true), G2 && e4.pointerId === G2.id && (G2 = null);
      }, eO = (e4) => {
        "touch" !== e4.pointerType && !X2 && U2 && (ey2(U2, _2 === U2), U2 = null, ef2());
      }, eD = (e4) => {
        let t4 = et2(e4.target);
        if (!t4) return;
        if (ee2) {
          ee2 = false, e4.preventDefault();
          return;
        }
        let r4 = n3.get(t4);
        r4 && (0 === e4.detail && eI(r4), i2.current(r4.index));
      }, eN = (e4) => {
        if ("Escape" === e4.key && X2) return void eV(true);
        let t4 = er2(e4.target);
        if (!t4) return;
        let i3 = "ArrowLeft" === e4.key ? [-1, 0] : "ArrowRight" === e4.key ? [1, 0] : "ArrowUp" === e4.key ? [0, -1] : "ArrowDown" === e4.key ? [0, 1] : null;
        i3 && (e4.preventDefault(), ((e5, t5, i4) => {
          let o3 = r3.current, a4 = e5.body;
          if (!a4) return;
          if (o3.paused || o3.reduced) {
            let r4 = 18 * Math.sqrt(S2), o4 = en2(e5, a4.position.x + t5 * r4, a4.position.y + i4 * r4);
            d.Body.setPosition(a4, o4), d.Body.setVelocity(a4, { x: 0, y: 0 }), e5.px = o4.x, e5.py = o4.y, eu2(e5, 1), eh2(), d.Sleeping.set(a4, false), ez();
            return;
          }
          let n4 = d.Body.getVelocity(a4), l4 = 5.5 * Math.sqrt(S2);
          d.Body.setVelocity(a4, { x: n4.x + t5 * l4, y: n4.y + i4 * l4 * (i4 < 0 ? 1.35 : 1) }), d.Body.setAngularVelocity(a4, d.Body.getAngularVelocity(a4) + 0.04 * t5), d.Sleeping.set(a4, false), ez();
        })(t4, i3[0], i3[1]));
      }, eH = (e4) => {
        let t4 = et2(e4.target), r4 = t4 ? n3.get(t4) : void 0;
        if (!t4 || !r4) return;
        let i3 = true;
        try {
          i3 = t4.matches(":focus-visible");
        } catch {
          i3 = true;
        }
        i3 && (t4.style.outline = "2px solid currentColor", t4.style.outlineOffset = "3px", _2 = r4, ey2(r4, true), ef2());
      }, eX = (e4) => {
        let t4 = et2(e4.target);
        if (!t4) return;
        t4.style.outline = "", t4.style.outlineOffset = "";
        let r4 = n3.get(t4);
        r4 && _2 === r4 && (_2 = null, ey2(r4, U2 === r4), ef2());
      }, eG = () => {
        (e3.scrollTop || e3.scrollLeft) && (e3.scrollTop = 0, e3.scrollLeft = 0);
      }, eU = () => {
        X2 && eV(true);
      }, e_ = () => {
        R2 = 0, ez();
      }, eY = () => {
        z2 || (z2 = true, V2 || (Q2 = window.setTimeout(() => {
          V2 = true, ek();
        }, 1500)), ek());
      }, eK = new ResizeObserver(() => {
        ej() && (eF(true), ek(), ez());
      }), eZ = new IntersectionObserver((e4) => {
        for (let t4 of e4) I2 = t4.isIntersecting, t4.isIntersecting && (t4.intersectionRatio >= 0.15 || t4.intersectionRect.height > (t4.rootBounds?.height ?? window.innerHeight) * 0.3) && eY();
        ez();
      }, { threshold: [0, 0.05, 0.15, 0.3, 0.6] });
      e3.addEventListener("pointerdown", eT), e3.addEventListener("pointermove", eR), e3.addEventListener("pointerup", e$), e3.addEventListener("pointercancel", eq), e3.addEventListener("lostpointercapture", eq), e3.addEventListener("pointerleave", eO), e3.addEventListener("click", eD), e3.addEventListener("keydown", eN), e3.addEventListener("focusin", eH), e3.addEventListener("focusout", eX), e3.addEventListener("scroll", eG), a3.addEventListener("blur", eU), document.addEventListener("visibilitychange", e_), ej(), A2 = M(r3.current), B2 = C(r3.current), eF(false), eK.observe(e3), eZ.observe(e3);
      let eJ = () => {
        !L2 && s3.some((e4) => "chip" === e4.kind) && eF(true);
      };
      return e3.ownerDocument.fonts?.addEventListener("loadingdone", eJ), e3.ownerDocument.fonts?.ready.then(eJ), { sync: () => {
        let e4 = r3.current, t4 = M(e4);
        t4 !== A2 && (A2 = t4, eF(true), ek());
        let i3 = C(e4);
        i3 !== B2 && (B2 = i3, (() => {
          let e5 = r3.current, t5 = g(b(e5.bounce, 0.3), 0, 0.95), i4 = g(b(e5.friction, 0.3), 0, 1), o3 = g(b(e5.airFriction, 0.012), 0, 0.2);
          for (let e6 of s3) {
            let r4 = e6.body;
            r4 && (r4.restitution = t5, r4.friction = i4, r4.frictionAir = o3, d.Sleeping.set(r4, false));
          }
          e5.paused && X2?.constraint && eV(true), el2(es2(e5));
        })()), ef2();
      }, drop: () => {
        z2 && V2 && (eS2(), ez());
      }, shake: (e4 = 1) => ((e5) => {
        let t4 = r3.current;
        if (t4.reduced || t4.paused || !(e5 > 0)) return;
        let i3 = E(t4), o3 = g(e5, 0, 3) * Math.sqrt(S2);
        for (let e6 of s3) {
          let t5 = e6.body;
          if (!t5) continue;
          let r4 = d.Body.getVelocity(t5), a4 = (x(4.1 * e6.index + 0.01 * T2) - 0.5) * 7 * o3, n4 = (3.5 + 4.5 * x(2.2 * e6.index + 0.02 * T2)) * o3;
          d.Body.setVelocity(t5, { x: r4.x + a4 - i3.x * n4, y: r4.y - i3.y * n4 + i3.x * a4 * 0.2 }), d.Body.setAngularVelocity(t5, d.Body.getAngularVelocity(t5) + (x(6.7 * e6.index + T2) - 0.5) * 0.2 * o3), d.Sleeping.set(t5, false);
        }
        ez();
      })(e4), pop: (e4, t4, i3) => eL(e4, t4, g(b(i3 ?? r3.current.popForce, 1), 0, 3)), destroy: () => {
        for (let t4 of (L2 = true, cancelAnimationFrame(W2), window.clearTimeout(J2), window.clearTimeout(Q2), eK.disconnect(), eZ.disconnect(), e3.removeEventListener("pointerdown", eT), e3.removeEventListener("pointermove", eR), e3.removeEventListener("pointerup", e$), e3.removeEventListener("pointercancel", eq), e3.removeEventListener("lostpointercapture", eq), e3.removeEventListener("pointerleave", eO), e3.removeEventListener("click", eD), e3.removeEventListener("keydown", eN), e3.removeEventListener("focusin", eH), e3.removeEventListener("focusout", eX), e3.removeEventListener("scroll", eG), a3.removeEventListener("blur", eU), document.removeEventListener("visibilitychange", e_), e3.ownerDocument.fonts?.removeEventListener("loadingdone", eJ), l3)) t4.removeEventListener("load", eC), t4.removeEventListener("error", eC);
        X2?.constraint && d.Composite.remove(o2.world, X2.constraint), X2 = null, d.Composite.clear(o2.world, false), d.Engine.clear(o2), s3 = [], n3.clear();
      } };
    })(e2, t2, ey, ef);
    return es.current = r2, () => {
      r2.destroy(), es.current = null;
    };
  }, []), (0, o.useImperativeHandle)(eo, () => ({ drop: () => es.current?.drop(), shake: (e2) => es.current?.shake(e2), pop: (e2, t2, r2) => es.current?.pop(e2, t2, r2) }), []);
  let eg = I.trim().toLowerCase(), eb = g(b(L, 0.5), 0, 1), ex = `color-mix(in oklch, ${V} 12%, transparent)`, ew = { display: "block", width: "100%", height: "100%", objectFit: "cover", opacity: 0, transition: "opacity 0.5s ease, filter 0.45s ease", filter: W ? "grayscale(var(--tw-mono, 1))" : void 0, pointerEvents: "none", userSelect: "none" }, ev = { position: "absolute", inset: 0, zIndex: -1, borderRadius: "inherit", boxShadow: (ea = Math.max(eb, 0.4), `0 22px 40px -12px rgb(0 0 0 / ${(0.42 * ea).toFixed(3)}), 0 8px 16px -6px rgb(0 0 0 / ${(0.2 * ea).toFixed(3)})`), opacity: "var(--tw-lift, 0)", transition: "opacity 0.3s ease", pointerEvents: "none" }, eS = [];
  for (let t2 = 0; t2 < ep; t2 += 1) {
    let r2 = e[t2 % e.length], o2 = w(eu, t2), a3 = r2.title ?? r2.alt ?? "", n3 = [r2.title, r2.alt].filter(Boolean).join(", ") || `Item ${t2 + 1}`, l3 = "chip" === o2, s3 = !l3 && "none" !== eh, d2 = "polaroid" === eh && "circle" !== o2 && T && r2.title, c2 = { position: "absolute", left: 0, top: 0, boxSizing: "border-box", display: l3 ? "flex" : "block", alignItems: l3 ? "center" : void 0, gap: l3 && r2.src ? "calc(var(--tw-f, 13px) * 0.62)" : void 0, width: l3 ? "var(--tw-w, max-content)" : "var(--tw-w, 0px)", height: "var(--tw-h, 0px)", margin: 0, padding: l3 ? r2.src ? "0 calc(var(--tw-f, 13px) * 1.1) 0 var(--tw-p, 4px)" : "0 calc(var(--tw-f, 13px) * 1.1) 0 calc(var(--tw-f, 13px) * 1.15)" : s3 ? "var(--tw-fw, 0px) var(--tw-fw, 0px) var(--tw-b, 0px)" : 0, border: 0, borderRadius: "var(--tw-r, 0px)", background: l3 || s3 ? z : "none", color: "inherit", font: "inherit", fontSize: l3 ? "var(--tw-f, 13px)" : void 0, fontWeight: l3 ? 500 : void 0, lineHeight: l3 ? 1 : void 0, letterSpacing: l3 ? "-0.01em" : void 0, whiteSpace: l3 ? "nowrap" : void 0, textAlign: "left", textDecoration: "none", cursor: _ ? "grab" : "pointer", touchAction: "none", userSelect: "none", WebkitUserSelect: "none", WebkitTapHighlightColor: "transparent", visibility: "hidden", willChange: "transform", boxShadow: A(eb) }, p2 = l3 ? (0, i.jsxs)(i.Fragment, { children: [r2.src ? (0, i.jsx)("span", { style: { position: "relative", flex: "none", width: "calc(var(--tw-h, 40px) - var(--tw-p, 4px) * 2)", height: "calc(var(--tw-h, 40px) - var(--tw-p, 4px) * 2)", borderRadius: "50%", overflow: "hidden", background: ex, pointerEvents: "none" }, children: (0, i.jsx)("img", { src: r2.src, alt: "", draggable: false, decoding: "async", style: ew }) }) : null, (0, i.jsx)("span", { style: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", color: V, pointerEvents: "none" }, children: a3 }), (0, i.jsx)("span", { "aria-hidden": "true", style: ev })] }) : (0, i.jsxs)(i.Fragment, { children: [(0, i.jsxs)("span", { style: { position: "relative", display: "block", width: "100%", height: "100%", overflow: "hidden", borderRadius: "var(--tw-ri, 0px)", background: r2.src ? "color-mix(in oklch, currentColor 10%, transparent)" : z, pointerEvents: "none" }, children: [r2.src ? (0, i.jsx)("img", { src: r2.src, alt: "", draggable: false, decoding: "async", style: ew }) : (0, i.jsx)("span", { style: { display: "grid", placeItems: "center", width: "100%", height: "100%", padding: "0 10%", boxSizing: "border-box", color: V, fontSize: "calc(var(--tw-w, 100px) * 0.12)", fontWeight: 500, lineHeight: 1.15, textAlign: "center" }, children: a3 }), "none" === eh ? (0, i.jsx)("span", { "aria-hidden": "true", style: { position: "absolute", inset: 0, borderRadius: "inherit", boxShadow: "inset 0 0 0 1px color-mix(in oklch, currentColor 14%, transparent)" } }) : null] }), d2 ? (0, i.jsx)("span", { style: { position: "absolute", left: "var(--tw-fw, 0px)", right: "var(--tw-fw, 0px)", bottom: 0, height: "var(--tw-b, 0px)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", color: V, opacity: 0.72, fontSize: "var(--tw-f, 12px)", fontWeight: 500, letterSpacing: "-0.01em", whiteSpace: "nowrap", pointerEvents: "none" }, children: r2.title }) : null, (0, i.jsx)("span", { "aria-hidden": "true", style: ev })] }), u2 = { "data-tw-item": t2, "data-tw-title": r2.title ?? "", "data-tw-label": l3 ? a3 : void 0, "aria-label": n3, "aria-describedby": ec, draggable: false, style: c2 };
    eS.push(r2.href ? (0, i.jsx)("a", { href: r2.href, ...u2, children: p2 }, t2) : (0, i.jsx)("button", { type: "button", ...u2, children: p2 }, t2));
  }
  return (0, i.jsxs)("div", { role: "group", "aria-label": ee, className: (0, c.cn)("tw-root", er), style: { backgroundColor: "transparent" === eg || "" === eg ? void 0 : I, ...ei }, children: [(0, i.jsx)("div", { ref: en, style: { position: "absolute", inset: 0, zIndex: 0, overflow: "hidden", touchAction: "pan-y" }, children: eS }), (0, i.jsx)("div", { ref: el, "aria-hidden": "true", style: { position: "absolute", left: 0, top: 0, zIndex: 1, padding: "5px 9px", borderRadius: 8, background: z, color: V, fontSize: 12, lineHeight: "16px", fontWeight: 500, letterSpacing: "-0.005em", whiteSpace: "nowrap", pointerEvents: "none", opacity: 0, transition: "opacity 0.18s ease", boxShadow: "0 6px 18px -6px rgb(0 0 0 / 0.35)", willChange: "transform, opacity" } }), (0, i.jsx)("span", { id: ec, style: B, children: _ ? "Drag to throw. Arrow keys nudge." : "Arrow keys nudge." })] });
});
P.displayName = "TumbleWall";
var TumbleWall_raw_default = P;
export {
  TumbleWall_raw_default as default
};
