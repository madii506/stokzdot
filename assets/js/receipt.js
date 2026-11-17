/* bankz: every confirmed move prints a receipt. A slip of thermal paper feeds out of the slot under the tape, line by line:
   what happened, your account number, a barcode drawn from the transaction signature and a link to it on Solscan.
   Receipts are only printed for transactions the chain confirmed. This browser keeps the last 40 as your statement. */
(function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch { } } };
  const A58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wallet = () => (window.MarketsWallet && window.MarketsWallet.W && window.MarketsWallet.W.addr) || null;

  // an account number for every wallet: 12 digits hashed from the address. A label for your receipts, not a bank account.
  function acct(addr) {
    if (!addr) return null;
    let h1 = 0x811c9dc5, h2 = 0x01000193;
    for (let i = 0; i < addr.length; i++) { const c = addr.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619) >>> 0; h2 = Math.imul(h2 ^ (c * 31 + i), 2246822519) >>> 0; }
    const d = String(h1 % 1e6).padStart(6, '0') + String(h2 % 1e6).padStart(6, '0');
    return `BZ ${d.slice(0, 4)} ${d.slice(4, 8)} ${d.slice(8, 12)}`;
  }
  // a barcode from the signature: each base58 character sets one bar's width and the gap after it
  function bars(sig) {
    const out = []; let x = 0;
    for (const ch of String(sig || 'stokz').slice(0, 44)) { const v = Math.max(0, A58.indexOf(ch)), w = 1 + (v % 3), gap = 1 + ((v >> 2) % 2); out.push([x, w]); x += w + gap; }
    return { bars: out, w: x };
  }
  const svgBars = sig => { const b = bars(sig); return `<svg class="rc-bc" viewBox="0 0 ${b.w} 30" preserveAspectRatio="none" aria-hidden="true">${b.bars.map(([x, w]) => `<rect x="${x}" y="0" width="${w}" height="30"/>`).join('')}</svg>`; };
  const stamp = t => { const d = new Date(t); return d.toISOString().slice(0, 10) + ' · ' + d.toISOString().slice(11, 19) + ' UTC'; };

  // ---------------------------------------------------------------- the statement: receipts this browser printed
  const KEY = 'bankz.receipts';
  const all = () => { try { return JSON.parse(store.get(KEY) || '[]'); } catch { return []; } };
  function keep(r) { const L = all().filter(x => x.sig !== r.sig || !r.sig); L.push(r); store.set(KEY, JSON.stringify(L.slice(-40))); }
  const mine = () => { const a = wallet(); return all().filter(r => !a || r.addr === a).reverse(); };

  // ---------------------------------------------------------------- the printer
  function host() {
    let h = document.getElementById('rcpt');
    if (!h) {
      h = document.createElement('div'); h.id = 'rcpt'; h.setAttribute('aria-live', 'polite');
      h.innerHTML = '<div class="rc-slot" aria-hidden="true"><i></i></div>'; document.body.appendChild(h);
    }
    const tape = document.querySelector('.tape'), top = tape ? Math.max(8, Math.round(tape.getBoundingClientRect().bottom) + 6) : 12;
    h.style.top = top + 'px';
    return h;
  }
  const slip = (r, live) => `<div class="rc-in">
      <div class="rc-h"><b>stokz</b><span>THE CITY'S STOCK MARKET</span></div>
      <div class="rc-t">${esc(r.title || 'RECEIPT')}</div>
      <div class="rc-d">${esc(stamp(r.t))}${r.addr ? '<br>ACCT ' + esc(acct(r.addr)) : ''}</div>
      <div class="rc-hr"></div>${(r.rows || []).map(([k, v]) => `<div class="rc-r"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}<div class="rc-hr"></div>
      ${r.note ? `<div class="rc-n">${esc(r.note)}</div>` : ''}
      ${r.sig ? svgBars(r.sig) + `<a class="rc-tx" href="https://solscan.io/tx/${esc(r.sig)}" target="_blank" rel="noopener">TX ${esc(r.sig.slice(0, 6))}…${esc(r.sig.slice(-6))} ↗</a>` : ''}
      <div class="rc-f">THANK YOU FOR BANKING WITH US</div>
      ${live ? '<div class="rc-b"><button type="button" data-rsave>save</button><button type="button" data-rpost>post</button><button type="button" data-rx aria-label="tear off">×</button></div>' : ''}
    </div>`;
  let cur = null;
  // tear it off (×, or a new receipt), or, when it times out, file it into the statement icon in the bar
  function tear(el, file) {
    if (!el || !el.isConnected || el.classList.contains('out')) return; clearTimeout(el._t); if (cur === el) cur = null;
    const ic = document.querySelector('.bar [data-stmt]'), r2 = ic && ic.getBoundingClientRect();
    if (file && r2 && r2.width && !still()) {
      const r1 = el.getBoundingClientRect(), dx = r2.left + r2.width / 2 - (r1.left + r1.width / 2), dy = r2.top + r2.height / 2 - (r1.top + r1.height / 2);
      el.classList.add('out', 'filed'); el.style.transform = `translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px) scale(.05) rotate(-10deg)`;
      setTimeout(() => { ic.classList.remove('bump'); void ic.offsetWidth; ic.classList.add('bump'); }, 420);
    } else el.classList.add('out');
    setTimeout(() => { el.remove(); const h = document.getElementById('rcpt'); if (h && !h.querySelector('.rc')) h.classList.remove('on'); }, 560);
  }
  function print(o) {
    const r = { t: Date.now(), title: o.title, rows: o.rows || [], note: o.note || '', sig: o.sig || '', addr: wallet() || o.addr || null, share: o.share || '' };
    keep(r);
    const h = host(), go = () => {
      const el = document.createElement('div'); el.className = 'rc' + (still() ? ' now' : '');
      el.innerHTML = `<div class="rc-p">${slip(r, true)}</div>`;
      h.appendChild(el); h.classList.add('on'); cur = el;
      const n = el.querySelectorAll('.rc-in > *').length; el.style.setProperty('--lines', Math.max(8, n + 4));
      const arm = ms => { clearTimeout(el._t); el._t = setTimeout(() => tear(el, true), ms); };
      arm(10000);
      el.addEventListener('pointerenter', () => clearTimeout(el._t)); el.addEventListener('pointerleave', () => arm(6000));
      el.querySelector('[data-rx]').onclick = () => tear(el);
      el.querySelector('[data-rsave]').onclick = () => save(r);
      el.querySelector('[data-rpost]').onclick = () => { const txt = `${r.share || r.title || 'Traded'} on stokz.`; window.open('https://x.com/intent/post?text=' + encodeURIComponent(txt + ' ' + location.origin), '_blank', 'noopener'); };
      if (navigator.vibrate && matchMedia('(pointer: coarse)').matches) try { navigator.vibrate([6, 40, 6, 40, 6]); } catch { }
    };
    if (cur) { tear(cur); setTimeout(go, still() ? 0 : 380); } else go();
    paintCount();
  }

  // the same slip as a picture to keep or post
  function save(r) {
    const rows = r.rows || [], W = 640, H = 470 + rows.length * 44 + (r.note ? 40 : 0) + (r.addr ? 22 : 0), c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    g.fillStyle = '#03120d'; g.fillRect(0, 0, W, H);
    const px = 70, pw = W - 140, bot = H - 30; g.fillStyle = '#fbf6e8'; g.beginPath(); g.moveTo(px, 30); g.lineTo(px + pw, 30);
    for (let x = px + pw; x > px; x -= 16) { g.lineTo(x, bot - 10); g.lineTo(x - 8, bot); } g.lineTo(px, bot - 10); g.closePath(); g.fill();
    g.fillStyle = '#1a140a'; g.textAlign = 'center'; let y = 98;
    g.font = '400 50px Bowlby, sans-serif'; g.fillText('stokz', W / 2, y); y += 30;
    g.font = '600 13px JBM, monospace'; g.fillText("THE CITY'S STOCK MARKET", W / 2, y); y += 44;
    g.font = '800 21px JBM, monospace'; g.fillText(String(r.title || 'RECEIPT').toUpperCase(), W / 2, y); y += 30;
    g.font = '500 13px JBM, monospace'; g.fillText(stamp(r.t), W / 2, y); y += 22; if (r.addr) { g.fillText('ACCT ' + acct(r.addr), W / 2, y); y += 22; }
    const dash = yy => { g.save(); g.setLineDash([5, 5]); g.strokeStyle = '#1a140a'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(px + 24, yy); g.lineTo(px + pw - 24, yy); g.stroke(); g.restore(); };
    y += 2; dash(y); y += 36;
    g.font = '600 15px JBM, monospace';
    for (const [k, v] of rows) { g.textAlign = 'left'; g.fillText(String(k).toUpperCase(), px + 30, y); g.textAlign = 'right'; g.fillText(String(v), px + pw - 30, y); y += 44; }
    y -= 20; dash(y); y += 32; g.textAlign = 'center';
    if (r.note) { g.font = '500 13px JBM, monospace'; g.fillText(r.note, W / 2, y); y += 36; }
    const b = bars(r.sig), k = Math.min(1.8, (pw - 90) / b.w), x0 = W / 2 - b.w * k / 2;
    for (const [x, w] of b.bars) g.fillRect(x0 + x * k, y, w * k, 48);
    y += 72; g.font = '600 12px JBM, monospace'; if (r.sig) { g.fillText('TX ' + r.sig.slice(0, 10) + '…' + r.sig.slice(-10), W / 2, y); y += 26; }
    g.font = '700 12px JBM, monospace'; g.fillText('THANK YOU FOR BANKING WITH US', W / 2, y);
    c.toBlob(bl => { const u = URL.createObjectURL(bl), a = document.createElement('a'); a.href = u; a.download = 'stokz-receipt.png'; a.click(); setTimeout(() => URL.revokeObjectURL(u), 4000); }, 'image/png');
  }

  // ---------------------------------------------------------------- the statement drawer
  function statement() {
    let d = document.getElementById('stmt');
    if (!d) {
      d = document.createElement('div'); d.id = 'stmt'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-label', 'Statement');
      document.body.appendChild(d);
      d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-sx]')) close(); });
      document.addEventListener('keydown', e => { if (e.key === 'Escape' && d.classList.contains('on')) { e.stopPropagation(); close(); } }, true);
    }
    const a = wallet(), L = mine();
    d.innerHTML = `<div class="st-roll"><div class="st-p">
      <div class="st-top"><div><b>stokz</b><span>STATEMENT</span></div><button type="button" data-sx aria-label="close">×</button></div>
      <div class="st-acct">${a ? 'ACCT ' + esc(acct(a)) : 'NO WALLET CONNECTED'}<br>${esc(new Date().toISOString().slice(0, 10))} · ${L.length} ${L.length === 1 ? 'RECEIPT' : 'RECEIPTS'} PRINTED HERE</div>
      <div class="rc-hr"></div>
      ${L.length ? L.map(r => `<div class="st-e"><div class="st-eh"><b>${esc(r.title)}</b><span>${esc(stamp(r.t).replace(' UTC', ''))}</span></div>${(r.rows || []).slice(0, 4).map(([k, v]) => `<div class="rc-r"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}${r.sig ? `<a class="rc-tx" href="https://solscan.io/tx/${esc(r.sig)}" target="_blank" rel="noopener">TX ${esc(r.sig.slice(0, 6))}…${esc(r.sig.slice(-6))} ↗</a>` : ''}</div>`).join('')
        : `<div class="st-empty">No receipts yet. Every lock, claim and trade the chain confirms prints one here.</div>`}
      <div class="rc-hr"></div><div class="rc-f">KEPT IN THIS BROWSER ONLY · EVERY TX LIVES ON SOLANA</div>
    </div></div>`;
    d.hidden = false; requestAnimationFrame(() => d.classList.add('on'));
    const x = d.querySelector('[data-sx]'); x && x.focus({ preventScroll: true });
    function close() { d.classList.remove('on'); setTimeout(() => { if (!d.classList.contains('on')) d.hidden = true; }, 380); }
  }
  // a count of receipts on any [data-stmt] button
  function paintCount() { const n = mine().length; document.querySelectorAll('[data-stmt] em').forEach(e => { e.textContent = n ? String(n) : ''; }); }
  document.addEventListener('click', e => { const b = e.target.closest('[data-stmt]'); if (b) statement(); });
  window.Receipt = { print, acct, statement, count: () => mine().length, paintCount };
  // the bar's statement icon shows how many receipts this wallet has here; it follows wallet switches
  let lastA = null; paintCount(); setInterval(() => { if (document.hidden) return; const w = wallet(); if (w !== lastA) { lastA = w; paintCount(); } }, 1500);
})();
