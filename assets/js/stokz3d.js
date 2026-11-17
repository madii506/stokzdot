// STOKZ home: the city is the stock market. The opening bell: the camera cranes down over the grid while
// the towers rise in a wave out of downtown, windows switch on floor by floor, and the listed towers light
// LED ticker bands and crowns in their stock's colour while two facade screens flip through live quotes.
// One instanced draw for every tower piece, one for all the LEDs, one ground plane, one sky.
import * as THREE from 'three';

const HASH = `float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }`;
const FOG = `uniform vec3 uCam; uniform vec3 uFogLo; uniform vec3 uFogHi; uniform float uFogD;
vec3 fogCol(float y){ return mix(uFogLo, uFogHi, smoothstep(0.0, 760.0, y)); }
float fogAmt(vec3 w){ float d = length(w - uCam); return 1.0 - exp(-pow(d / uFogD, 2.0)); }`;
const OUT = `#include <tonemapping_fragment>
#include <colorspace_fragment>`;
const AVE0 = 65, AVE = 130, STR = 95;   // avenues at 65 + k*130 (x), streets every 95 (z)

// ------------------------------------------------ towers: bodies, setbacks, spires, rooftop gear
const T_VERT = `
attribute vec4 aBox;   // delay, seed, height, layer
attribute vec4 aKind;  // kind (0 body, 1 setback, 2 spire, 3 gear), facade, base y, -
varying vec3 vW; varying vec3 vN; varying float vSeed; varying float vTop; varying float vDelay; varying float vKind; varying float vType; varying float vHf; varying float vBase;
uniform float uTime; uniform float uRise;
float ease(float t){ t = clamp(t, 0.0, 1.0); return 1.0 - pow(1.0 - t, 3.0); }
void main(){
  float kind = aKind.x;
  float k = uRise < 0.0 ? 1.0 : ease((uTime - aBox.x) / (kind > 0.5 ? 0.7 : 1.6));
  vec3 p = position;
  if (kind > 1.5 && kind < 2.5) p.xz *= 1.0 - 0.8 * p.y;
  if (kind > 2.5) p *= k; else p.y *= max(k, 0.002);
  if (kind > 0.5 && k <= 0.0) p *= 0.0;
  vec4 w = modelMatrix * instanceMatrix * vec4(p, 1.0);
  vW = w.xyz; vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
  vSeed = aBox.y; vTop = aKind.z + aBox.z * max(k, 0.002); vDelay = aBox.x; vKind = kind; vType = aKind.y; vHf = aBox.z; vBase = aKind.z;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const T_FRAG = `
precision highp float;
varying vec3 vW; varying vec3 vN; varying float vSeed; varying float vTop; varying float vDelay; varying float vKind; varying float vType; varying float vHf; varying float vBase;
uniform float uTime; uniform float uRise; uniform vec3 uSky;
${HASH}
${FOG}
void main(){
  vec3 n = normalize(vN);
  float side = abs(n.y) < 0.5 ? 1.0 : 0.0;
  float hy = clamp((vW.y - vBase) / max(vHf, 1.0), 0.0, 1.0);
  vec3 col = mix(vec3(0.006, 0.0045, 0.014), vec3(0.024, 0.015, 0.044), clamp(vW.y / 720.0, 0.0, 1.0));
  vec3 lights = vec3(0.0);
  if (vKind < 1.5 && side > 0.5) {
    float u = abs(n.x) > 0.5 ? vW.z : vW.x;
    float t = vType;
    vec2 cs = t < 0.5 ? vec2(6.0, 7.5) : t < 1.5 ? vec2(3.6, 6.0) : vec2(5.0, 6.4);
    vec2 g = vec2(u, vW.y) / cs, cell = floor(g), f = fract(g);
    float win = t < 0.5 ? step(0.2, f.x) * step(f.x, 0.8) * step(0.3, f.y) * step(f.y, 0.8)
              : t < 1.5 ? step(0.12, f.x) * step(f.x, 0.94) * step(0.14, f.y) * step(f.y, 0.9)
              : step(0.27, f.x) * step(f.x, 0.73) * step(0.3, f.y) * step(f.y, 0.78);
    float r = h21(cell + vSeed * 17.0);
    float fl = h21(vec2(cell.y, vSeed * 31.0));
    float dens = t < 0.5 ? 0.12 : t < 1.5 ? 0.035 : 0.2;
    float lit = step(r, dens + 0.05 * sin(vSeed * 6.0));
    if (t < 1.5 && fl < 0.1) lit = step(r, 0.82);            // a whole floor working late
    lit = clamp(lit - step(0.988, h21(cell * 1.7 + floor(uTime * 0.6 + r * 20.0))), 0.0, 1.0);
    float on = uRise < 0.0 ? 1.0 : step(vDelay + 1.2 + hy * 0.9 + r * 0.45, uTime);
    vec3 wc = r < 0.03 ? vec3(0.45, 1.0, 0.7) : r < 0.05 ? vec3(1.0, 0.42, 0.72) : (t > 0.5 && t < 1.5) ? vec3(0.72, 0.84, 1.0) : vec3(1.0, 0.74, 0.44);
    lights = win * lit * on * step(vW.y, vTop - 2.0) * wc * (0.8 + 0.35 * r);
    if (t > 0.5 && t < 1.5) {
      // glass curtain: dark mullions and the dusk sliding up the glass
      float glass = step(0.12, f.x) * step(f.x, 0.94);
      col = mix(col, mix(vec3(0.012, 0.008, 0.03), vec3(0.06, 0.022, 0.07), hy * hy), 0.75 * glass);
    } else {
      col *= 0.82 + 0.18 * step(0.3, f.y);    // spandrels between floors
    }
  }
  if (n.y > 0.5) col = mix(col, uSky, 0.2);
  // the roof edge catches the last of the sky
  col += vec3(0.32, 0.1, 0.18) * smoothstep(vTop - 1.4, vTop - 0.2, vW.y) * side * 0.4;
  float d = length(vW - uCam);
  float fa = clamp(fogAmt(vW) + exp(-max(vW.y, 0.0) / 150.0) * smoothstep(450.0, 2300.0, d) * 0.55, 0.0, 0.93);
  gl_FragColor = vec4(mix(col, fogCol(vW.y), fa) + lights * (1.0 - fa * 0.72), 1.0);
  ${OUT}
}`;

// ------------------------------------------------ LEDs: ticker bands, crowns, quote screens
const L_VERT = `
attribute vec4 aB;   // appear time, width, depth, height
attribute vec4 aL;   // line or slot offset, length in columns, mode (0 ticker, 1 crown, 2 screen), columns per second
attribute vec3 aC;   // crown colour
varying vec2 vS; varying vec2 vUV; varying float vFace; varying float vFront; varying vec3 vW; varying vec4 vL; varying vec3 vC; varying float vOn; varying float vH;
uniform float uTime; uniform float uRise;
void main(){
  vec3 p = position; float w = aB.y, d = aB.z, s;
  // perimeter coordinate, left to right as seen from outside, seam on the hidden back corner
  if (normal.x < -0.5) s = (p.z + 0.5) * d;
  else if (normal.z > 0.5) s = d + (p.x + 0.5) * w;
  else if (normal.x > 0.5) s = d + w + (0.5 - p.z) * d;
  else s = 2.0 * d + w + (0.5 - p.x) * w;
  vS = vec2(s, p.y + 0.5); vUV = p.xy + 0.5; vFace = abs(normal.y) > 0.5 ? 1.0 : 0.0; vFront = normal.z > 0.5 ? 1.0 : 0.0; vH = aB.w;
  vOn = uRise < 0.0 ? 99.0 : uTime - aB.x;
  if (vOn < 0.0) p *= 0.0;
  vL = aL; vC = aC;
  vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0); vW = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const L_FRAG = `
precision highp float;
varying vec2 vS; varying vec2 vUV; varying float vFace; varying float vFront; varying vec3 vW; varying vec4 vL; varying vec3 vC; varying float vOn; varying float vH;
uniform sampler2D uMap; uniform vec2 uMapSize; uniform sampler2D uScr; uniform float uScrN; uniform float uScrH; uniform float uTime;
${HASH}
${FOG}
void main(){
  vec3 col = vec3(0.005, 0.0035, 0.01);
  float lit = 0.0; vec3 lc = vec3(0.0); vec2 g = vec2(0.0); bool led = false;
  if (vL.z > 1.5) {
    // a quote screen: big symbol, price, change; flips to the next listing every few seconds, top row first
    if (vFront > 0.5) {
      led = true; g = vec2(vUV.x * 64.0, (1.0 - vUV.y) * 34.0);
      vec2 c = floor(g);
      float slot = mod(floor((uTime - c.y * 0.012) / 3.6) + vL.x, max(uScrN, 1.0));
      float tr = -1.0, tc = 0.0;
      if (c.y >= 1.0 && c.y <= 14.0) { tr = floor((c.y - 1.0) / 2.0); tc = floor(c.x / 2.0); }
      else if (c.y >= 17.0 && c.y <= 23.0) { tr = 8.0 + c.y - 17.0; tc = c.x; }
      else if (c.y >= 26.0 && c.y <= 32.0) { tr = 16.0 + c.y - 26.0; tc = c.x; }
      if (tr >= 0.0) { vec4 tx = texture2D(uScr, vec2((tc + 0.5) / 64.0, (slot * 24.0 + tr + 0.5) / uScrH)); lit = tx.a; lc = tx.rgb; }
    }
  } else if (vFace < 0.5) {
    led = true; g = vec2(vS.x / (vH / 9.0), vS.y * 9.0);
    vec2 c = floor(g);
    if (vL.z < 0.5) {
      if (c.y >= 1.0 && c.y <= 7.0) {
        float cc = mod(c.x + floor(uTime * vL.w), vL.y);
        vec4 tx = texture2D(uMap, vec2((cc + 0.5) / uMapSize.x, (vL.x * 8.0 + (7.0 - c.y) + 0.5) / uMapSize.y));
        lit = tx.a; lc = tx.rgb;
      }
    } else {
      lit = step(1.0, c.y) * step(c.y, 7.0) * (0.55 + 0.45 * step(0.5, fract(vS.x / (vH * 3.0) - uTime * 0.35)));
      lc = vC;
    }
  }
  if (led) {
    vec2 cell = floor(g), f = fract(g) - 0.5;
    lit *= step(h21(cell + 7.0), (vOn - 0.05) * 1.3);
    float dm = mix(smoothstep(0.47, 0.3, length(f)), 0.5, smoothstep(0.3, 0.85, fwidth(g.x)));
    col += vec3(0.03, 0.02, 0.045) * dm + lc * lit * dm * 1.7;
  }
  col = mix(col, fogCol(vW.y), clamp(fogAmt(vW), 0.0, 0.9) * 0.55);
  gl_FragColor = vec4(col, 1.0);
  ${OUT}
}`;

// ------------------------------------------------ the street grid: kerb lamps and traffic
const G_FRAG = `
precision highp float;
varying vec3 vW;
uniform float uTime; uniform vec3 uHorF;
${HASH}
${FOG}
void main(){
  vec2 q = vW.xz;
  vec3 dv = vW - uCam;
  float near = (1.0 - smoothstep(1300.0, 3400.0, length(dv))) * smoothstep(0.035, 0.11, abs(normalize(dv).y));
  float ai = floor((q.x - ${AVE0}.0) / ${AVE}.0 + 0.5), ax = q.x - ${AVE0}.0 - ${AVE}.0 * ai;
  float sz = q.y - ${STR}.0 * floor(q.y / ${STR}.0 + 0.5);
  float ave = 1.0 - step(7.0, abs(ax)), st = 1.0 - step(6.0, abs(sz));
  vec3 col = vec3(0.006, 0.0042, 0.011) + vec3(0.009, 0.006, 0.014) * max(ave, st);
  float lamp = (1.0 - step(0.9, abs(abs(ax) - 7.8))) * (1.0 - step(0.1, abs(fract(q.y / 19.0) - 0.5))) * (1.0 - st)
             + (1.0 - step(0.9, abs(abs(sz) - 6.8))) * (1.0 - step(0.1, abs(fract(q.x / 21.0) - 0.5))) * (1.0 - ave);
  col += vec3(1.0, 0.6, 0.3) * min(lamp, 1.0) * 0.8 * near;
  float dir = ax > 0.0 ? 1.0 : -1.0;
  float zz = q.y + dir * uTime * (34.0 + 22.0 * h21(vec2(ai, dir)));
  float car = step(h21(vec2(floor(zz / 15.0), ai * 3.1 + dir * 7.0)), 0.34);
  float fz = fract(zz / 15.0);
  float lanes = 1.0 - step(0.7, abs(abs(ax) - 3.3));
  col += (dir > 0.0 ? vec3(1.0, 0.14, 0.1) : vec3(1.0, 0.88, 0.68)) * car * step(0.4, fz) * step(fz, 0.6) * lanes * ave * 1.6 * near;
  vec3 fc = mix(fogCol(0.0), uHorF, smoothstep(2600.0, 9000.0, length(dv)));
  gl_FragColor = vec4(mix(col, fc, fogAmt(vW)), 1.0);
  ${OUT}
}`;

const SKY_F = `
varying vec3 vD; uniform vec3 top, mid, hor, sunCol, sunDir, uHorF; uniform float uTime;
${HASH}
float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * n2(p); p = p * 2.07 + vec2(1.7, 9.2); a *= 0.5; } return s; }
void main(){
  vec3 d = normalize(vD); float h = d.y;
  vec3 c = mix(hor, mid, smoothstep(0.0, 0.1, h)); c = mix(c, top, smoothstep(0.08, 0.38, h));
  float s = max(dot(d, sunDir), 0.0);
  c += sunCol * (pow(s, 900.0) * 1.2 + pow(s, 70.0) * 0.2 + pow(s, 9.0) * 0.07);
  // long thin stratus, dark against the glow, lit pink where they pass the sun
  float az = atan(d.x, -d.z);
  float cl = fbm(vec2(az * 3.2 + uTime * 0.003, h * 58.0));
  float cm = smoothstep(0.58, 0.7, cl) * smoothstep(0.035, 0.07, h) * smoothstep(0.26, 0.11, h);
  c = mix(c, mix(vec3(0.07, 0.022, 0.07), vec3(1.0, 0.4, 0.36), pow(s, 14.0) * 0.8), cm * 0.75);
  vec2 g = vec2(az * 520.0, h * 820.0), fc = fract(g) - 0.5;
  float st = step(0.996, h21(floor(g))) * smoothstep(0.16, 0.38, h) * smoothstep(0.32, 0.05, length(fc));
  c += vec3(0.9, 0.9, 1.0) * st * (0.6 + 0.4 * sin(uTime * 2.0 + h21(floor(g) + 3.1) * 40.0)) * 0.9;
  c = mix(c, uHorF, smoothstep(0.012, -0.004, h));
  gl_FragColor = vec4(c, 1.0);
  ${OUT}
}`;

// ------------------------------------------------ a 5x7 LED font
const GLYPH = {
  A: [14, 17, 17, 17, 31, 17, 17], B: [30, 17, 17, 30, 17, 17, 30], C: [14, 17, 16, 16, 16, 17, 14], D: [28, 18, 17, 17, 17, 18, 28],
  E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16], G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14], J: [7, 2, 2, 2, 2, 18, 12], K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17], N: [17, 17, 25, 21, 19, 17, 17], O: [14, 17, 17, 17, 17, 17, 14], P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17], S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14], V: [17, 17, 17, 17, 17, 10, 4], W: [17, 17, 17, 21, 21, 21, 10], X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 17, 10, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31],
  0: [14, 17, 19, 21, 25, 17, 14], 1: [4, 12, 4, 4, 4, 4, 14], 2: [14, 17, 1, 2, 4, 8, 31], 3: [31, 2, 4, 2, 1, 17, 14], 4: [2, 6, 10, 18, 31, 2, 2],
  5: [31, 16, 30, 1, 1, 17, 14], 6: [6, 8, 16, 30, 17, 17, 14], 7: [31, 1, 2, 4, 8, 8, 8], 8: [14, 17, 17, 14, 17, 17, 14], 9: [14, 17, 17, 15, 1, 2, 12],
  '.': [0, 0, 0, 0, 0, 12, 12], ',': [0, 0, 0, 0, 12, 4, 8], '%': [24, 25, 2, 4, 8, 19, 3], '$': [4, 15, 20, 14, 5, 30, 4], '+': [0, 4, 4, 31, 4, 4, 0],
  '-': [0, 0, 0, 31, 0, 0, 0], ':': [0, 12, 12, 0, 12, 12, 0], '/': [0, 1, 2, 4, 8, 16, 0], '&': [12, 18, 20, 8, 21, 18, 13], "'": [12, 4, 8, 0, 0, 0, 0],
  '▲': [0, 0, 4, 14, 31, 0, 0], '▼': [0, 0, 31, 14, 4, 0, 0], '◆': [0, 4, 14, 31, 14, 4, 0],
};
const adv = ch => GLYPH[ch] ? 6 : ch === ' ' ? 4 : 6;
const measure = txt => [...String(txt).toUpperCase()].reduce((a, ch) => a + adv(ch), 0) - 1;
// draw text into an RGBA byte buffer, one texel per LED; returns the x after the text
function draw(buf, W, row, x, txt, c) {
  for (const ch of String(txt).toUpperCase()) {
    const g = GLYPH[ch];
    if (g && x + 5 <= W) for (let r = 0; r < 7; r++) for (let b = 0; b < 5; b++) if ((g[r] >> (4 - b)) & 1) { const o = ((row + r) * W + x + b) * 4; buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2]; buf[o + 3] = 255; }
    x += adv(ch);
  }
  return x;
}

export function startCity(canvas, opt = {}) {
  const small = Math.min(innerWidth, innerHeight) < 600;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !small, powerPreference: 'high-performance', alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, small ? 1.5 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 1, 20000);
  const SUN = new THREE.Vector3(0, 0.035, -1).normalize();
  const U = {
    uTime: { value: 0 }, uRise: { value: opt.still ? -1 : 0 }, uCam: { value: new THREE.Vector3() },
    uFogLo: { value: new THREE.Color('#9a3460') }, uFogHi: { value: new THREE.Color('#4a1848') }, uFogD: { value: 3300 }, uHorF: { value: new THREE.Color('#e0603e') }, uSky: { value: new THREE.Color('#3a1a44') },
  };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(9000, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { top: { value: new THREE.Color('#0d0724') }, mid: { value: new THREE.Color('#9c2468') }, hor: { value: new THREE.Color('#ff7a3d') }, sunCol: { value: new THREE.Color('#ffb27a') }, sunDir: { value: SUN }, uTime: U.uTime, uHorF: U.uHorF },
    vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: SKY_F,
  }));
  scene.add(sky);

  // the ground: a street grid that the towers sit inside
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(16000, 10000).rotateX(-Math.PI / 2).translate(0, 0, -3000), new THREE.ShaderMaterial({
    uniforms: U, vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }', fragmentShader: G_FRAG,
  })));

  // ------------------------------------------------ the city plan
  let seed = 1337; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const N = small ? 900 : 1500;
  // keep a building inside one block, clear of the roads around it
  const fitIn = (c, size, step, kerb, off) => { const b = Math.floor((c - off) / step), lo = off + b * step + kerb, hi = off + (b + 1) * step - kerb; size = Math.min(size, hi - lo - 2); return [Math.min(hi - size / 2, Math.max(lo + size / 2, c)), size]; };
  const DOWN = new THREE.Vector2(0, -1400);
  // z0, z1, share, base height, height range, x spread, width, width range, role
  const LAYERS = [
    [-2300, -1800, 0.26, 110, 250, 3400, 22, 34, 'far'],
    [-1750, -1050, 0.34, 70, 0, 3400, 22, 34, 'down'],
    [-1000, -520, 0.2, 40, 130, 3400, 34, 46, 'mid'],
    [-480, -60, 0.13, 30, 105, 2400, 30, 44, 'near'],
    [-40, 300, 0.07, 14, 44, 1600, 36, 44, 'fore'],
  ];
  const P = [], bodies = [];   // pieces: x, y, z, w, h, d, delay, seed, layer, kind, type
  for (const [z0, z1, share, h0, hr, spread, w0, wr, role] of LAYERS) {
    const n = Math.round(N * share);
    for (let k = 0; k < n; k++) {
      let x = (rnd() - 0.5) * spread, z = z0 + rnd() * (z1 - z0), h;
      if (role === 'down') {
        const cl = Math.exp(-((x + 560) ** 2) / (2 * 300 * 300)), cr = Math.exp(-((x - 540) ** 2) / (2 * 330 * 330)), cc = Math.exp(-(x ** 2) / (2 * 240 * 240));
        h = (h0 + rnd() * 110 + (cl + cr * 1.1) * (130 + rnd() * 290) + cc * (10 + rnd() * 40)) * (0.62 + 0.38 * Math.min(1, Math.max(0, (Math.abs(x) - 60) / 240)));
      } else h = h0 + rnd() * hr;
      let w = w0 + rnd() * wr, d = w * (0.7 + rnd() * 0.6);
      if (role !== 'far' && role !== 'down') [x, w] = fitIn(x, w, AVE, 10, AVE0);   // the far city ignores the grid, so no avenue opens a slot to the horizon
      [z, d] = fitIn(z, d, STR, 8, 0);
      const delay = 0.3 + Math.hypot(x - DOWN.x, z - DOWN.y) / 2600 * 2.3 + rnd() * 0.25;
      const q = rnd(), type = role === 'down' ? (q < 0.42 ? 0 : q < 0.9 ? 1 : 2) : role === 'far' ? (q < 0.6 ? 0 : q < 0.8 ? 1 : 2) : (q < 0.36 ? 0 : q < 0.52 ? 1 : 2);
      const b = { x, y: 0, z, w, h, d, delay, seed: rnd(), layer: role === 'far' ? 1 : 0, kind: 0, type, top: h, topDelay: delay + 1.6, role };
      P.push(b); bodies.push(b);
    }
  }
  // facade screens framed by the final shot: either side of the hero on wide screens, one under the buttons on phones
  const cam0 = new THREE.PerspectiveCamera(30, (canvas.clientWidth || innerWidth) / (canvas.clientHeight || innerHeight), 1, 20000);
  const port0 = cam0.aspect < 0.8;
  cam0.fov = port0 ? 46 : cam0.aspect < 1.3 ? 38 : 30; cam0.updateProjectionMatrix();
  cam0.position.set(0, 96 + (port0 ? 40 : 0), 560); cam0.lookAt(0, 282 + (port0 ? 160 : 0), -1400); cam0.updateMatrixWorld();
  const pv = new THREE.Vector3(), at = (x, y, z) => { pv.set(x, y, z).project(cam0); return [(pv.x + 1) / 2, (1 - pv.y) / 2]; };
  const screens = [];
  for (const [tx, ty] of port0 ? [[0.5, 0.79]] : [[0.13, 0.7], [0.87, 0.7]]) {
    let c = null, best = 9;
    for (const b of bodies) {
      if (b.role !== 'near' || b.z < -470 || b.z > -170 || screens.some(o => o.b === b)) continue;
      const [sx] = at(b.x, 120, b.z + b.d / 2), sc = Math.abs(sx - tx) + Math.abs(b.z + 300) / 3000;
      if (sc < best) { best = sc; c = b; }
    }
    if (!c) continue;
    if (best > 0.09) {
      // nothing stands in the right spot (narrow phones): move the nearest building there
      const dir = new THREE.Vector3(tx * 2 - 1, (1 - ty) * 2 - 1, 0.5).unproject(cam0).sub(cam0.position).normalize();
      c.x = cam0.position.x + dir.x * ((c.z + c.d / 2 - cam0.position.z) / dir.z);
    }
    [c.x, c.w] = fitIn(c.x, 72, AVE, 10, AVE0); c.d = Math.max(c.d, 40); c.type = 0;
    const p = Math.min(1.05, (c.w - 4) / 64), sh = 34 * p, zc = c.z + c.d / 2;
    let hb = 108, err = 9;
    for (let h = 96; h <= 260; h += 4) { const e = Math.abs(at(c.x, h - 10 - sh / 2, zc)[1] - ty); if (e < err) { err = e; hb = h; } }
    c.h = hb;
    const sy = c.h - 10 - sh / 2, sb = sy - sh / 2;
    // anything standing on the sight line from the camera to the screen is kept below it (camera drift included)
    for (const b of bodies) {
      if (b === c || b.z - b.d / 2 < zc - 1) continue;
      const f = (560 - b.z) / (560 - zc), xl = c.x * f, hw = c.w / 2 * f + 95 * (1 - f) + 8;
      if (Math.abs(b.x - xl) > b.w / 2 + hw) continue;
      const cy = 96 + (port0 ? 40 : 0), lim = zN => cy + (sb - cy) * (560 - zN) / (560 - zc);
      const hh = Math.max(10, Math.min(b.h, lim(b.z + b.d / 2) - 6, lim(b.z - b.d / 2) - 6));
      if (hh < b.h) { b.h = b.top = hh; b.capped = true; }
    }
    screens.push({ b: c, p, sh, sy });
  }
  // setbacks crown the tall towers, gear goes on the low roofs
  for (const b of bodies) {
    if (b.role === 'down' && b.h > 260) {
      const h1 = b.h * (0.07 + rnd() * 0.1);
      P.push({ x: b.x, y: b.h, z: b.z, w: b.w * 0.72, h: h1, d: b.d * 0.72, delay: b.delay + 1.45, seed: b.seed, layer: 0, kind: 1, type: b.type });
      b.top = b.h + h1; b.topDelay = b.delay + 2.15; b.tw = b.w * 0.72; b.td = b.d * 0.72;
      if (b.h > 430 && rnd() < 0.7) {
        const h2 = b.h * (0.04 + rnd() * 0.05);
        P.push({ x: b.x, y: b.top, z: b.z, w: b.w * 0.46, h: h2, d: b.d * 0.46, delay: b.delay + 2.05, seed: b.seed, layer: 0, kind: 1, type: b.type });
        b.top += h2; b.topDelay = b.delay + 2.75; b.tw = b.w * 0.46; b.td = b.d * 0.46;
      }
    } else if (b.role !== 'down' && b.role !== 'far' && !b.capped && !screens.some(s => s.b === b) && rnd() < (b.role === 'fore' ? 0.85 : 0.5)) {
      for (let g = 0, m = 1 + ((rnd() * 3) | 0); g < m; g++) {
        const gw = 4 + rnd() * 9;
        P.push({ x: b.x + (rnd() - 0.5) * (b.w - gw - 2), y: b.h, z: b.z + (rnd() - 0.5) * (b.d - gw - 2), w: gw, h: 3 + rnd() * 7, d: gw * (0.6 + rnd() * 0.8), delay: b.delay + 1.5 + rnd() * 0.3, seed: rnd(), layer: 0, kind: 3, type: 0 });
      }
    }
  }
  const byTop = bodies.filter(b => b.role === 'down' && b.h > 260).sort((a, b) => b.top - a.top);
  // the listed towers: one stock each, wide enough to carry a ticker band
  const listed = [];
  for (const b of byTop) {
    if (listed.length >= (small ? 8 : 12)) break;
    if (Math.abs(b.x) < 70 || b.h < 300 || listed.some(o => Math.abs(o.x - b.x) < 105)) continue;
    [b.x, b.w] = fitIn(b.x, Math.max(b.w, 54), AVE, 10, AVE0); b.d = Math.max(b.d, 46);
    listed.push(b);
  }
  // spires and aviation beacons on the tallest
  const beacon = [];
  for (const b of byTop.slice(0, small ? 22 : 34)) {
    const sh = 26 + rnd() * 64;
    P.push({ x: b.x, y: b.top, z: b.z, w: 3.2, h: sh, d: 3.2, delay: b.topDelay, seed: rnd(), layer: 0, kind: 2, type: 0 });
    beacon.push([b.x, b.top + sh, b.z, b.topDelay + 0.7]);
    b.spire = sh;
  }
  // setbacks follow their body if it was moved
  for (const p of P) if (p.kind === 1) { const b = bodies.find(o => o.seed === p.seed); if (b) { p.x = b.x; p.z = b.z; } }
  const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
  const mesh = new THREE.InstancedMesh(geo, new THREE.ShaderMaterial({ uniforms: U, vertexShader: T_VERT, fragmentShader: T_FRAG }), P.length);
  const aBox = new Float32Array(P.length * 4), aKind = new Float32Array(P.length * 4), m4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), Sc = new THREE.Vector3();
  P.forEach((p, i) => { m4.compose(V.set(p.x, p.y, p.z), Q, Sc.set(p.w, p.h, p.d)); mesh.setMatrixAt(i, m4); aBox.set([p.delay, p.seed, p.h, p.layer], i * 4); aKind.set([p.kind, p.type, p.y, 0], i * 4); });
  geo.setAttribute('aBox', new THREE.InstancedBufferAttribute(aBox, 4)); geo.setAttribute('aKind', new THREE.InstancedBufferAttribute(aKind, 4));
  mesh.frustumCulled = false; scene.add(mesh);

  const bG = new THREE.BufferGeometry();
  bG.setAttribute('position', new THREE.BufferAttribute(new Float32Array(beacon.flatMap(b => b.slice(0, 3))), 3));
  bG.setAttribute('aD', new THREE.BufferAttribute(new Float32Array(beacon.map(b => b[3])), 1));
  bG.setAttribute('aPh', new THREE.BufferAttribute(new Float32Array(beacon.map(() => rnd() * 6.28)), 1));
  const beacons = new THREE.Points(bG, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: U.uTime, uRise: U.uRise, uPx: { value: renderer.getPixelRatio() } },
    vertexShader: 'attribute float aPh; attribute float aD; uniform float uTime; uniform float uRise; uniform float uPx; varying float vA; void main(){ vA = step(0.55, fract(uTime * 0.55 + aPh)) * (uRise < 0.0 ? 1.0 : step(aD, uTime)); vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = 6.0 * uPx * (1400.0 / -mv.z); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(1.0, 0.22, 0.26, smoothstep(0.5, 0.32, d) * vA); }',
  }));
  beacons.frustumCulled = false; scene.add(beacons);

  // ------------------------------------------------ the LEDs
  const MW = 256, MH = 16 * 8, SW = 64, SN = 32, SH = SN * 24;
  const band = new Uint8Array(MW * MH * 4), scr = new Uint8Array(SW * SH * 4);
  const tex = (buf, w, h) => { const t = new THREE.DataTexture(buf, w, h, THREE.RGBAFormat); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; return t; };
  const map = tex(band, MW, MH), smap = tex(scr, SW, SH);
  const LN = listed.length * 2 + screens.length;
  const lGeo = new THREE.BoxGeometry(1, 1, 1);
  const LU = { ...U, uMap: { value: map }, uMapSize: { value: new THREE.Vector2(MW, MH) }, uScr: { value: smap }, uScrN: { value: 1 }, uScrH: { value: SH } };
  const lMesh = new THREE.InstancedMesh(lGeo, new THREE.ShaderMaterial({ uniforms: LU, vertexShader: L_VERT, fragmentShader: L_FRAG }), LN);
  const aB = new Float32Array(LN * 4), aL = new Float32Array(LN * 4), aC = new Float32Array(LN * 3);
  listed.forEach((b, i) => {
    const H = small ? 34 : 30, y = Math.max(260, Math.min(b.h * 0.82, b.h - 40)), w = b.w + 1.6, d = b.d + 1.6;
    m4.compose(V.set(b.x, y, b.z), Q, Sc.set(w, H, d)); lMesh.setMatrixAt(i * 2, m4);
    aB.set([b.delay + 1.75 + (y / b.h) * 0.4, w, d, H], i * 8); aL.set([i, 6, 0, 13 + (i % 3) * 2], i * 8);
    const cH = 7, cw = (b.tw || b.w) + 1.2, cd = (b.td || b.d) + 1.2;
    m4.compose(V.set(b.x, b.top - cH / 2 - 1.5, b.z), Q, Sc.set(cw, cH, cd)); lMesh.setMatrixAt(i * 2 + 1, m4);
    aB.set([b.topDelay + 0.5, cw, cd, cH], i * 8 + 4); aL.set([i, 1, 1, 0], i * 8 + 4);
    aC.set([1.0, 0.24, 0.55], i * 6 + 3);
  });
  screens.forEach((s, j) => {
    const k = listed.length * 2 + j, b = s.b, sw = 64 * s.p;
    m4.compose(V.set(b.x, s.sy, b.z + b.d / 2 + 1.3), Q, Sc.set(sw, s.sh, 2.4)); lMesh.setMatrixAt(k, m4);
    aB.set([b.delay + 1.9, sw, 2.4, s.sh], k * 4); aL.set([j * 5, 0, 2, 0], k * 4);
  });
  lGeo.setAttribute('aB', new THREE.InstancedBufferAttribute(aB, 4)); lGeo.setAttribute('aL', new THREE.InstancedBufferAttribute(aL, 4)); lGeo.setAttribute('aC', new THREE.InstancedBufferAttribute(aC, 3));
  lMesh.frustumCulled = false; scene.add(lMesh);

  const COL = { sym: [255, 238, 214], px: [255, 168, 38], up: [61, 220, 132], dn: [255, 70, 104], mag: [255, 61, 139] };
  const fx = v => v >= 1000 ? Math.round(v).toLocaleString('en-US') : v >= 1 ? v.toFixed(2) : v.toPrecision(3);
  const owned = [];
  function setTicker(stocks) {
    const S = (stocks || []).filter(s => isFinite(s.usd) && s.usd > 0).slice().sort((a, b) => (b.liq || 0) - (a.liq || 0));
    band.fill(0); scr.fill(0);
    listed.forEach((b, i) => {
      const s = S.length ? S[i % S.length] : null; owned[i] = s;
      let x;
      if (s) {
        const up = (s.ch24 || 0) >= 0;
        x = draw(band, MW, i * 8, 0, s.sym + ' ', COL.sym); x = draw(band, MW, i * 8, x, fx(s.usd) + ' ', COL.px);
        x = draw(band, MW, i * 8, x, (up ? '▲' : '▼') + Math.abs(s.ch24 || 0).toFixed(2) + '%', up ? COL.up : COL.dn) + 14;
        aC.set(up ? [0.2, 1.0, 0.5] : [1.0, 0.16, 0.24], i * 6 + 3);
      } else {
        x = draw(band, MW, i * 8, 0, 'STOKZ ', COL.sym); x = draw(band, MW, i * 8, x, '◆ ', COL.mag);
        aC.set([1.0, 0.24, 0.55], i * 6 + 3);
      }
      aL[i * 8 + 1] = Math.min(MW, Math.max(6, x));
    });
    // the screens flip through every listing; before any data they hold the house mark
    const list = S.length ? S.slice(0, SN) : [null];
    list.forEach((s, k) => {
      const r = k * 24;
      if (!s) { draw(scr, SW, r + 8, (SW - measure('STOKZ')) >> 1, 'STOKZ', COL.sym); return; }
      const up = (s.ch24 || 0) >= 0, sym = s.sym.slice(0, 5), px = '$' + fx(s.usd), ch = (up ? '▲' : '▼') + Math.abs(s.ch24 || 0).toFixed(2) + '%';
      draw(scr, SW, r, (32 - measure(sym)) >> 1, sym, COL.sym);
      draw(scr, SW, r + 8, (SW - measure(px)) >> 1, px, COL.px);
      draw(scr, SW, r + 16, (SW - measure(ch)) >> 1, ch, up ? COL.up : COL.dn);
    });
    LU.uScrN.value = list.length;
    map.needsUpdate = true; smap.needsUpdate = true; lGeo.attributes.aL.needsUpdate = true; lGeo.attributes.aC.needsUpdate = true;
    if (opt.still) renderer.render(scene, camera);
  }
  setTicker([]);

  // ------------------------------------------------ camera: the crane down, then a slow drift
  const P0 = new THREE.Vector3(0, 640, 1700), Q0 = new THREE.Vector3(0, 100, -950);
  const C0 = new THREE.Vector3(0, 96, 560), L0 = new THREE.Vector3(0, 282, -1400);
  const TI = 4.4, DONE = 6.4;
  let ptrX = 0, ptrY = 0, tx = 0, ty = 0;
  addEventListener('pointermove', e => { tx = e.clientX / innerWidth - 0.5; ty = e.clientY / innerHeight - 0.5; }, { passive: true });
  function resize() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    camera.fov = camera.aspect < 0.8 ? 46 : camera.aspect < 1.3 ? 38 : 30; camera.updateProjectionMatrix();
  }
  resize(); addEventListener('resize', resize);
  const io = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  const cp = new THREE.Vector3(), lp = new THREE.Vector3();
  function place(t) {
    const k = opt.still ? 1 : io(Math.min(1, t / TI)), port = camera.aspect < 0.8, m = k * k;
    const arc = Math.sin(k * Math.PI) * 150;
    cp.lerpVectors(P0, C0, k); cp.x += arc + m * (Math.sin(t * 0.05) * 60 + ptrX * 70); cp.y += port ? 40 * k : 0; cp.y += m * (Math.sin(t * 0.08) * 6 - ptrY * 20);
    lp.lerpVectors(Q0, L0, k); lp.x += arc * 0.4 + m * ptrX * 40; lp.y += port ? 160 * k : 0;
    camera.position.copy(cp); camera.lookAt(lp); camera.updateMatrixWorld();
    U.uCam.value.copy(cp); sky.position.copy(cp);
  }
  let t = 0, last = performance.now(), raf = 0, first = true;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    U.uTime.value = t;
    ptrX += (tx - ptrX) * 0.04; ptrY += (ty - ptrY) * 0.04;
    place(t);
    renderer.render(scene, camera);
    if (first) { first = false; opt.onFirst && opt.onFirst(); }
    raf = requestAnimationFrame(frame);
  }
  if (opt.still) { t = U.uTime.value = 8; place(t); renderer.render(scene, camera); opt.onFirst && opt.onFirst(); }
  else raf = requestAnimationFrame(frame);
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancelAnimationFrame(raf); else if (!opt.still) { last = performance.now(); raf = requestAnimationFrame(frame); } });

  const v = new THREE.Vector3();
  const proj = (x, y, z) => { v.set(x, y, z).project(camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - (v.y + 1) / 2) * innerHeight, ok: v.z < 1 }; };
  return {
    // screen spots above the listed towers (with their stock) and the other tall roofs
    tops(side) {
      const out = [];
      listed.forEach((b, i) => { const p = proj(b.x, b.top + (b.spire || 0), b.z); if (p.ok) out.push({ x: p.x, y: p.y, s: owned[i] || null }); });
      for (const b of byTop.slice(0, 40)) if (!listed.includes(b)) { const p = proj(b.x, b.top, b.z); if (p.ok) out.push({ x: p.x, y: p.y, s: null }); }
      const vis = out.filter(o => o.x > 20 && o.x < innerWidth - 20 && o.y > 112 && o.y < innerHeight - 60);
      return side ? vis.filter(o => (side < 0 ? o.x < innerWidth * 0.24 : o.x > innerWidth * 0.76) && o.y < innerHeight * 0.62) : vis;
    },
    setTicker,
    skip() { if (t < DONE) { t = DONE; U.uTime.value = t; } },
    // hold one moment of the film (used for posters and checks)
    seek(at) { cancelAnimationFrame(raf); opt.still = false; t = at; U.uTime.value = at; U.uRise.value = 0; ptrX = ptrY = 0; place(t); renderer.render(scene, camera); },
    renderOnce() { place(t); renderer.render(scene, camera); },
    get plan() { return { screens: screens.map(o => [Math.round(o.b.x), Math.round(o.b.z), Math.round(o.b.h)]), listed: listed.length, pieces: P.length }; },
  };
}
