function switchTab(name) {
    const isReview = name === 'review';
    const isAdmin  = name === 'admin';
    const isNtt    = name === 'ntt';

    document.getElementById('tabReview').classList.toggle('active', isReview);
    document.getElementById('tabAdmin').classList.toggle('active', isAdmin);
    document.getElementById('tabNtt').classList.toggle('active', isNtt);

    document.getElementById('revSection').style.display = isReview ? 'block' : 'none';
    document.getElementById('admSection').style.display = isAdmin  ? 'block' : 'none';
    document.getElementById('nttSection').style.display = isNtt    ? 'block' : 'none';

    // Sembunyikan topbar controls saat di tab NTT (karena tool punya UI sendiri)
    const topTh = document.getElementById('topThreshold');
    const topBf = document.getElementById('topBankFilter');
    const topMn = document.getElementById('topMinutes');
    const topRev = document.getElementById('topRevStats');
    const topAdm = document.getElementById('topAdmStats');
    const mainFooter = document.getElementById('mainFooter');

    // Toggle full-bleed mode untuk tab NTT
    document.body.classList.toggle('ntt-mode', isNtt);

    if (isNtt) {
        if (topTh) topTh.style.display = 'none';
        if (topBf) topBf.style.display = 'none';
        if (topMn) topMn.style.display = 'none';
        if (topRev) topRev.style.display = 'none';
        if (topAdm) topAdm.style.display = 'none';
        if (mainFooter) mainFooter.style.display = 'none';
    } else {
        // Filter Rp hanya di ADMIN; Jenis hanya di REVIEW; Menit aktif di keduanya
        if (topTh) topTh.style.display = isAdmin ? 'inline-flex' : 'none';
        if (topBf) topBf.style.display = isReview ? 'inline-flex' : 'none';
        if (topMn) topMn.style.display = 'inline-flex';
        if (topRev) topRev.style.display = (isReview && RESULT_TSV.rev) ? 'flex' : 'none';
        if (topAdm) topAdm.style.display = (isAdmin  && RESULT_TSV.adm) ? 'flex' : 'none';
        if (mainFooter) mainFooter.style.display = 'block';
    }
}

const EWALLET_PREFIX = {
    'LINKAJA': '09110',
    'OVO':     '39358',
    'GOPAY':   '70001',
    'DANA':    '3901'
};

function applyPrefix(bank, rek) {
    const key = String(bank ?? '').toUpperCase().replace(/[\s_\-\.]/g, '');
    const prefix = EWALLET_PREFIX[key];
    const rawRek = String(rek ?? '').trim();
    if (!prefix) return { rek: rawRek, isEw: false };

    // Do not add the prefix twice when the source already contains it.
    const digits = rawRek.replace(/\s+/g, '');
    if (digits.startsWith(prefix)) return { rek: digits, isEw: true };
    return { rek: prefix + digits, isEw: true };
}

function normalizeAmountText(val) {
    let s = String(val ?? '').trim();
    s = s.replace(/\s+/g, '').replace(/^Rp\.?/i, '').replace(/[^\d,.\-+]/g, '');
    return s;
}

function parseNum(val) {
    let s = normalizeAmountText(val);
    if (!s) return 0;

    // Indonesian/thousands formats:
    // 1.000.000  -> 1000000
    // 1,000,000  -> 1000000
    // 1000000     -> 1000000
    // 100.50      -> 100.50
    // 100,50      -> 100.50
    const sign = s.startsWith('-') ? -1 : 1;
    s = s.replace(/^[+-]/, '');

    const dots = (s.match(/\./g) || []).length;
    const commas = (s.match(/,/g) || []).length;

    if (dots && commas) {
        // Last separator is treated as decimal separator only when
        // exactly 1-2 digits follow it; otherwise all separators are thousands.
        const lastDot = s.lastIndexOf('.');
        const lastComma = s.lastIndexOf(',');
        const last = Math.max(lastDot, lastComma);
        const frac = s.slice(last + 1);
        if (/^\d{1,2}$/.test(frac)) {
            s = s.slice(0, last).replace(/[.,]/g, '') + '.' + frac;
        } else {
            s = s.replace(/[.,]/g, '');
        }
    } else if (dots) {
        if (dots > 1 || /\.\d{3}$/.test(s)) s = s.replace(/\./g, '');
        // otherwise keep a single decimal point
    } else if (commas) {
        if (commas > 1 || /,\d{3}$/.test(s)) s = s.replace(/,/g, '');
        else s = s.replace(',', '.');
    }

    const n = Number(s);
    return Number.isFinite(n) ? sign * n : 0;
}

function formatAmount(val) {
    const n = parseNum(val);
    if (!Number.isFinite(n)) return String(val ?? '').trim();
    return Number.isInteger(n) ? String(n) : String(n).replace(/\.0+$/, '');
}

function getSeparator() {
    return '\t';
}

const revInput  = document.getElementById('revInput');
const revOutput = document.getElementById('revOutput');
const admInput  = document.getElementById('admInput');
const admOutput = document.getElementById('admOutput');

// Hasil disimpan sebagai TSV — dipakai tombol Copy (format tab, siap paste ke Excel)
const RESULT_TSV = { rev: '', adm: '' };
const RESULT_STALE = { rev: [], adm: [] }; // true = antrian > 10 menit

/* ===== PARSE WAKTU DARI DATA MENTAH ===== */
// Format: 08/09/2026 07:17:14 (DD/MM/YYYY HH:mm:ss)
function parseRowTime(cols) {
    const reDMY = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/;
    const reISO = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;

    for (const c of cols) {
        const s = String(c).trim();
        let m = s.match(reDMY);
        if (m) {
            const d = parseInt(m[1], 10), mo = parseInt(m[2], 10) - 1;
            const y = parseInt(m[3], 10), h = parseInt(m[4], 10);
            const mi = parseInt(m[5], 10), sec = parseInt(m[6] || '0', 10);
            const dt = new Date(y, mo, d, h, mi, sec);
            if (!isNaN(dt.getTime())) return dt;
        }

        m = s.match(reISO);
        if (m) {
            const y = parseInt(m[1], 10), mo = parseInt(m[2], 10) - 1;
            const d = parseInt(m[3], 10), h = parseInt(m[4] || '0', 10);
            const mi = parseInt(m[5] || '0', 10), sec = parseInt(m[6] || '0', 10);
            const dt = new Date(y, mo, d, h, mi, sec);
            if (!isNaN(dt.getTime())) return dt;
        }
    }
    return null;
}

function isStale(cols, maxMinutes) {
    const t = parseRowTime(cols);
    if (!t) return false;
    const diffMs = Date.now() - t.getTime();
    return diffMs > maxMinutes * 60 * 1000;
}

/* ===== RENDER TABEL GAYA EXCEL (ringan & cepat via DocumentFragment) ===== */
const EXCEL_HEADERS = ['Bank', 'No. Rekening', 'User ID', 'Nama', 'Nominal'];

function filterReview() {
    const raw = revInput.value.trim();
    if (!raw) { hide('rev'); return; }

    const sep     = getSeparator();
    // Multi-select bank filter
    const selectedBanks = getSelectedBanks(); // array of uppercase values, empty = semua
    const lines   = raw.split(/\r?\n/).filter(l => l.trim() !== '');
    const results = [];
    const staleFlags = [];
    let skipped = 0, ew = 0, total = 0, filteredOut = 0, staleCount = 0;

    lines.forEach(line => {
        // pisah kolom (tab / 2+ spasi), lalu buang kolom kosong hasil indentasi di awal baris
        let cols = (line.includes('\t') ? line.split('\t') : line.split(/\s{2,}/))
                    .map(c => c.trim());
        while (cols.length && cols[0] === '') cols.shift();

        if (cols.length >= 7) {
            const bank    = cols[6];               // bank / e-wallet tujuan (GOPAY, DANA, ...)
            const bankUp  = bank.toUpperCase().replace(/[\s_\-\.]/g, '');

            // Filter multi bank/e-wallet
            if (selectedBanks.length > 0) {
                const match = selectedBanks.some(f => {
                    const fUp = String(f).toUpperCase().replace(/[\s_\-\.]/g, '');
                    return bankUp === fUp;
                });
                if (!match) {
                    filteredOut++;
                    return;
                }
            }

            const rek     = cols[2];               // no. rekening / no. HP
            const user    = cols[1];               // user ID
            const nama    = cols[3];               // nama pemilik rekening
            const nominal = formatAmount(cols[4]); // 321,000.00 → 321,000

            const p = applyPrefix(bank, rek);
            if (p.isEw) ew++;
            total += parseNum(nominal);

            const maxMin = parseInt(document.getElementById('revMinutes')?.value, 10) || 10;
            const stale = isStale(cols, maxMin);
            if (stale) staleCount++;
            staleFlags.push(stale);
            results.push(`${bank}${sep}${p.rek}${sep}${user}${sep}${nama}${sep}${nominal}`);
        } else {
            skipped++;
        }
    });

    if (results.length === 0) {
        hide('rev');
        toast(selectedBanks.length
            ? `⚠️ Tidak ada data untuk filter terpilih`
            : '⚠️ Format data tidak dikenali');
        return;
    }

    RESULT_STALE.rev = staleFlags;
    showResult('rev', revOutput, results.join('\n'), results.length);
    document.getElementById('topRevOk').textContent    = results.length;
    document.getElementById('topRevSkip').textContent  = skipped + filteredOut;
    document.getElementById('topRevEw').textContent    = ew;
    document.getElementById('topRevTotal').textContent = total.toLocaleString('en-US');
    document.getElementById('topRevStats').style.display = 'flex';

    const filterMsg = selectedBanks.length ? ` • filter ${selectedBanks.join(',')}` : '';
    const staleMsg = staleCount > 0 ? ` • ${staleCount} antrian lama ⚠️` : '';
    toast(ew > 0
        ? `✨ ${results.length} data ✓ • ${ew} e-wallet diberi prefix 📱${filterMsg}${staleMsg}`
        : `✨ ${results.length} data ter-filter otomatis${filterMsg}${staleMsg}`);
}

function filterAdmin() {
    const raw = admInput.value.trim();
    if (!raw) { hide('adm'); return; }

    const sep       = getSeparator();
    const thresholdRaw = String(document.getElementById('admThreshold').value ?? '').trim();
    const thresholdParsed = Number(thresholdRaw);
    const threshold = thresholdRaw === '' || !Number.isFinite(thresholdParsed) ? 500000 : thresholdParsed;
    const maxMin    = parseInt(document.getElementById('revMinutes')?.value, 10) || 10;

    const lines    = raw.split(/\r?\n/);
    const records  = [];
    let cur = null;

    lines.forEach(line => {
        const t = line.trim();
        if (!t) return;

        if (/^\d+[\t\s]/.test(t)) {
            if (cur) records.push(cur);
            const parts = t.split(/\t|\s{2,}/).map(s => s.trim()).filter(Boolean);
            cur = { user: parts.length > 1 ? parts[parts.length - 1] : '', rawParts: parts };
        }
        else if (/^withdraw/i.test(t)) {
            if (!cur) cur = { user: '', rawParts: [] };
            const cols = t.includes('\t') ? t.split('\t') : t.split(/\s{2,}/);
            const cleanCols = cols.map(c => c.trim()).filter(Boolean);
            cur.nominal = (cleanCols[2] || cleanCols.find(c => /\d/.test(c)) || '').trim();
            cur.rawParts = (cur.rawParts || []).concat(cleanCols);
        }
        else if (t.includes(',')) {
            if (!cur) cur = { user: '', rawParts: [] };
            cur.bankLine = t;
            cur.rawParts = (cur.rawParts || []).concat([t]);
        }
        else if (cur && !cur.user && !cur.nominal) {
            cur.user = t;
            cur.rawParts = (cur.rawParts || []).concat([t]);
        } else if (cur) {
            cur.rawParts = (cur.rawParts || []).concat([t]);
        }
    });
    if (cur) records.push(cur);

    const results = [];
    const staleFlags = [];
    let over = 0, ew = 0, total = 0, staleCount = 0;

    records.forEach(r => {
        if (r.nominal === undefined || !r.bankLine) return;

        const num = parseNum(r.nominal);

        if (num > threshold) { over++; return; }

        const bp      = r.bankLine.split(',');
        const bank    = (bp[0] || '').trim();
        const rekRaw  = (bp[1] || '').trim();
        const nama    = bp.slice(2).join(',').trim();
        const nominal = formatAmount(r.nominal);

        const p = applyPrefix(bank, rekRaw);
        if (p.isEw) ew++;

        total += num;

        const stale = isStale(r.rawParts || [], maxMin);
        if (stale) staleCount++;
        staleFlags.push(stale);
        results.push(`${bank}${sep}${p.rek}${sep}${r.user}${sep}${nama}${sep}${nominal}`);
    });

    if (results.length === 0) {
        hide('adm');
        toast(over > 0
            ? `⚠️ ${over} data di atas batas — semua dilewati`
            : '⚠️ Format data tidak dikenali');
        return;
    }

    RESULT_STALE.adm = staleFlags;
    showResult('adm', admOutput, results.join('\n'), results.length);
    document.getElementById('topAdmOk').textContent    = results.length;
    document.getElementById('topAdmOver').textContent  = over;
    document.getElementById('topAdmEw').textContent    = ew;
    document.getElementById('topAdmTotal').textContent = total.toLocaleString('en-US');
    document.getElementById('topAdmStats').style.display = 'flex';

    const staleMsg = staleCount > 0 ? ` • ${staleCount} antrian lama ⚠️` : '';
    toast(over > 0
        ? `✨ ${results.length} data ✓ • ${over} dilewati (> batas)${staleMsg}`
        : `✨ ${results.length} data ter-filter otomatis${staleMsg}`);
}

/* ===== EVENT: PASTE 20ms (instan) + DEBOUNCE 70ms (cepat) ===== */
let debRev, debAdm;

revInput.addEventListener('paste', () => requestAnimationFrame(() => filterReview()));
revInput.addEventListener('input', () => { clearTimeout(debRev); debRev = setTimeout(filterReview, 70); });

admInput.addEventListener('paste', () => requestAnimationFrame(() => filterAdmin()));
admInput.addEventListener('input', () => { clearTimeout(debAdm); debAdm = setTimeout(filterAdmin, 70); });

// ===== Filter Jenis Bank MULTI (REVIEW) =====
function getSelectedBanks() {
    const cbs = document.querySelectorAll('.rev-bank-cb:checked');
    return Array.from(cbs).map(c => c.value.toUpperCase());
}
function updateBankLabel() {
    const selected = getSelectedBanks();
    const label = document.getElementById('revBankLabel');
    const allCb = document.getElementById('revBankAll');
    if (!label) return;
    if (selected.length === 0 || (allCb && allCb.checked)) {
        label.textContent = 'Semua';
        if (allCb) allCb.checked = true;
    } else if (selected.length === 1) {
        label.textContent = selected[0];
    } else {
        label.textContent = selected.length + ' bank';
    }
}
function saveBankFilter() {
    const selected = getSelectedBanks();
    localStorage.setItem('revBankFilterMulti', JSON.stringify(selected));
}
function restoreBankFilter() {
    try {
        const raw = localStorage.getItem('revBankFilterMulti');
        if (!raw) return;
        const arr = JSON.parse(raw);
        if (!Array.isArray(arr)) return;
        const allCb = document.getElementById('revBankAll');
        document.querySelectorAll('.rev-bank-cb').forEach(cb => {
            cb.checked = arr.includes(cb.value);
        });
        if (allCb) allCb.checked = arr.length === 0;
        updateBankLabel();
    } catch(e) {}
}
const revBankBtn = document.getElementById('revBankBtn');
const revBankDropdown = document.getElementById('revBankDropdown');
if (revBankBtn && revBankDropdown) {
    revBankBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = revBankDropdown.style.display === 'block';
        revBankDropdown.style.display = open ? 'none' : 'block';
        revBankBtn.classList.toggle('open', !open);
    });
    document.addEventListener('click', () => {
        revBankDropdown.style.display = 'none';
        revBankBtn.classList.remove('open');
    });
    revBankDropdown.addEventListener('click', e => e.stopPropagation());

    const allCb = document.getElementById('revBankAll');
    if (allCb) {
        allCb.addEventListener('change', () => {
            document.querySelectorAll('.rev-bank-cb').forEach(cb => { cb.checked = false; });
            allCb.checked = true;
            updateBankLabel();
            saveBankFilter();
            filterReview();
        });
    }
    document.querySelectorAll('.rev-bank-cb').forEach(cb => {
        cb.addEventListener('change', () => {
            const any = document.querySelectorAll('.rev-bank-cb:checked').length > 0;
            if (allCb) allCb.checked = !any;
            updateBankLabel();
            saveBankFilter();
            filterReview();
        });
    });
    restoreBankFilter();
}

// ===== Batas menit antrian lama (REVIEW) =====
const revMinutesEl = document.getElementById('revMinutes');
const savedMinutes = localStorage.getItem('revMinutes');
if (savedMinutes !== null && revMinutesEl) {
    revMinutesEl.value = savedMinutes;
}
if (revMinutesEl) {
    revMinutesEl.addEventListener('input', () => {
        localStorage.setItem('revMinutes', revMinutesEl.value);
        // Aktif di kedua tab
        if (revInput.value.trim()) filterReview();
        if (admInput.value.trim()) filterAdmin();
    });
}

const admThresholdEl = document.getElementById('admThreshold');

// Restore threshold dari localStorage (tidak ikut ter-reset)
const savedThreshold = localStorage.getItem('admThreshold');
if (savedThreshold !== null) {
    admThresholdEl.value = savedThreshold;
}

admThresholdEl.addEventListener('input', () => {
    localStorage.setItem('admThreshold', admThresholdEl.value);
    clearTimeout(debAdm);
    debAdm = setTimeout(filterAdmin, 100);
});

/* ===== SHOW / RENDER / HIDE ===== */
function groupOutputByBank(tsv, staleRows) {
    if (!tsv || !tsv.trim()) return { tsv: tsv || '', stale: staleRows || [] };

    const lines = tsv.split('\n').filter(line => line.trim() !== '');
    const staleSet = new Set(staleRows || []);
    const rows = lines.map((line, idx) => ({
        line,
        stale: staleSet.has(idx),
        idx
    }));

    const groups = new Map();
    const order = [];
    rows.forEach(row => {
        const cols = row.line.split('\t');
        const bank = String(cols[0] || '').trim();
        const key = bank.toUpperCase().replace(/[\s_\-\.]+/g, ' ');
        if (!groups.has(key)) {
            groups.set(key, []);
            order.push(key);
        }
        groups.get(key).push(row);
    });

    const sorted = order.flatMap(key => groups.get(key));
    const newStale = [];
    sorted.forEach((row, idx) => {
        if (row.stale) newStale.push(idx);
    });

    return { tsv: sorted.map(row => row.line).join('\n'), stale: newStale };
}

function showResult(name, outEl, tsv, count) {
    if (name === 'rev' || name === 'adm') {
        const grouped = groupOutputByBank(tsv, RESULT_STALE[name] || []);
        tsv = grouped.tsv;
        RESULT_STALE[name] = grouped.stale;
    }
    RESULT_TSV[name] = tsv;
    renderExcel(outEl, tsv, count, RESULT_STALE[name] || []);

    document.getElementById(name + 'Result').classList.add('show');

    const card = document.getElementById(name + 'Result').querySelector('.card');
    card.classList.remove('flash');
    void card.offsetWidth;
    card.classList.add('flash');
}

function renderExcel(el, tsv, count, staleFlags) {
    const rows = tsv.split('\n');
    staleFlags = staleFlags || [];

    // DocumentFragment → render massal tanpa reflow berulang (cepat utk data besar)
    const frag = document.createDocumentFragment();
    const scroll = document.createElement('div');
    scroll.className = 'excel-scroll';

    const table = document.createElement('table');
    table.className = 'excel';

    // thead
    const thead = document.createElement('thead');
    const htr = document.createElement('tr');
    const thNum = document.createElement('th');
    thNum.className = 'rownum';
    thNum.textContent = '#';
    htr.appendChild(thNum);
    EXCEL_HEADERS.forEach(h => {
        const th = document.createElement('th');
        th.textContent = h;
        htr.appendChild(th);
    });
    thead.appendChild(htr);
    table.appendChild(thead);

    // tbody
    const tbody = document.createElement('tbody');
    rows.forEach((line, i) => {
        const tr = document.createElement('tr');
        if (staleFlags[i]) tr.className = 'stale';

        const tdNum = document.createElement('td');
        tdNum.className = 'rownum';
        tdNum.textContent = i + 1;
        tr.appendChild(tdNum);

        const cells = line.split('\t');
        cells.forEach((c, ci) => {
            const td = document.createElement('td');
            if (ci === cells.length - 1) td.className = 'num-cell';
            td.textContent = c;   // textContent otomatis aman dari HTML injection
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    scroll.appendChild(table);
    frag.appendChild(scroll);
    el.innerHTML = '';
    el.appendChild(frag);

    // tinggi tabel mengikuti jumlah baris (maks 520px, lalu scroll)
    scroll.style.maxHeight = Math.min(520, Math.max(160, count * 38 + 80)) + 'px';
}

function hide(name) {
    document.getElementById(name + 'Result').classList.remove('show');
    if (name === 'rev') {
        const el = document.getElementById('topRevStats');
        if (el) el.style.display = 'none';
    } else if (name === 'adm') {
        const el = document.getElementById('topAdmStats');
        if (el) el.style.display = 'none';
    }
}

function copyOut(name) {
    const tsv = RESULT_TSV[name];
    if (!tsv) { toast('⚠️ Belum ada hasil'); return; }

    const done = () => toast('📋 Tersalin ke clipboard!');

    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(tsv).then(done).catch(() => fallbackCopy(tsv, done));
    } else {
        fallbackCopy(tsv, done);
    }
}

function fallbackCopy(text, done) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.left = '0';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
    done();
}

function clearSec(name) {
    document.getElementById(name + 'Input').value = '';
    document.getElementById(name + 'Output').innerHTML = '';
    RESULT_TSV[name] = '';
    RESULT_STALE[name] = [];
    hide(name);
    document.getElementById(name + 'Input').focus();
    toast('🗑️ Reset bersih');
}

let toastTimer;
function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}

const themeBtn = document.getElementById('themeBtn');
if (localStorage.getItem('theme') === 'dark') {
    document.documentElement.dataset.theme = 'dark';
    themeBtn.textContent = '☀️';
}
themeBtn.addEventListener('click', () => {
    const html = document.documentElement;
    const dark = html.dataset.theme === 'dark';
    html.dataset.theme = dark ? '' : 'dark';
    themeBtn.textContent = dark ? '🌙' : '☀️';
    localStorage.setItem('theme', dark ? 'light' : 'dark');
});
