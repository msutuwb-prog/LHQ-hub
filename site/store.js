/* LHQ Hub: keeps the big lists (documents, tutor logs, spending, students) compressed on this device.
   A browser gives each site about 5 MB; LHQ's documents and logs would fill that in about a year and a half.
   Compressed they take roughly a tenth of the space. Every page still reads and writes localStorage as before:
   this file packs those keys on the way in and unpacks them on the way out. Needs pako.min.js first.
   Data saved before this existed is read as it is and packed the next time it is saved. */
(function(){
  if(!window.pako) return;   // without the packer everything keeps working, just uncompressed
  const BIG = ['lhq_saved', 'lhq_logs', 'lhq_spend', 'lhq_income', 'lhq_students', 'lhq_repEdits', 'lhq_tlinks', 'lhq_people'];
  const MARK = 'Z1:', MIN = 4096;
  const ls = window.localStorage;
  const P = Storage.prototype, getI = P.getItem, setI = P.setItem;
  const memo = {};   // last packed value → unpacked text, so reading the same list again costs nothing
  function pack(text){
    const bytes = pako.deflate(text), parts = [];
    for(let i = 0; i < bytes.length; i += 0x8000) parts.push(String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)));
    return MARK + btoa(parts.join(''));
  }
  function unpack(raw){
    const bin = atob(raw.slice(MARK.length)), bytes = new Uint8Array(bin.length);
    for(let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return pako.inflate(bytes, {to: 'string'});
  }
  P.getItem = function(k){
    const raw = getI.call(this, k);
    if(this !== ls || raw == null || !BIG.includes(k) || raw.slice(0, 3) !== MARK) return raw;
    const m = memo[k]; if(m && m.raw === raw) return m.text;
    try{ const text = unpack(raw); memo[k] = {raw, text}; return text; }catch(e){ return null; }
  };
  P.setItem = function(k, v){
    v = String(v);
    if(this === ls && BIG.includes(k) && v.length >= MIN){
      const m = memo[k]; const raw = m && m.text === v ? m.raw : pack(v);
      memo[k] = {raw, text: v};
      return full(() => setI.call(this, k, raw));
    }
    delete memo[k];
    return full(() => setI.call(this, k, v));
  };
  /* the device is out of space: say so plainly (once a minute), instead of failing quietly */
  let warned = 0;
  function full(fn){
    try{ return fn(); }
    catch(e){
      if(e && (e.name === 'QuotaExceededError' || e.code === 22) && Date.now() - warned > 60000){
        warned = Date.now();
        const m = 'This device is out of space for LHQ Hub, so the last change was not kept here. Your saved work is safe online; make a backup in Settings › Backup and ask for the Hub to be checked.';
        if(window.hubToast) window.hubToast(m); else alert(m);
      }
      throw e;
    }
  }
  /* how much of the device's space LHQ is using (Settings › Backup shows it) */
  window.lhqStorageUse = () => { let n = 0; for(let i = 0; i < ls.length; i++){ const k = ls.key(i); n += k.length + (getI.call(ls, k) || '').length; } return n * 2; };
})();
