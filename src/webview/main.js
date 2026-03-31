// @ts-check
(function () {
  /** @type {any} */
  const vscode = acquireVsCodeApi();

  // ── Constants ──────────────────────────────────────────────────────────
  const DEFAULT_H  = 44;
  const EXPANDED_H = 220;
  const BUFFER     = 10;

  // ── State ───────────────────────────────────────────────────────────────
  /** @type {any[]} */
  let allEntries = [];
  /** @type {any[]} */
  let filteredEntries = [];
  /** @type {number[]} */
  let heights = [];
  /** @type {number[]} */
  let offsets = [];
  /** @type {Set<number>} */
  const expandedIds = new Set();
  let isLoading = false;

  let filterLevel  = '';
  let filterSearch = '';
  let filterHours  = 0;
  let newestTimestamp = 0;
  let filterMode       = 'relative'; // 'relative' | 'custom'
  let filterRangeStart = 0;          // ms epoch, 0 = no lower bound
  let filterRangeEnd   = 0;          // ms epoch, 0 = no upper bound

  // ── DOM refs ────────────────────────────────────────────────────────────
  const scrollerEl  = /** @type {HTMLElement} */ (document.getElementById('scroller-container'));
  const spacerEl    = /** @type {HTMLElement} */ (document.getElementById('spacer'));
  const rowsEl      = /** @type {HTMLElement} */ (document.getElementById('rows-container'));
  const levelSel    = /** @type {HTMLSelectElement} */ (document.getElementById('level-filter'));
  const searchInput = /** @type {HTMLInputElement} */ (document.getElementById('search-input'));
  const timeSel     = /** @type {HTMLSelectElement} */ (document.getElementById('time-filter'));
  const statusBar   = /** @type {HTMLElement} */ (document.getElementById('status-bar'));
  const timeBtnEl1m    = /** @type {HTMLElement} */    (document.getElementById('time-btn-1m'));
  const timeBtnEl5m    = /** @type {HTMLElement} */    (document.getElementById('time-btn-5m'));
  const customRangeBar = /** @type {HTMLElement} */    (document.getElementById('custom-range-bar'));
  const rangeStartEl   = /** @type {HTMLInputElement} */(document.getElementById('range-start'));
  const rangeEndEl     = /** @type {HTMLInputElement} */(document.getElementById('range-end'));

  // ── Filter helpers ────────────────────────────────────────────────────────────
  /** @param {any} e @param {number} cutoff */
  function matchesFilters(e, cutoff) {
    if (filterLevel && e.level !== filterLevel) return false;
    if (filterSearch) {
      const hit =
        (e.message && e.message.toLowerCase().includes(filterSearch)) ||
        (e.url     && e.url.toLowerCase().includes(filterSearch))     ||
        (e.ip      && e.ip.toLowerCase().includes(filterSearch));
      if (!hit) return false;
    }
    if (filterMode === 'relative' && filterHours > 0) {
      if (!e.timestamp) return false;
      if (new Date(e.timestamp).getTime() < cutoff) return false;
    } else if (filterMode === 'custom') {
      if (!e.timestamp) return false;
      const t = new Date(e.timestamp).getTime();
      if (filterRangeStart > 0 && t < filterRangeStart) return false;
      if (filterRangeEnd   > 0 && t > filterRangeEnd)   return false;
    }
    return true;
  }

  /** @param {any[]} entries */
  function updateNewestTimestamp(entries) {
    for (const e of entries) {
      if (e.timestamp) {
        const t = new Date(e.timestamp).getTime();
        if (!isNaN(t) && t > newestTimestamp) newestTimestamp = t;
      }
    }
  }

  // ── Filtering ────────────────────────────────────────────────────────────
  function applyFilters() {
    let cutoff = 0;
    if (filterMode === 'relative' && filterHours > 0) {
      cutoff = newestTimestamp > 0
        ? newestTimestamp - filterHours * 3_600_000
        : Date.now()     - filterHours * 3_600_000;
    }
    filteredEntries = allEntries.filter(e => matchesFilters(e, cutoff));
    rebuildHeights();
    render();
    updateStatus();
  }

  // ── Height / offset bookkeeping ──────────────────────────────────────────
  function rebuildHeights() {
    heights = filteredEntries.map(e => expandedIds.has(e.id) ? EXPANDED_H : DEFAULT_H);
    rebuildOffsets(0);
  }

  /** @param {number} from */
  function rebuildOffsets(from) {
    if (heights.length === 0) { spacerEl.style.height = '0px'; return; }
    if (from === 0) offsets[0] = 0;
    for (let i = Math.max(from, 1); i < heights.length; i++) {
      offsets[i] = offsets[i - 1] + heights[i - 1];
    }
    offsets.length = heights.length;
    const total = offsets[heights.length - 1] + heights[heights.length - 1];
    spacerEl.style.height = total + 'px';
  }

  // ── Visible range (binary search) ────────────────────────────────────────
  function visibleRange() {
    const top    = scrollerEl.scrollTop;
    const bottom = top + scrollerEl.clientHeight;
    const n      = filteredEntries.length;
    if (n === 0) return { start: 0, end: 0 };

    let lo = 0, hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (offsets[mid] + heights[mid] < top) lo = mid + 1;
      else hi = mid;
    }
    const start = Math.max(0, lo - BUFFER);
    let end = lo;
    while (end < n && offsets[end] < bottom) end++;
    end = Math.min(n, end + BUFFER);
    return { start, end };
  }

  // ── Render ───────────────────────────────────────────────────────────────
  function render() {
    const { start, end } = visibleRange();
    while (rowsEl.firstChild) rowsEl.removeChild(rowsEl.firstChild);

    if (filteredEntries.length === 0 && !isLoading) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'No entries match the current filters';
      rowsEl.appendChild(empty);
      return;
    }

    for (let i = start; i < end; i++) {
      rowsEl.appendChild(buildRow(filteredEntries[i], i));
    }
  }

  /**
   * Build a row element using safe DOM APIs (no user content via innerHTML).
   * @param {any} entry
   * @param {number} idx
   */
  function buildRow(entry, idx) {
    const row = document.createElement('div');
    row.className = 'log-row level-' + (entry.level || 'unknown').toLowerCase();
    row.style.cssText =
      'position:absolute;top:' + offsets[idx] + 'px;' +
      'width:100%;height:' + heights[idx] + 'px;box-sizing:border-box;';

    // ── Main line ──────────────────────────────────────────────────────────
    const main = document.createElement('div');
    main.className = 'log-row-main';

    const badge = document.createElement('span');
    badge.className = 'log-level-badge';
    badge.textContent = entry.level || 'UNKNOWN';
    main.appendChild(badge);

    const ts = document.createElement('span');
    ts.className = 'log-timestamp';
    ts.textContent = entry.timestamp || '';
    main.appendChild(ts);

    const msgSpan = document.createElement('span');
    msgSpan.className = 'log-message';
    appendHighlighted(msgSpan, entry.message || '', filterSearch);

    if (entry.ip) {
      const ipSpan = document.createElement('span');
      ipSpan.className = 'log-ip';
      appendHighlighted(ipSpan, entry.ip, filterSearch);
      msgSpan.appendChild(ipSpan);
    }
    if (entry.url) {
      const urlSpan = document.createElement('span');
      urlSpan.className = 'log-url';
      appendHighlighted(urlSpan, entry.url, filterSearch);
      msgSpan.appendChild(urlSpan);
    }
    if (entry.statusCode) {
      const stSpan = document.createElement('span');
      stSpan.className = 'log-status';
      stSpan.textContent = String(entry.statusCode);
      msgSpan.appendChild(stSpan);
    }
    main.appendChild(msgSpan);
    row.appendChild(main);

    // ── Stack trace toggle ─────────────────────────────────────────────────
    if (entry.context) {
      const toggle = document.createElement('div');
      toggle.className = 'log-context-toggle';
      const expanded = expandedIds.has(entry.id);
      toggle.textContent = (expanded ? '\u25BC' : '\u25BA') + ' Stack trace';
      toggle.addEventListener('click', () => toggleExpand(entry.id));
      toggle.setAttribute('role', 'button');
      toggle.setAttribute('tabindex', '0');
      toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      toggle.addEventListener('keydown', (/** @type {KeyboardEvent} */ ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          toggleExpand(entry.id);
        }
      });
      row.appendChild(toggle);

      if (expanded) {
        const pre = document.createElement('pre');
        pre.className = 'log-context';
        pre.textContent = entry.context;
        row.appendChild(pre);
      }
    }

    return row;
  }

  /**
   * Append text into a container element, wrapping query matches in <mark>.
   * Uses textContent for all text nodes — safe against injection.
   * @param {HTMLElement} container
   * @param {string} text
   * @param {string} query  (already lowercased)
   */
  function appendHighlighted(container, text, query) {
    if (!query) {
      container.appendChild(document.createTextNode(text));
      return;
    }
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(escapedQuery, 'gi');
    const matches = Array.from(text.matchAll(pattern));
    let last = 0;
    for (const m of matches) {
      const idx = /** @type {number} */ (m.index);
      if (idx > last) {
        container.appendChild(document.createTextNode(text.slice(last, idx)));
      }
      const mark = document.createElement('mark');
      mark.textContent = m[0];
      container.appendChild(mark);
      last = idx + m[0].length;
    }
    if (last < text.length) {
      container.appendChild(document.createTextNode(text.slice(last)));
    }
  }

  // ── Expand / collapse ────────────────────────────────────────────────────
  /** @param {number} id */
  function toggleExpand(id) {
    const idx = filteredEntries.findIndex(e => e.id === id);
    if (idx === -1) return;
    if (expandedIds.has(id)) {
      expandedIds.delete(id);
      heights[idx] = DEFAULT_H;
    } else {
      expandedIds.add(id);
      heights[idx] = EXPANDED_H;
    }
    rebuildOffsets(idx + 1);
    render();
  }

  // ── Status bar ────────────────────────────────────────────────────────────
  function updateStatus() {
    const errors   = allEntries.filter(e => e.level === 'ERROR' || e.level === 'CRITICAL').length;
    const warnings = allEntries.filter(e => e.level === 'WARNING' || e.level === 'NOTICE').length;
    const loading  = isLoading ? ' \u00B7 Loading\u2026' : '';
    statusBar.textContent =
      'Showing ' + filteredEntries.length + ' of ' + allEntries.length + ' entries' +
      ' \u00B7 ' + errors + ' error' + (errors !== 1 ? 's' : '') +
      ' \u00B7 ' + warnings + ' warning' + (warnings !== 1 ? 's' : '') +
      loading;
  }

  // ── Event listeners ───────────────────────────────────────────────────────
  scrollerEl.addEventListener('scroll', render, { passive: true });

  levelSel.addEventListener('change', () => {
    filterLevel = levelSel.value;
    applyFilters();
  });

  let debounce;
  searchInput.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      filterSearch = searchInput.value.toLowerCase();
      applyFilters();
    }, 150);
  });

  timeSel.addEventListener('change', () => {
    setActiveTimeBtn(null);
    if (timeSel.value === '-1') {
      filterMode  = 'custom';
      filterHours = 0;
      customRangeBar.style.display = 'flex';
    } else {
      filterMode  = 'relative';
      filterHours = parseInt(timeSel.value, 10) || 0;
      customRangeBar.style.display = 'none';
    }
    applyFilters();
  });

  rangeStartEl.addEventListener('change', () => {
    filterRangeStart = rangeStartEl.value ? new Date(rangeStartEl.value).getTime() : 0;
    applyFilters();
  });

  rangeEndEl.addEventListener('change', () => {
    filterRangeEnd = rangeEndEl.value ? new Date(rangeEndEl.value).getTime() : 0;
    applyFilters();
  });

  /** @param {HTMLElement|null} activeBtn */
  function setActiveTimeBtn(activeBtn) {
    [timeBtnEl1m, timeBtnEl5m].forEach(b => b.classList.remove('active'));
    if (activeBtn) activeBtn.classList.add('active');
  }

  timeBtnEl1m.addEventListener('click', () => {
    filterMode  = 'relative';
    filterHours = 1 / 60;
    timeSel.value = '0';
    customRangeBar.style.display = 'none';
    setActiveTimeBtn(timeBtnEl1m);
    applyFilters();
  });

  timeBtnEl5m.addEventListener('click', () => {
    filterMode  = 'relative';
    filterHours = 5 / 60;
    timeSel.value = '0';
    customRangeBar.style.display = 'none';
    setActiveTimeBtn(timeBtnEl5m);
    applyFilters();
  });

  // ── Message handler ───────────────────────────────────────────────────────
  window.addEventListener('message', ev => {
    const msg = ev.data;
    if (msg.type === 'init') {
      allEntries = msg.entries || [];
      expandedIds.clear();
      newestTimestamp = 0;
      isLoading = msg.totalLines === -1;
      updateNewestTimestamp(allEntries);
      applyFilters();
    } else if (msg.type === 'append') {
      const newEntries = msg.entries || [];
      allEntries.push(...newEntries);
      updateNewestTimestamp(newEntries);

      let cutoff = 0;
      if (filterMode === 'relative' && filterHours > 0) {
        cutoff = newestTimestamp > 0
          ? newestTimestamp - filterHours * 3_600_000
          : Date.now()     - filterHours * 3_600_000;
      }
      const newMatches = newEntries.filter(e => matchesFilters(e, cutoff));

      if (newMatches.length > 0) {
        const prevLen = filteredEntries.length;
        filteredEntries.push(...newMatches);
        newMatches.forEach(() => heights.push(DEFAULT_H));
        rebuildOffsets(prevLen);
        if (visibleRange().end >= prevLen - BUFFER) render();
      }
      updateStatus();
    } else if (msg.type === 'done') {
      isLoading = false;
      applyFilters(); // final consistency pass
      updateStatus();
    }
  });

  // Signal ready — provider responds with 'init'
  vscode.postMessage({ type: 'ready' });
})();
