// ==UserScript==
// @name         Timelog Bulk Filler
// @namespace    https://github.com/0x384c0/scripts
// @version      3.2.0
// @description  Bulk-fill a month of time logs in any supported time tracker: clone a template day, or import a month exported from another tracker and map its projects onto this one.
// @author       0x384c0
// @homepageURL  https://github.com/0x384c0/scripts/tree/master/user_scripts
// @supportURL   https://github.com/0x384c0/scripts/issues
// @updateURL    https://raw.githubusercontent.com/0x384c0/scripts/master/user_scripts/timelog-bulk-filler.user.js
// @downloadURL  https://raw.githubusercontent.com/0x384c0/scripts/master/user_scripts/timelog-bulk-filler.user.js
// @include      /^https?:\/\/people\.zoho\.[a-z]{2,}(\.[a-z]{2,})?(\/.*)?$/
// @include      /^https?:\/\/jade\.[^/]+(\/.*)?$/
// @run-at       document-idle
// @grant        none
// ==/UserScript==
//
// ADDING A TRACKER
//   1. Subclass TimeTracker (ZohoPeopleTracker is a worked API-driven example,
//      JadeTracker a worked DOM-driven one).
//   2. Register it in TRACKERS.
//   3. Add its hostnames to @include above.
// The engine and UI below are tracker-agnostic: they speak only the
// normalised DayInfo / Entry / Logbook shapes documented on TimeTracker.
//
// Nothing here hardcodes a company, a person, a project or a form id: every
// such value is read back from the live page, its cookies or its APIs, so the
// script is safe to publish and to run on any tenant of a supported tracker.
//
// @grant none is REQUIRED: trackers read page globals (Zoho's erecno,
// _LOGGEDIN_ZUID, Timetracker.*), which a sandboxed script cannot see.

(function () {
  'use strict';

  // =====================================================================
  // Errors
  // =====================================================================

  /**
   * Anything the user should see as a sentence rather than a stack trace.
   * `code` lets the UI react to a condition instead of matching on text.
   *
   *   HISTORY_UNAVAILABLE - tracker cannot show the month that was asked for,
   *                         so a template day cannot be read from it
   *   PERIOD_CLOSED       - tracker refuses writes for the target month
   *   NOT_READY           - page did not expose what the adapter needs
   *   WRITE_FAILED        - a write was attempted and rejected
   */
  class TrackerError extends Error {
    constructor(message, code = 'ERROR', detail = null) {
      super(message);
      this.name = 'TrackerError';
      this.code = code;
      this.detail = detail;
    }
  }

  // =====================================================================
  // Tracker interface
  // =====================================================================

  /**
   * A time tracker adapter.
   *
   * Normalised shapes the engine and UI rely on:
   *
   *   DayInfo  { off: boolean, offReason: ?string, entries: Entry[] }
   *     off        - weekend / holiday / leave: never written to
   *     offReason  - 'weekend' | 'holiday' | 'leave' | ... , shown to the user
   *                  and used to explain where a shifted entry came from
   *
   *   Entry    { taskId, taskName, project, client, minutes,
   *              description, entryId, extra }
   *     taskId      - stable id used to decide "already logged"
   *     taskName    - full name of the job/task
   *     project     - short label shown in the UI (falls back to taskName)
   *     client      - optional customer name
   *     minutes     - duration in minutes
   *     description - plain text, already entity-decoded
   *     entryId     - existing record id, for updates (may be null)
   *     extra       - adapter-private payload, echoed back on write
   *
   *   Period   { from: Date, to: Date, deadline: ?Date, text: string }
   *     the window the tracker will accept writes in, when it advertises one
   *
   *   Target   { id, label, project, task, specialty, extra }
   *     something an imported entry can be mapped onto when writing here
   */
  class TimeTracker {
    /** Short machine id. */
    static id = 'base';
    /** Human label shown in the panel header. */
    static label = 'Time tracker';
    /** Write pacing; trackers throttle differently. */
    static rateLimit = { delayMs: 2000, retries: 3, backoffMs: 5000, abortAfter: 3 };

    /**
     * What this adapter can do. The UI hides or rewires itself from these
     * rather than testing for a tracker by name.
     *
     *   readHistory  - readMonth() works for past months, so a template day
     *                  can be picked here; false means "import a file instead"
     *   batchWrite   - writeBatch() is implemented and many dates can share
     *                  one round trip
     *   mapOnImport  - imported entries must be mapped onto targets() before
     *                  they can be written
     *   weekendsOff  - engine may assume Sat/Sun are non-working even when
     *                  readMonth() did not flag them
     */
    static capabilities = {
      readHistory: true,
      batchWrite: false,
      mapOnImport: false,
      weekendsOff: true,
    };

    /** Does this adapter handle the current page? */
    static matches() { return false; }

    /** Wait until the page exposes whatever the adapter needs. */
    async ready() { throw new TrackerError('not implemented', 'NOT_READY'); }

    /** Who the logs belong to, as the tracker labels them. */
    async employee() { return null; }

    /**
     * @returns {Promise<Object<string, DayInfo>>} keyed by day-of-month.
     * @throws  {TrackerError} HISTORY_UNAVAILABLE if that month cannot be shown.
     */
    async readMonth() { throw new TrackerError('not implemented', 'NOT_READY'); }

    /**
     * The window this tracker accepts writes in, or null if it never says.
     * @returns {Promise<?Period>}
     */
    async period() { return null; }

    /**
     * Everything an imported entry could be written as, for the mapping UI.
     * Only needed when capabilities.mapOnImport is true.
     * @returns {Promise<Target[]>}
     */
    async targets() { return []; }

    /**
     * Create (or update) one entry.
     * @param {{date: Date, template: Object, description: string, entryId: ?string}} req
     * @returns {Promise<number>} HTTP-like status; 200 means success.
     */
    async writeEntry() { throw new TrackerError('not implemented', 'NOT_READY'); }

    /**
     * Create one entry on each of several dates in a single round trip.
     * Only called when capabilities.batchWrite is true.
     * @param {{dates: Date[], template: Object, description: string}} req
     * @returns {Promise<number>} HTTP-like status; 200 means success.
     */
    async writeBatch() { throw new TrackerError('not implemented', 'NOT_READY'); }
  }

  // =====================================================================
  // Shared helpers
  // =====================================================================

  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTH_NAMES = ['january', 'february', 'march', 'april', 'may', 'june', 'july',
                       'august', 'september', 'october', 'november', 'december'];

  const fmtHM = (min) =>
    String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');

  const hmToMin = (hm) => Number(hm.split(':')[0]) * 60 + Number(hm.split(':')[1]);

  /** Decimal hours, the way most UIs want them typed. */
  const fmtHours = (min) => (min / 60).toFixed(2);

  const decodeEntities = (s) => {
    const t = document.createElement('textarea');
    t.innerHTML = s || '';
    return t.value;
  };

  const esc = (s) => String(s == null ? '' : s)
    .replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const pad = (s, n) => String(s == null ? '' : s).padEnd(n).slice(0, n);

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /** Poll until fn() is truthy, or give up. */
  async function waitFor(fn, timeoutMs = 20000, stepMs = 250) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      try { if (fn()) return true; } catch (e) { /* keep polling */ }
      await sleep(stepMs);
    }
    return false;
  }

  /** Local-midnight Date, so day arithmetic never crosses a timezone edge. */
  const dateOf = (y, m, d) => new Date(y, m - 1, d);
  const isWeekend = (d) => d.getDay() === 0 || d.getDay() === 6;
  const ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
                     '-' + String(d.getDate()).padStart(2, '0');
  const parseYmd = (s) => {
    const [y, m, d] = String(s).split('-').map(Number);
    return dateOf(y, m, d);
  };
  const sameDay = (a, b) => a && b && ymd(a) === ymd(b);
  const shortDate = (d) => d.toDateString().slice(4); // "Nov 03 2026"

  /** localStorage, namespaced and never throwing (private mode, quota, ...). */
  const store = {
    key: (k) => 'timelog-bulk-filler:' + k,
    get(k, fallback) {
      try {
        const raw = localStorage.getItem(store.key(k));
        return raw == null ? fallback : JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set(k, v) {
      try { localStorage.setItem(store.key(k), JSON.stringify(v)); return true; }
      catch (e) { console.warn('[timelog-filler] could not persist', k, e); return false; }
    },
  };

  /** Offer a generated file to the user without needing @grant GM_download. */
  function downloadText(filename, text, mime = 'application/json') {
    const url = URL.createObjectURL(new Blob([text], { type: mime }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  /** Read one user-picked file as text. Resolves null if the picker is cancelled. */
  function pickFile(accept = '.json,application/json') {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.style.cssText = 'position:fixed;left:-9999px;';
      input.onchange = () => {
        const f = input.files && input.files[0];
        if (!f) { input.remove(); return resolve(null); }
        const r = new FileReader();
        r.onload = () => { input.remove(); resolve({ name: f.name, text: String(r.result) }); };
        r.onerror = () => { input.remove(); resolve(null); };
        r.readAsText(f);
      };
      document.body.appendChild(input);
      input.click();
    });
  }

  // =====================================================================
  // DOM automation helpers
  //
  // For trackers with no HTTP API of their own - a Blazor Server app, for
  // instance, talks to its backend over an opaque SignalR connection, so the
  // only way in is the UI it renders. Everything below drives real widgets:
  // events are dispatched so they bubble, because server-side frameworks
  // listen through a single delegated handler on the document and ignore
  // anything that does not reach it.
  // =====================================================================

  /**
   * Rendered and on screen. Hidden form variants share the DOM with live ones,
   * so this has to be true visibility - and offsetParent alone will not do it,
   * because a position:fixed element (an overlay, a dialog) has none.
   */
  const visible = (el) => {
    if (!el) return false;
    if (el.offsetParent !== null) return true;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
    return el.getClientRects().length > 0;
  };

  const allVisible = (root, sel) => [...(root || document).querySelectorAll(sel)].filter(visible);
  const firstVisible = (root, sel) => allVisible(root, sel)[0] || null;

  const textOf = (el) => (el ? el.textContent : '').replace(/\s+/g, ' ').trim();

  /**
   * A click the page cannot tell from a real one: full pointer/mouse sequence,
   * bubbling, with real coordinates. `.click()` alone is enough for plain
   * buttons but not for widgets that track pointerdown to decide focus.
   */
  function realClick(el, opts = {}) {
    const r = el.getBoundingClientRect();
    const base = {
      bubbles: true, cancelable: true, composed: true, view: window, button: 0,
      clientX: r.left + r.width / 2, clientY: r.top + r.height / 2,
      ctrlKey: !!opts.ctrlKey, shiftKey: !!opts.shiftKey,
    };
    const pointer = { ...base, pointerId: 1, isPrimary: true, pointerType: 'mouse' };
    el.dispatchEvent(new PointerEvent('pointerdown', pointer));
    el.dispatchEvent(new MouseEvent('mousedown', base));
    el.dispatchEvent(new PointerEvent('pointerup', pointer));
    el.dispatchEvent(new MouseEvent('mouseup', base));
    el.dispatchEvent(new MouseEvent('click', base));
  }

  /**
   * Set an input's value so a two-way binding notices. Frameworks patch the
   * value setter to track changes, so the native setter has to be called
   * explicitly before the events are fired.
   */
  function setFieldValue(el, value) {
    const proto = el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    el.focus();
    setter.call(el, String(value));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /** A line of transient progress for the panel; replaced once the UI exists. */
  const Status = { report() {} };

  /**
   * Riding out a flaky connection.
   *
   * Some single-page frameworks keep the rendered page on screen after the
   * connection behind it drops: the pixels look fine, every click is
   * swallowed, and a run would otherwise appear to work while writing
   * nothing at all. Worse, the page can take half a minute to admit it, so
   * for that whole window a dead socket is indistinguishable from a slow
   * server.
   *
   * The saving grace is that the session lives on the server, not in the
   * page: when it reconnects, the UI comes back exactly as it was. So an
   * outage is something to sit through and carry on from, not a reason to
   * stop - and whatever was on screen afterwards is the truth about what the
   * server did.
   */
  const Connection = {
    /** Why the page is not talking to its server, or null if it is. */
    lost() {
      // the framework's own reconnection bookkeeping, where it is reachable:
      // it is set the moment the connection drops, a little before the
      // banner is painted
      try {
        const handler = window.Blazor && window.Blazor.defaultReconnectionHandler;
        const process = handler && handler._currentReconnectionProcess;
        if (process && process.isDisposed === false) {
          return 'the page lost its connection to the server';
        }
      } catch (e) { /* internals are not a contract; the banner below is enough */ }

      const modal = this.modal();
      if (!modal) return null;
      const shouting = /components-reconnect-(show|failed|rejected)/.test(modal.className);
      if (!shouting && !visible(modal)) return null;
      return textOf(modal).replace(/Retry.*$/i, '').trim() ||
             'the page lost its connection to the server';
    },

    modal() {
      return document.getElementById('components-reconnect-modal') ||
             document.querySelector('.components-reconnect-show, [class*="reconnect-modal"]');
    },

    /** Has the page given up retrying by itself? Then a nudge is wanted. */
    exhausted() {
      const modal = this.modal();
      if (!modal) return false;
      return /failed|rejected/i.test(modal.className) ||
             /failed to reconnect|reconnection failed|could not reconnect/i.test(textOf(modal));
    },

    /** Ask for another attempt, exactly as the page's own Retry button does. */
    nudge() {
      try {
        if (window.Blazor && typeof window.Blazor.reconnect === 'function') {
          const p = window.Blazor.reconnect();
          if (p && typeof p.catch === 'function') p.catch(() => {});
          return true;
        }
      } catch (e) { /* fall through to the button */ }
      try {
        const btn = this.modal() && this.modal().querySelector('button');
        if (btn && visible(btn)) { realClick(btn); return true; }
      } catch (e) { /* nothing else to try */ }
      return false;
    },

    /**
     * Sit through an outage. Only nudges once the page has stopped trying on
     * its own - racing its retry loop would just make things worse.
     * @returns {Promise<boolean>} true if the connection came back in time.
     */
    async waitBack(budgetMs = 180000, what = '') {
      if (!this.lost()) return true;
      const t0 = Date.now();
      let lastNudge = 0;
      let nudges = 0;

      while (Date.now() - t0 < budgetMs) {
        const waited = Math.round((Date.now() - t0) / 1000);
        Status.report('Connection dropped' + (what ? ' during ' + what : '') +
                      ' - waiting for it to come back (' + waited + 's)');

        if (this.exhausted() && Date.now() - lastNudge > 15000) {
          this.nudge();
          lastNudge = Date.now();
          nudges++;
        }
        // The session is only held open on the server for a few minutes. Once
        // the page says it has given up and a nudge has not revived it, the
        // session is gone and more waiting buys nothing - so fail promptly
        // instead of sitting out the whole budget.
        if (nudges >= 2 && this.exhausted()) {
          Status.report('');
          return false;
        }

        await sleep(1000);
        if (!this.lost()) {
          Status.report('Back. Carrying on...');
          await sleep(1500); // let the page finish re-rendering before touching it
          Status.report('');
          return true;
        }
      }
      Status.report('');
      return false;
    },
  };

  /** The page is not reachable and will not be: say so once and stop. */
  function deadConnection(budgetMs) {
    const gone = Connection.exhausted();
    return new TrackerError(
      (gone
        ? 'the page has given up reconnecting, and the session behind it is gone for good'
        : 'the page could not get its connection back within ' + Math.round(budgetMs / 1000) + 's') +
      '. Reload it and run again - anything already written is detected and skipped, so a re-run ' +
      'only fills what is missing.', 'NOT_READY');
  }

  async function ensureLive(budgetMs = 180000, what = '') {
    if (await Connection.waitBack(budgetMs, what)) return;
    throw deadConnection(budgetMs);
  }

  /**
   * waitFor, except an outage does not count against the clock: the wait
   * pauses while the connection is away and resumes where it left off.
   */
  async function waitThrough(until, timeoutMs = 15000, budgetMs = 180000, what = '', stepMs = 200) {
    let deadline = Date.now() + timeoutMs;
    for (;;) {
      try { if (until()) return true; } catch (e) { /* keep polling */ }
      if (Connection.lost()) {
        const outageStart = Date.now();
        if (!await Connection.waitBack(budgetMs, what)) throw deadConnection(budgetMs);
        deadline += Date.now() - outageStart;
        continue;
      }
      if (Date.now() > deadline) return false;
      await sleep(stepMs);
    }
  }

  /**
   * Do something to the page and make sure it took, retrying through
   * outages and swallowed clicks.
   *
   * Every caller passes `until`, a check of the outcome rather than of the
   * click, which is what makes a retry safe: if the first attempt did land,
   * the check passes and nothing is done twice. Only use this for actions
   * where that holds - picking from a list, setting a field, opening a
   * dialog. Submitting a form is not one of them.
   */
  async function act({ what, perform, until, timeoutMs = 15000, attempts = 3, budgetMs = 180000 }) {
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try { if (until()) return true; } catch (e) { /* not yet */ }
      await ensureLive(budgetMs, what);
      try {
        await perform();
      } catch (e) {
        // a missing option is a real answer, not a hiccup: do not keep asking
        if (e && e.fatal) throw e;
        if (attempt === attempts) throw e;
        Status.report(what + ' failed (' + e.message + ') - trying again');
        await sleep(600);
        continue;
      }
      if (await waitThrough(until, timeoutMs, budgetMs, what)) return true;
      if (attempt < attempts) {
        Status.report('No response to ' + what + ' - trying again (' + (attempt + 1) + '/' + attempts + ')');
        await sleep(600);
      }
    }
    Status.report('');
    throw new TrackerError(
      'the page did not respond to ' + what + ' after ' + attempts + ' tries. ' +
      'It is still rendering, so this is usually a connection that dropped without saying so - ' +
      'reload the page and run again.', 'NOT_READY');
  }

  /**
   * Kendo/Telerik widget plumbing, shared by any adapter built on that UI kit.
   * Popups are portalled to <body>; a picker names its own popup through
   * aria-controls, which is the only reliable way to tell two open lists apart.
   *
   * Every method here checks the outcome it wanted rather than the click it
   * made, so each one can be retried through a dropped connection without
   * doing anything twice.
   */
  const Kendo = {
    /**
     * The picker whose field label reads `label`, within `root`.
     *
     * aria-labelledby is what the widget itself says its label is, which
     * matters on forms where "Project" and "Project Task" sit in one wrapper
     * and a nearest-label guess would happily return the wrong one.
     */
    pickerByLabel(root, label) {
      const norm = (s) => String(s).toLowerCase().replace(/[:*]/g, '').replace(/\s+/g, ' ').trim();
      const want = norm(label);
      const pickers = allVisible(root, '.k-dropdownlist, .k-combobox');

      for (const picker of pickers) {
        const id = picker.getAttribute('aria-labelledby');
        const lbl = id ? document.getElementById(id) : null;
        if (lbl && norm(textOf(lbl)) === want) return picker;
      }
      // only if the widget declared no label: the closest wrapper that has one
      for (const picker of pickers) {
        if (picker.getAttribute('aria-labelledby')) continue;
        let scope = picker.parentElement;
        for (let i = 0; i < 3 && scope; i++, scope = scope.parentElement) {
          const lbls = [...scope.querySelectorAll('label')].filter(visible);
          if (!lbls.length) continue;
          if (norm(textOf(lbls[0])) === want) return picker;
          break; // the nearest label is this picker's; it is not the one wanted
        }
      }
      return null;
    },

    /** The popup list a picker owns, if it is open. */
    popupOf(picker) {
      const id = picker.getAttribute('aria-controls');
      const container = id ? document.getElementById(id) : null;
      if (container && visible(container)) return container;
      const list = id ? document.querySelector('[id="' + CSS.escape(id) + '"] .k-list-ul') : null;
      return list && visible(list) ? list.closest('.k-animation-container') || list : null;
    },

    isOpen(picker) {
      return picker.getAttribute('aria-expanded') === 'true' && !!this.popupOf(picker);
    },

    items(picker) {
      const popup = this.popupOf(picker);
      return popup ? [...popup.querySelectorAll('.k-list-item, li[role="option"]')] : [];
    },

    async open(picker, what = 'a dropdown') {
      await act({
        what: 'opening ' + what,
        perform: () => realClick(picker.querySelector('.k-input-inner') || picker),
        until: () => this.isOpen(picker),
      });
      await sleep(120); // let the list finish rendering its items
      return this.popupOf(picker);
    },

    async close(picker) {
      if (picker.getAttribute('aria-expanded') !== 'true') return;
      picker.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await waitFor(() => picker.getAttribute('aria-expanded') !== 'true', 3000, 80);
    },

    /** Option labels currently offered by a picker. */
    async options(picker, what = 'a dropdown') {
      await this.open(picker, what);
      const items = this.items(picker).map(textOf);
      await this.close(picker);
      return items.filter(Boolean);
    },

    /**
     * Pick the option whose text matches, exactly first then loosely.
     * Done when the picker *shows* it, which is also what makes a retry safe.
     */
    async select(picker, label, what) {
      const want = String(label).replace(/\s+/g, ' ').trim();
      const shows = () => {
        const live = document.contains(picker) ? picker : null;
        if (!live) return false;
        const now = textOf(live);
        return now === want || now.toLowerCase() === want.toLowerCase();
      };
      if (shows()) return true;

      await act({
        what: what || 'choosing "' + want + '"',
        perform: async () => {
          if (!this.isOpen(picker)) {
            realClick(picker.querySelector('.k-input-inner') || picker);
            if (!await waitThrough(() => this.isOpen(picker), 8000, undefined, 'the dropdown')) {
              throw new TrackerError('the dropdown would not open');
            }
            await sleep(120);
          }
          const items = this.items(picker);
          const hit = items.find((li) => textOf(li) === want) ||
                      items.find((li) => textOf(li).toLowerCase() === want.toLowerCase()) ||
                      items.find((li) => textOf(li).toLowerCase().includes(want.toLowerCase()));
          if (!hit) {
            const offered = items.map(textOf).join(' | ') || 'nothing';
            await this.close(picker);
            const err = new TrackerError('no option "' + want + '" - offered: ' + offered, 'WRITE_FAILED');
            err.fatal = true; // asking again will not conjure it up
            throw err;
          }
          realClick(hit);
        },
        until: shows,
      });
      await sleep(150); // a selection usually triggers a server round trip
      return true;
    },

    /** Force a switch into a state. Checking the state keeps retries safe. */
    async setSwitch(sw, on, what = 'a toggle') {
      if (!sw) return;
      const is = () => sw.getAttribute('aria-checked') === 'true';
      if (is() === !!on) return;
      await act({
        what: 'setting ' + what,
        perform: () => realClick(sw),
        until: () => is() === !!on,
        timeoutMs: 8000,
      });
    },

    /** Type into a field and make sure the value stuck. */
    async setValue(field, value, what = 'a field') {
      const same = () => {
        const a = String(field.value).trim();
        const b = String(value).trim();
        return a === b || (a !== '' && parseFloat(a) === parseFloat(b));
      };
      if (same()) return;
      await act({
        what: 'setting ' + what,
        perform: () => {
          setFieldValue(field, value);
          field.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
        },
        until: same,
        timeoutMs: 8000,
      });
    },
  };

  /**
   * A month-grid calendar whose cells carry their own full date in `title` /
   * `aria-label` - no need to guess the displayed month or the locale's
   * first-day-of-week.
   */
  const KendoCalendar = {
    cells(cal) {
      return [...cal.querySelectorAll('td[role="gridcell"], td')].filter((td) => td.querySelector('.k-link'));
    },

    /** Parse "Thursday, November 26, 2026" into a local Date. */
    cellDate(td) {
      const label = td.getAttribute('title') || td.getAttribute('aria-label') || '';
      const m = label.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
      if (!m) return null;
      const mi = MONTH_NAMES.indexOf(m[1].toLowerCase());
      if (mi < 0) return null;
      return dateOf(Number(m[3]), mi + 1, Number(m[2]));
    },

    cellFor(cal, date) {
      return this.cells(cal).find((td) => {
        const d = this.cellDate(td);
        return d && sameDay(d, date) && !td.classList.contains('k-other-month');
      }) || null;
    },

    isSelected(cal, date) {
      const td = this.cellFor(cal, date);
      return !!td && (td.getAttribute('aria-selected') === 'true' || td.classList.contains('k-selected'));
    },

    selected(cal) {
      return this.cells(cal)
        .filter((td) => td.getAttribute('aria-selected') === 'true' || td.classList.contains('k-selected'))
        .map((td) => this.cellDate(td))
        .filter(Boolean);
    },

    /** Which month the grid is showing, from the cells it is not greying out. */
    shownMonth(cal) {
      const own = this.cells(cal)
        .filter((td) => !td.classList.contains('k-other-month'))
        .map((td) => this.cellDate(td))
        .filter(Boolean);
      return own.length ? { year: own[0].getFullYear(), month: own[0].getMonth() + 1 } : null;
    },

    /** Page the calendar to the month a date lives in, if it is not there. */
    async goToMonth(cal, date) {
      for (let guard = 0; guard < 24; guard++) {
        if (this.cellFor(cal, date)) return;
        const now = this.shownMonth(cal);
        if (!now) throw new TrackerError('could not read the dialog calendar', 'WRITE_FAILED');
        const behind = (now.year * 12 + now.month) < (date.getFullYear() * 12 + date.getMonth() + 1);
        const button = () => [...cal.parentElement.querySelectorAll('button, .k-link')].find((b) =>
          new RegExp(behind ? 'next period|next month' : 'previous period|previous month', 'i')
            .test(b.getAttribute('title') || b.getAttribute('aria-label') || ''));
        const btn = button();
        if (!btn || btn.disabled || btn.classList.contains('k-disabled')) {
          throw new TrackerError('the dialog calendar will not open ' + ymd(date), 'WRITE_FAILED');
        }
        await act({
          what: 'paging the calendar',
          perform: () => { const b = button(); if (b) realClick(b); },
          until: () => {
            const m = this.shownMonth(cal);
            return m && (m.year * 12 + m.month) !== (now.year * 12 + now.month);
          },
          timeoutMs: 10000,
        });
      }
      throw new TrackerError('gave up paging the dialog calendar to ' + ymd(date), 'WRITE_FAILED');
    },

    /**
     * Put one date into, or out of, the selection.
     *
     * Expressed as a state rather than the ctrl-click that gets there: a
     * retried toggle would undo itself, a retried "make sure it is selected"
     * will not.
     */
    async setSelected(cal, date, wanted) {
      if (this.isSelected(cal, date) === wanted) return;
      const td = this.cellFor(cal, date);
      if (!td) throw new TrackerError('date ' + ymd(date) + ' is not on the calendar', 'WRITE_FAILED');
      if (td.getAttribute('aria-disabled') === 'true' || td.classList.contains('k-disabled')) {
        throw new TrackerError('date ' + ymd(date) + ' is not selectable', 'WRITE_FAILED');
      }
      await act({
        what: (wanted ? 'ticking ' : 'unticking ') + shortDate(date),
        perform: () => {
          const cell = this.cellFor(cal, date);
          if (cell) realClick(cell.querySelector('.k-link') || cell, { ctrlKey: true });
        },
        until: () => this.isSelected(cal, date) === wanted,
        timeoutMs: 8000,
      });
    },

    /**
     * Leave exactly `dates` selected. Calendars tend to preselect today, so
     * anything unwanted has to be cleared rather than assumed absent.
     */
    async setSelection(cal, dates) {
      if (dates.length) await this.goToMonth(cal, dates[0]);
      const want = new Set(dates.map(ymd));
      for (const d of this.selected(cal)) {
        if (!want.has(ymd(d))) await this.setSelected(cal, d, false);
      }
      for (const d of dates) await this.setSelected(cal, d, true);

      const final = new Set(this.selected(cal).map(ymd));
      const missing = dates.filter((d) => !final.has(ymd(d)));
      const extra = [...final].filter((k) => !want.has(k));
      if (missing.length || extra.length) {
        throw new TrackerError(
          'could not set the date selection (missing ' + missing.map(ymd).join(', ') +
          '; extra ' + extra.join(', ') + ')', 'WRITE_FAILED');
      }
    },
  };

  // =====================================================================
  // Zoho People adapter - API driven
  // =====================================================================

  class ZohoPeopleTracker extends TimeTracker {
    static id = 'zoho-people';
    static label = 'Zoho People';
    // Zoho documents ~30 requests/minute on its timesheet API.
    static rateLimit = { delayMs: 2000, retries: 3, backoffMs: 5000, abortAfter: 3 };
    static capabilities = {
      readHistory: true,   // getMonthTimesheet serves any month
      batchWrite: false,   // one record per request
      mapOnImport: false,  // entries carry their own job ids
      weekendsOff: true,
    };

    static matches() {
      return /^people\.zoho\.[a-z.]+$/.test(location.hostname);
    }

    constructor() {
      super();
      this.formId = null;
    }

    get portal() { return location.pathname.split('/').filter(Boolean)[0]; }

    get csrf() {
      return (document.cookie.match(/(?:^|;\s*)CT_CSRF_TOKEN=([^;]+)/) || [])[1];
    }

    async ready() {
      const ok = await waitFor(() => window.erecno && window._LOGGEDIN_ZUID && this.csrf);
      if (!ok) throw new TrackerError('Zoho globals (erecno / _LOGGEDIN_ZUID) never appeared. Signed in?', 'NOT_READY');
      this.formId = await this.#resolveFormId();
    }

    async employee() {
      // whatever the page already shows for the signed-in user; never a
      // hardcoded name, and only used to label an export
      const el = document.querySelector('[class*="userName"], [id*="userName"], .zpeople-username');
      return textOf(el) || String(window.erecno || '') || null;
    }

    /** Per-org P_Timesheet form id, read the way Zoho's own bundle reads it. */
    async #resolveFormId() {
      const T = window.Timetracker;
      const direct = T && T.timelogs && T.timelogs.formDetails && T.timelogs.formDetails.formId;
      if (direct) return String(direct);

      const Z = window.ZPeople;
      const md = Z && Z.Module && Z.Module.MODULE_DATA && Z.Module.MODULE_DATA.timetracker;
      const viaModule = md && md.formDetails && md.formDetails.P_Timesheet && md.formDetails.P_Timesheet.formId;
      if (viaModule) return String(viaModule);

      if (T && T.util && typeof T.util.getFormDetailsAsPromise === 'function') {
        const fd = await T.util.getFormDetailsAsPromise(
          T.timelogs ? T.timelogs.formDetails : null, 'P_Timesheet');
        if (fd && fd.formId) return String(fd.formId);
      }
      throw new TrackerError('could not resolve zp_formId - open the Time Logs page first', 'NOT_READY');
    }

    #post(path, params) {
      return fetch('/' + this.portal + '/' + path, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: new URLSearchParams(params).toString(),
      });
    }

    static #fmtDate(d) {
      return String(d.getDate()).padStart(2, '0') + '-' + MON[d.getMonth()] + '-' + d.getFullYear();
    }

    async readMonth(year, month) {
      const res = await this.#post('timesheet.zp', {
        mode: 'getMonthTimesheet',
        userErecNo: window.erecno,
        year: year,
        month: month - 1, // Zoho's month is 0-indexed
        isFromNewUI: true,
        clientId: 0,
        projectId: 0,
        jobId: 0,
        typeMode: -1,
        approvalStatus: 0,
        isClientDetailsNeeded: true,
        conreqcsr: this.csrf,
      });
      if (!res.ok) throw new TrackerError('readMonth failed: HTTP ' + res.status, 'ERROR');
      const raw = (await res.json())[0] || {};

      const out = {};
      for (const [day, info] of Object.entries(raw)) {
        out[day] = {
          off: !!(info && info.leave),
          offReason: info && info.leave ? 'leave / holiday' : null,
          entries: (info.jobobj || []).map((j) => ({
            taskId: String(j.jobId),
            taskName: j.jobName,
            project: j.projectName,
            client: j.clientName,
            minutes: j.hours, // Zoho reports minutes here
            description: decodeEntities(j.description || '').trim(),
            entryId: j.timelogId ? String(j.timelogId) : null,
            extra: { projectId: j.projectId, billableStatus: j.billableStatus },
          })),
        };
      }
      return out;
    }

    async writeEntry({ date, template, description, entryId = null }) {
      if (!this.formId) throw new TrackerError('form id not resolved', 'NOT_READY');
      const params = {
        zp_mode: entryId ? 'updateRecord' : 'addRecord',
        zp_tableName: 'P_Timesheet',
        zp_formId: this.formId,
        Date: ZohoPeopleTracker.#fmtDate(date),
        JobId: template.taskId,
        Project: template.extra.projectId,
        User_Name: window.erecno,
        loginUserZUID: window._LOGGEDIN_ZUID,
        loggedHrs: fmtHM(template.minutes),
        Description: description + '\n',
        Billable_Status: template.extra.billableStatus,
        timelogtype: 0,
        isFromNewUI: true,
        isPicklistIdEnabled: true,
        conreqcsr: this.csrf,
      };
      if (entryId) params.zp_recordId = entryId;
      return (await this.#post('addUpdateRecord.zp', params)).status;
    }
  }

  // =====================================================================
  // JADE Time Entry adapter - UI driven
  //
  // The app is Blazor Server: the browser holds nothing but a SignalR
  // connection carrying opaque render batches, so there is no request to
  // replay and no id to read out of a payload. Everything below therefore
  // works the way a person does - open the entry dialog, choose from the
  // dropdowns the server offered, click the dates, submit - and reads its
  // facts (projects, holidays, the open period, who the logs are for) back
  // off the rendered page instead of carrying any of them as constants.
  // =====================================================================

  class JadeTracker extends TimeTracker {
    static id = 'jade-time-entry';
    static label = 'JADE Time Entry';
    // Every write is a dialog round trip rather than an API call, so it is
    // paced by the UI, not by a documented quota.
    // Every write is a dialog round trip, not an API call, against a server
    // that is slow and drops its connection often: pace gently, wait long,
    // and allow a full outage to pass without counting it as a failure.
    static rateLimit = {
      delayMs: 900, retries: 2, backoffMs: 4000, abortAfter: 3,
      uiTimeoutMs: 25000,
      // the session is kept on the server for a few minutes after a drop, so
      // waiting that long is what lets a run carry on where it left off
      reconnectBudgetMs: 180000,
      passes: 3,
    };
    static capabilities = {
      readHistory: false,  // the toolbar refuses to leave the open period
      batchWrite: true,    // one dialog can post the same entry on many dates
      mapOnImport: true,   // imported projects must be matched to local ones
      weekendsOff: true,
    };

    static matches() {
      // deliberately host-shaped rather than host-specific, so any tenant
      // works; ready() is what decides whether this really is the app
      return /^jade\.[^.]+\./i.test(location.hostname);
    }

    constructor() {
      super();
      this._period = null;
      this._targets = null;
    }

    // ------------------------------------------------------------------
    // page furniture
    // ------------------------------------------------------------------

    get view() { return document.querySelector('.jadeCalendarView'); }

    get toolbar() {
      const v = this.view;
      return v ? v.querySelector('.k-toolbar') : null;
    }

    #toolbarButton(titleRe) {
      const tb = this.toolbar;
      if (!tb) return null;
      return [...tb.querySelectorAll('button')]
        .find((b) => titleRe.test(b.getAttribute('title') || '') || titleRe.test(textOf(b))) || null;
    }

    #tabs() {
      const strip = document.querySelector('.k-tabstrip-items');
      if (!strip) return {};
      const items = [...strip.querySelectorAll('.k-tabstrip-item')];
      const byIcon = (name, fallbackIndex) =>
        items.find((li) => textOf(li).includes(name)) || items[fallbackIndex] || null;
      return { grid: byIcon('grid_view', 0), calendar: byIcon('calendar_month', 1), items };
    }

    async #showTab(which) {
      const tab = this.#tabs()[which];
      if (!tab || tab.classList.contains('k-active')) return;
      await act({
        what: 'switching to the ' + which + ' view',
        perform: () => realClick(tab.querySelector('.k-link') || tab),
        until: () => tab.classList.contains('k-active'),
        timeoutMs: this.budget.uiTimeoutMs,
        budgetMs: this.budget.reconnectBudgetMs,
      });
      await sleep(350); // the pane renders after the tab flips
    }

    async #restoreTab(index) {
      if (index == null || index < 0) return;
      const tabs = this.#tabs();
      const tab = (tabs.items || [])[index];
      if (!tab || tab.classList.contains('k-active')) return;
      realClick(tab.querySelector('.k-link') || tab);
      await waitFor(() => tab.classList.contains('k-active'), 8000, 120);
      await sleep(250); // best effort: putting the user's tab back is not worth a retry
    }

    async ready() {
      // only the tab strip is required here: which pane is showing is the
      // user's business until readMonth needs a particular one
      const ok = await waitFor(() => this.#tabs().calendar || this.#tabs().grid, 30000, 300);
      if (!ok) {
        throw new TrackerError(
          'the time entry page never finished loading - open Time Entry first', 'NOT_READY');
      }
      await this.#live('reading the page');
    }

    get budget() { return this.constructor.rateLimit; }

    /** Pause for an outage rather than giving up on one. */
    async #live(what) { await ensureLive(this.budget.reconnectBudgetMs, what); }

    async #waitFor(fn, timeoutMs, what) {
      return waitThrough(fn, timeoutMs || this.budget.uiTimeoutMs,
                         this.budget.reconnectBudgetMs, what);
    }

    async employee() {
      // the page's own employee picker; falls back to the greeting in the header
      const picker = document.querySelector('#employeeFilter') ||
                     firstVisible(document, '.j-gridFilterBox .k-dropdownlist');
      const fromPicker = textOf(picker && picker.querySelector('.k-input-value-text'));
      if (fromPicker && !/please select/i.test(fromPicker)) return fromPicker;
      const hello = (document.body.innerText.match(/Hello,\s*([^!\n]+)!/) || [])[1];
      return hello ? hello.trim() : null;
    }

    // ------------------------------------------------------------------
    // which months are in reach
    // ------------------------------------------------------------------

    /** The month the calendar pane is showing, when that pane is up. */
    #shownMonth() {
      const input = this.toolbar && this.toolbar.querySelector('input');
      const label = (input && input.value) ||
                    textOf(this.toolbar && this.toolbar.querySelector('.toolbar__currentPeriod'));
      const m = String(label).match(/([A-Za-z]+)\s*(\d{4})/);
      if (!m) return null;
      const name = m[1].toLowerCase();
      let idx = MON.findIndex((x) => x.toLowerCase() === name.slice(0, 3));
      if (idx < 0) idx = MONTH_NAMES.indexOf(name);
      return idx < 0 ? null : { year: Number(m[2]), month: idx + 1 };
    }

    static #monthIndex(y, m) { return y * 12 + (m - 1); }

    /**
     * The toolbar's back arrow is disabled outside the window the tenant lets
     * you write in, which is exactly the signal that earlier months are out
     * of reach. Reading it beats clicking it.
     */
    #assertReachable(year, month) {
      const now = this.#shownMonth();
      if (!now) return; // calendar pane is not up; the dialog will decide
      const want = JadeTracker.#monthIndex(year, month);
      const have = JadeTracker.#monthIndex(now.year, now.month);
      if (want === have) return;
      const btn = this.#toolbarButton(want < have ? /^previous$/i : /^next$/i);
      if (!btn || btn.disabled || btn.classList.contains('k-disabled')) {
        throw new TrackerError(
          MON[month - 1] + ' ' + year + ' cannot be opened here - this tracker only offers ' +
          MON[now.month - 1] + ' ' + now.year + ', so a template day has to come from an import instead.',
          'HISTORY_UNAVAILABLE', { shown: now });
      }
    }

    // ------------------------------------------------------------------
    // reading
    // ------------------------------------------------------------------

    /**
     * The open period and the month's non-working days, both read from the
     * entry dialog in a single visit.
     *
     * The dialog is the better source for holidays than the page behind it:
     * it marks them on the very calendar the dates get ticked on, so what is
     * read is exactly what can be clicked, and it needs no tab to be active.
     */
    async #calendarFacts(year, month) {
      const key = year + '-' + month;
      if (this._facts && this._facts.key === key) return this._facts;
      await this.#live('reading the page');

      const facts = await this.#withDialog(async () => {
        const dlg = this.#dialog();
        const cal = JadeTracker.#calendar(dlg);
        if (!cal) throw new TrackerError('the entry dialog has no date calendar', 'NOT_READY');
        await KendoCalendar.goToMonth(cal, dateOf(year, month, 1));

        const holidays = {};
        for (const td of KendoCalendar.cells(JadeTracker.#calendar(this.#dialog()))) {
          if (td.classList.contains('k-other-month')) continue;
          const special = td.querySelector('[class*="calendarSpecial"]');
          if (!special) continue;
          const d = KendoCalendar.cellDate(td);
          if (d) holidays[d.getDate()] = special.getAttribute('title') || textOf(special) || 'holiday';
        }

        const banner = [...this.#dialog().querySelectorAll('div, span, p')]
          .filter((e) => visible(e) && /time\s+writing\s+is\s+open/i.test(e.textContent))
          .sort((a, b) => a.textContent.length - b.textContent.length)[0];
        const text = banner ? textOf(banner.parentElement || banner) : '';

        return { holidays, text };
      });

      let period = null;
      if (/time\s+writing\s+is\s+open/i.test(facts.text)) {
        const hint = { year, month };
        const range = facts.text.match(/open\s+from\s+(\S+?)\s+to\s+(\S+?)(?:\s|$)/i);
        const by = facts.text.match(/entered\s+by[^0-9]*(\d[\d/.\-]+\d)/i);
        const from = range ? JadeTracker.#parseDate(range[1], hint) : null;
        const to = range ? JadeTracker.#parseDate(range[2], hint) : null;
        if (from && to) {
          period = {
            from, to,
            deadline: by ? JadeTracker.#parseDate(by[1], hint) : null,
            text: facts.text.replace(/\s+/g, ' ').trim(),
          };
        }
      }

      this._facts = { key, holidays: facts.holidays, period };
      this._period = period;
      return this._facts;
    }

    async period() {
      if (this._period) return this._period;
      const shown = this.#shownMonth() || { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
      const facts = await this.#calendarFacts(shown.year, shown.month);
      return facts.period;
    }

    /** Column name -> index, so no column order is ever assumed. */
    static #headerMap(grid) {
      const heads = [...grid.querySelectorAll('.k-grid-header th')];
      const map = {};
      heads.forEach((th, i) => {
        const key = textOf(th).toLowerCase();
        if (key) map[key] = i;
      });
      return map;
    }

    /** "11/3/2026", "3 Nov 2026", "Nov 3, 2026" - all of them, no locale guess. */
    static #parseDate(text, hint) {
      const s = String(text).trim();
      let m = s.match(/([A-Za-z]{3,})\s+(\d{1,2}),?\s+(\d{4})/);
      if (m) {
        const mi = MONTH_NAMES.findIndex((n) => n.startsWith(m[1].toLowerCase().slice(0, 3)));
        if (mi >= 0) return dateOf(Number(m[3]), mi + 1, Number(m[2]));
      }
      m = s.match(/(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})/);
      if (m) {
        const mi = MONTH_NAMES.findIndex((n) => n.startsWith(m[2].toLowerCase().slice(0, 3)));
        if (mi >= 0) return dateOf(Number(m[3]), mi + 1, Number(m[1]));
      }
      m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (m) return dateOf(Number(m[1]), Number(m[2]), Number(m[3]));
      m = s.match(/(\d{1,2})[/.](\d{1,2})[/.](\d{4})/);
      if (m) {
        const a = Number(m[1]), b = Number(m[2]), y = Number(m[3]);
        // month/day or day/month: let whichever is impossible decide, and
        // fall back to the month we already know we are looking at
        if (a > 12) return dateOf(y, b, a);
        if (b > 12) return dateOf(y, a, b);
        if (hint && hint.month) {
          if (a === hint.month) return dateOf(y, a, b);
          if (b === hint.month) return dateOf(y, b, a);
        }
        return dateOf(y, a, b); // month-first is this app's own format
      }
      return null;
    }

    /** Every row of the grid, following the pager to the end. */
    async #readGridRows() {
      const rows = [];
      const seenPages = new Set();
      for (let page = 0; page < 60; page++) {
        await this.#live('reading the page');
        const grid = firstVisible(document, '.k-grid');
        if (!grid) throw new TrackerError('the time entry grid is not on screen', 'NOT_READY');
        const map = JadeTracker.#headerMap(grid);
        const body = grid.querySelector('.k-grid-content tbody, tbody');
        const trs = body ? [...body.querySelectorAll('tr')] : [];
        for (const tr of trs) {
          if (tr.classList.contains('k-grid-norecords') || tr.querySelector('.k-grid-norecords')) continue;
          const tds = [...tr.children];
          const cell = (name) => {
            const i = map[name];
            return i == null || !tds[i] ? '' : textOf(tds[i]);
          };
          if (!cell('entry date')) continue;
          rows.push({
            status: cell('status'),
            date: cell('entry date'),
            project: cell('project'),
            task: cell('project task'),
            hours: cell('hours'),
            employee: cell('employee'),
            specialty: cell('specialty'),
            wbs: cell('wbs detail'),
          });
        }

        const pager = grid.querySelector('.k-pager');
        const state = textOf(pager);
        if (!pager || seenPages.has(state)) break;
        seenPages.add(state);
        const next = [...pager.querySelectorAll('button, .k-link')]
          .find((b) => /next page/i.test(b.getAttribute('title') || b.getAttribute('aria-label') || ''));
        const dead = !next || next.disabled || next.classList.contains('k-disabled');
        if (dead) break;
        realClick(next);
        await this.#waitFor(() => textOf(grid.querySelector('.k-pager')) !== state,
                            null, 'the next page of entries');
        await sleep(250);
      }
      return rows;
    }

    /**
     * A row's identity for "already logged" purposes. The app exposes no
     * record id in the grid, so the stable parts of the row stand in for one;
     * the project code it prints in brackets is used when there is one.
     */
    static taskKey({ project, task, specialty }) {
      const code = (String(project || '').match(/\((\d+)\)/) || [])[1];
      const proj = code || String(project || '').trim().toLowerCase();
      return [proj, String(task || '').trim().toLowerCase(), String(specialty || '').trim().toLowerCase()]
        .filter(Boolean).join('|');
    }

    async readMonth(year, month) {
      await this.#live('reading the page');
      this.#assertReachable(year, month); // throws HISTORY_UNAVAILABLE when out of reach

      const { holidays } = await this.#calendarFacts(year, month);

      // what is already logged has to come from the grid, and a guess of
      // "nothing" would mean writing the month twice - so this either works
      // or it says so
      const originalTab = (this.#tabs().items || [])
        .findIndex((li) => li.classList.contains('k-active'));
      let rows = [];
      try {
        await this.#showTab('grid');
        const up = await this.#waitFor(() => {
          const g = firstVisible(document, '.k-grid');
          return g && g.querySelector('.k-grid-header th');
        }, 15000, 200);
        if (!up) {
          throw new TrackerError(
            'could not open the grid view to check what is already logged, so this run was stopped ' +
            'rather than risk writing the month twice. Switch to Grid View yourself and try again.',
            'NOT_READY');
        }
        rows = await this.#readGridRows();
      } finally {
        await this.#restoreTab(originalTab);
      }

      const who = (await this.employee()) || '';
      const lastDay = new Date(year, month, 0).getDate();
      const out = {};
      for (let d = 1; d <= lastDay; d++) {
        const date = dateOf(year, month, d);
        const holiday = holidays[d];
        out[String(d)] = {
          off: !!holiday || isWeekend(date),
          offReason: holiday ? holiday : (isWeekend(date) ? 'weekend' : null),
          entries: [],
        };
      }

      for (const r of rows) {
        const date = JadeTracker.#parseDate(r.date, { year, month });
        if (!date || date.getFullYear() !== year || date.getMonth() + 1 !== month) continue;
        if (who && r.employee && r.employee.toLowerCase() !== who.toLowerCase()) continue;
        const day = out[String(date.getDate())];
        if (!day) continue;
        const hours = parseFloat(String(r.hours).replace(/[^\d.]/g, ''));
        day.entries.push({
          taskId: JadeTracker.taskKey(r),
          taskName: r.task || r.project,
          project: r.project,
          client: null,
          minutes: Number.isFinite(hours) ? Math.round(hours * 60) : 0,
          description: '', // the grid does not carry comments
          entryId: null,
          extra: { status: r.status, specialty: r.specialty, wbs: r.wbs },
        });
      }
      return out;
    }

    // ------------------------------------------------------------------
    // the entry dialog
    // ------------------------------------------------------------------

    #dialog() {
      const dialogs = allVisible(document, '.k-dialog, .k-window, [role="dialog"]');
      return dialogs.length ? dialogs[dialogs.length - 1] : null;
    }

    async #openDialog() {
      if (this.#dialog()) return this.#dialog();
      const find = () => this.#toolbarButton(/add time entr/i) ||
                   allVisible(document, 'button').find((b) => /add time entr/i.test(textOf(b)));
      if (!find()) throw new TrackerError('could not find the "Add Time Entry" button', 'NOT_READY');

      await act({
        what: 'opening the time entry dialog',
        perform: () => { const b = find(); if (b) realClick(b); },
        until: () => { const d = this.#dialog(); return !!(d && Kendo.pickerByLabel(d, 'Project')); },
        timeoutMs: this.budget.uiTimeoutMs,
        budgetMs: this.budget.reconnectBudgetMs,
      });
      await sleep(250);
      return this.#dialog();
    }

    async #closeDialog() {
      const d = this.#dialog();
      if (!d) return;
      const close = d.querySelector('.k-dialog-close, .k-window-action, button[title="Close"]') ||
                    [...d.querySelectorAll('button')].find((b) => /close|×/i.test(b.getAttribute('title') || textOf(b)));
      if (close) realClick(close);
      else d.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await waitFor(() => !this.#dialog(), 6000, 120);
      await sleep(150);
    }

    /** Open the dialog, do something in it, and always put it away again. */
    async #withDialog(fn) {
      const dlg = await this.#openDialog();
      try { return await fn(dlg); }
      finally { await this.#closeDialog(); }
    }

    /** The two toggles, told apart by the words printed beside them. */
    static #switches(dlg) {
      const found = { paid: null, dailyPercent: null };
      for (const sw of allVisible(dlg, '[role="switch"], .k-switch')) {
        const around = textOf(sw.closest('div') || sw);
        if (/daily\s*%/i.test(around)) found.dailyPercent = found.dailyPercent || sw;
        else if (/unpaid|paid/i.test(around)) found.paid = found.paid || sw;
      }
      return found;
    }

    static #commentBox(dlg) {
      return allVisible(dlg, 'textarea')[0] || null;
    }

    static #hoursBox(dlg) {
      return firstVisible(dlg, 'input[role="spinbutton"]') ||
             allVisible(dlg, '.k-numerictextbox input')[0] || null;
    }

    static #calendar(dlg) {
      return firstVisible(dlg, '.k-calendar');
    }

    // ------------------------------------------------------------------
    // what an imported entry can be written as
    // ------------------------------------------------------------------

    /**
     * What an imported job can be written as here.
     *
     * Shallow by default, and that is the point: choosing a project makes the
     * form fill in the only task and specialty that go with it, so the
     * project alone is enough to map onto and the whole list costs one round
     * trip. The full walk - every task and specialty of every project - is
     * many round trips, and is only worth it where a project really does
     * offer a choice, so it is asked for rather than assumed.
     */
    async targets(onProgress = () => {}, deep = false) {
      await this.#live('reading the page');
      const out = [];
      await this.#withDialog(async () => {
        await Kendo.setSwitch(JadeTracker.#switches(this.#dialog()).paid, true);
        await sleep(250);

        const projectPicker = Kendo.pickerByLabel(this.#dialog(), 'Project');
        if (!projectPicker) throw new TrackerError('the dialog has no Project field', 'NOT_READY');
        const projects = (await Kendo.options(projectPicker))
          .filter((p) => !/please select/i.test(p));
        if (!projects.length) throw new TrackerError('the Project list came back empty', 'NOT_READY');

        if (!deep) {
          for (const project of projects) {
            out.push({
              id: project, label: project, project,
              task: '', specialty: '', specialtyOptions: [], wbs: '', wbsOptions: [],
            });
          }
          return;
        }

        for (let pi = 0; pi < projects.length; pi++) {
          const project = projects[pi];
          onProgress('Reading ' + project + ' (' + (pi + 1) + '/' + projects.length + ')');
          await Kendo.select(Kendo.pickerByLabel(this.#dialog(), 'Project'), project);
          await sleep(300);

          const taskPicker = Kendo.pickerByLabel(this.#dialog(), 'Project Task');
          const tasks = (taskPicker ? await Kendo.options(taskPicker) : [])
            .filter((t) => !/please select/i.test(t));

          for (const task of (tasks.length ? tasks : [''])) {
            if (task && taskPicker) {
              await Kendo.select(Kendo.pickerByLabel(this.#dialog(), 'Project Task'), task);
              await sleep(250);
            }
            const dlg = this.#dialog();
            const specPicker = Kendo.pickerByLabel(dlg, 'Specialty');
            const wbsPicker = Kendo.pickerByLabel(dlg, 'WBS Detail');
            const current = textOf(specPicker);
            const specialties = (specPicker ? await Kendo.options(specPicker) : [])
              .filter((x) => !/please select/i.test(x));
            const wbs = (wbsPicker ? await Kendo.options(wbsPicker) : [])
              .filter((x) => !/please select/i.test(x));
            const specialty = (current && !/please select/i.test(current)) ? current : (specialties[0] || '');
            out.push({
              id: [project, task, specialty].filter(Boolean).join(' \u203a '),
              label: [project, task].filter(Boolean).join(' \u203a '),
              project, task, specialty,
              specialtyOptions: specialties,
              wbs: wbs[0] || '', wbsOptions: wbs,
            });
          }
        }
      });
      this._targets = out;
      return out;
    }

    // ------------------------------------------------------------------
    // writing
    // ------------------------------------------------------------------

    async writeEntry({ date, template, description }) {
      return this.writeBatch({ dates: [date], template, description });
    }

    /**
     * One dialog, one project/comment/duration, as many dates as the month
     * needs. Fields are filled in the order the form cascades and the dates
     * go in last, because each earlier choice re-renders what follows it.
     */
    async writeBatch({ dates, template, description }) {
      if (!dates || !dates.length) return 200;
      const t = (template && template.extra) || {};
      if (!t.project) {
        throw new TrackerError(
          'nothing to write as: "' + (template.project || template.taskName || '?') +
          '" has not been mapped to a project here', 'WRITE_FAILED');
      }

      await this.#live('reading the page');
      await this.#openDialog();
      try {
        const sw = JadeTracker.#switches(this.#dialog());
        await Kendo.setSwitch(sw.paid, t.unpaid !== true, 'paid/unpaid');
        await sleep(250);

        await Kendo.select(Kendo.pickerByLabel(this.#dialog(), 'Project'), t.project);
        // Choosing a project fills in whatever task and specialty belong to
        // it. Only override that where the mapping actually named something;
        // otherwise just make sure nothing was left unchosen.
        await this.#choose('Project Task', t.task);
        await this.#choose('Specialty', t.specialty);
        await this.#choose('WBS Detail', t.wbs); // only present for some projects

        const dlg = this.#dialog();
        const comment = JadeTracker.#commentBox(dlg);
        if (comment) await Kendo.setValue(comment, description || '', 'the comment');

        await Kendo.setSwitch(JadeTracker.#switches(this.#dialog()).dailyPercent, false,
                              'hours rather than a daily %');
        await sleep(150);

        const hours = fmtHours(template.minutes);
        const hoursBox = JadeTracker.#hoursBox(this.#dialog());
        if (!hoursBox) throw new TrackerError('the dialog has no hours field', 'WRITE_FAILED');
        await Kendo.setValue(hoursBox, hours, 'the hours');
        await sleep(250);

        const cal = JadeTracker.#calendar(this.#dialog());
        if (!cal) throw new TrackerError('the dialog has no date calendar', 'WRITE_FAILED');
        await KendoCalendar.setSelection(cal, dates);

        // the cascade may have re-rendered the number box; make sure the
        // figure that is about to be submitted is still the one we set
        const finalHours = JadeTracker.#hoursBox(this.#dialog());
        if (finalHours) await Kendo.setValue(finalHours, hours, 'the hours');

        return await this.#submit();
      } catch (e) {
        await this.#closeDialog();
        throw e;
      }
    }

    /**
     * Set a field to `want`, or - when nothing was asked for - leave the
     * form's own choice alone, stepping in only if it was left empty.
     * Returns what the field ended up showing, or null if it has no such field.
     */
    async #choose(label, want) {
      const picker = Kendo.pickerByLabel(this.#dialog(), label);
      if (!picker) return null;
      if (want) {
        await Kendo.select(picker, want);
        return want;
      }
      if (!/please select/i.test(textOf(picker))) return textOf(picker);
      const options = (await Kendo.options(Kendo.pickerByLabel(this.#dialog(), label)))
        .filter((o) => !/please select/i.test(o));
      if (!options.length) return null;
      await Kendo.select(Kendo.pickerByLabel(this.#dialog(), label), options[0]);
      return options[0];
    }

    /**
     * Click submit once, then find out what the server made of it.
     *
     * This is the one action that must never be replayed on a hunch: the
     * click may well have been processed even if the answer never arrived.
     * What makes it tractable is that the session lives on the server - so
     * once the connection is back, the dialog on screen is the server's own
     * account of itself. Still open means it did not save; gone means it
     * did. Only an outage that never ends leaves it genuinely unknown, and
     * that is reported as such rather than guessed at.
     */
    async #submit() {
      const btn = allVisible(this.#dialog(), 'button').find((b) => /^submit$/i.test(textOf(b))) ||
                  firstVisible(this.#dialog(), 'button[type="submit"]');
      if (!btn) throw new TrackerError('the dialog has no Submit button', 'WRITE_FAILED');

      const problem = () => {
        const d = this.#dialog();
        if (!d) return null;
        const err = allVisible(d, '.k-form-error, .validation-message, .field-validation-error, .invalid-feedback, .k-messagebox-error')
          .map(textOf).filter(Boolean);
        return err.length ? err.join('; ') : null;
      };

      realClick(btn);

      let settled;
      try {
        settled = await this.#waitFor(() => !this.#dialog() || problem(),
                                      this.budget.uiTimeoutMs, 'the entry to save');
      } catch (e) {
        const err = new TrackerError(
          'the connection went while this was being saved and did not come back, so there is no ' +
          'way to tell from here whether it was written. Nothing was retried, because a retry ' +
          'could double it.', 'UNCERTAIN');
        throw err;
      }

      const why = problem();
      if (why) {
        await this.#closeDialog();
        const err = new TrackerError('rejected: ' + why, 'WRITE_FAILED');
        err.fatal = true; // the form said no; asking again the same way will not help
        throw err;
      }
      if (!settled || this.#dialog()) {
        // connected, and the dialog is still sitting there: the server never
        // took it, so this is safe for the caller to try again
        await this.#closeDialog();
        throw new TrackerError('the dialog never closed after Submit - nothing was saved', 'WRITE_FAILED');
      }

      const toast = allVisible(document, '.k-notification-error, .k-notification.k-error')
        .map(textOf).filter(Boolean);
      if (toast.length) throw new TrackerError('rejected: ' + toast.join('; '), 'WRITE_FAILED');
      await sleep(400); // let the grid behind the dialog catch up
      return 200;
    }
  }

  // ---------------------------------------------------------------------
  // Register trackers here. First match wins.
  // ---------------------------------------------------------------------
  const TRACKERS = [
    ZohoPeopleTracker,
    JadeTracker,
  ];

  // =====================================================================
  // Portable logbook - the file that moves a month between trackers
  // =====================================================================

  const LOGBOOK_FORMAT = 'timelog-bulk-filler/logbook';
  const LOGBOOK_VERSION = 1;

  /** How one tracker's job is recognised again in another one. */
  const identityKey = (e) =>
    [e.client || '', e.project || '', e.taskName || ''].map((s) => String(s).trim()).join(' | ');

  const identityLabel = (e) =>
    [e.client, e.project, e.taskName].filter(Boolean).join(' › ') || '(unnamed)';

  /** A month, as read from a tracker, in a shape any other tracker can read. */
  function toLogbook(tracker, employee, year, month, monthData) {
    const entries = [];
    for (const [day, info] of Object.entries(monthData)) {
      for (const e of info.entries || []) {
        entries.push({
          date: ymd(dateOf(year, month, Number(day))),
          minutes: e.minutes,
          description: e.description || '',
          identity: {
            key: identityKey(e),
            client: e.client || null,
            project: e.project || null,
            task: e.taskName || null,
          },
        });
      }
    }
    entries.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return {
      format: LOGBOOK_FORMAT,
      version: LOGBOOK_VERSION,
      exported: new Date().toISOString(),
      source: {
        tracker: tracker.constructor.id,
        label: tracker.constructor.label,
        host: location.hostname,
        employee: employee || null,
      },
      period: { year, month },
      entries,
    };
  }

  function parseLogbook(text) {
    let data;
    try { data = JSON.parse(text); }
    catch (e) { throw new TrackerError('that file is not JSON: ' + e.message); }
    if (!data || data.format !== LOGBOOK_FORMAT) {
      throw new TrackerError('that file was not exported by this script');
    }
    if (!Array.isArray(data.entries) || !data.entries.length) {
      throw new TrackerError('that export has no entries in it');
    }
    for (const e of data.entries) {
      if (!e.date || !parseYmd(e.date) || !Number.isFinite(e.minutes)) {
        throw new TrackerError('that export has a malformed entry: ' + JSON.stringify(e).slice(0, 120));
      }
      e.identity = e.identity || { key: identityKey(e) };
      e.identity.key = e.identity.key || identityKey({
        client: e.identity.client, project: e.identity.project, taskName: e.identity.task,
      });
    }
    return data;
  }

  /** The distinct jobs in an import, with how much of the month each covers. */
  function logbookIdentities(book) {
    const by = new Map();
    for (const e of book.entries) {
      const key = e.identity.key;
      if (!by.has(key)) {
        by.set(key, {
          key,
          label: [e.identity.client, e.identity.project, e.identity.task].filter(Boolean).join(' › ') || key,
          days: new Set(),
          minutes: new Set(),
          descriptions: [],
        });
      }
      const row = by.get(key);
      row.days.add(e.date);
      row.minutes.add(e.minutes);
      if (e.description) row.descriptions.push(e.description);
    }
    return [...by.values()].sort((a, b) => b.days.size - a.days.size);
  }

  // =====================================================================
  // Mapping memory - which job over there is which job over here
  // =====================================================================

  const Mappings = {
    key(sourceTracker, targetTracker) {
      return 'map/' + sourceTracker + '->' + targetTracker + '@' + location.hostname;
    },
    load(sourceTracker, targetTracker) {
      return store.get(this.key(sourceTracker, targetTracker), { tasks: {}, employees: {} });
    },
    save(sourceTracker, targetTracker, mapping) {
      return store.set(this.key(sourceTracker, targetTracker), mapping);
    },
    forget(sourceTracker, targetTracker) {
      try { localStorage.removeItem(store.key(this.key(sourceTracker, targetTracker))); } catch (e) {}
    },
  };

  /** Probed dropdown contents, cached so the dialog is not re-walked each time. */
  const TargetCache = {
    key: () => 'targets/' + location.hostname,
    load() {
      const c = store.get(this.key(), null);
      if (!c || !Array.isArray(c.targets) || !c.targets.length) return null;
      // a month old is plenty: project lists change, but not every session
      if (Date.now() - (c.at || 0) > 30 * 24 * 3600 * 1000) return null;
      return c.targets;
    },
    save(targets) { store.set(this.key(), { at: Date.now(), targets }); },
    clear() { try { localStorage.removeItem(store.key(this.key())); } catch (e) {} },
  };

  // =====================================================================
  // Engine - tracker-agnostic
  // =====================================================================

  /** Week 1 starts on the month's first Monday; earlier days are week 0. */
  function weekOfMonth(d) {
    const first = new Date(d.getFullYear(), d.getMonth(), 1);
    const firstMonday = 1 + ((8 - first.getDay()) % 7);
    return d.getDate() < firstMonday ? 0 : Math.floor((d.getDate() - firstMonday) / 7) + 1;
  }

  /** Weeks present in a month, weekdays only: [{ week, label }]. */
  function weeksIn(year, month) {
    const lastDay = new Date(year, month, 0).getDate();
    const byWeek = new Map();
    for (let d = 1; d <= lastDay; d++) {
      const date = new Date(year, month - 1, d);
      if (date.getDay() === 0 || date.getDay() === 6) continue;
      const wk = weekOfMonth(date);
      if (!byWeek.has(wk)) byWeek.set(wk, []);
      byWeek.get(wk).push(d);
    }
    return [...byWeek.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([week, days]) => ({
        week,
        label: 'Week ' + week + ' - ' + MON[month - 1] + ' ' + days[0] +
               (days.length > 1 ? '-' + days[days.length - 1] : ''),
      }));
  }

  /** Days of a month that have entries, ascending: [[day, DayInfo], ...] */
  const daysWithEntries = (monthData) =>
    Object.entries(monthData)
      .filter(([, v]) => v.entries && v.entries.length)
      .sort((a, b) => Number(a[0]) - Number(b[0]));

  const entryLabel = (e) => e.project || e.taskName;

  /**
   * Fill in what an adapter did not say. Trackers that do not report
   * weekends still must not be written to on one, so the engine marks them
   * unless the adapter opts out.
   */
  function normaliseMonth(year, month, monthData, capabilities) {
    const lastDay = new Date(year, month, 0).getDate();
    const out = {};
    for (let d = 1; d <= lastDay; d++) {
      const key = String(d);
      const info = monthData[key] || { off: false, offReason: null, entries: [] };
      const date = dateOf(year, month, d);
      const weekend = capabilities.weekendsOff !== false && isWeekend(date);
      out[key] = {
        off: !!info.off || weekend,
        offReason: info.offReason || (weekend ? 'weekend' : null),
        entries: info.entries || [],
      };
    }
    return out;
  }

  /** Is this day one we are allowed to write on at all? */
  function writable(year, month, day, monthData, period) {
    const info = monthData[String(day)];
    if (!info || info.off) return false;
    if (period) {
      const date = dateOf(year, month, day);
      if (date < period.from || date > period.to) return false;
    }
    return true;
  }

  /**
   * The working day an entry lands on when its own day cannot take it:
   * the nearest one before it, and only if there is none, the nearest after.
   * That keeps a month's hours intact when two trackers disagree about which
   * days are holidays.
   */
  function nearestWritable(year, month, day, monthData, period) {
    const lastDay = new Date(year, month, 0).getDate();
    for (let d = day - 1; d >= 1; d--) {
      if (writable(year, month, d, monthData, period)) return { day: d, direction: 'before' };
    }
    for (let d = day + 1; d <= lastDay; d++) {
      if (writable(year, month, d, monthData, period)) return { day: d, direction: 'after' };
    }
    return null;
  }

  /**
   * Template mode: one item per task per working day, with that week's text.
   * @param descriptions {Object<week, Object<taskId, string>>}
   * @param monthData    normalised target month, so days off are left alone
   */
  function itemsFromTemplate(year, month, template, descriptions, monthData) {
    const lastDay = new Date(year, month, 0).getDate();
    const items = [];
    const skipped = [];
    for (let d = 1; d <= lastDay; d++) {
      const info = monthData[String(d)] || {};
      if (info.off) {
        // a template repeats across working days; it never invents work on a
        // day off, so these are dropped here rather than moved later
        skipped.push({ day: d, why: info.offReason || 'weekend / holiday / leave' });
        continue;
      }
      const date = dateOf(year, month, d);
      const wk = weekOfMonth(date);
      const weekDescs = descriptions[wk] || {};
      for (const t of template) {
        const description = weekDescs[String(t.taskId)];
        if (!description) {
          skipped.push({ day: d, why: 'no description for week ' + wk + ' / ' + entryLabel(t) });
          continue;
        }
        items.push({ day: d, date, week: wk, description, template: t, minutes: t.minutes });
      }
    }
    return { items, skipped };
  }

  /**
   * Import mode: one item per entry in the file, carrying the target it was
   * mapped onto. Entries for an unmapped job are reported, never guessed at.
   */
  function itemsFromLogbook(year, month, book, mapping, weekOverrides) {
    const items = [];
    const skipped = [];
    for (const e of book.entries) {
      const date = parseYmd(e.date);
      const target = (mapping.tasks || {})[e.identity.key];
      const label = [e.identity.client, e.identity.project, e.identity.task]
        .filter(Boolean).join(' \u203a ') || e.identity.key;
      if (!target || !target.template) {
        skipped.push({ day: date.getDate(), why: 'not mapped: ' + label });
        continue;
      }
      if (date.getFullYear() !== year || date.getMonth() + 1 !== month) {
        skipped.push({ day: date.getDate(), why: 'outside ' + MON[month - 1] + ' ' + year + ': ' + e.date });
        continue;
      }
      const wk = weekOfMonth(date);
      const override = (weekOverrides[wk] || {})[e.identity.key];
      items.push({
        day: date.getDate(),
        date,
        week: wk,
        description: override || e.description || '',
        minutes: e.minutes,
        template: { ...target.template, minutes: e.minutes },
      });
    }
    return { items, skipped };
  }

  /**
   * Common tail for both modes: move what cannot stay where it is, drop what
   * is already logged, and refuse anything the tracker's own window forbids.
   *
   * Deduplication counts rather than tests: a day that legitimately holds two
   * entries for one task - because a holiday's hours were moved onto it -
   * must still be seen as complete when the run is repeated.
   */
  function finalisePlan(year, month, items, monthData, period, opts) {
    const shiftOffDays = opts.shiftOffDays !== false;
    const plan = [];
    const skipped = [];
    const shifted = [];
    const blocked = [];

    for (const item of items.slice().sort((a, b) => a.day - b.day)) {
      let day = item.day;
      if (!writable(year, month, day, monthData, period)) {
        const info = monthData[String(day)] || {};
        const date = dateOf(year, month, day);
        const outside = period && (date < period.from || date > period.to);
        const why = outside ? 'outside the open period' : (info.offReason || 'not a working day');

        if (outside && !shiftOffDays) {
          blocked.push({ day, why, label: entryLabel(item.template) });
          continue;
        }
        if (!shiftOffDays) {
          skipped.push({ day, why: why + ': ' + entryLabel(item.template) });
          continue;
        }
        const moved = nearestWritable(year, month, day, monthData, period);
        if (!moved) {
          blocked.push({ day, why: why + ', and no working day is free to take it', label: entryLabel(item.template) });
          continue;
        }
        shifted.push({ from: day, to: moved.day, why, direction: moved.direction, label: entryLabel(item.template) });
        day = moved.day;
      }
      plan.push({ ...item, day, date: dateOf(year, month, day), week: weekOfMonth(dateOf(year, month, day)), shiftedFrom: day === item.day ? null : item.day });
    }

    // already-logged pass, by count per task per day
    const have = new Map();
    for (const [day, info] of Object.entries(monthData)) {
      for (const e of info.entries || []) {
        const k = day + '#' + String(e.taskId);
        have.set(k, (have.get(k) || 0) + 1);
      }
    }
    const kept = [];
    for (const p of plan) {
      const k = String(p.day) + '#' + String(p.template.taskId);
      const left = have.get(k) || 0;
      if (left > 0) {
        have.set(k, left - 1);
        skipped.push({ day: p.day, why: 'already logged: ' + entryLabel(p.template) });
        continue;
      }
      kept.push(p);
    }
    return { plan: kept, skipped, shifted, blocked };
  }

  /**
   * Collapse a plan into the fewest round trips a tracker will accept: one
   * per distinct job + text + duration, carrying all of its dates.
   */
  function groupForBatch(plan) {
    const bySignature = new Map();
    for (const p of plan) {
      const sig = [p.template.taskId, p.minutes, p.description].join('\u0000');
      if (!bySignature.has(sig)) bySignature.set(sig, []);
      const siblings = bySignature.get(sig);
      // a date can only be ticked once per submission, so a second entry for
      // the same day - a holiday's hours moved onto it - needs its own
      let group = siblings.find((g) => !g.seen.has(ymd(p.date)));
      if (!group) {
        group = { template: p.template, description: p.description, minutes: p.minutes,
                  dates: [], days: [], seen: new Set() };
        siblings.push(group);
      }
      group.dates.push(p.date);
      group.days.push(p.day);
      group.seen.add(ymd(p.date));
    }
    return [...bySignature.values()].flat();
  }

  /** Hard stops the user must see before anything is written. */
  function periodProblems(year, month, period, plan, blocked) {
    const problems = [];
    if (period) {
      const first = dateOf(year, month, 1);
      const last = dateOf(year, month, new Date(year, month, 0).getDate());
      if (last < period.from || first > period.to) {
        problems.push(MON[month - 1] + ' ' + year + ' is outside the open period (' +
                      shortDate(period.from) + ' to ' + shortDate(period.to) + ').');
      }
      if (period.deadline) {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        if (today > period.deadline) {
          problems.push('The cut-off for entering time was ' + shortDate(period.deadline) +
                        ', which has passed.');
        }
      }
    }
    if (blocked.length) {
      const byWhy = blocked.reduce((a, b) => ((a[b.why] = (a[b.why] || 0) + 1), a), {});
      problems.push(blocked.length + ' entries cannot be placed: ' +
                    Object.entries(byWhy).map(([w, n]) => n + ' x ' + w).join('; ') + '.');
    }
    return problems;
  }

  // =====================================================================
  // Panel UI
  // =====================================================================

  class PanelUI {
    constructor(tracker) {
      this.tracker = tracker;
      this.caps = tracker.constructor.capabilities;
      this.sourceMonth = {};   // cached DayInfo map for the source month
      this.book = null;        // imported logbook, when working from a file
      this.mapping = { tasks: {}, employees: {} };
      this.targets = [];       // what an imported job can be written as here
      this.lastPlan = null;
      this.lastUnits = null;
      this.#mount();
    }

    #mount() {
      const host = document.createElement('div');
      host.setAttribute('data-timelog-filler-host', '1');
      host.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:2147483647;';
      const root = host.attachShadow({ mode: 'open' });
      root.innerHTML = `
        <style>
          :host { all: initial; }
          * { box-sizing: border-box; font-family: system-ui, -apple-system, Segoe UI, sans-serif; }
          .fab { background:#2d5be3; color:#fff; border:0; border-radius:999px; padding:10px 16px;
                 font-size:13px; font-weight:600; cursor:pointer; box-shadow:0 2px 10px rgba(0,0,0,.25); }
          /* Frame stays put; .body is the single scroll container. */
          .panel { display:none; position:relative; width:820px; height:620px;
                   max-width:calc(100vw - 36px); max-height:calc(100vh - 36px); overflow:hidden;
                   background:#fff; border:1px solid #d6d9e0; border-radius:10px;
                   box-shadow:0 8px 30px rgba(0,0,0,.18); font-size:13px; color:#1b1f27; }
          .panel.open { display:block; }
          .body { height:100%; overflow:auto; padding:22px 14px 14px; }
          h3 { margin:0 0 2px; font-size:14px; }
          .sub { color:#6b7280; font-size:11px; margin:0 0 10px; }
          .note { color:#6b7280; font-size:11px; margin:4px 0 0; }
          .note.warn { color:#b45309; }
          label { display:block; font-size:11px; text-transform:uppercase; letter-spacing:.04em;
                  color:#6b7280; margin:10px 0 3px; }
          input, textarea, select { width:100%; padding:6px 8px; border:1px solid #cfd4dc;
                  border-radius:6px; font-size:13px; background:#fff; }
          textarea { resize:vertical; min-height:30px; overflow:hidden; }
          .row { display:flex; gap:8px; } .row > * { flex:1; }
          .actions { display:flex; gap:8px; margin-top:12px; }
          button.go { flex:1; padding:8px; border:0; border-radius:6px; cursor:pointer; font-weight:600; }
          .dry { background:#eef1f6; color:#1b1f27; }
          .write { background:#c2410c; color:#fff; }
          .write:disabled, .dry:disabled { background:#e5e7eb; color:#9ca3af; cursor:not-allowed; }
          pre { background:#0f172a; color:#cbd5e1; padding:9px; border-radius:6px; font-size:11px;
                line-height:1.45; overflow:visible; white-space:pre; margin:10px 0 0;
                font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
          pre.small { font-size:10px; max-height:120px; overflow:auto; }
          .wk { border-top:1px solid #eceff3; padding-top:4px; margin-top:8px; }
          .taskrow { display:flex; align-items:center; gap:8px; margin:3px 0; }
          .taskrow .name { flex:0 0 190px; font-size:11px; color:#374151; font-weight:600;
                           overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
          .taskrow textarea { flex:1; }
          .opts { margin-top:10px; border-top:1px solid #eceff3; padding-top:8px; }
          .status { min-height:15px; margin-top:8px; font-size:11.5px; color:#b45309; font-weight:600; }
          .chk { display:flex; align-items:center; gap:6px; text-transform:none; letter-spacing:0;
                 font-size:11.5px; color:#374151; margin:4px 0; }
          .chk input { width:auto; }
          .grip { position:absolute; left:3px; top:3px; z-index:6; width:14px; height:14px;
                  cursor:nwse-resize; border-top:2px solid #9aa3b2; border-left:2px solid #9aa3b2;
                  border-top-left-radius:8px; opacity:.6; }
          .grip:hover { opacity:1; }
          .close { position:absolute; right:6px; top:2px; z-index:6; border:0; background:none;
                   cursor:pointer; font-size:18px; line-height:1; color:#6b7280; }
          .overlay { display:none; position:absolute; inset:0; z-index:8; background:rgba(15,23,42,.45);
                     padding:18px; }
          .overlay.open { display:block; }
          .sheet { background:#fff; border-radius:8px; height:100%; overflow:auto; padding:14px; }
          .maprow { border-top:1px solid #eceff3; padding:7px 0; }
          .maprow .src { font-size:12px; font-weight:600; color:#1b1f27; }
          .maprow .meta { font-size:10.5px; color:#6b7280; margin:1px 0 4px; }
          .maprow .fields { display:flex; gap:6px; flex-wrap:wrap; }
          .maprow .fields > * { flex:1 1 150px; }
          .unmapped { color:#b45309; }
        </style>
        <button class="fab">Bulk log</button>
        <div class="panel">
          <div class="grip" title="Drag to resize"></div>
          <button class="close">&times;</button>
          <div class="body">
            <h3>Bulk month time logs</h3>
            <p class="sub" id="who">${esc(this.tracker.constructor.label)}</p>
            <div class="row">
              <div><label>Target month</label><input id="tgt" type="month"></div>
              <div><label>Take the pattern from</label>
                <select id="mode">
                  <option value="template">A template day in this tracker</option>
                  <option value="import">An exported file</option>
                </select></div>
            </div>
            <div id="templateBox">
              <label>Copy pattern from</label><input id="src" type="month">
              <label>Template day - this day's tasks &amp; hours repeat all month</label>
              <select id="tplday"></select>
              <p class="note" id="templateHint" hidden>This tracker publishes no job list of its own,
                so the tasks on this day are what imported jobs can be matched against.</p>
            </div>
            <div id="importBox" hidden>
              <label>Exported logs</label>
              <div class="row">
                <button class="go dry" id="import">Choose file...</button>
                <button class="go dry" id="mapbtn" disabled>Map jobs...</button>
              </div>
              <p class="note" id="importNote">No file loaded yet.</p>
            </div>
            <label>Editing descriptions for</label>
            <select id="tasksel"></select>
            <div id="weeks"></div>
            <div class="opts">
              <label class="chk"><input type="checkbox" id="shift" checked>
                Move entries off holidays and weekends onto the nearest working day before</label>
              <label class="chk"><input type="checkbox" id="ignoreWindow">
                Ignore this tracker's time-writing window</label>
            </div>
            <div class="actions">
              <button class="go dry" id="dry">Dry run</button>
              <button class="go write" id="write" disabled>Write</button>
              <button class="go dry" id="export">Export month</button>
            </div>
            <div class="status" id="status"></div>
            <pre id="out">Loading...</pre>
          </div>
          <div class="overlay" id="mapOverlay">
            <div class="sheet">
              <h3>Match the imported jobs to this tracker</h3>
              <p class="sub" id="mapSub"></p>
              <p class="note" id="mapNote" hidden>Tasks and specialties were read in full, so a
                mapping saved from the shorter list may need picking again.</p>
              <div id="mapRows"></div>
              <pre id="mapOut" class="small"></pre>
              <div class="actions">
                <button class="go dry" id="mapProbe">Read every task &amp; specialty (slower)</button>
                <button class="go dry" id="mapCancel">Cancel</button>
                <button class="go write" id="mapSave">Save</button>
              </div>
            </div>
          </div>
        </div>`;
      document.body.appendChild(host);

      this.root = root;
      this.$ = (s) => root.querySelector(s);
      this.panel = this.$('.panel');
      this.fab = this.$('.fab');

      // the widget layer narrates outages here rather than clobbering the log
      Status.report = (msg) => {
        const el = root.querySelector('#status');
        if (el) el.textContent = msg || '';
      };

      this.fab.onclick = () => this.#setOpen(true);
      this.$('.close').onclick = () => this.#setOpen(false);
      this.$('#tasksel').onchange = () => this.#applyTaskFilter();
      this.$('#tgt').onchange = () => this.#renderWeeks();
      this.$('#tplday').onchange = () => this.#renderWeeks();
      this.$('#src').onchange = () => this.#loadSourceMonth().then(() => this.#renderWeeks());
      this.$('#mode').onchange = () => this.#setMode(this.$('#mode').value);
      this.$('#import').onclick = () => this.#onImport();
      this.$('#mapbtn').onclick = () => this.#openMapping(false);
      this.$('#mapProbe').onclick = () => this.#openMapping(true);
      this.$('#mapCancel').onclick = () => this.$('#mapOverlay').classList.remove('open');
      this.$('#mapSave').onclick = () => this.#saveMapping();
      this.$('#dry').onclick = () => this.#dryRun();
      this.$('#write').onclick = () => this.#write();
      this.$('#export').onclick = () => this.#export();

      const now = new Date();
      const ym = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      this.$('#tgt').value = ym(now);
      this.$('#src').value = ym(new Date(now.getFullYear(), now.getMonth() - 1, 1));

      this.#initResize();
    }

    log(s) { this.$('#out').textContent = s; }
    mapLog(s) { this.$('#mapOut').textContent = s; }

    #setOpen(open) {
      this.panel.classList.toggle('open', open);
      this.fab.style.display = open ? 'none' : '';
      // Textareas cannot be measured while hidden, so fit them once visible.
      if (open) this.root.querySelectorAll('[data-wk]').forEach((el) => PanelUI.#autosize(el));
    }

    // Panel is anchored bottom-right, so it grows up and to the left.
    #initResize() {
      const grip = this.$('.grip');
      const panel = this.panel;
      let dragging = false, sx = 0, sy = 0, sw = 0, sh = 0;
      grip.addEventListener('mousedown', (e) => {
        const r = panel.getBoundingClientRect();
        dragging = true; sx = e.clientX; sy = e.clientY; sw = r.width; sh = r.height;
        e.preventDefault();
      });
      window.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        panel.style.width = Math.min(Math.max(420, sw - (e.clientX - sx)), window.innerWidth - 36) + 'px';
        panel.style.height = Math.min(Math.max(260, sh - (e.clientY - sy)), window.innerHeight - 36) + 'px';
      });
      window.addEventListener('mouseup', () => { dragging = false; });
    }

    static #autosize(el) {
      if (!el.offsetParent) return;
      el.style.height = 'auto';
      el.style.height = Math.max(30, el.scrollHeight + 2) + 'px';
    }

    parseYM(v) { return { year: Number(v.split('-')[0]), month: Number(v.split('-')[1]) }; }

    get mode() { return this.$('#mode').value; }

    #setMode(mode) {
      this.$('#mode').value = mode;
      // in import mode the template day is still needed when this tracker
      // cannot list its own jobs - that day is where the options come from
      const needsTemplateForOptions = mode === 'import' && !this.caps.mapOnImport &&
                                      this.caps.readHistory !== false;
      this.$('#templateBox').hidden = mode !== 'template' && !needsTemplateForOptions;
      this.$('#importBox').hidden = mode !== 'import';
      this.$('#templateHint').hidden = !needsTemplateForOptions;
      this.#renderWeeks();
    }

    /**
     * Read the source month once; the dropdown and seeds both come from it.
     * This runs in import mode too on trackers that publish no option lists
     * of their own, because then the template day is the only vocabulary
     * an imported job can be matched against.
     */
    async #loadSourceMonth() {
      if (this.caps.readHistory === false) return;
      const s = this.parseYM(this.$('#src').value);
      const sel = this.$('#tplday');
      sel.innerHTML = '<option value="">loading...</option>';
      try {
        this.sourceMonth = await this.tracker.readMonth(s.year, s.month);
        const days = daysWithEntries(this.sourceMonth);
        if (!days.length) {
          sel.innerHTML = '<option value="">no logs in ' + MON[s.month - 1] + ' ' + s.year + '</option>';
          return;
        }
        sel.innerHTML = days.map(([d, info]) => {
          const parts = info.entries.map((e) => fmtHM(e.minutes) + ' ' + entryLabel(e)).join(' + ');
          const total = fmtHM(info.entries.reduce((a, e) => a + e.minutes, 0));
          return '<option value="' + d + '">' + MON[s.month - 1] + ' ' + d + '  -  ' +
                 esc(parts) + '  (' + total + ')</option>';
        }).join('');
        sel.value = days[days.length - 1][0]; // default: last day with entries
      } catch (e) {
        this.sourceMonth = {};
        console.error('[timelog-filler] loadSourceMonth', e);
        sel.innerHTML = '<option value="">' + esc(e.message) + '</option>';
      }
    }

    /** The selected template day's entries, from the cached source month. */
    get template() {
      const hit = daysWithEntries(this.sourceMonth)
        .find(([d]) => String(d) === String(this.$('#tplday').value));
      return hit ? hit[1].entries : [];
    }

    /**
     * The rows the description editors are keyed by: one per task in template
     * mode, one per imported job in import mode.
     */
    #descRows() {
      if (this.mode === 'template') {
        return this.template.map((e) => ({
          key: String(e.taskId),
          label: entryLabel(e),
          hint: fmtHM(e.minutes),
          seedAll: e.description,
        }));
      }
      if (!this.book) return [];
      return logbookIdentities(this.book).map((id) => ({
        key: id.key,
        label: id.label,
        hint: [...id.minutes].map(fmtHM).join('/') + ' x' + id.days.size + 'd',
        seedAll: null,
      }));
    }

    /** In import mode each week starts from whatever that week already says. */
    #importSeed(week, key) {
      if (!this.book) return '';
      const counts = new Map();
      for (const e of this.book.entries) {
        if (e.identity.key !== key) continue;
        if (weekOfMonth(parseYmd(e.date)) !== week) continue;
        const d = e.description || '';
        counts.set(d, (counts.get(d) || 0) + 1);
      }
      let best = '', n = -1;
      for (const [d, c] of counts) if (c > n) { best = d; n = c; }
      return best;
    }

    #renderWeeks() {
      const t = this.parseYM(this.$('#tgt').value);
      const rows = this.#descRows();
      const taskSel = this.$('#tasksel');
      if (!rows.length) { this.$('#weeks').innerHTML = ''; taskSel.innerHTML = ''; return; }

      const previous = taskSel.value;
      taskSel.innerHTML = rows.map((r) =>
        `<option value="${esc(r.key)}">${esc(r.label)} &middot; ${esc(r.hint)}</option>`
      ).join('') + '<option value="*">All</option>';
      taskSel.value = [...taskSel.options].some((o) => o.value === previous) ? previous : rows[0].key;

      this.$('#weeks').innerHTML = weeksIn(t.year, t.month).map((w) =>
        `<div class="wk"><label>${esc(w.label)}</label>` +
        rows.map((r) =>
          `<div class="taskrow" data-task="${esc(r.key)}">` +
          `<span class="name" title="${esc(r.label)}">${esc(r.label)} &middot; ${esc(r.hint)}</span>` +
          `<textarea data-wk="${w.week}" data-task="${esc(r.key)}" rows="1"></textarea>` +
          `</div>`
        ).join('') +
        `</div>`
      ).join('');

      this.root.querySelectorAll('[data-wk]').forEach((el) => {
        const seed = this.mode === 'template'
          ? (rows.find((r) => r.key === el.dataset.task) || {}).seedAll || ''
          : this.#importSeed(Number(el.dataset.wk), el.dataset.task);
        el.value = seed;
        el.dataset.seed = seed;
        el.addEventListener('input', () => PanelUI.#autosize(el));
        el.addEventListener('paste', () => setTimeout(() => PanelUI.#autosize(el), 0));
      });
      this.#applyTaskFilter();
    }

    #applyTaskFilter() {
      const want = this.$('#tasksel').value;
      this.root.querySelectorAll('.taskrow').forEach((row) => {
        row.style.display = want === '*' || row.dataset.task === want ? '' : 'none';
      });
      this.root.querySelectorAll('[data-wk]').forEach((el) => PanelUI.#autosize(el));
    }

    /**
     * -> { week: { rowKey: description } }
     * In template mode this is the text itself. In import mode the file
     * already carries a description per entry, so only boxes the user
     * actually changed are returned, as overrides for that week.
     */
    #collectDescriptions() {
      const out = {};
      const overridesOnly = this.mode === 'import';
      this.root.querySelectorAll('[data-wk]').forEach((el) => {
        const v = el.value.trim();
        if (!v) return;
        if (overridesOnly && v === (el.dataset.seed || '').trim()) return;
        if (!out[el.dataset.wk]) out[el.dataset.wk] = {};
        out[el.dataset.wk][el.dataset.task] = v;
      });
      return out;
    }

    // ------------------------------------------------------------------
    // import + mapping
    // ------------------------------------------------------------------

    async #onImport() {
      const file = await pickFile();
      if (!file) return;
      try {
        this.#useBook(file.name, parseLogbook(file.text));
      } catch (e) {
        this.book = null;
        this.$('#importNote').textContent = e.message;
        this.$('#importNote').className = 'note warn';
        return;
      }
      // this page gets reloaded a lot - a connection that will not come back
      // leaves no other way out - so keep the file rather than making them
      // go and find it again every time
      store.set('import/' + location.hostname, { name: file.name, text: file.text });

      const ids = logbookIdentities(this.book);
      const unmapped = ids.filter((i) => !(this.mapping.tasks || {})[i.key]);
      this.log('Loaded ' + this.book.entries.length + ' entries.\n' +
        (unmapped.length
          ? unmapped.length + ' of ' + ids.length + ' jobs still need matching - open "Map jobs...".'
          : 'All ' + ids.length + ' jobs already have a saved match. Dry run when ready.'));
      if (unmapped.length) await this.#openMapping(false);
    }

    /** Take a parsed logbook into the panel, however it got here. */
    #useBook(name, book, restored) {
      this.book = book;
      const ids = logbookIdentities(book);
      const p = book.period || {};
      this.$('#importNote').className = 'note';
      this.$('#importNote').textContent =
        (restored ? 'still loaded - ' : '') + name + ' - ' + book.entries.length + ' entries, ' +
        ids.length + ' jobs, ' + (p.month ? MON[p.month - 1] + ' ' + p.year : 'unknown month') +
        ', from ' + (book.source.label || book.source.tracker) +
        (book.source.employee ? ' (' + book.source.employee + ')' : '');
      this.$('#mapbtn').disabled = false;

      // align the target month with the file, since that is almost always meant
      if (p.year && p.month) {
        this.$('#tgt').value = p.year + '-' + String(p.month).padStart(2, '0');
      }
      this.mapping = Mappings.load(book.source.tracker, this.tracker.constructor.id);
      this.#renderWeeks();
    }

    /** Put back the file that was loaded before the last reload, if any. */
    #restoreBook() {
      const saved = store.get('import/' + location.hostname, null);
      if (!saved || !saved.text) return false;
      try {
        this.#useBook(saved.name || 'imported file', parseLogbook(saved.text), true);
        return true;
      } catch (e) {
        return false;
      }
    }

    /**
     * What an imported job can become here. A tracker that knows its own
     * option lists provides them; one that does not falls back to the tasks
     * on the chosen template day, which is the only vocabulary it has.
     */
    async #resolveTargets(force, deep) {
      if (!force) {
        const cached = TargetCache.load();
        if (cached && cached.length) return cached;
      }
      let targets = [];
      if (this.caps.mapOnImport) {
        this.mapLog(deep ? 'Reading every task and specialty - this takes a while...'
                         : 'Reading the jobs this tracker offers...');
        targets = await this.tracker.targets((msg) => this.mapLog(msg), !!deep);
      }
      if (!targets.length) {
        targets = this.template.map((e) => ({
          id: String(e.taskId),
          label: entryLabel(e) + ' · ' + fmtHM(e.minutes),
          template: e,
        }));
      }
      if (targets.length) TargetCache.save(targets);
      return targets;
    }

    async #openMapping(deep) {
      if (!this.book) return;
      const overlay = this.$('#mapOverlay');
      overlay.classList.add('open');
      this.$('#mapRows').innerHTML = '<p class="note">Loading the options...</p>';
      this.mapLog('');
      try {
        if (deep) TargetCache.clear();
        this.targets = await this.#resolveTargets(!!deep, !!deep);
        if (!this.targets.length) {
          this.$('#mapRows').innerHTML =
            '<p class="note warn">This tracker offered no jobs to map onto. ' +
            'Pick a template day first, or open the page that lists your projects.</p>';
          return;
        }
        this.#renderMapRows();
        const shallow = this.targets.every((t) => !t.task);
        this.mapLog(this.targets.length + ' job(s) available.' + (shallow
          ? '\nChoosing a project here lets the entry form fill in its own task and specialty,'
            + '\nwhich is what you want whenever a project only has one of each.'
            + '\nUse the button below only if you need to pick those yourself.'
          : ''));
      } catch (e) {
        console.error('[timelog-filler] mapping', e);
        this.$('#mapRows').innerHTML = '<p class="note warn">' + esc(e.message) + '</p>';
      }
    }

    #renderMapRows() {
      const ids = logbookIdentities(this.book);
      const saved = this.mapping.tasks || {};
      const srcEmp = this.book.source.employee || 'unknown';
      const dstEmp = this.employeeName || 'this account';
      this.$('#mapSub').textContent =
        (this.book.source.label || this.book.source.tracker) + ' → ' +
        this.tracker.constructor.label + '   ·   ' + srcEmp + ' → ' + dstEmp +
        '   ·   choices are remembered for next time';
      this.$('#mapNote').hidden = this.targets.every((t) => !t.task);

      const opt = (value, label, selected) =>
        '<option value="' + esc(value) + '"' + (selected ? ' selected' : '') + '>' + esc(label) + '</option>';

      this.$('#mapRows').innerHTML = ids.map((id) => {
        const was = saved[id.key] || {};
        const options = '<option value="">- not mapped -</option>' +
          this.targets.map((t) => opt(t.id, t.label, was.id === t.id)).join('');
        const chosen = this.targets.find((t) => t.id === was.id);
        return `<div class="maprow" data-key="${esc(id.key)}">
            <div class="src ${was.id ? '' : 'unmapped'}">${esc(id.label)}</div>
            <div class="meta">${id.days.size} day(s) &middot; ${[...id.minutes].map(fmtHM).join(', ')}</div>
            <div class="fields">
              <select data-role="target">${options}</select>
              <select data-role="specialty"></select>
              <select data-role="wbs"></select>
              <select data-role="paid">
                ${opt('paid', 'Paid', !was.unpaid)}${opt('unpaid', 'Unpaid', !!was.unpaid)}
              </select>
            </div>
          </div>`;
      }).join('');

      // the dependent selects are filled from whichever target is chosen
      this.root.querySelectorAll('.maprow').forEach((row) => {
        const key = row.dataset.key;
        const sel = row.querySelector('[data-role="target"]');
        const fill = () => this.#fillDependentSelects(row, (saved[key] || {}));
        sel.onchange = () => { row.querySelector('.src').classList.toggle('unmapped', !sel.value); fill(); };
        fill();
      });
    }

    /** Specialty / WBS / paid only apply to trackers whose form has them. */
    #fillDependentSelects(row, was) {
      const id = row.querySelector('[data-role="target"]').value;
      const target = this.targets.find((t) => t.id === id);
      const specSel = row.querySelector('[data-role="specialty"]');
      const wbsSel = row.querySelector('[data-role="wbs"]');
      const paidSel = row.querySelector('[data-role="paid"]');
      const formLike = !!(target && target.project);

      const build = (sel, options, chosen, placeholder) => {
        const list = options || [];
        sel.hidden = !formLike || !list.length;
        if (sel.hidden) { sel.innerHTML = ''; return; }
        sel.innerHTML = list.map((o) =>
          '<option value="' + esc(o) + '"' + (o === chosen ? ' selected' : '') + '>' +
          esc(placeholder + ': ' + o) + '</option>').join('');
      };
      build(specSel, target && target.specialtyOptions, was.specialty || (target && target.specialty), 'Specialty');
      build(wbsSel, target && target.wbsOptions, was.wbs || (target && target.wbs), 'WBS');
      paidSel.hidden = !formLike;
    }

    #saveMapping() {
      const tasks = {};
      this.root.querySelectorAll('.maprow').forEach((row) => {
        const key = row.dataset.key;
        const id = row.querySelector('[data-role="target"]').value;
        if (!id) return;
        const target = this.targets.find((t) => t.id === id);
        if (!target) return;
        const specialty = row.querySelector('[data-role="specialty"]').value || target.specialty || '';
        const wbs = row.querySelector('[data-role="wbs"]').value || target.wbs || '';
        const unpaid = row.querySelector('[data-role="paid"]').value === 'unpaid';

        tasks[key] = target.project
          ? {
              id: target.id, label: target.label, project: target.project, task: target.task,
              specialty, wbs, unpaid,
              template: {
                taskId: target.id,
                taskName: target.task || target.project,
                project: target.project,
                client: null,
                minutes: 0,
                extra: { project: target.project, task: target.task, specialty, wbs, unpaid },
              },
            }
          : { id: target.id, label: target.label, template: target.template };
      });
      this.mapping = {
        tasks,
        employees: {
          ...(this.mapping.employees || {}),
          [this.book.source.employee || 'unknown']: this.employeeName || null,
        },
      };
      const ok = Mappings.save(this.book.source.tracker, this.tracker.constructor.id, this.mapping);
      this.$('#mapOverlay').classList.remove('open');
      const n = Object.keys(tasks).length;
      const total = logbookIdentities(this.book).length;
      this.log('Mapped ' + n + '/' + total + ' jobs' +
               (ok ? ' and remembered the choices.' : ' (could not save them for next time).') +
               (n < total ? '\nThe unmapped ones will be reported, not written.' : '') +
               '\n\nDry run when ready.');
    }

    // ------------------------------------------------------------------
    // export
    // ------------------------------------------------------------------

    async #export() {
      try {
        const t = this.parseYM(this.$('#tgt').value);
        this.log('Reading ' + MON[t.month - 1] + ' ' + t.year + '...');
        const data = await this.tracker.readMonth(t.year, t.month);
        const book = toLogbook(this.tracker, this.employeeName, t.year, t.month, data);
        if (!book.entries.length) {
          this.log('Nothing to export: ' + MON[t.month - 1] + ' ' + t.year + ' has no entries.');
          return;
        }
        const name = 'timelog-' + this.tracker.constructor.id + '-' +
                     t.year + '-' + String(t.month).padStart(2, '0') + '.json';
        downloadText(name, JSON.stringify(book, null, 2));
        this.log('Exported ' + book.entries.length + ' entries to ' + name + '.\n\n' +
                 'Open the other tracker, switch "Take the pattern from" to "An exported file",\n' +
                 'and load this file there.');
      } catch (e) {
        console.error('[timelog-filler] export', e);
        this.log('ERROR: ' + e.message);
      }
    }

    // ------------------------------------------------------------------
    // dry run
    // ------------------------------------------------------------------

    async #buildPlan() {
      const t = this.parseYM(this.$('#tgt').value);

      if (this.mode === 'template' && this.caps.readHistory === false) {
        throw new TrackerError(
          this.tracker.constructor.label + ' does not let this script read past months, so there is no ' +
          'template day to copy here.\n\nExport the month from the tracker you do keep it in, then switch ' +
          '"Take the pattern from" to "An exported file".', 'HISTORY_UNAVAILABLE');
      }
      if (this.mode === 'import' && !this.book) {
        throw new TrackerError('Load an exported file first.', 'ERROR');
      }

      const raw = await this.tracker.readMonth(t.year, t.month);
      const monthData = normaliseMonth(t.year, t.month, raw, this.caps);
      const period = this.$('#ignoreWindow').checked ? null : await this.tracker.period();

      const descriptions = this.#collectDescriptions();
      const built = this.mode === 'template'
        ? itemsFromTemplate(t.year, t.month, this.template, descriptions, monthData)
        : itemsFromLogbook(t.year, t.month, this.book, this.mapping, descriptions);

      if (this.mode === 'template' && !this.template.length) {
        throw new TrackerError('Pick a template day first.', 'ERROR');
      }

      const res = finalisePlan(t.year, t.month, built.items, monthData, period,
                              { shiftOffDays: this.$('#shift').checked });
      res.skipped = built.skipped.concat(res.skipped);
      return { t, monthData, period, ...res };
    }

    async #dryRun() {
      this.$('#write').disabled = true;
      this.lastPlan = null;
      this.lastUnits = null;
      try {
        this.log('Reading...');
        const { t, monthData, period, plan, skipped, shifted, blocked } = await this.#buildPlan();

        const problems = periodProblems(t.year, t.month, period, plan, blocked);
        const lines = [];

        if (period) {
          lines.push('OPEN PERIOD', '  ' + period.text, '');
        }

        if (problems.length) {
          this.log('CANNOT WRITE\n' +
                   problems.map((p) => '  - ' + p).join('\n') +
                   (period ? '\n\n  ' + period.text : '') +
                   (blocked.length ? '\n\nFIRST FEW\n' + blocked.slice(0, 8)
                      .map((b) => '  ' + MON[t.month - 1] + ' ' + b.day + '  ' + b.label + '  (' + b.why + ')')
                      .join('\n') : '') +
                   '\n\nNothing has been written. Fix the above, or tick "Ignore this tracker\'s ' +
                   'time-writing window" if you know better than the page does.');
          return;
        }

        this.lastPlan = plan;
        this.lastUnits = this.#unitsFor(plan);
        this.$('#write').disabled = plan.length === 0;

        const rows = this.mode === 'template' ? this.template : [];
        const nameW = Math.max(7, ...plan.map((p) => entryLabel(p.template).length), 7);
        const newMin = plan.reduce((a, p) => a + p.minutes, 0);
        const haveMin = Object.values(monthData)
          .flatMap((d) => d.entries || [])
          .reduce((a, e) => a + e.minutes, 0);
        const byReason = skipped.reduce((a, x) => ((a[x.why] = (a[x.why] || 0) + 1), a), {});

        if (this.mode === 'template') {
          lines.push('TEMPLATE  (' + this.$('#tplday').selectedOptions[0].textContent.trim() + ')');
          for (const e of rows) {
            lines.push('  ' + fmtHM(e.minutes) +
              '   client: ' + (e.client || '-') +
              '   project: ' + (e.project || '-') +
              '\n         task: ' + (e.taskName || '-') +
              '\n         taskId ' + e.taskId);
          }
        } else {
          const p = this.book.period || {};
          lines.push('IMPORTED  (' + (this.book.source.label || this.book.source.tracker) + ', ' +
                     (p.month ? MON[p.month - 1] + ' ' + p.year : '?') + ', ' +
                     this.book.entries.length + ' entries)');
          for (const id of logbookIdentities(this.book)) {
            const m = (this.mapping.tasks || {})[id.key];
            lines.push('  ' + pad(id.label, 46) + ' -> ' + (m ? m.label : '(not mapped)'));
          }
        }

        lines.push('', 'WOULD WRITE ' + plan.length + ' entries over ' +
                   new Set(plan.map((p) => p.day)).size + ' days' +
                   (this.caps.batchWrite ? ', in ' + this.lastUnits.length + ' submissions' : ''));
        for (const p of plan) {
          lines.push('  ' + shortDate(p.date) + '  w' + p.week + '  ' +
                     fmtHM(p.minutes) + '  ' + pad(entryLabel(p.template), nameW) + '  ' +
                     (p.shiftedFrom ? '[moved from ' + MON[t.month - 1] + ' ' + p.shiftedFrom + '] ' : '') +
                     p.description);
        }

        if (shifted.length) {
          lines.push('', 'MOVED  ' + shifted.length + ' entries off non-working days');
          const seen = new Set();
          for (const s of shifted) {
            const k = s.from + '>' + s.to + s.why;
            if (seen.has(k)) continue;
            seen.add(k);
            lines.push('  ' + MON[t.month - 1] + ' ' + s.from + ' (' + s.why + ')  ->  ' +
                       MON[t.month - 1] + ' ' + s.to + '  (' + s.direction + ')');
          }
        }

        lines.push('', 'HOURS   new ' + fmtHM(newMin) +
                   '  +  already logged ' + fmtHM(haveMin) +
                   '  =  month total ' + fmtHM(newMin + haveMin));

        lines.push('', 'SKIPPED');
        const skipLines = Object.entries(byReason).map(([k, v]) => '  ' + v + ' x ' + k);
        lines.push(skipLines.length ? skipLines.join('\n') : '  nothing');

        this.log(lines.join('\n'));
      } catch (e) {
        console.error('[timelog-filler] dryRun', e);
        this.log('ERROR: ' + e.message + '\n\nSee console, filter on [timelog-filler]');
      }
    }

    // ------------------------------------------------------------------
    // write
    // ------------------------------------------------------------------

    /** Turn a plan into the fewest round trips this tracker will take. */
    #unitsFor(plan) {
      if (this.caps.batchWrite) {
        return groupForBatch(plan).map((g) => ({
          label: entryLabel(g.template) + ' x' + g.dates.length + 'd',
          count: g.dates.length,
          run: () => this.tracker.writeBatch({
            dates: g.dates, template: g.template, description: g.description }),
        }));
      }
      return plan.map((p) => ({
        label: shortDate(p.date) + ' ' + entryLabel(p.template),
        count: 1,
        run: () => this.tracker.writeEntry({
          date: p.date, template: p.template, description: p.description }),
      }));
    }

    /**
     * One sweep through a list of writes.
     * @returns {{written:number, failures:string[], stop:?string}}
     */
    async #writePass(units, total, passLabel) {
      const { delayMs, retries, backoffMs, abortAfter } = this.tracker.constructor.rateLimit;
      let written = 0, consecutiveFailures = 0;
      const failures = [];

      for (let i = 0; i < units.length; i++) {
        const u = units[i];
        let done = false;

        for (let attempt = 1; attempt <= retries && !done; attempt++) {
          try {
            const status = await u.run();
            if (status === 200) { written += u.count; done = true; break; }
            failures.push(u.label + ' HTTP ' + status);
          } catch (e) {
            console.error('[timelog-filler] write ' + u.label, e);
            if (e.code === 'UNCERTAIN' || e.code === 'NOT_READY') {
              // either the submit's fate is unknown, or the page is simply
              // gone. Both are settled by reading the month again, which is
              // what the next run does - so stop rather than guess.
              return { written, failures, stop: e.message, uncertain: u.label };
            }
            failures.push(u.label + ' ' + e.message);
            if (e.fatal) break; // the form refused it; another identical try will too
          }
          if (attempt < retries && !done) {
            const wait = backoffMs * Math.pow(3, attempt - 1);
            this.log(passLabel + 'writing ' + (i + 1) + '/' + units.length +
                     '  (ok: ' + written + '/' + total + ')\n' +
                     'Rejected on ' + u.label + ' - backing off ' + Math.round(wait / 1000) + 's');
            await sleep(wait);
          }
        }

        consecutiveFailures = done ? 0 : consecutiveFailures + 1;
        if (consecutiveFailures >= abortAfter) {
          return { written, failures,
                   stop: abortAfter + ' writes in a row were refused' };
        }
        this.log(passLabel + 'writing ' + (i + 1) + '/' + units.length +
                 '  (ok: ' + written + '/' + total + ')');
        await sleep(delayMs);
      }
      return { written, failures, stop: null };
    }

    /**
     * Write the plan, then check the month again and fill whatever did not
     * make it, a few times over.
     *
     * Against a server that drops its connection every minute or two, a
     * single clean sweep is the exception rather than the rule. Re-reading
     * between passes is what makes that survivable: it is the tracker's own
     * record of what exists, so each pass asks for exactly what is still
     * missing and nothing is ever written twice.
     */
    async #write() {
      if (!this.lastUnits || !this.lastUnits.length) return;
      const planned = this.lastPlan.length;
      if (!confirm('Write ' + planned + ' entries to ' + this.tracker.constructor.label + '?')) return;

      const maxPasses = this.tracker.constructor.rateLimit.passes || 1;
      this.$('#write').disabled = true;
      this.$('#dry').disabled = true;

      let units = this.lastUnits;
      let remaining = planned;
      let writtenAll = 0;
      let lastStop = null;
      let uncertain = null;
      const failures = [];

      try {
        for (let pass = 1; pass <= maxPasses; pass++) {
          const label = maxPasses > 1 ? 'Pass ' + pass + '/' + maxPasses + ': ' : '';
          const res = await this.#writePass(units, remaining, label);
          writtenAll += res.written;
          failures.push(...res.failures);
          if (res.uncertain) uncertain = res.uncertain;
          if (res.stop) { lastStop = res.stop; break; }
          if (!res.failures.length) break; // clean sweep

          if (pass === maxPasses) break;

          // see what is genuinely still missing before trying again
          this.log('Checking what actually landed...');
          let rebuilt;
          try {
            rebuilt = await this.#buildPlan();
          } catch (e) {
            lastStop = 'could not re-read the month to check: ' + e.message;
            break;
          }
          const problems = periodProblems(rebuilt.t.year, rebuilt.t.month, rebuilt.period,
                                          rebuilt.plan, rebuilt.blocked);
          if (problems.length) { lastStop = problems[0]; break; }
          if (!rebuilt.plan.length) break; // everything is there after all
          if (rebuilt.plan.length >= remaining && !res.written) {
            lastStop = 'nothing went through on that pass, so trying again would not help';
            break;
          }
          remaining = rebuilt.plan.length;
          units = this.#unitsFor(rebuilt.plan);
          this.log('Still missing ' + remaining + ' entries - going round again.');
          await sleep(800);
        }
      } finally {
        this.$('#dry').disabled = false;
        Status.report('');
      }

      const lines = ['Wrote ' + writtenAll + ' of ' + planned + ' entries.'];
      if (uncertain) {
        lines.push('', '"' + uncertain + '" may or may not have saved - it was not retried, ' +
                   'because a retry could double it.');
      }
      if (lastStop) {
        lines.push('', 'STOPPED: ' + lastStop);
        lines.push('', 'Reload the page and run the dry run again. It reads what is really there, ' +
                   'so a second run only fills what is still missing - nothing gets written twice.');
      } else if (failures.length) {
        lines.push('', 'STILL MISSING after ' + maxPasses + ' passes:',
                   ...failures.slice(-8).map((e) => '  ' + e));
      } else {
        lines.push('', 'Reload the page to see them.');
      }
      this.log(lines.join('\n'));
      this.lastPlan = null; this.lastUnits = null;
    }

    async start() {
      try { this.employeeName = await this.tracker.employee(); } catch (e) { this.employeeName = null; }
      this.$('#who').textContent = this.tracker.constructor.label +
        (this.employeeName ? ' · ' + this.employeeName : '');

      // a tracker that cannot show you last month can only work from a file
      this.#setMode(this.caps.readHistory === false ? 'import' : 'template');
      if (this.caps.readHistory === false) {
        this.$('#mode').querySelector('option[value="template"]').disabled = true;
      }

      await this.#loadSourceMonth();
      this.#renderWeeks();

      const restored = this.mode === 'import' && this.#restoreBook();

      let hint = 'Pick months, then Dry run.';
      if (restored) {
        const ids = logbookIdentities(this.book);
        const unmapped = ids.filter((i) => !(this.mapping.tasks || {})[i.key]);
        hint = 'Picked up where you left off: ' + this.book.entries.length + ' entries still loaded.\n' +
               (unmapped.length
                 ? unmapped.length + ' of ' + ids.length + ' jobs still need matching.'
                 : 'All ' + ids.length + ' jobs are matched.') +
               '\n\nDry run first - it reads what is already in the month, so anything written ' +
               'before a reload is skipped rather than repeated.';
      } else if (this.caps.readHistory === false) {
        hint = this.tracker.constructor.label + ' only shows the open period, so there is no past month ' +
               'to copy a template day from.\n\nExport the month from your other tracker, then load it ' +
               'with "Choose file...". Jobs are matched once and remembered.';
      }
      this.log(hint);
    }
  }

  // =====================================================================
  // Boot
  // =====================================================================

  (async () => {
    const Tracker = TRACKERS.find((T) => T.matches());
    if (!Tracker) return; // not a supported tracker page
    if (document.querySelector('[data-timelog-filler-host]')) return; // already mounted

    const tracker = new Tracker();
    let ui;
    try {
      ui = new PanelUI(tracker);
      await tracker.ready();
      await ui.start();
    } catch (e) {
      console.error('[timelog-filler] boot', e);
      if (ui) ui.log('Startup failed: ' + e.message);
    }
  })();
})();
