/* bankz: wallets. Your main wallet (Phantom, Solflare, Backpack) and any number of fresh wallets made in this browser.
   Whichever one is "on" signs every trade. Fresh keys are made here, kept only in this browser, and never sent anywhere. */
(function () {
  const WALLETS = [
    { name: 'Phantom', get: () => window.phantom && window.phantom.solana && window.phantom.solana.isPhantom && window.phantom.solana, color: '#ab9ff2', dl: 'https://phantom.com/download', ul: u => `https://phantom.app/ul/browse/${encodeURIComponent(u)}?ref=${encodeURIComponent(location.origin)}` },
    { name: 'Solflare', get: () => window.solflare && window.solflare.isSolflare && window.solflare, color: '#fc7227', dl: 'https://solflare.com/download', ul: u => `https://solflare.com/ul/v1/browse/${encodeURIComponent(u)}?ref=${encodeURIComponent(location.origin)}` },
    { name: 'Backpack', get: () => window.backpack && window.backpack.isBackpack !== false && window.backpack, color: '#e33e3f', dl: 'https://backpack.app/download', ul: null },
  ];
  const KEY = 'anon.wallet', FKEY = 'anon.fresh', AKEY = 'anon.active';
  const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { } } };
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const subs = new Set();
  const MAIN = { addr: null, name: null, p: null };          // the wallet you connected
  const W = { addr: null, name: null, p: null, fresh: null };  // whichever wallet is on right now (the terminal reads this)
  const emit = () => subs.forEach(f => { try { f(W); } catch (e) { console.error(e); } });

  // ---------------------------------------------------------------- fresh wallets
  const B58A = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  function b58(u8) { const d = []; let s = ''; for (const byte of u8) { let c = byte; for (let j = 0; j < d.length; j++) { c += d[j] << 8; d[j] = c % 58; c = (c / 58) | 0; } while (c) { d.push(c % 58); c = (c / 58) | 0; } } for (const byte of u8) { if (byte) break; s += '1'; } for (let j = d.length - 1; j >= 0; j--) s += B58A[d[j]]; return s; }
  const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const toB64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); };
  let FRESH = []; try { FRESH = JSON.parse(store.get(FKEY) || '[]').filter(f => f && f.pub && f.sk); } catch { FRESH = []; }
  const saveFresh = () => store.set(FKEY, JSON.stringify(FRESH));
  let active = store.get(AKEY) || 'main';
  if (active !== 'main' && !FRESH.find(f => f.id === active)) active = 'main';

  function freshProvider(f) {
    return {
      __fresh: true, publicKey: { toString: () => f.pub },
      async signTransaction(tx) { const S = await web3(); tx.sign([S.Keypair.fromSecretKey(b64(f.sk))]); return tx; },
      async signAllTransactions(txs) { const S = await web3(); const kp = S.Keypair.fromSecretKey(b64(f.sk)); txs.forEach(t => t.sign([kp])); return txs; },
      async connect() { return { publicKey: this.publicKey }; }, async disconnect() { },
    };
  }
  function apply() {
    const f = active !== 'main' && FRESH.find(x => x.id === active);
    if (f) { W.addr = f.pub; W.name = f.label; W.p = freshProvider(f); W.fresh = f; }
    else { W.addr = MAIN.addr; W.name = MAIN.name; W.p = MAIN.p; W.fresh = null; }
  }
  function use(id) { active = id && id !== 'main' && FRESH.find(f => f.id === id) ? id : 'main'; store.set(AKEY, active); apply(); emit(); return W; }
  async function freshNew(label) {
    const S = await web3(); const kp = S.Keypair.generate();
    const n = FRESH.reduce((m, f) => Math.max(m, f.n || 0), 0) + 1;
    const f = { id: 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), n, label: label || 'wallet #' + n, pub: kp.publicKey.toBase58(), sk: toB64(kp.secretKey), born: Date.now() };
    FRESH.push(f); saveFresh(); emit(); return f;
  }
  function freshBurn(id) { FRESH = FRESH.filter(f => f.id !== id); saveFresh(); if (active === id) use('main'); else emit(); }
  function freshRename(id, label) { const f = FRESH.find(x => x.id === id); if (f) { f.label = String(label || '').slice(0, 24) || f.label; saveFresh(); apply(); emit(); } }
  // the secret key in the format Phantom, Solflare and Backpack import
  function freshExport(id) { const f = FRESH.find(x => x.id === id); return f ? b58(b64(f.sk)) : null; }

  // ---------------------------------------------------------------- the connected wallet
  function bind(p, name) {
    if (!p || p.__mk) return; p.__mk = 1;
    const onAcc = pk => { if (MAIN.p !== p) return; if (pk) { MAIN.addr = pk.toString(); apply(); emit(); } else disconnect(true); };
    try { p.on && p.on('accountChanged', onAcc); } catch { }
    try { p.on && p.on('disconnect', () => { if (MAIN.p === p) disconnect(true); }); } catch { }
  }
  async function connect(name, silent) {
    const w = WALLETS.find(x => x.name === name); if (!w) throw new Error('unknown wallet');
    const p = w.get();
    if (!p) {
      if (silent) return null;
      if (mobile && w.ul) { location.href = w.ul(location.href); return null; }
      window.open(w.dl, '_blank', 'noopener'); return null;
    }
    const r = silent ? await p.connect({ onlyIfTrusted: true }) : await p.connect();
    const pk = (r && r.publicKey) || p.publicKey;
    if (!pk) throw new Error('the wallet did not share an address');
    bind(p, name);
    MAIN.addr = pk.toString(); MAIN.name = name; MAIN.p = p;
    store.set(KEY, name); apply(); emit();
    return MAIN.addr;
  }
  async function disconnect(quiet) {
    const p = MAIN.p; MAIN.addr = null; MAIN.name = null; MAIN.p = null; store.set(KEY, null); apply(); emit();
    if (p && !quiet) { try { await p.disconnect(); } catch { } }
  }
  async function restore() {
    const last = store.get(KEY); if (!last) return;
    for (let k = 0; k < 6; k++) { const w = WALLETS.find(x => x.name === last); if (w && w.get()) break; await new Promise(r => setTimeout(r, 250)); }
    try { await connect(last, true); } catch { }
  }

  // web3.js loads on first use (signing, or making a fresh wallet)
  let web3P = null;
  function web3() { if (window.solanaWeb3) return Promise.resolve(window.solanaWeb3); if (web3P) return web3P; web3P = new Promise((ok, no) => { const s = document.createElement('script'); s.src = '/assets/js/web3.min.js'; s.onload = () => ok(window.solanaWeb3); s.onerror = () => { web3P = null; no(new Error('could not load the signer, check your connection')); }; document.head.appendChild(s); }); return web3P; }

  // ---------------------------------------------------------------- signing, with whichever wallet you name (default: the one that is on)
  const who = id => !id ? W : id === 'main' ? MAIN : (() => { const f = FRESH.find(x => x.id === id); return f ? { addr: f.pub, name: f.label, p: freshProvider(f), fresh: f } : null; })();
  async function signAndSend(txB64, relay, id) {
    const I = who(id); if (!I || !I.p) throw new Error(id === 'main' || (!id && !W.fresh) ? 'connect a wallet first' : 'that wallet is gone');
    const S = await web3();
    const tx = S.VersionedTransaction.deserialize(b64(txB64));
    const p = I.p;
    try {
      if (p.signAndSendTransaction) {
        const r = await p.signAndSendTransaction(tx, { skipPreflight: false, maxRetries: 3 });
        const sig = r && (r.signature != null ? r.signature : r);
        if (!sig) throw new Error('the wallet did not return a signature');
        return typeof sig === 'string' ? sig : b58(sig);
      }
      const signed = await p.signTransaction(tx);
      return await relay(toB64(signed.serialize()));
    } catch (e) {
      if (isReject(e)) throw new Error('you cancelled in your wallet');
      throw new Error(friendly(e));
    }
  }
  const friendly = e => { const m = String((e && (e.message || e.toString())) || 'the wallet could not send it'); if (/insufficient|0x1\b|lamports|no record of a prior credit/i.test(m)) return 'not enough SOL in this wallet for this and its fees'; if (/blockhash|expired/i.test(m)) return 'the quote expired, try again'; if (/slippage|0x1771|6001/i.test(m)) return 'the price moved past your slippage, try again'; return m.slice(0, 160); };
  const isReject = e => e && (e.code === 4001 || /reject|cancel|denied|declined/i.test(e.message || ''));
  async function signLaunch(txB64, mintKp) {
    if (!W.p) throw new Error('connect a wallet first');
    if (!W.p.signTransaction) throw new Error('this wallet cannot sign a launch, try Phantom or Solflare');
    const S = await web3();
    const tx = S.VersionedTransaction.deserialize(b64(txB64));
    let signed;
    try { signed = await W.p.signTransaction(tx); } catch (e) { if (isReject(e)) throw new Error('you cancelled in your wallet'); throw new Error(friendly(e)); }
    signed.sign([mintKp]);
    return toB64(signed.serialize());
  }
  async function signOnly(txB64) {
    if (!W.p) throw new Error('connect a wallet first');
    if (!W.p.signTransaction) throw new Error('this wallet cannot sign this order, try Phantom or Solflare');
    const S = await web3();
    const tx = S.VersionedTransaction.deserialize(b64(txB64));
    try { const signed = await W.p.signTransaction(tx); return toB64(signed.serialize()); }
    catch (e) { if (isReject(e)) throw new Error('you cancelled in your wallet'); throw new Error(friendly(e)); }
  }
  // a plain SOL transfer (funding a route's deposit address, or sending out of a fresh wallet)
  async function transfer({ from, to, lamports, blockhash }, relay) {
    const I = who(from); if (!I || !I.addr) throw new Error(from === 'main' ? 'connect your main wallet first' : 'pick a wallet to send from');
    const S = await web3();
    const msg = new S.TransactionMessage({ payerKey: new S.PublicKey(I.addr), recentBlockhash: blockhash, instructions: [
      S.ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 20000 }),
      S.SystemProgram.transfer({ fromPubkey: new S.PublicKey(I.addr), toPubkey: new S.PublicKey(to), lamports: Number(lamports) }),
    ] }).compileToV0Message();
    const tx = new S.VersionedTransaction(msg);
    return signAndSend(toB64(tx.serialize()), relay, from);
  }

  apply();
  window.MarketsWallet = { WALLETS, W, MAIN, connect, disconnect, restore, signAndSend, signLaunch, signOnly, transfer, web3, isReject,
    fresh: () => FRESH.slice(), active: () => active, use, freshNew, freshBurn, freshRename, freshExport,
    on: f => { subs.add(f); return () => subs.delete(f); }, installed: () => WALLETS.filter(w => w.get()), mobile };
})();
