/**
 * Generates product illustrations as SVG (front / back / detail) for any garment + colour.
 * Demo-catalogue stand-in for real photography: swap product_images.url for CDN photo URLs
 * and nothing else changes.
 */
type RGB = [number, number, number];

const toRgb = (hex: string): RGB => {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
};
const toHex = (c: RGB) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a: string, b: string, t: number) => {
  const x = toRgb(a), y = toRgb(b);
  return toHex([0, 1, 2].map((i) => x[i] + (y[i] - x[i]) * t) as RGB);
};
const lum = (hex: string) => {
  const [r, g, b] = toRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};

interface Palette { base: string; shade: string; deep: string; light: string; stitch: string; line: string; bg: string; bg2: string }

const palette = (hex: string): Palette => {
  const base = `#${hex}`;
  const L = lum(base);
  return {
    base,
    shade: mix(base, '#000000', 0.14),
    deep: mix(base, '#000000', 0.3),
    light: mix(base, '#ffffff', 0.18),
    stitch: L > 0.6 ? mix(base, '#000000', 0.25) : mix(base, '#ffffff', 0.35),
    line: L > 0.85 ? '#cfc8bc' : mix(base, '#000000', 0.35),
    bg: mix(base, '#F4F1EC', L > 0.85 ? 1 : 0.9),
    bg2: mix(base, '#EAE5DD', L > 0.85 ? 1 : 0.84),
  };
};

type Draw = (p: Palette, back: boolean) => string;

const S = (d: string, p: Palette, extra = '') => `<path d="${d}" fill="${p.base}" stroke="${p.line}" stroke-width="1.5" stroke-linejoin="round" ${extra}/>`;
const shade = (d: string, p: Palette, o = 1) => `<path d="${d}" fill="${p.shade}" opacity="${o}"/>`;
const stitch = (d: string, p: Palette) => `<path d="${d}" fill="none" stroke="${p.stitch}" stroke-width="1.2" stroke-dasharray="4 3" opacity=".8"/>`;
const btn = (x: number, y: number, p: Palette, r = 4) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${p.light}" stroke="${p.deep}" stroke-width="1"/>`;

const tee = (p: Palette, back: boolean, polo = false) => {
  const body = 'M120 88 L166 66 Q200 88 234 66 L280 88 L346 138 L318 190 L284 170 L286 436 Q200 448 114 436 L116 170 L82 190 L54 138 Z';
  let s = S(body, p);
  s += shade('M116 170 L114 436 Q140 440 160 441 L150 180 Z', p, 0.55) + shade('M284 170 L286 436 Q262 440 244 441 L252 182 Z', p, 0.35);
  s += stitch('M116 420 Q200 432 284 420', p) + stitch('M68 170 L84 180', p) + stitch('M332 170 L316 180', p);
  if (!back) {
    if (polo) {
      s += `<path d="M166 66 L184 104 L200 92 L216 104 L234 66 Q200 84 166 66Z" fill="${p.shade}" stroke="${p.line}" stroke-width="1.2"/>`;
      s += `<path d="M192 92 L192 150 L208 150 L208 92" fill="${p.light}" stroke="${p.line}" stroke-width="1"/>` + btn(200, 112, p, 3.5) + btn(200, 134, p, 3.5);
    } else {
      s += `<path d="M166 66 Q200 104 234 66" fill="none" stroke="${p.deep}" stroke-width="7" stroke-linecap="round"/>`;
    }
  } else s += `<path d="M168 66 Q200 78 232 66" fill="none" stroke="${p.deep}" stroke-width="6" stroke-linecap="round"/>`;
  return s;
};

const longSleeveTop = (p: Palette) =>
  S('M124 80 L170 62 L200 88 L230 62 L276 80 L302 98 L338 310 L306 318 L282 172 L284 440 L116 440 L118 172 L94 318 L62 310 L98 98 Z', p) +
  shade('M118 172 L116 440 L150 440 L144 182Z', p, 0.5) +
  shade('M282 172 L284 440 L256 440 L260 184Z', p, 0.3) +
  `<rect x="62" y="300" width="34" height="18" rx="3" transform="rotate(4 79 309)" fill="${p.shade}" stroke="${p.line}"/>` +
  `<rect x="304" y="300" width="34" height="18" rx="3" transform="rotate(-4 321 309)" fill="${p.shade}" stroke="${p.line}"/>`;

const DRAW: Record<string, Draw> = {
  tshirt: (p, back) => tee(p, back),
  polo: (p, back) => tee(p, back, true),

  shirt: (p, back) => {
    let s = longSleeveTop(p);
    if (!back) {
      s += `<path d="M170 62 L186 108 L200 88Z" fill="${p.light}" stroke="${p.line}"/><path d="M230 62 L214 108 L200 88Z" fill="${p.light}" stroke="${p.line}"/>`;
      s += `<path d="M200 90 L200 440" stroke="${p.line}" stroke-width="1.2"/>` + stitch('M206 96 L206 440', p);
      for (let y = 120; y < 430; y += 48) s += btn(203, y, p, 3.5);
      s += `<path d="M226 150 h34 v40 q-17 8 -34 0z" fill="none" stroke="${p.line}" stroke-width="1.2"/>`;
    } else s += stitch('M118 130 Q200 146 282 130', p) + `<path d="M170 62 Q200 76 230 62" fill="none" stroke="${p.deep}" stroke-width="5"/>`;
    return s;
  },

  jacket: (p, back) => {
    let s = S('M118 84 L170 60 L200 80 L230 60 L282 84 L308 104 L342 316 L308 324 L284 180 L286 420 L114 420 L116 180 L92 324 L58 316 L92 104 Z', p);
    s += `<rect x="112" y="402" width="176" height="30" rx="4" fill="${p.shade}" stroke="${p.line}"/>`;
    s += `<rect x="58" y="304" width="36" height="22" rx="3" fill="${p.shade}" stroke="${p.line}"/><rect x="306" y="304" width="36" height="22" rx="3" fill="${p.shade}" stroke="${p.line}"/>`;
    if (!back) {
      s += `<path d="M170 60 L156 120 L200 170 L200 80Z" fill="${p.shade}" stroke="${p.line}"/><path d="M230 60 L244 120 L200 170 L200 80Z" fill="${p.shade}" stroke="${p.line}"/>`;
      s += `<path d="M200 170 L200 432" stroke="${p.deep}" stroke-width="3"/>` + stitch('M140 150 L140 400', p) + stitch('M260 150 L260 400', p);
      s += `<path d="M132 250 h44 v36 h-44z M224 250 h44 v36 h-44z" fill="${p.shade}" stroke="${p.line}"/>` + btn(154, 262, p, 3) + btn(246, 262, p, 3);
      for (let y = 200; y < 400; y += 50) s += btn(200, y, p, 4.5);
    } else s += stitch('M116 160 Q200 180 284 160', p) + `<path d="M170 60 Q200 70 230 60 L226 86 Q200 94 174 86Z" fill="${p.shade}" stroke="${p.line}"/>`;
    return s;
  },

  hoodie: (p, back) => {
    let s = `<path d="M150 90 Q148 20 200 18 Q252 20 250 90 Z" fill="${p.shade}" stroke="${p.line}" stroke-width="1.5"/>`;
    s += longSleeveTop(p);
    s += `<rect x="114" y="416" width="172" height="26" rx="6" fill="${p.shade}" stroke="${p.line}"/>`;
    if (!back) {
      s += `<path d="M160 80 Q200 140 240 80 Q228 60 200 58 Q172 60 160 80Z" fill="${p.deep}" opacity=".55"/>`;
      s += `<path d="M186 104 L182 176 M214 104 L218 176" stroke="${p.light}" stroke-width="3" stroke-linecap="round"/>`;
      s += `<path d="M142 300 L258 300 L276 380 L124 380 Z" fill="${p.shade}" stroke="${p.line}" stroke-width="1.2"/>`;
    } else s += `<path d="M150 90 Q200 150 250 90" fill="none" stroke="${p.line}" stroke-width="1.2"/>`;
    return s;
  },

  jeans: (p, back) => {
    let s = S('M128 60 L272 60 L290 452 L214 452 L200 178 L186 452 L110 452 Z', p);
    s += `<rect x="126" y="60" width="148" height="24" fill="${p.shade}" stroke="${p.line}" stroke-width="1.2"/>`;
    s += shade('M128 84 L110 452 L140 452 L150 100Z', p, 0.45) + shade('M272 84 L290 452 L262 452 L252 100Z', p, 0.3);
    for (const x of [146, 180, 220, 254]) s += `<rect x="${x - 4}" y="56" width="8" height="30" rx="2" fill="${p.shade}" stroke="${p.line}"/>`;
    s += stitch('M128 440 L186 440 M214 440 L290 440', p);
    if (!back) {
      s += stitch('M200 86 L200 160 Q196 176 182 176', p) + stitch('M130 92 Q160 126 170 90', p) + stitch('M270 92 Q240 126 230 90', p);
      s += btn(200, 72, p, 5);
    } else {
      s += `<path d="M140 110 h44 l-4 52 l-18 10 l-18 -10z M216 110 h44 l-4 52 l-18 10 l-18 -10z" fill="none" stroke="${p.stitch}" stroke-width="1.4"/>`;
      s += `<path d="M128 100 Q200 90 272 100" fill="none" stroke="${p.line}"/>`;
    }
    return s;
  },

  chinos: (p, back) => {
    let s = S('M130 60 L270 60 L284 452 L212 452 L200 176 L188 452 L116 452 Z', p);
    s += `<rect x="128" y="60" width="144" height="22" fill="${p.shade}" stroke="${p.line}" stroke-width="1.2"/>`;
    s += shade('M130 82 L116 452 L142 452 L150 96Z', p, 0.4) + shade('M270 82 L284 452 L258 452 L252 96Z', p, 0.3);
    s += `<path d="M158 90 L150 452 M242 90 L250 452" stroke="${p.shade}" stroke-width="2"/>`;
    s += back ? `<path d="M146 112 h36 M218 112 h36" stroke="${p.line}" stroke-width="2"/>` : `<path d="M132 88 L152 130 M268 88 L248 130" stroke="${p.line}" stroke-width="1.4"/>` + btn(200, 71, p, 4);
    return s;
  },

  shorts: (p, back) => {
    let s = S('M126 90 L274 90 L292 300 L212 312 L200 200 L188 312 L108 300 Z', p);
    s += `<rect x="124" y="84" width="152" height="28" rx="6" fill="${p.shade}" stroke="${p.line}" stroke-width="1.2"/>`;
    s += stitch('M112 284 L188 294 M212 294 L288 284', p);
    if (!back) s += `<path d="M190 112 q-6 40 -14 54 M210 112 q6 40 14 54" stroke="${p.light}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    return s;
  },

  kurta: (p, back) => {
    let s = S('M130 74 L176 60 Q200 70 224 60 L270 74 L296 96 L324 300 L296 306 L278 170 L292 470 L228 470 L222 430 L178 430 L172 470 L108 470 L122 170 L104 306 L76 300 L104 96 Z', p);
    s += shade('M122 170 L108 470 L136 470 L142 182Z', p, 0.45) + shade('M278 170 L292 470 L266 470 L260 184Z', p, 0.3);
    s += stitch('M112 454 L172 454 M228 454 L288 454', p) + stitch('M84 288 L102 292 M316 288 L298 292', p);
    if (!back) {
      s += `<path d="M176 60 Q200 76 224 60 L224 70 Q200 86 176 70Z" fill="${p.shade}" stroke="${p.line}"/>`;
      s += `<path d="M200 76 L200 190" stroke="${p.line}" stroke-width="1.2"/>` + [100, 128, 156].map((y) => btn(200, y, p, 3.5)).join('');
      s += `<path d="M150 76 Q200 110 250 76" fill="none" stroke="${p.light}" stroke-width="1.5" stroke-dasharray="2 4" opacity=".9"/>`;
    }
    return s;
  },

  dress: (p, back) => {
    let s = S('M164 58 L178 58 Q200 92 222 58 L236 58 L252 196 Q316 360 344 462 Q200 486 56 462 Q84 360 148 196 Z', p);
    s += shade('M148 196 Q84 360 56 462 Q90 468 120 472 Q140 330 176 206Z', p, 0.45);
    s += shade('M252 196 Q316 360 344 462 Q316 468 290 470 Q262 330 226 206Z', p, 0.3);
    s += `<path d="M146 196 Q200 212 254 196" fill="none" stroke="${p.deep}" stroke-width="3"/>`;
    s += `<path d="M150 200 Q140 330 120 470 M200 210 L200 480 M250 200 Q262 330 282 470" stroke="${p.shade}" stroke-width="1.5" fill="none" opacity=".8"/>`;
    if (!back) s += `<path d="M178 58 Q200 110 222 58" fill="none" stroke="${p.deep}" stroke-width="2"/>`;
    return s;
  },

  top: (p, back) => {
    let s = S('M134 86 L176 64 Q200 80 224 64 L266 86 L276 330 Q200 344 124 330 Z', p);
    s += `<ellipse cx="112" cy="116" rx="44" ry="38" fill="${p.base}" stroke="${p.line}" stroke-width="1.5"/><ellipse cx="288" cy="116" rx="44" ry="38" fill="${p.base}" stroke="${p.line}" stroke-width="1.5"/>`;
    s += `<path d="M84 128 Q100 150 128 140 M316 128 Q300 150 272 140" stroke="${p.shade}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
    s += shade('M134 140 L124 330 Q150 336 162 337 L160 150Z', p, 0.4);
    s += stitch('M126 318 Q200 330 274 318', p);
    if (!back) s += `<path d="M176 64 Q200 100 224 64" fill="none" stroke="${p.deep}" stroke-width="3"/>` + [120, 160, 200].map((y) => btn(200, y, p, 3)).join('');
    return s;
  },

  saree: (p, back) => {
    const border = '#B98B2E';
    let s = '';
    for (let i = 0; i < 4; i++) {
      const y = 150 + i * 40;
      s += `<rect x="${70 + i * 4}" y="${y}" width="${260 - i * 8}" height="60" rx="6" fill="${i % 2 ? p.shade : p.base}" stroke="${p.line}" stroke-width="1.2"/>`;
      s += `<rect x="${70 + i * 4}" y="${y + 48}" width="${260 - i * 8}" height="12" fill="${border}" opacity=".9"/>`;
    }
    s += `<path d="M230 60 L330 170 L330 430 L230 360 Z" fill="${p.deep}" stroke="${p.line}" stroke-width="1.2"/>`;
    s += `<path d="M300 138 L330 170 L330 430 L300 408 Z" fill="${border}" opacity=".9"/>`;
    for (let y = 190; y < 400; y += 34) s += `<path d="M256 ${y} l10 -10 l10 10 l-10 10z" fill="${border}" opacity=".85"/>`;
    for (let x = 90; x < 300; x += 30) s += `<circle cx="${x}" cy="${back ? 180 : 262}" r="4" fill="${border}" opacity=".7"/>`;
    return s;
  },

  frock: (p, back) => {
    let s = S('M160 90 L184 78 Q200 90 216 78 L240 90 L246 200 Q332 330 330 400 Q200 430 70 400 Q68 330 154 200 Z', p);
    s += `<ellipse cx="146" cy="104" rx="26" ry="20" fill="${p.light}" stroke="${p.line}"/><ellipse cx="254" cy="104" rx="26" ry="20" fill="${p.light}" stroke="${p.line}"/>`;
    s += `<path d="M154 200 Q200 214 246 200" stroke="${p.deep}" stroke-width="8" fill="none"/>`;
    if (!back) s += `<path d="M200 206 l-24 -14 l0 28z M200 206 l24 -14 l0 28z" fill="${p.deep}"/><circle cx="200" cy="206" r="6" fill="${p.deep}"/>`;
    s += `<path d="M110 390 Q130 300 176 214 M200 216 L200 420 M290 390 Q270 300 224 214" stroke="${p.shade}" stroke-width="2" fill="none"/>`;
    s += `<path d="M72 398 Q86 410 100 400 Q114 412 128 402 Q142 414 156 404 Q170 414 184 406 Q200 416 216 406 Q230 414 244 404 Q258 414 272 402 Q286 412 300 400 Q314 410 328 398" fill="none" stroke="${p.light}" stroke-width="3"/>`;
    return s;
  },

  romper: (p, back) => {
    let s = S('M140 100 L178 84 Q200 96 222 84 L260 100 L300 136 L280 170 L262 160 L266 330 Q264 380 232 400 L214 400 L200 356 L186 400 L168 400 Q136 380 134 330 L138 160 L120 170 L100 136 Z', p);
    s += stitch('M138 320 Q200 340 262 320', p);
    if (!back) s += `<path d="M178 84 Q200 118 222 84" fill="none" stroke="${p.deep}" stroke-width="4"/>` + [180, 214, 248].map((y) => btn(200, y, p, 4)).join('') + [184, 200, 216].map((x) => btn(x, 386, p, 3)).join('');
    return s;
  },

  sneaker: (p, back) => {
    const flip = back ? 'transform="translate(400 0) scale(-1 1)"' : '';
    let s = `<g ${flip}>`;
    s += `<path d="M52 330 Q52 300 80 296 L170 286 Q210 230 262 222 L300 222 Q330 230 340 268 L352 300 Q356 326 336 334 Z" fill="${p.base}" stroke="${p.line}" stroke-width="1.8"/>`;
    s += `<path d="M48 334 Q48 356 76 360 L338 360 Q362 358 360 334 Q358 324 340 326 L64 326 Q48 326 48 334Z" fill="#F7F4EE" stroke="#bdb5a7" stroke-width="1.5"/>`;
    s += `<path d="M52 350 L360 350" stroke="#d8d1c4" stroke-width="3"/>`;
    s += `<path d="M52 330 Q56 300 84 298 L130 292 Q116 318 124 326 Z" fill="${p.shade}"/>`;
    s += `<path d="M262 222 L300 222 Q330 230 340 268 L352 300 Q330 290 300 292 Q286 250 262 222Z" fill="${p.shade}" stroke="${p.line}"/>`;
    for (let i = 0; i < 5; i++) s += `<path d="M${186 + i * 17} ${276 - i * 9} l22 10" stroke="${p.light}" stroke-width="4" stroke-linecap="round"/>`;
    s += stitch('M84 318 L330 318', p);
    s += `</g>`;
    return s;
  },
};

export function garmentSvg(kind: string, hex: string, view: string) {
  const p = palette(/^[0-9a-f]{6}$/i.test(hex) ? hex : '9E9E9E');
  const draw = DRAW[kind] ?? DRAW.tshirt;
  const back = view === 'back';
  const detail = view === 'detail';
  const art = draw(p, back);
  const vb = detail ? (kind === 'sneaker' ? '150 170 200 250' : kind === 'saree' ? '200 120 160 200' : '110 40 180 225') : '0 0 400 500';
  const weave = detail
    ? `<pattern id="w" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="none"/><path d="M0 0 V6" stroke="${p.deep}" stroke-width="1" opacity=".18"/></pattern>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="800" height="1000" preserveAspectRatio="xMidYMid slice">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.bg}"/><stop offset="1" stop-color="${p.bg2}"/></linearGradient>
  <radialGradient id="sh" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#000" stop-opacity=".16"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
  <linearGradient id="gl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".10"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  ${weave}
</defs>
<rect x="-200" y="-200" width="800" height="900" fill="url(#bg)"/>
<ellipse cx="200" cy="${kind === 'sneaker' ? 372 : 478}" rx="${kind === 'sneaker' ? 170 : 150}" ry="16" fill="url(#sh)"/>
<g>${art}</g>
<rect x="150" y="0" width="100" height="500" fill="url(#gl)" style="mix-blend-mode:screen"/>
${detail ? `<rect x="0" y="0" width="400" height="500" fill="url(#w)"/>` : ''}
</svg>`;
}
