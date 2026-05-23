// ============================================================
// notifications.js  —  GeoExam Portal  (FIXED v2)
// Drop this ONE script on any student page and notifications
// just work: bell badge, slide-in panel, mark-all-read,
// and optional dashboard widget.
//
// USAGE (add before </body> on every student page):
//   <script src="../js/notifications.js"></script>
//
// REQUIRES:
//   - Firebase auth + Firestore already initialised (firebase-config.js)
//   - Utils.toast() available
//   - An element with id="notif-bell-btn"  in the navbar
//   - An element with id="notif-badge"     inside that button
//     (NOTE: use id="notif-badge" — NOT "notif-bell-badge")
//
// OPTIONAL (dashboard only):
//   - An element with id="notif-widget-list" to show a mini preview
// ============================================================

(function () {
  'use strict';

  /* ── Internal state ── */
  let _user   = null;
  let _notifs = [];
  let _panel  = null;

  /* ── Icon / colour maps ── */
  const ICONS  = { exam:'fa-file-alt', resource:'fa-book', doubt:'fa-lightbulb', general:'fa-bell', system:'fa-cog' };
  const COLORS = { exam:'#dbeafe',     resource:'#dcfce7', doubt:'#fef9c3',      general:'#f3e8ff', system:'#f1f5f9' };

  /* ─────────────────────────────────────────
     1. Inject the slide-in panel into <body>
  ───────────────────────────────────────── */
  function _injectPanel() {
    if (document.getElementById('gx-notif-panel')) return;
    const div = document.createElement('div');
    div.id = 'gx-notif-panel';
    div.style.cssText = [
      'display:none', 'position:fixed', 'top:64px', 'right:16px',
      'width:360px', 'max-height:500px',
      'background:var(--surface,#fff)',
      'border:1px solid var(--border,#e2e8f0)',
      'border-radius:14px',
      'box-shadow:0 8px 32px rgba(0,0,0,.14)',
      'z-index:2000', 'overflow:hidden',
      'flex-direction:column',
    ].join(';');
    div.innerHTML = `
      <div style="padding:14px 18px;border-bottom:1px solid var(--border,#e2e8f0);
                  display:flex;justify-content:space-between;align-items:center;flex-shrink:0;">
        <span style="font-size:15px;font-weight:800;">
          <i class="fas fa-bell" style="color:#2563ab;margin-right:6px;"></i>Notifications
        </span>
        <div style="display:flex;gap:8px;align-items:center;">
          <button id="gx-mark-read-btn"
            style="font-size:12px;color:#2563ab;background:none;border:none;cursor:pointer;font-weight:600;padding:0;">
            Mark all read
          </button>
          <button onclick="GxNotifications.close()"
            style="background:none;border:none;font-size:16px;cursor:pointer;color:var(--text3,#94a3b8);line-height:1;">
            &times;
          </button>
        </div>
      </div>
      <div id="gx-notif-list"
           style="overflow-y:auto;flex:1;
                  scrollbar-width:thin;scrollbar-color:#cbd5e1 transparent;">
        <div style="padding:32px;text-align:center;color:var(--text3,#94a3b8);font-size:13px;">
          <i class="fas fa-bell" style="font-size:32px;opacity:.25;display:block;margin-bottom:10px;"></i>
          Loading notifications…
        </div>
      </div>
    `;
    document.body.appendChild(div);
    _panel = div;

    document.getElementById('gx-mark-read-btn').addEventListener('click', GxNotifications.markAllRead);

    // Close on outside click
    document.addEventListener('click', function (e) {
      if (!_panel) return;
      const bell = document.getElementById('notif-bell-btn');
      if (_panel.style.display !== 'none'
          && !_panel.contains(e.target)
          && bell && !bell.contains(e.target)) {
        _panel.style.display = 'none';
      }
    });
  }

  /* ─────────────────────────────────────────
     2. Fetch notifications from Firestore
     FIX: query uses `global == true` and `targetUserId == uid`.
     Both fields are written by adminBroadcastNotif /
     adminSendNotifToUser in admin.js — this matches exactly.
  ───────────────────────────────────────── */
  async function _load() {
    if (!_user) return;

    try {
      const [globalSnap, personalSnap] = await Promise.all([
        db.collection('notifications')
          .where('global', '==', true)
          .orderBy('createdAt', 'desc')
          .limit(30)
          .get(),
        db.collection('notifications')
          .where('targetUserId', '==', _user.uid)
          .orderBy('createdAt', 'desc')
          .limit(10)
          .get(),
      ]);

      // Merge + de-dupe by id, sort newest first
      const map = {};
      [...globalSnap.docs, ...personalSnap.docs].forEach(d => {
        map[d.id] = { id: d.id, ...d.data() };
      });
      _notifs = Object.values(map).sort((a, b) =>
        (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
      );

      _updateBadge();
      _renderPanel();
      _renderWidget();       // populate dashboard widget if present
    } catch (err) {
      console.warn('GxNotifications: fetch failed —', err.code || err.message);
      const list = document.getElementById('gx-notif-list');
      if (list) list.innerHTML = `
        <div style="padding:32px;text-align:center;color:var(--text3,#94a3b8);font-size:13px;">
          <i class="fas fa-bell-slash" style="font-size:32px;opacity:.25;display:block;margin-bottom:10px;"></i>
          Could not load notifications.<br>
          <span style="font-size:11px;opacity:.7;">${_esc(err.message || err.code || '')}</span>
        </div>`;
    }
  }

  /* ─────────────────────────────────────────
     3. Badge — FIX: look for BOTH possible IDs
     (dashboard uses "notif-badge";
      resources/doubt-room used "notif-bell-badge" by mistake)
  ───────────────────────────────────────── */
  function _updateBadge() {
    const lastSeen = parseInt(localStorage.getItem('gx_notifs_seen') || '0');
    const unread   = _notifs.filter(n => (n.createdAt?.seconds || 0) > lastSeen).length;

    // Support both id variants so every page works without HTML edits
    ['notif-badge', 'notif-bell-badge'].forEach(id => {
      const badge = document.getElementById(id);
      if (!badge) return;
      if (unread > 0) {
        badge.textContent   = unread > 99 ? '99+' : unread;
        badge.style.display = 'flex';
      } else {
        badge.style.display = 'none';
      }
    });
  }

  /* ─────────────────────────────────────────
     4. Render the slide-in panel list
  ───────────────────────────────────────── */
  function _renderPanel() {
    const list = document.getElementById('gx-notif-list');
    if (!list) return;

    if (!_notifs.length) {
      list.innerHTML = `
        <div style="padding:48px 24px;text-align:center;color:var(--text3,#94a3b8);font-size:13px;">
          <i class="fas fa-bell" style="font-size:40px;opacity:.2;display:block;margin-bottom:12px;"></i>
          No notifications yet.
        </div>`;
      return;
    }

    const lastSeen = parseInt(localStorage.getItem('gx_notifs_seen') || '0');
    list.innerHTML = _notifs.map(n => {
      const isUnread = (n.createdAt?.seconds || 0) > lastSeen;
      const ts = n.createdAt?.toDate?.()?.toLocaleString('en-IN', {
        day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'
      }) || '';
      const icon  = ICONS[n.type]  || 'fa-bell';
      const color = COLORS[n.type] || '#f3e8ff';
      return `
        <div onclick="${n.link ? `window.location='${_esc(n.link)}'` : ''}"
          style="
            padding:13px 18px;
            border-bottom:1px solid var(--border,#e2e8f0);
            display:flex; gap:12px; align-items:flex-start;
            background:${isUnread ? '#eff6ff' : 'transparent'};
            ${isUnread ? 'border-left:3px solid #2563ab;' : ''}
            ${n.link ? 'cursor:pointer;' : ''}
            transition:background .15s;">
          <div style="width:36px;height:36px;border-radius:50%;background:${color};flex-shrink:0;
                      display:flex;align-items:center;justify-content:center;">
            <i class="fas ${icon}" style="color:#2563ab;font-size:14px;"></i>
          </div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;font-weight:${isUnread?'700':'600'};margin-bottom:3px;
                        color:var(--text,#1e293b);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${_esc(n.title || '(No title)')}
            </div>
            <div style="font-size:12px;color:var(--text2,#64748b);
                        display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">
              ${_esc(n.body || '')}
            </div>
            ${n.link ? `<div style="font-size:11px;color:#2563ab;margin-top:4px;font-weight:600;">
              <i class="fas fa-external-link-alt" style="font-size:9px;"></i> View</div>` : ''}
            <div style="font-size:11px;color:var(--text3,#94a3b8);margin-top:4px;">${ts}</div>
          </div>
          ${isUnread ? '<div style="width:8px;height:8px;border-radius:50%;background:#2563ab;flex-shrink:0;margin-top:4px;"></div>' : ''}
        </div>`;
    }).join('');
  }

  /* ─────────────────────────────────────────
     5. Dashboard widget (notif-widget-list)
     FIX: this was MISSING — the widget on the dashboard
     showed a static "Click 🔔 to view" placeholder forever
     because nothing ever populated it.
  ───────────────────────────────────────── */
  function _renderWidget() {
    const widget = document.getElementById('notif-widget-list');
    if (!widget) return;   // not the dashboard page — skip

    const lastSeen = parseInt(localStorage.getItem('gx_notifs_seen') || '0');
    const recent   = _notifs.slice(0, 4);

    if (!recent.length) {
      widget.innerHTML = `<div style="padding:16px;text-align:center;color:var(--text3,#94a3b8);font-size:13px;">
        No notifications yet.</div>`;
      return;
    }

    widget.innerHTML = recent.map(n => {
      const isUnread = (n.createdAt?.seconds || 0) > lastSeen;
      const icon     = ICONS[n.type]  || 'fa-bell';
      const color    = COLORS[n.type] || '#f3e8ff';
      const ts = n.createdAt?.toDate?.()?.toLocaleString('en-IN', {
        day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'
      }) || '';
      return `
        <div onclick="${n.link ? `window.location='${_esc(n.link)}'` : 'GxNotifications.toggle(event)'}"
          style="display:flex;gap:10px;align-items:flex-start;padding:10px 14px;
                 border-bottom:1px solid var(--border,#e2e8f0);cursor:pointer;
                 background:${isUnread?'#eff6ff':'transparent'};
                 ${isUnread?'border-left:3px solid #2563ab;':''}"
          onmouseenter="this.style.background='${isUnread?'#dbeafe':'var(--bg,#f8fafc)'}'"
          onmouseleave="this.style.background='${isUnread?'#eff6ff':'transparent'}'">
          <div style="width:30px;height:30px;border-radius:50%;background:${color};
                      flex-shrink:0;display:flex;align-items:center;justify-content:center;">
            <i class="fas ${icon}" style="color:#2563ab;font-size:12px;"></i>
          </div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;font-weight:${isUnread?'700':'600'};
                        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
                        color:var(--text,#1e293b);">
              ${_esc(n.title || '(No title)')}
            </div>
            <div style="font-size:11px;color:var(--text3,#94a3b8);margin-top:2px;">${ts}</div>
          </div>
          ${isUnread?'<div style="width:7px;height:7px;border-radius:50%;background:#2563ab;flex-shrink:0;margin-top:4px;"></div>':''}
        </div>`;
    }).join('');
  }

  /* ── Helper: HTML-escape ── */
  function _esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /* ─────────────────────────────────────────
     Public API
  ───────────────────────────────────────── */
  window.GxNotifications = {

    /** Call once after auth.onAuthStateChanged gives a user */
    init(user) {
      _user = user;
      _injectPanel();
      _load();
    },

    /** Toggle open/close the panel */
    toggle(e) {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      if (!_panel) return;
      const open = _panel.style.display === 'flex';
      _panel.style.display = open ? 'none' : 'flex';
      _panel.style.flexDirection = 'column';
    },

    /** Close the panel */
    close() {
      if (_panel) _panel.style.display = 'none';
    },

    /** Mark all notifications as read */
    markAllRead() {
      localStorage.setItem('gx_notifs_seen', Math.floor(Date.now() / 1000));
      _updateBadge();
      _renderPanel();
      _renderWidget();
      if (typeof Utils !== 'undefined' && Utils.toast) {
        Utils.toast('All notifications marked as read.', 'success');
      }
    },

    /** Force reload from Firestore */
    reload() { _load(); },
  };

})();
