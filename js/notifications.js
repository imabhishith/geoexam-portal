// ============================================================
// notifications.js  —  GeoExam Portal
// Drop this ONE script on any student page and notifications
// just work: bell badge, slide-in panel, mark-all-read.
//
// USAGE (add before </body> on every student page):
//   <script src="../js/notifications.js"></script>
//
// REQUIRES:
//   - Firebase auth + Firestore already initialised (firebase-config.js)
//   - Utils.toast() available
//   - An element with id="notif-bell-btn"  in the navbar
//   - An element with id="notif-badge"     inside that button
// ============================================================

(function () {
  'use strict';

  /* ── Internal state ── */
  let _user     = null;
  let _notifs   = [];
  let _panel    = null;

  /* ── Icon map ── */
  const ICONS  = { exam:'fa-file-alt', resource:'fa-book', doubt:'fa-lightbulb', general:'fa-bell', system:'fa-cog' };
  const COLORS = { exam:'#dbeafe',     resource:'#dcfce7', doubt:'#fef9c3',      general:'#f3e8ff', system:'#f1f5f9' };

  /* ── 1. Inject the slide-in panel into <body> once ── */
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

    // Close panel on outside click
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

  /* ── 2. Fetch notifications for this user ── */
  async function _load() {
    if (!_user) return;

    try {
      // Two separate queries to avoid permission-denied on collection scan:
      // Query A — global broadcasts
      const [globalSnap, personalSnap] = await Promise.all([
        db.collection('notifications')
          .where('global', '==', true)
          .orderBy('createdAt', 'desc')
          .limit(25)
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
      _notifs = Object.values(map).sort((a, b) => {
        return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
      });

      _updateBadge();
      _renderPanel();
    } catch (err) {
      console.warn('GxNotifications: fetch failed —', err.code || err.message);
      // Show a graceful empty state instead of crashing
      const list = document.getElementById('gx-notif-list');
      if (list) list.innerHTML = `
        <div style="padding:32px;text-align:center;color:var(--text3,#94a3b8);font-size:13px;">
          <i class="fas fa-bell-slash" style="font-size:32px;opacity:.25;display:block;margin-bottom:10px;"></i>
          Could not load notifications.
        </div>`;
    }
  }

  /* ── 3. Badge count ── */
  function _updateBadge() {
    const lastSeen = parseInt(localStorage.getItem('gx_notifs_seen') || '0');
    const unread   = _notifs.filter(n => (n.createdAt?.seconds || 0) > lastSeen).length;
    const badge    = document.getElementById('notif-badge');
    if (!badge) return;
    if (unread > 0) {
      badge.textContent    = unread > 99 ? '99+' : unread;
      badge.style.display  = 'flex';
    } else {
      badge.style.display  = 'none';
    }
  }

  /* ── 4. Render the notification list ── */
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
      const ts  = n.createdAt?.toDate?.()?.toLocaleString('en-IN', {
        day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'
      }) || '';
      const icon  = ICONS[n.type]  || 'fa-bell';
      const color = COLORS[n.type] || '#f3e8ff';
      const safeTitle = _esc(n.title || '');
      const safeBody  = _esc(n.body  || '');
      return `
        <div onclick="${n.link ? `window.location='${n.link}'` : ''}"
          style="
            padding:13px 18px;
            border-bottom:1px solid var(--border,#e2e8f0);
            display:flex; gap:12px; align-items:flex-start;
            background:${isUnread ? '#eff6ff' : 'transparent'};
            ${isUnread ? 'border-left:3px solid #2563ab;' : ''}
            ${n.link ? 'cursor:pointer;' : ''}
            transition:background .15s;
          "
          onmouseenter="this.style.background='${isUnread ? '#dbeafe' : 'var(--bg,#f8fafc)'}'"
          onmouseleave="this.style.background='${isUnread ? '#eff6ff' : 'transparent'}'">
          <div style="
            width:36px; height:36px; border-radius:50%;
            background:${color}; flex-shrink:0;
            display:flex; align-items:center; justify-content:center;">
            <i class="fas ${icon}" style="color:#2563ab;font-size:14px;"></i>
          </div>
          <div style="flex:1;min-width:0;">
            <div style="
              font-size:13px; font-weight:${isUnread ? '700' : '600'};
              margin-bottom:3px; color:var(--text,#1e293b);
              white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              ${safeTitle}
            </div>
            <div style="
              font-size:12px; color:var(--text2,#64748b);
              display:-webkit-box; -webkit-line-clamp:2;
              -webkit-box-orient:vertical; overflow:hidden;">
              ${safeBody}
            </div>
            ${n.link ? `
              <div style="font-size:11px;color:#2563ab;margin-top:4px;font-weight:600;">
                <i class="fas fa-external-link-alt" style="font-size:9px;"></i> View
              </div>` : ''}
            <div style="font-size:11px;color:var(--text3,#94a3b8);margin-top:4px;">${ts}</div>
          </div>
          ${isUnread ? '<div style="width:8px;height:8px;border-radius:50%;background:#2563ab;flex-shrink:0;margin-top:4px;"></div>' : ''}
        </div>`;
    }).join('');
  }

  /* ── 5. Helpers ── */
  function _esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /* ── Public API ── */
  window.GxNotifications = {

    /** Call this once after auth.onAuthStateChanged gives you a user */
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
      const badge = document.getElementById('notif-badge');
      if (badge) badge.style.display = 'none';
      _renderPanel(); // re-render without blue highlights
      if (typeof Utils !== 'undefined' && Utils.toast) {
        Utils.toast('All notifications marked as read.', 'success');
      }
    },

    /** Force reload from Firestore */
    reload() { _load(); },
  };

})();
