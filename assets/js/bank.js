/* bankz: the vault. Safe-deposit boxes are Jupiter Lock escrows (the open-source lock program behind lock.jup.ag):
   your browser builds the lock, your wallet signs it, and nobody (not you, not bankz) can open a box before its date.
   Also here: the vault wall (every box made here, read back from the chain), your card, the teller and savings. */
(function () {
  const WAL = window.MarketsWallet;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const short = a => a ? a.slice(0, 4) + '…' + a.slice(-4) : '';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { } } };
  async function api(a, p) { const r = await fetch('/api/m?a=' + a + (p ? '&' + new URLSearchParams(p) : ''), { cache: 'no-store' }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'request failed'); return j; }
  async function post(a, b) { const r = await fetch('/api/m?a=' + a, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'request failed'); return j; }
  const relay = async b64 => (await post('send', { tx: b64 })).sig;
  const acct = a => (window.Receipt && window.Receipt.acct(a)) || ('BZ •••• •••• ' + String(a || '').slice(-4).toUpperCase());
  const RC = o => { try { window.Receipt && window.Receipt.print(o); } catch (e) { console.warn('receipt', e); } };   // a receipt only after the chain confirms
  const toast = m => { const t = $('#toast'); if (!t) return; t.textContent = m; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2800); };
  const usd = x => x == null ? '—' : x >= 1e6 ? '$' + (x / 1e6).toFixed(2) + 'M' : x >= 1e4 ? '$' + (x / 1e3).toFixed(1) + 'K' : x >= 1 ? '$' + x.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 }) : x > 0 ? '$' + x.toPrecision(2) : '$0.00';
  const amt = x => x == null ? '—' : x >= 1e9 ? (x / 1e9).toFixed(2) + 'B' : x >= 1e6 ? (x / 1e6).toFixed(2) + 'M' : x >= 1e3 ? (x / 1e3).toFixed(1) + 'K' : x >= 1 ? x.toFixed(2) : x > 0 ? x.toPrecision(3) : '0';
  const int = x => Math.round(x).toLocaleString();
  const DAY = 86400, now = () => Math.floor(Date.now() / 1000);
  const left = s => { if (s <= 0) return 'now'; const d = Math.floor(s / DAY), h = Math.floor(s % DAY / 3600), m = Math.floor(s % 3600 / 60); return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m ${s % 60}s`; };
  const day = t => new Date(t * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  const KEY = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="8" cy="8" r="5"/><path d="M11.5 11.5 21 21M17 17l2-2M14.5 14.5l2-2"/></svg>';
  const SOL_MINT = 'So11111111111111111111111111111111111111112';

  // ---------------------------------------------------------------- the lock program (Jupiter Lock), encoded by hand
  const P = { LOCK: 'LocpQgucEQHbqNABEYvBvwoxCPsSbG91A1QaQhQQqjn', ATA: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL', TOKEN: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', T22: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb', MEMO: 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr' };
  const u64 = v => { const b = new Uint8Array(8); let x = BigInt(v); for (let i = 0; i < 8; i++) { b[i] = Number(x & 255n); x >>= 8n; } return b; };
  const cat = (...a) => { const o = new Uint8Array(a.reduce((s, x) => s + x.length, 0)); let k = 0; for (const x of a) { o.set(x, k); k += x.length; } return o; };
  const enc = s => new TextEncoder().encode(s);
  const meta = (pubkey, isSigner, isWritable) => ({ pubkey, isSigner: !!isSigner, isWritable: !!isWritable });
  function keys(S, prog) {
    const K = x => new S.PublicKey(x), LK = K(P.LOCK), TP = K(prog === 't22' ? P.T22 : P.TOKEN);
    return { K, LK, TP, ATA: K(P.ATA), ev: S.PublicKey.findProgramAddressSync([enc('__event_authority')], LK)[0],
      ata: (owner, mint) => S.PublicKey.findProgramAddressSync([owner.toBytes(), TP.toBytes(), mint.toBytes()], K(P.ATA))[0] };
  }
  const ataIx = (S, k, payer, ataAddr, owner, mint) => new S.TransactionInstruction({ programId: k.ATA, data: Uint8Array.of(1), keys: [meta(payer, 1, 1), meta(ataAddr, 0, 1), meta(owner), meta(mint), meta(S.SystemProgram.programId), meta(k.TP)] });
  // create_vesting_escrow_v2: everything unlocks at once at `unlock`; nobody can cancel it or change who receives it
  async function lockTx({ owner, mint, prog, from, raw, unlock, blockhash }) {
    const S = await WAL.web3(), k = keys(S, prog), U = k.K(owner), M = k.K(mint), base = S.Keypair.generate();
    const escrow = S.PublicKey.findProgramAddressSync([enc('escrow'), base.publicKey.toBytes()], k.LK)[0], escrowToken = k.ata(escrow, M);
    const data = cat(Uint8Array.from([181, 155, 104, 183, 182, 128, 35, 47]), u64(unlock), u64(unlock), u64(1), u64(raw), u64(0), u64(0), Uint8Array.of(0, 0, 0));
    const lock = new S.TransactionInstruction({ programId: k.LK, data, keys: [meta(base.publicKey, 1, 1), meta(escrow, 0, 1), meta(M), meta(escrowToken, 0, 1), meta(U, 1, 1), meta(k.K(from), 0, 1), meta(U), meta(k.TP), meta(S.SystemProgram.programId), meta(k.ev), meta(k.LK)] });
    const msg = new S.TransactionMessage({ payerKey: U, recentBlockhash: blockhash, instructions: [S.ComputeBudgetProgram.setComputeUnitLimit({ units: 160000 }), S.ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 40000 }), ataIx(S, k, U, escrowToken, escrow, M), lock] }).compileToV0Message();
    return { tx: new S.VersionedTransaction(msg), base, escrow: escrow.toBase58() };
  }
  // claim_v2: everything the box holds goes back to the wallet it was locked for
  async function claimTx({ owner, escrow, mint, prog, blockhash }) {
    const S = await WAL.web3(), k = keys(S, prog), U = k.K(owner), M = k.K(mint), E = k.K(escrow), mine = k.ata(U, M);
    const data = cat(Uint8Array.from([229, 87, 46, 162, 21, 157, 231, 114]), u64((1n << 64n) - 1n), Uint8Array.of(0));
    const claim = new S.TransactionInstruction({ programId: k.LK, data, keys: [meta(E, 0, 1), meta(M), meta(k.ata(E, M), 0, 1), meta(U, 1, 1), meta(mine, 0, 1), meta(k.K(P.MEMO)), meta(k.TP), meta(k.ev), meta(k.LK)] });
    const msg = new S.TransactionMessage({ payerKey: U, recentBlockhash: blockhash, instructions: [S.ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 40000 }), ataIx(S, k, U, mine, U, M), claim] }).compileToV0Message();
    return new S.VersionedTransaction(msg);
  }
  const toB64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); };
  async function waitSig(sig) { for (let k = 0; k < 50; k++) { try { const s = await api('status', { sig }); if (s.status === 'failed') return 'failed'; if (s.status === 'confirmed' || s.status === 'finalized') return 'ok'; } catch { } await sleep(1500); } return 'unknown'; }

  // ---------------------------------------------------------------- data: your bag and the vault
  const D = { bag: null, bagErr: null, vault: null, vaultErr: null, sel: null, amt: '', term: 30, busy: false, filter: 'all', tSel: null, tAmt: '', tCa: '', tSol: '', sv: '0.1' };
  const MINE = () => JSON.parse(store.get('bankz.boxes') || '[]');
  const remember = b => { const m = MINE().filter(x => x.escrow !== b.escrow); m.push(b); store.set('bankz.boxes', JSON.stringify(m.slice(-60))); };
  async function loadBag(force) {
    const a = WAL.W.addr; if (!a) { D.bag = null; return; }
    if (!force && D.bag && D.bag.wallet === a && Date.now() - D.bag.t < 15000) return;
    try { const w = await api('wallet', { addr: a }); w.wallet = a; w.t = Date.now(); D.bag = w; D.bagErr = null; } catch (e) { D.bagErr = e.message; }
  }
  async function loadVault() {
    try { D.vault = await api('boxes'); D.vaultErr = null; } catch (e) { D.vaultErr = e.message; }
    // boxes this browser made that the registry has not listed yet: register them again
    if (D.vault && D.vault.online) { const have = new Set(D.vault.boxes.map(b => b.escrow)); for (const b of MINE()) if (!have.has(b.escrow) && Date.now() - (b.t || 0) < 7 * DAY * 1000) post('boxadd', { escrow: b.escrow, sig: b.sig }).catch(() => { }); }
  }
  const myBoxes = () => (D.vault && D.vault.boxes || []).filter(b => WAL.W.addr && b.owner === WAL.W.addr);
  const lockable = () => (D.bag && D.bag.tokens || []).filter(t => t.mint !== SOL_MINT && t.raw && BigInt(t.top || t.raw) > 0n);

  // ---------------------------------------------------------------- the card: your score is dollars locked × days locked
  const TIERS = [{ k: 'debit', at: 0, name: 'Debit' }, { k: 'gold', at: 1000, name: 'Gold' }, { k: 'platinum', at: 25000, name: 'Platinum' }, { k: 'black', at: 250000, name: 'Black card' }];
  function score() { return myBoxes().filter(b => b.state === 'locked').reduce((a, b) => a + (b.usd || 0) * Math.max(1, (b.unlock - b.start) / DAY), 0); }
  function tierOf(s) { let t = TIERS[0]; for (const x of TIERS) if (s >= x.at) t = x; return t; }

  // ---------------------------------------------------------------- the page
  function build(el) {
    el.innerHTML = `
    <div class="bk-h"><div><h1>The vault</h1><div class="lead">Lock a bag in a safe-deposit box and it stays shut until its date. Not you, not us, nobody opens it early. Every box in the city is on the wall below, read straight from Solana.</div></div><div class="bk-tot" id="bkTot"></div></div>
    <div class="bk-top">
      <div class="pn bk-lock">
        <div class="sf-sec"><span class="eb">01</span><b>lock a bag</b><span class="mute">a safe-deposit box on Jupiter Lock</span></div>
        <div id="bkForm"></div>
      </div>
      <div class="pn bk-cardp">
        <div class="sf-sec"><span class="eb">02</span><b>your card</b><span class="bk-cb"><button class="kb" data-stmt>statement<em></em></button><button class="kb" id="bkShare">share my card</button></span></div>
        <div id="bkCard"></div>
      </div>
    </div>
    <div class="sf-sec sf-wide"><span class="eb">03</span><b>the vault wall</b><span class="seg" id="bkFilt"><button data-f="all" class="on">all</button><button data-f="locked">locked</button><button data-f="open">opening</button><button data-f="mine">mine</button></span></div>
    <div class="bk-wall" id="bkWall"></div>
    <div class="bk-grid">
      <div class="pn bk-teller"><div class="sf-sec"><span class="eb">04</span><b>teller</b><span class="mute">cash a meme out, or buy one by its CA</span></div><div id="bkTeller"></div></div>
      <div class="pn bk-save"><div class="sf-sec"><span class="eb">05</span><b>savings</b><span class="mute">stack the wins in gold or the S&amp;P</span></div><div id="bkSave"></div></div>
    </div>
    <div class="sf-sec sf-wide"><span class="eb">06</span><b>the rules</b></div>
    <div class="rl">
      <div class="pn rl-c"><div class="rl-h"><i></i>bankz never</div><ul>
        <li><b>Holds your bag.</b> A box is an escrow account of the Jupiter Lock program. bankz has no key to it.</li>
        <li><b>Opens a box early.</b> Every box is made with cancel and redirect switched off, for everyone.</li>
        <li><b>Sees your keys.</b> Your wallet signs every lock, claim and trade, and shows it to you first.</li>
        <li><b>Charges a fee.</b> You pay the Solana network and the account rent for the box, both shown first.</li>
      </ul></div>
      <div class="pn rl-c lim"><div class="rl-h"><i></i>honest limits</div><ul>
        <li><b>A box guards your hands, not the chart.</b> The coin can still go to zero while it sits in the vault.</li>
        <li><b>There is no undo.</b> Lock the wrong amount or the wrong date and you wait it out like everyone else.</li>
        <li><b>The wall is public.</b> Every box shows its owner's address, amount and date. That is the point of a wall.</li>
        <li><b>Card scores move with prices.</b> Your score is the dollar value locked today times the days it is locked.</li>
      </ul></div>
    </div>
    <div class="sf-sec sf-wide"><span class="eb">07</span><b>faq</b></div>
    <div class="fq">
      <details><summary>What is a safe-deposit box?<i>+</i></summary><p>A Jupiter Lock escrow: an account owned by the open-source lock program behind lock.jup.ag, holding your tokens until the date you pick. bankz builds the lock in your browser, your wallet signs it, and the program does the rest. When the date arrives, press claim and everything goes back to the wallet that locked it.</p></details>
      <details><summary>Can anyone open it early?<i>+</i></summary><p>No. Boxes are made with cancel mode and update-recipient mode set to "nobody". Not you, not bankz, not the program's team. The registry only lists boxes that the chain confirms are locked that way.</p></details>
      <details><summary>Which tokens can I lock?<i>+</i></summary><p>Any Solana token in your wallet: pump.fun coins, memes, stocks, stablecoins. Both token programs work. A few Token-2022 coins with transfer hooks may refuse; your wallet shows that before you sign.</p></details>
      <details><summary>What does it cost?<i>+</i></summary><p>bankz adds no fee. You pay the Solana network fee and the rent for the escrow and its token account, a few thousandths of a SOL. Your wallet shows the total before you sign.</p></details>
      <details><summary>How do card tiers work?<i>+</i></summary><p>Your score is the dollar value of each locked box times the days it is locked for, added up. Gold from 1,000, Platinum from 25,000, Black from 250,000. $500 locked for 60 days is 30,000: Platinum.</p></details>
      <details><summary>What are the teller and savings?<i>+</i></summary><p>The teller cashes any token in your wallet out to SOL, or buys any token by its contract address, through Jupiter. Savings moves SOL into tokenized gold or the S&amp;P 500 (xStocks, not offered to US persons). You sign every trade.</p></details>
      <details><summary>What is the account number on my card?<i>+</i></summary><p>A label made from your wallet address, so your card and your receipts match. It is not a bank account and holds nothing. Every confirmed lock, claim and trade prints a receipt with it; your statement (the receipt icon in the top bar) keeps the last 40 in this browser.</p></details>
      <details><summary>Is bankz affiliated with Jupiter, pump.fun or any game?<i>+</i></summary><p>No. bankz is independent and uses their public programs and APIs. Nothing here is financial advice.</p></details>
    </div>`;
    $('#bkFilt').onclick = e => { const b = e.target.closest('[data-f]'); if (!b) return; D.filter = b.dataset.f; $$('#bkFilt button').forEach(x => x.classList.toggle('on', x === b)); paintWall(); };
    $('#bkShare').onclick = shareCard;
    el.addEventListener('click', onClick); el.addEventListener('input', onInput);
  }
  function onInput(e) {
    const t = e.target;
    if (t.id === 'bkAmt') { D.amt = t.value; paintSummary(); }
    if (t.id === 'bkTok') { D.sel = t.value; D.amt = ''; paintForm(); }
    if (t.id === 'tkTok') { D.tSel = t.value; paintTeller(); }
    if (t.id === 'tkAmt') D.tAmt = t.value;
    if (t.id === 'tkCa') D.tCa = t.value.trim();
    if (t.id === 'tkSol') D.tSol = t.value;
    if (t.id === 'svAmt') D.sv = t.value;
    if (t.id === 'svAck' && t.checked) store.set('markets.ack', '1');
  }
  function onClick(e) {
    const b = e.target.closest('button,[data-copy]'); if (!b) return;
    if (b.dataset.connect !== undefined) return;
    if (b.dataset.term) { D.term = +b.dataset.term; $$('#bkTerms button').forEach(x => x.classList.toggle('on', x === b)); paintSummary(); return; }
    if (b.dataset.pct) { const t = selTok(); if (t) { const raw = BigInt(t.top || t.raw) * BigInt(b.dataset.pct) / 100n; D.amt = String(Number(raw) / 10 ** t.decimals); $('#bkAmt').value = D.amt; paintSummary(); } return; }
    if (b.id === 'bkGo') return doLock();
    if (b.dataset.claim) return doClaim(b.dataset.claim);
    if (b.dataset.tpct) { const t = (D.bag && D.bag.tokens || []).find(x => x.mint === D.tSel); if (t) { D.tAmt = String(+(t.amount * +b.dataset.tpct / 100).toPrecision(8)); $('#tkAmt').value = D.tAmt; } return; }
    if (b.id === 'tkSell') return teller('sell');
    if (b.id === 'tkBuy') return teller('buy');
    if (b.dataset.save) return save(b.dataset.save);
    if (b.dataset.copy) { navigator.clipboard && navigator.clipboard.writeText(b.dataset.copy).then(() => toast('copied')); }
  }
  const selTok = () => lockable().find(t => t.mint === D.sel) || null;

  // ---------------------------------------------------------------- 01 lock a bag
  function paintForm() {
    const el = $('#bkForm'); if (!el) return;
    if (!WAL.W.addr) { el.innerHTML = `<div class="bk-empty"><p>Connect a wallet to lock a bag. Phantom, Solflare or Backpack. Your wallet signs the lock; bankz never holds it.</p><button class="kb hot" data-connect>Connect wallet</button></div>`; return; }
    if (!D.bag) { el.innerHTML = `<div class="mute">${D.bagErr ? 'Could not read your wallet: ' + esc(D.bagErr) : 'Reading your bag<span class="spin"></span>'}</div>`; return; }
    const L = lockable();
    if (!L.length) { el.innerHTML = `<div class="bk-empty"><p>Nothing to lock yet: this wallet holds no tokens besides SOL. Buy a meme at the teller below or in the trenches, then come back.</p></div>`; return; }
    if (!D.sel || !L.find(t => t.mint === D.sel)) D.sel = L[0].mint;
    el.innerHTML = `
      <div class="fr2"><label for="bkTok">bag</label><select id="bkTok">${L.map(t => `<option value="${esc(t.mint)}" ${t.mint === D.sel ? 'selected' : ''}>${esc(t.sym)} · ${amt(Number(BigInt(t.top || t.raw)) / 10 ** t.decimals)}${t.value != null ? ' · ' + usd(t.value) : ''}</option>`).join('')}</select></div>
      <div class="fr2"><label for="bkAmt">amount</label><div class="amt"><input id="bkAmt" inputmode="decimal" placeholder="0" value="${esc(D.amt)}"><span>${esc((selTok() || {}).sym || '')}</span></div><span class="qk"><button data-pct="25">25%</button><button data-pct="50">50%</button><button data-pct="100">max</button></span></div>
      <div class="fr2"><label>opens in</label><span class="seg terms" id="bkTerms">${[[1, '1 day'], [7, '1 week'], [30, '1 month'], [90, '3 months'], [180, '6 months'], [365, '1 year']].map(([d, l]) => `<button data-term="${d}" class="${D.term === d ? 'on' : ''}">${l}</button>`).join('')}</span></div>
      <div class="bk-sum" id="bkSum"></div>
      <button class="sgo" id="bkGo" ${D.busy ? 'disabled' : ''}>${D.busy ? 'locking…' : 'lock it in the vault'}</button>
      <div class="bk-mine" id="bkMine"></div>`;
    paintSummary(); paintMine();
  }
  function paintSummary() {
    const el = $('#bkSum'); if (!el) return; const t = selTok(); if (!t) { el.innerHTML = ''; return; }
    const a = parseFloat(D.amt), unlock = now() + D.term * DAY, v = t.price != null && a > 0 ? t.price * a : null;
    el.innerHTML = a > 0 ? `<span>box holds <b>${esc(amt(a))} ${esc(t.sym)}</b>${v != null ? ' · ' + usd(v) : ''}</span><span>opens <b>${esc(day(unlock))}</b></span><span>score +${v != null ? int(v * D.term) : '—'}</span>`
      : `<span class="mute">pick an amount and a date. The box stays shut until then, for everyone.</span>`;
  }
  async function doLock() {
    const t = selTok(); if (!t || D.busy) return;
    const a = parseFloat(D.amt); if (!(a > 0)) return toast('enter an amount to lock');
    const raw = BigInt(Math.floor(a * 10 ** t.decimals + 1e-9)), max = BigInt(t.top || t.raw);
    if (raw <= 0n) return toast('that amount is too small');
    if (raw > max) return toast(`this wallet's biggest ${t.sym} account holds ${amt(Number(max) / 10 ** t.decimals)}`);
    const unlock = now() + D.term * DAY, v0 = t.price != null ? t.price * a : null;
    D.busy = true; paintForm();
    try {
      const { blockhash } = await api('bh');
      const L = await lockTx({ owner: WAL.W.addr, mint: t.mint, prog: t.prog || 'spl', from: t.acct, raw: raw.toString(), unlock, blockhash });
      toast('checking the box with the network…');
      const dry = await post('sim', { tx: toB64(L.tx.serialize()) }); if (!dry.ok) throw new Error(dry.error || 'the network would reject this box');
      const signed = await WAL.signLaunch(toB64(L.tx.serialize()), L.base);   // your wallet signs, then the box's one-time key
      toast('locking…'); const sig = await relay(signed);
      remember({ escrow: L.escrow, sig, t: Date.now() });
      const st = await waitSig(sig); if (st === 'failed') throw new Error('the lock failed on-chain, nothing was moved');
      await post('boxadd', { escrow: L.escrow, sig }).catch(() => { });
      toast(`${t.sym} is in the vault until ${day(unlock)}`); D.amt = '';
      if (st === 'ok') RC({ title: 'SAFE-DEPOSIT BOX', rows: [['deposit', `${amt(a)} ${t.sym}`], ['value', v0 != null ? usd(v0) : '—'], ['term', D.term === 1 ? '1 day' : D.term + ' days'], ['opens', day(unlock)], ['box', short(L.escrow)], ['early open', 'nobody']], note: 'cancel and redirect are off for everyone', sig, share: `Locked ${amt(a)} $${t.sym} in the vault until ${day(unlock)}` });
      await Promise.all([loadBag(true), loadVault()]);
    } catch (e) { toast(WAL.isReject && WAL.isReject(e) ? 'you cancelled in your wallet' : String(e.message || e).slice(0, 140)); }
    D.busy = false; paintAll();
  }
  async function doClaim(escrow) {
    const b = myBoxes().find(x => x.escrow === escrow); if (!b) return;
    try {
      const { blockhash } = await api('bh'); const tx = await claimTx({ owner: WAL.W.addr, escrow, mint: b.mint, prog: b.prog, blockhash });
      const dry = await post('sim', { tx: toB64(tx.serialize()) }); if (!dry.ok) throw new Error(dry.error || 'the network would reject this claim');
      const sig = await WAL.signAndSend(toB64(tx.serialize()), relay); toast('opening your box…');
      const st = await waitSig(sig); if (st === 'failed') throw new Error('the claim failed on-chain');
      toast(`${b.sym} is back in your wallet`);
      if (st === 'ok') RC({ title: 'BOX OPENED', rows: [['withdrawal', `${amt(b.amount)} ${b.sym}`], ['value', usd(b.usd)], ['box', `No. ${String(b.n || 0).padStart(4, '0')}`], ['held', left(Math.max(0, now() - b.start)).replace(/ \d+m.*$/, '')], ['to', 'your wallet']], sig, share: `Opened my safe-deposit box: ${amt(b.amount)} $${b.sym} back in my wallet` });
      await Promise.all([loadBag(true), loadVault()]); paintAll();
    } catch (e) { toast(String(e.message || e).slice(0, 140)); }
  }
  function paintMine() {
    const el = $('#bkMine'); if (!el) return; const M = myBoxes(); if (!M.length) { el.innerHTML = ''; return; }
    const lockedV = M.filter(b => b.state === 'locked').reduce((a, b) => a + (b.usd || 0), 0);
    el.innerHTML = `<div class="lbl">YOUR BOXES · ${M.filter(b => b.state !== 'emptied').length} · ${usd(lockedV)} LOCKED</div>` + M.filter(b => b.state !== 'emptied').map(b => `<div class="bm">${b.icon ? `<img src="${esc(b.icon)}" alt="" loading="lazy" onerror="this.remove()">` : '<i></i>'}<b>${esc(amt(b.amount))} ${esc(b.sym)}</b><span>${b.state === 'open' ? 'ready' : 'opens ' + esc(day(b.unlock))}</span>${b.state === 'open' ? `<button class="kb hot" data-claim="${esc(b.escrow)}">claim</button>` : `<em class="clk3" data-until="${b.unlock}">${left(b.unlock - now())}</em>`}</div>`).join('');
  }

  // ---------------------------------------------------------------- 02 your card
  function paintCard() {
    const el = $('#bkCard'); if (!el) return;
    const s = score(), t = tierOf(s), nx = TIERS[TIERS.indexOf(t) + 1], a = WAL.W.addr, M = myBoxes();
    const since = M.length ? Math.min(...M.map(b => b.made || b.start)) : null;
    const pct = nx ? Math.min(100, (s - t.at) / (nx.at - t.at) * 100) : 100;
    el.innerHTML = `<div class="ccard ${t.k}"><div class="cc-top"><b class="cc-w">bankz</b><span class="cc-t">${esc(t.name)}</span></div><i class="cc-chip"></i><div class="cc-n">${a ? esc(acct(a)) : 'BZ •••• •••• ••••'}</div><div class="cc-b"><span>${a ? (since ? 'MEMBER SINCE ' + esc(new Date(since * 1000).toLocaleDateString(undefined, { month: '2-digit', year: '2-digit' })) : 'NO BOXES YET') : 'CONNECT A WALLET'}</span><span>${a ? esc(short(a)) : ''}</span></div></div>
      <div class="cc-p"><div class="row2"><span class="k">score</span><span class="v">${int(s)}</span></div>
      <div class="bb"><i style="width:${pct.toFixed(1)}%"></i></div>
      <div class="mute" style="font-size:12px">${nx ? `${int(Math.max(0, nx.at - s))} to ${esc(nx.name)}` : 'the top tier. The city knows your name.'}</div>
      <div class="tiers">${TIERS.map(x => `<span class="${x === t ? 'on' : s >= x.at ? 'done' : ''}">${esc(x.name)}<em>${x.at ? int(x.at) : 'any box'}</em></span>`).join('')}</div></div>`;
    window.Receipt && window.Receipt.paintCount();
  }
  function shareCard() {
    const a = WAL.W.addr; if (!a) return toast('connect a wallet first');
    const s = score(), t = tierOf(s), W = 1200, H = 675, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    const BG = { debit: ['#0c4a37', '#06261c'], gold: ['#ffd76a', '#c98a1e'], platinum: ['#e9eef2', '#9aa6b2'], black: ['#1b1d1c', '#050606'] }[t.k], dark = t.k === 'gold' || t.k === 'platinum';
    g.fillStyle = '#03120d'; g.fillRect(0, 0, W, H);
    const cx = 160, cy = 120, cw = 880, ch = 435, r = 40;
    g.save(); g.beginPath(); g.roundRect ? g.roundRect(cx, cy, cw, ch, r) : g.rect(cx, cy, cw, ch); g.clip();
    const gr = g.createLinearGradient(cx, cy, cx + cw, cy + ch); gr.addColorStop(0, BG[0]); gr.addColorStop(1, BG[1]); g.fillStyle = gr; g.fillRect(cx, cy, cw, ch);
    g.strokeStyle = dark ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.06)'; g.lineWidth = 2; for (let i = -10; i < 30; i++) { g.beginPath(); g.arc(cx + cw * 0.86, cy + ch * 0.2, 60 + i * 26, 0, 7); g.stroke(); }
    g.restore();
    const ink = dark ? '#1a1205' : '#fff8e6';
    g.fillStyle = ink; g.font = '400 78px Bowlby'; g.fillText('bankz', cx + 56, cy + 110);
    g.font = '800 30px Unbounded'; g.textAlign = 'right'; g.fillText(t.name.toUpperCase(), cx + cw - 56, cy + 96); g.textAlign = 'left';
    const chip = g.createLinearGradient(0, cy + 160, 0, cy + 240); chip.addColorStop(0, '#f5d27a'); chip.addColorStop(1, '#b8862a'); g.fillStyle = chip; g.beginPath(); g.roundRect ? g.roundRect(cx + 56, cy + 160, 110, 80, 14) : g.rect(cx + 56, cy + 160, 110, 80); g.fill();
    g.fillStyle = ink; g.font = '600 46px JBM, monospace'; g.fillText(acct(a), cx + 56, cy + 320);
    g.font = '600 22px JBM, monospace'; g.fillText('SCORE ' + int(s), cx + 56, cy + 385); g.textAlign = 'right'; g.fillText(location.host, cx + cw - 56, cy + 385); g.textAlign = 'left';
    g.fillStyle = '#9fd9c3'; g.font = '600 22px Inter'; g.fillText('My bags are in the vault. Nobody opens them early, not even me.', cx, H - 48);
    c.toBlob(b => {
      const u = URL.createObjectURL(b), l = document.createElement('a'); l.href = u; l.download = 'my-bankz-card.png'; l.click(); setTimeout(() => URL.revokeObjectURL(u), 4000);
      const txt = `${t.name === 'Debit' ? 'Opened my account' : 'Made ' + t.name} at bankz. My bags are in the vault and nobody opens them early, not even me.`;
      window.open('https://x.com/intent/post?text=' + encodeURIComponent(txt + ' ' + location.origin), '_blank', 'noopener');
    }, 'image/png');
  }

  // ---------------------------------------------------------------- 03 the vault wall
  function paintTot() {
    const el = $('#bkTot'); if (!el) return; const v = D.vault;
    el.innerHTML = !v ? `<span class="mute">${D.vaultErr ? 'vault offline' : 'opening the vault…'}</span>` : !v.online ? '<span class="mute">vault registry offline</span>'
      : `<div><b>${usd(v.totals.usd)}</b><span>locked</span></div><div><b>${int(v.totals.boxes)}</b><span>boxes shut</span></div><div><b>${int(v.totals.owners)}</b><span>depositors</span></div>`;
  }
  function paintWall() {
    const el = $('#bkWall'); if (!el) return; const v = D.vault;
    if (!v) { el.innerHTML = `<div class="empty">${D.vaultErr ? 'Could not open the vault right now (' + esc(D.vaultErr) + '). Try again in a moment.' : 'Opening the vault<span class="spin"></span>'}</div>`; return; }
    let L = v.boxes.filter(b => b.state !== 'emptied');
    if (D.filter === 'locked') L = L.filter(b => b.state === 'locked');
    if (D.filter === 'open') L = L.filter(b => b.state === 'locked').sort((a, b) => a.unlock - b.unlock);
    else L.sort((a, b) => (b.usd || 0) - (a.usd || 0));
    if (D.filter === 'mine') L = L.filter(b => b.owner === WAL.W.addr);
    const tile = b => `<div class="vb ${b.state}${b.owner === WAL.W.addr ? ' mine' : ''}"><div class="vb-n">No. ${String(b.n).padStart(4, '0')}</div><i class="vb-k"></i>
      <div class="vb-t">${b.icon ? `<img src="${esc(b.icon)}" alt="" loading="lazy" onerror="this.remove()">` : ''}<b>${esc(b.sym)}</b></div>
      <div class="vb-a">${esc(amt(b.amount))}<span>${usd(b.usd)}</span></div>
      <div class="vb-c">${b.state === 'open' ? 'open · ready to claim' : `opens in <b class="clk3" data-until="${b.unlock}">${left(b.unlock - now())}</b>`}</div>
      <a class="vb-o" href="https://solscan.io/account/${esc(b.escrow)}" target="_blank" rel="noopener">${esc(short(b.owner))} ↗</a>
      ${b.owner === WAL.W.addr && b.state === 'open' ? `<button class="kb hot" data-claim="${esc(b.escrow)}">claim</button>` : ''}</div>`;
    const ghost = n => Array.from({ length: n }, (_, i) => `<div class="vb ghost"><div class="vb-n">No. ${String((v.boxes.length || 0) + i + 1).padStart(4, '0')}</div><i class="vb-k"></i></div>`).join('');
    el.innerHTML = L.length ? L.slice(0, 120).map(tile).join('') + (L.length < 6 ? ghost(6 - L.length) : '')
      : `<div class="bk-wempty">${D.filter === 'mine' ? (WAL.W.addr ? 'You have no boxes yet. Lock a bag above.' : 'Connect a wallet to see your boxes.') : 'The vault is empty. The first box could be yours.'}</div>${ghost(6)}`;
  }
  setInterval(() => { if (document.hidden) return; const n = now(); $$('.clk3[data-until]').forEach(e => { e.textContent = left(+e.dataset.until - n); }); }, 1000);

  // ---------------------------------------------------------------- 04 teller: cash a meme out to SOL, or buy one by its CA
  function paintTeller() {
    const el = $('#bkTeller'); if (!el) return;
    const T = (D.bag && D.bag.tokens || []).filter(t => t.mint !== SOL_MINT && t.value !== 0);
    if (D.tSel && !T.find(t => t.mint === D.tSel)) D.tSel = null; if (!D.tSel && T.length) D.tSel = T[0].mint;
    el.innerHTML = `
      <div class="lbl">CASH OUT</div>
      ${!WAL.W.addr ? '<div class="mute" style="margin-bottom:12px">Connect a wallet to cash out.</div>' : !T.length ? '<div class="mute" style="margin-bottom:12px">No tokens to cash out yet.</div>' : `
      <div class="fr2"><label for="tkTok">sell</label><select id="tkTok">${T.map(t => `<option value="${esc(t.mint)}" ${t.mint === D.tSel ? 'selected' : ''}>${esc(t.sym)} · ${amt(t.amount)}${t.value != null ? ' · ' + usd(t.value) : ''}</option>`).join('')}</select></div>
      <div class="fr2"><label for="tkAmt">amount</label><div class="amt"><input id="tkAmt" inputmode="decimal" placeholder="0" value="${esc(D.tAmt)}"><span>→ SOL</span></div><span class="qk"><button data-tpct="50">50%</button><button data-tpct="100">all</button></span></div>
      <button class="sgo alt" id="tkSell">cash out to SOL</button>`}
      <div class="lbl" style="margin-top:18px">BUY BY CA</div>
      <div class="fr2"><label for="tkCa">token</label><input id="tkCa" class="txt" placeholder="paste a contract address" spellcheck="false" value="${esc(D.tCa)}"></div>
      <div class="fr2"><label for="tkSol">pay</label><div class="amt"><input id="tkSol" inputmode="decimal" placeholder="0.00" value="${esc(D.tSol)}"><span>SOL</span></div></div>
      <button class="sgo" id="tkBuy">buy</button>
      <div class="foot">routed by Jupiter · signed in your wallet · bankz adds no fee</div>`;
  }
  async function swapRun(inM, outM, rawAmt, label, rc) {
    if (!WAL.W.addr) { const c = document.querySelector('[data-connect]'); if (c) c.click(); return; }
    try {
      toast('getting a quote…');
      const q = await api('quote', { in: inM, out: outM, amt: rawAmt, slip: 300 });
      const s = await post('swap', { user: WAL.W.addr, quote: q.quote });
      const sig = await WAL.signAndSend(s.tx, relay); toast(label + '…');
      const st = await waitSig(sig); if (st === 'failed') throw new Error('the trade failed on-chain, nothing was spent');
      toast(label + ' · done');
      if (st === 'ok' && rc) RC({ title: rc.title, rows: [['paid', `${amt(q.inUi)} ${rc.inSym}`], ['quoted', `${amt(q.outUi)} ${rc.outSym}`], ['at least', q.minUi != null ? `${amt(q.minUi)} ${rc.outSym}` : '—'], ['route', (q.route || []).slice(0, 3).join(' › ') || 'Jupiter'], ['bankz fee', 'none']], note: rc.note || '', sig, share: rc.share });
      await loadBag(true); paintAll();
    } catch (e) { toast(String(e.message || e).slice(0, 140)); }
  }
  function teller(kind) {
    if (kind === 'sell') {
      const t = (D.bag && D.bag.tokens || []).find(x => x.mint === D.tSel); const a = parseFloat(D.tAmt);
      if (!t) return toast('pick a token'); if (!(a > 0)) return toast('enter an amount');
      const raw = BigInt(Math.floor(Math.min(a, t.amount) * 10 ** t.decimals)); if (raw <= 0n) return toast('that amount is too small');
      return swapRun(t.mint, 'SOL', raw.toString(), `cashing out ${t.sym}`, { title: 'TELLER · CASH OUT', inSym: t.sym, outSym: 'SOL', share: `Cashed my $${t.sym} out at the teller` });
    }
    const ca = D.tCa, a = parseFloat(D.tSol);
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(ca)) return toast('paste a Solana contract address');
    if (!(a > 0)) return toast('enter how much SOL to pay');
    return swapRun('SOL', ca, String(Math.floor(a * 1e9)), 'buying', { title: 'TELLER · BUY', inSym: 'SOL', outSym: short(ca), share: 'Bought a bag at the teller' });
  }

  // ---------------------------------------------------------------- 05 savings: SOL into tokenized gold or the S&P 500
  const SAVE = [{ k: 'GOLD', name: 'Gold', sub: 'GLDx · tracks the gold ETF', mint: 'Xsv9hRk1z5ystj9MhnA7Lq4vjSsLwzL2nxrwmwtD3re' }, { k: 'SPY', name: 'S&P 500', sub: 'SPYx · tracks the index ETF', mint: 'XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W' }];
  function paintSave() {
    const el = $('#bkSave'); if (!el) return; const T = D.bag && D.bag.tokens || [], ack = store.get('markets.ack') === '1';
    el.innerHTML = `<div class="sv">${SAVE.map(s => { const h = T.find(t => t.mint === s.mint); return `<div class="sv-c ${s.k.toLowerCase()}"><b>${esc(s.name)}</b><span class="mute">${esc(s.sub)}</span><div class="sv-v">${h ? usd(h.value) : WAL.W.addr ? '$0.00' : '—'}</div><button class="sgo${s.k === 'SPY' ? ' alt' : ''}" data-save="${s.k}">move SOL into ${esc(s.name.toLowerCase())}</button></div>`; }).join('')}</div>
      <div class="fr2"><label for="svAmt">amount</label><div class="amt"><input id="svAmt" inputmode="decimal" value="${esc(D.sv)}"><span>SOL</span></div></div>
      ${ack ? '' : '<label class="ack"><input type="checkbox" id="svAck"><span>I am not a US person and xStocks are allowed where I live. They track the price; they are not the shares.</span></label>'}`;
  }
  function save(k) {
    const s = SAVE.find(x => x.k === k), a = parseFloat(D.sv); if (!s) return;
    if (store.get('markets.ack') !== '1') return toast('confirm the xStocks line first');
    if (!(a > 0)) return toast('enter an amount of SOL');
    return swapRun('SOL', s.k, String(Math.floor(a * 1e9)), `moving ${a} SOL into ${s.name.toLowerCase()}`, { title: 'SAVINGS DEPOSIT', inSym: 'SOL', outSym: s.k === 'GOLD' ? 'GLDx' : 'SPYx', note: 'xStocks track the price, they are not the shares', share: `Moved ${a} SOL into ${s.name === 'Gold' ? 'gold' : 'the S&P 500'}` });
  }

  // ---------------------------------------------------------------- render
  function paintAll() { paintTot(); paintForm(); paintCard(); paintWall(); paintTeller(); paintSave(); }
  let loading = null;
  async function render() {
    const el = $('#vault'); if (!el) return;
    if (!el.dataset.built) { build(el); el.dataset.built = 1; }
    paintAll();
    if (loading) { loading.again = true; return; }     // a wallet switch mid-load reads again once this one lands
    loading = { again: false };
    try { do { loading.again = false; await Promise.all([loadBag(), loadVault()]); paintAll(); } while (loading.again); } finally { loading = null; }
  }
  setInterval(() => { if (!document.hidden && $('#vault') && $('#vault').offsetParent) loadVault().then(() => { paintTot(); paintWall(); paintCard(); paintMine(); }); }, 30000);
  WAL.on(() => { D.bag = null; if ($('#vault') && $('#vault').dataset.built) render(); });
  window.BANKZ_VAULT = { render, lockTx, claimTx, score, tierOf, TIERS, prefill: (sym, a, days) => { const t = lockable().find(x => x.sym.toLowerCase() === String(sym).toLowerCase()); if (t) D.sel = t.mint; if (a) D.amt = String(a); if (days) D.term = [1, 7, 30, 90, 180, 365].reduce((p, d) => Math.abs(d - days) < Math.abs(p - days) ? d : p, 30); render(); return !!t; } };
})();
