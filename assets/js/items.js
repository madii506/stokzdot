/* bankz: city items. Line icons drawn on a 64-unit grid, white strokes on a night tile.
   Used for the city cards and, at claim time, rendered to a PNG that becomes the coin image. */
(function () {
  const ICON = {
    // ---------------- real estate
    hotel: '<rect x="19" y="16" width="26" height="40" rx="2"/><path d="M14 56h36"/><path d="M24 23h4M30 23h4M36 23h4M24 30h4M30 30h4M36 30h4M24 37h4M30 37h4M36 37h4"/><path d="M28 56v-9h8v9"/><path d="M32 16V7l8 3-8 3"/>',
    penthouse: '<path d="M22 58V26h20v32"/><path d="M18 26h28l-4-10H22z"/><path d="M27 32v20M32 32v20M37 32v20"/><path d="M16 58h32"/><path d="M25 12c2-2 4-2 6 0s4 2 6 0"/>',
    island: '<path d="M6 50c4-3 7-3 10 0s7 3 10 0 7-3 10 0 7 3 10 0 7-3 10 0"/><path d="M15 45c6-7 28-7 34 0"/><path d="M31 41c1-8 0-15-3-22"/><path d="M28 19c-5-3-11-2-14 3M28 19c-1-5-5-8-10-8M28 19c4-4 10-4 13 0M28 19c5-1 9 2 10 7"/><circle cx="50" cy="13" r="4"/>',
    mansion: '<path d="M8 29L32 13l24 16"/><path d="M13 29v26h38V29"/><path d="M20 34v16M26 34v16M38 34v16M44 34v16"/><path d="M29 55V44h6v11"/><path d="M8 55h48"/>',
    marina: '<path d="M30 9v29"/><path d="M31 11l13 24H31"/><path d="M28 15l-9 20h9"/><path d="M13 40h37l-6 7H19z"/><path d="M6 55c4-3 7-3 10 0s7 3 10 0 7-3 10 0 7 3 10 0 7-3 10 0"/>',
    motel: '<path d="M6 34h36v20H6z"/><path d="M12 54v-10h5v10M22 54v-10h5v10M32 54v-10h5v10"/><path d="M53 54V24"/><path d="M53 9l2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/><path d="M4 54h54"/>',
    lofts: '<rect x="13" y="16" width="38" height="40"/><path d="M19 30v-5a3 3 0 0 1 6 0v5zM29 30v-5a3 3 0 0 1 6 0v5zM39 30v-5a3 3 0 0 1 6 0v5zM19 46v-5a3 3 0 0 1 6 0v5zM29 46v-5a3 3 0 0 1 6 0v5zM39 46v-5a3 3 0 0 1 6 0v5z"/><path d="M13 16l4-5h30l4 5"/><path d="M9 56h46"/>',
    pier: '<circle cx="40" cy="22" r="13"/><path d="M40 9v26M27 22h26M30.8 12.8l18.4 18.4M49.2 12.8L30.8 31.2"/><path d="M34 52l6-17 6 17"/><path d="M4 44h30M10 44v8M20 44v8M30 44v8"/><path d="M4 56c4-3 7-3 10 0s7 3 10 0 7-3 10 0 7 3 10 0 7-3 10 0"/>',
    // ---------------- businesses
    club: '<path d="M32 5v9"/><circle cx="32" cy="33" r="17"/><path d="M15 33h34M18 24h28M18 42h28"/><ellipse cx="32" cy="33" rx="8" ry="17"/><path d="M53 9v6M50 12h6M10 50v6M7 53h6"/>',
    bar: '<path d="M13 14h38L32 35z"/><path d="M32 35v17M22 52h20"/><path d="M41 6l-7 15"/><circle cx="33.5" cy="22" r="2.6"/>',
    wash: '<path d="M8 50h48v-8l-6-2-6-8H26l-7 8-8 2z"/><circle cx="20" cy="50" r="5"/><circle cx="44" cy="50" r="5"/><circle cx="20" cy="15" r="4"/><circle cx="31" cy="9" r="3"/><circle cx="42" cy="17" r="5"/><circle cx="52" cy="8" r="2.6"/>',
    diner: '<path d="M14 25h30v13a12 12 0 0 1-12 12h-6a12 12 0 0 1-12-12z"/><path d="M44 29h3a5 5 0 0 1 0 10h-3"/><path d="M9 56h44"/><path d="M22 19c-3-3 0-6-1-9M30 19c-3-3 0-6-1-9M38 19c-3-3 0-6-1-9"/>',
    arcade: '<rect x="11" y="39" width="42" height="15" rx="3"/><path d="M32 39V21"/><circle cx="32" cy="16" r="6"/><circle cx="20" cy="46.5" r="2.6"/><circle cx="44" cy="46.5" r="2.6"/>',
    tattoo: '<circle cx="32" cy="11" r="4"/><path d="M32 15v40"/><path d="M22 23h20"/><path d="M13 40c3 10 10 15 19 15s16-5 19-15"/><path d="M9 43l4-5 4 5M47 43l4-5 4 5"/>',
    pawn: '<path d="M10 9h44"/><path d="M19 9v10M45 9v10M32 9v24"/><circle cx="19" cy="25" r="6.5"/><circle cx="45" cy="25" r="6.5"/><circle cx="32" cy="41" r="6.5"/>',
    taco: '<path d="M7 47V22h34v25"/><path d="M41 47V30h8l7 8v9z"/><path d="M12 28h24v8H12z"/><path d="M9 22l3-6h26l3 6"/><circle cx="17" cy="49" r="5"/><circle cx="47" cy="49" r="5"/><path d="M4 47h4M22 47h20"/>',
    // ---------------- rides
    supercar: '<path d="M5 44h54v-4c-2-4-6-5-11-6l-9-7c-4-2-8-2-14-2h-4c-6 0-9 3-12 7l-4 1c-5 1-7 4-8 7z"/><path d="M22 33l5-6h9l7 6z"/><circle cx="17" cy="45" r="5.5"/><circle cx="47" cy="45" r="5.5"/>',
    muscle: '<path d="M5 44h54v-8H48l-6-9H22l-6 9H5z"/><path d="M11 36h9l2-3h-9z"/><path d="M24 35l3-5h12l3 5z"/><circle cx="17" cy="45" r="6"/><circle cx="47" cy="45" r="6"/>',
    bike: '<circle cx="15" cy="44" r="9"/><circle cx="49" cy="44" r="9"/><path d="M15 44l12-14h12l10 14"/><path d="M27 30l7 14 5-14"/><path d="M39 30l4-8h6"/><path d="M23 27h10"/>',
    limo: '<path d="M3 44h58v-6l-6-2-5-7H19l-5 7-8 1-3 3z"/><path d="M23 33h8M35 33h8M47 33h4"/><circle cx="14" cy="45" r="5"/><circle cx="50" cy="45" r="5"/>',
    boat: '<path d="M6 38h48l-8 10H14z"/><path d="M20 38l6-8h11l3 8"/><path d="M58 46c-5-1-8 1-11 4"/><path d="M4 56c4-3 7-3 10 0s7 3 10 0 7-3 10 0 7 3 10 0 7-3 10 0"/>',
    yacht: '<path d="M4 40h56l-8 10H12z"/><path d="M14 40v-8h36l6 8"/><path d="M22 32v-7h22l4 7"/><path d="M33 25v-8M29 19h8"/><path d="M19 36h4M27 36h4M35 36h4M43 36h4"/><path d="M4 57c4-3 7-3 10 0s7 3 10 0 7-3 10 0 7 3 10 0 7-3 10 0"/>',
    jet: '<path d="M6 37c0-4 3-6 8-6h34c7 0 11 2 12 6-1 4-5 6-12 6H14c-5 0-8-2-8-6z"/><path d="M15 31L9 17h6l10 14"/><path d="M30 43l-8 12h6l12-12"/><path d="M28 36h1.5M34 36h1.5M40 36h1.5"/>',
    heli: '<path d="M18 30h20a10 10 0 0 1 10 10v2a4 4 0 0 1-4 4H22a8 8 0 0 1-8-8v-4a4 4 0 0 1 4-4z"/><path d="M48 38h12M60 33v10"/><path d="M8 22h48M32 22v8"/><path d="M20 53h26M25 46v7M39 46v7"/><path d="M34 32h8v6h-8z"/>',
  };
  // night sky: top, middle, horizon, neon (the accent: lit windows and the icon's offset line)
  const PAL = {
    estate: ['#020d09', '#07291c', '#0f4a33', '#ffcd4a'],
    biz: ['#020d09', '#06251f', '#0c4a3c', '#2ee6a0'],
    ride: ['#020d09', '#14200c', '#33461a', '#ffb13d'],
  };
  const CAT = { estate: 'real estate', biz: 'business', ride: 'ride' };
  let uid = 0;
  // the tile: a night sky, one searchlight, a few stars, a dark skyline with lit windows, the icon in white over a neon offset
  function seed(str) { let h = 2166136261; for (const ch of String(str || 'x')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296; }
  function tile(it, size, opt) {
    opt = opt || {};
    const p = PAL[it.cat] || PAL.estate, id = 't' + (uid++), R = seed(it.id || it.icon || it.name), r = opt.r != null ? opt.r : 0;
    const sw = opt.stroke || 2.4, ic = ICON[it.icon] || '';
    const sx = 8 + R() * 84, bx = sx + (R() < .5 ? -1 : 1) * (18 + R() * 22);
    let stars = ''; for (let k = 0; k < 7; k++) stars += `<rect x="${(R() * 96 + 2).toFixed(1)}" y="${(R() * 34 + 3).toFixed(1)}" width="${k % 3 ? .8 : 1.3}" height="${k % 3 ? .8 : 1.3}" fill="#fff" opacity="${(.35 + R() * .5).toFixed(2)}"/>`;
    let sky = 'M0 100', win = '', x = 0;
    while (x < 100) { const w = 5 + Math.floor(R() * 7), h = 3 + Math.floor(R() * 9); sky += `V${100 - h}h${w}`; if (h > 5 && R() < .7) win += `<rect x="${(x + 1.5 + R() * (w - 3)).toFixed(1)}" y="${(100 - h + 1.5 + R() * (h - 3)).toFixed(1)}" width="1" height="1" fill="${p[3]}" opacity=".85"/>`; x += w; }
    sky += 'V100z';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}"${opt.slice ? ' preserveAspectRatio="xMidYMid slice"' : ''}>
      <defs><linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p[0]}"/><stop offset=".5" stop-color="${p[1]}"/><stop offset=".88" stop-color="${p[2]}"/><stop offset="1" stop-color="${p[2]}"/></linearGradient>
      <clipPath id="${id}c"><rect width="100" height="100" rx="${r}"/></clipPath></defs>
      <g clip-path="url(#${id}c)"><rect width="100" height="100" fill="url(#${id}g)"/>
      <polygon points="${sx.toFixed(1)},-2 ${(sx + 2.5).toFixed(1)},-2 ${(bx + 15).toFixed(1)},101 ${(bx - 15).toFixed(1)},101" fill="#dff8ff" opacity=".07"/>${stars}
      <path d="${sky}" fill="#05041a"/>${win}</g>
      <g transform="translate(19.3 19.3)" fill="none" stroke="${p[3]}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" opacity=".9">${ic}</g>
      <g transform="translate(18 18)" fill="none" stroke="#fff" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${ic}</g>
    </svg>`;
  }
  // PNG for the coin image (pump.fun shows it everywhere the coin is listed)
  function png(it, size) {
    return new Promise((ok, no) => {
      const svg = tile(it, size, { stroke: 2.2, r: 0 });
      const img = new Image();
      img.onload = () => { const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); g.drawImage(img, 0, 0, size, size); try { ok(c.toDataURL('image/png')); } catch (e) { no(e); } };
      img.onerror = () => no(new Error('could not draw the coin image'));
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
  }
  // the real photo of an item (made once on the server, served from the CDN); the line tile stays underneath as the fallback
  function photo(it, thumb) { const u = it.img || `/api/m?a=cimg&id=${encodeURIComponent(it.id)}&v=n1`; return thumb ? u + '&s=t' : u; }
  // bankz draws the city as gold line art on night tiles: no photos (they would need a paid image model)
  function art(it, size, opt) { return tile(it, size, Object.assign({ r: 0, slice: true }, opt || {})); }
  // the coin image for a launch: the item's photo cropped square, else the line tile
  function photoPng(it, size) { return png(it, size).catch(() => null); }

  window.MarketsItems = { ICON, PAL, CAT, tile, png, photo: null, art, photoPng };
})();
