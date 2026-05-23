// ============================================================
// notifications.js  —  GeoExam Portal  (v3 — Navy/Orange Theme)
// ============================================================

(function () {
  'use strict';

  /* ── Internal state ── */
  let _user   = null;
  let _notifs = [];
  let _panel  = null;

  /* ── Icon / colour maps (navy-theme accents) ── */
  const ICONS  = { exam:'fa-file-alt', resource:'fa-book', doubt:'fa-lightbulb', general:'fa-bell', system:'fa-cog' };
  const COLORS = { exam:'#dbeafe', resource:'#dcfce7', doubt:'#fef9c3', general:'#fde8d8', system:'#f1f5f9' };
  const ICOLOR = { exam:'#1565c0', resource:'#2e7d32', doubt:'#d97706', general:'#e65100', system:'#546e7a' };

  /* ─────────────────────────────────────────
     1. Inject panel CSS + HTML
  ───────────────────────────────────────── */
  function _injectPanel() {
    if (document.getElementById('gx-notif-panel')) return;

    // ── Inject CSS ──
    const style = document.createElement('style');
    style.textContent = `
      #gx-notif-panel {
        display: none;
        position: fixed;
        top: 62px;
        right: 16px;
        width: 380px;
        max-height: 560px;
        background: #fff;
        border-radius: 14px;
        border: 1px solid #e2e8f0;
        box-shadow: 0 12px 40px rgba(10,37,64,.18), 0 2px 8px rgba(10,37,64,.08);
        z-index: 2000;
        overflow: hidden;
        flex-direction: column;
        font-family: 'Noto Sans','Segoe UI',Arial,sans-serif;
      }
      #gx-notif-panel .gx-np-head {
        background: linear-gradient(135deg, #0a2540 0%, #0e3460 100%);
        border-bottom: 3px solid #f57c00;
        padding: 14px 18px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-shrink: 0;
      }
      #gx-notif-panel .gx-np-title {
        font-size: 15px;
        font-weight: 800;
        color: #fff;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      #gx-notif-panel .gx-np-title i {
        color: #f57c00;
        font-size: 14px;
      }
      #gx-notif-panel .gx-np-badge {
        background: #e65100;
        color: #fff;
        font-size: 10px;
        font-weight: 800;
        padding: 2px 7px;
        border-radius: 10px;
        margin-left: 4px;
      }
      #gx-notif-panel .gx-np-actions {
        display: flex;
        gap: 6px;
        align-items: center;
      }
      #gx-notif-panel .gx-np-btn {
        background: rgba(255,255,255,.12);
        border: 1px solid rgba(255,255,255,.2);
        color: rgba(255,255,255,.85);
        border-radius: 6px;
        padding: 5px 10px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        transition: background .15s;
        white-space: nowrap;
      }
      #gx-notif-panel .gx-np-btn:hover {
        background: rgba(255,255,255,.22);
        color: #fff;
      }
      #gx-notif-panel .gx-np-close {
        background: none;
        border: none;
        color: rgba(255,255,255,.6);
        font-size: 18px;
        cursor: pointer;
        line-height: 1;
        padding: 2px 4px;
        transition: color .15s;
      }
      #gx-notif-panel .gx-np-close:hover { color: #fff; }
      #gx-notif-list {
        overflow-y: auto;
        flex: 1;
        scrollbar-width: thin;
        scrollbar-color: #cbd5e1 transparent;
      }
      .gx-notif-item {
        display: flex;
        gap: 12px;
        align-items: flex-start;
        padding: 13px 16px;
        border-bottom: 1px solid #f1f5f9;
        transition: background .15s;
        cursor: default;
      }
      .gx-notif-item:hover { background: #f8fafc; }
      .gx-notif-item.gx-unread {
        background: #fffbf5;
        border-left: 3px solid #f57c00;
      }
      .gx-notif-item.gx-unread:hover { background: #fff3e0; }
      .gx-notif-item.gx-clickable { cursor: pointer; }
      .gx-notif-icon {
        width: 38px; height: 38px;
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
        font-size: 15px;
      }
      .gx-notif-body { flex: 1; min-width: 0; }
      .gx-notif-title {
        font-size: 13px;
        font-weight: 700;
        color: #1e293b;
        margin-bottom: 4px;
        line-height: 1.35;
      }
      .gx-notif-title.gx-read { font-weight: 600; color: #475569; }
      .gx-notif-msg {
        font-size: 12px;
        color: #64748b;
        line-height: 1.5;
        margin-bottom: 5px;
        /* FULL message — no clamp */
        white-space: pre-line;
      }
      .gx-notif-link {
        font-size: 11px;
        color: #e65100;
        font-weight: 600;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        gap: 3px;
        margin-bottom: 4px;
      }
      .gx-notif-link:hover { color: #f57c00; }
      .gx-notif-time {
        font-size: 11px;
        color: #94a3b8;
        margin-top: 2px;
      }
      .gx-unread-dot {
        width: 8px; height: 8px;
        border-radius: 50%;
        background: #e65100;
        flex-shrink: 0;
        margin-top: 5px;
      }
      .gx-np-empty {
        padding: 48px 24px;
        text-align: center;
        color: #94a3b8;
        font-size: 13px;
      }
      .gx-np-empty i {
        font-size: 40px;
        opacity: .2;
        display: block;
        margin-bottom: 12px;
        color: #0a2540;
      }
      .gx-np-footer {
        padding: 10px 16px;
        border-top: 1px solid #f1f5f9;
        background: #f8fafc;
        text-align: center;
        font-size: 12px;
        color: #64748b;
        flex-shrink: 0;
      }
      /* ── Dashboard widget items ── */
      .gx-widget-item {
        display: flex;
        gap: 10px;
        align-items: flex-start;
        padding: 10px 14px;
        border-bottom: 1px solid var(--border,#e2e8f0);
        cursor: pointer;
        transition: background .15s;
      }
      .gx-widget-item:hover { background: var(--bg,#f8fafc); }
      .gx-widget-item.gx-unread { background: #fffbf5; border-left: 3px solid #f57c00; }
      .gx-widget-item.gx-unread:hover { background: #fff3e0; }
    `;
    document.head.appendChild(style);

    // ── Inject panel HTML ──
    const div = document.createElement('div');
    div.id = 'gx-notif-panel';
    div.innerHTML = `
      <div class="gx-np-head">
        <div class="gx-np-title">
          <i class="fas fa-bell"></i>
          Notifications
          <span class="gx-np-badge" id="gx-np-count" style="display:none;">0</span>
        </div>
        <div class="gx-np-actions">
          <button class="gx-np-btn" id="gx-mark-read-btn">
            <i class="fas fa-check-double"></i> Mark all read
          </button>
          <button class="gx-np-close" onclick="GxNotifications.close()">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
      <div id="gx-notif-list">
        <div class="gx-np-empty">
          <i class="fas fa-bell"></i>
          Loading notifications…
        </div>
      </div>
      <div class="gx-np-footer" id="gx-np-footer" style="display:none;">
        <i class="fas fa-shield-alt" style="color:#e65100;margin-right:4px;"></i>
        GeoExam Portal Notifications
      </div>
    `;
    document.body.appendChild(div);
    _panel = div;

    document.getElementById('gx-mark-read-btn').addEventListener('click', GxNotifications.markAllRead);

    // Close on outside click
    document.addEventListener('click', function (e) {
      if (!_panel || _panel.style.display === 'none') return;
      const bell = document.getElementById('notif-bell-btn');
      if (!_panel.contains(e.target) && bell && !bell.contains(e.target)) {
        _panel.style.display = 'none';
      }
    });
  }

  /* ─────────────────────────────────────────
     2. Fetch notifications from Firestore
  ───────────────────────────────────────── */
  async function _load() {
    if (!_user) return;
    try {
      const [globalSnap, personalSnap] = await Promise.all([
        db.collection('notifications').where('global', '==', true).limit(30).get(),
        db.collection('notifications').where('targetUserId', '==', _user.uid).limit(15).get(),
      ]);
      const map = {};
      [...globalSnap.docs, ...personalSnap.docs].forEach(d => { map[d.id] = { id: d.id, ...d.data() }; });
      _notifs = Object.values(map).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      _updateBadge();
      _renderPanel();
      _renderWidget();
    } catch (err) {
      console.warn('GxNotifications: fetch failed —', err.code || err.message);
      const list = document.getElementById('gx-notif-list');
      if (list) list.innerHTML = `<div class="gx-np-empty">
        <i class="fas fa-bell-slash"></i>
        Could not load notifications.<br>
        <span style="font-size:11px;opacity:.7;">${_esc(err.message || '')}</span>
      </div>`;
    }
  }

  /* ─────────────────────────────────────────
     3. Badge — supports both id variants
  ───────────────────────────────────────── */
  function _updateBadge() {
    const lastSeen = parseInt(localStorage.getItem('gx_notifs_seen') || '0');
    const unread   = _notifs.filter(n => (n.createdAt?.seconds || 0) > lastSeen).length;

    ['notif-badge', 'notif-bell-badge'].forEach(id => {
      const badge = document.getElementById(id);
      if (!badge) return;
      badge.textContent   = unread > 99 ? '99+' : unread;
      badge.style.display = unread > 0 ? 'flex' : 'none';
    });

    // Panel header count
    const cnt = document.getElementById('gx-np-count');
    if (cnt) {
      cnt.textContent   = unread > 99 ? '99+' : unread;
      cnt.style.display = unread > 0 ? 'inline-block' : 'none';
    }
  }

  /* ─────────────────────────────────────────
     4. Render the slide-in panel
  ───────────────────────────────────────── */
  function _renderPanel() {
    const list = document.getElementById('gx-notif-list');
    if (!list) return;
    const footer = document.getElementById('gx-np-footer');

    if (!_notifs.length) {
      list.innerHTML = `<div class="gx-np-empty">
        <i class="fas fa-bell"></i>
        No notifications yet.<br>
        <span style="font-size:12px;">You'll see updates here.</span>
      </div>`;
      if (footer) footer.style.display = 'none';
      return;
    }

    if (footer) footer.style.display = 'block';
    const lastSeen = parseInt(localStorage.getItem('gx_notifs_seen') || '0');

    list.innerHTML = _notifs.map(n => {
      const isUnread = (n.createdAt?.seconds || 0) > lastSeen;
      const ts = n.createdAt?.toDate?.()?.toLocaleString('en-IN', {
        day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'
      }) || '';
      const icon   = ICONS[n.type]  || 'fa-bell';
      const bg     = COLORS[n.type] || '#fde8d8';
      const icolor = ICOLOR[n.type] || '#e65100';

      return `<div class="gx-notif-item ${isUnread ? 'gx-unread' : ''} ${n.link ? 'gx-clickable' : ''}"
                   ${n.link ? `onclick="window.location='${_esc(n.link)}'"` : ''}>
        <div class="gx-notif-icon" style="background:${bg};">
          <i class="fas ${icon}" style="color:${icolor};"></i>
        </div>
        <div class="gx-notif-body">
          <div class="gx-notif-title ${isUnread ? '' : 'gx-read'}">${_esc(n.title || '(No title)')}</div>
          <div class="gx-notif-msg">${_esc(n.body || '')}</div>
          ${n.link ? `<a class="gx-notif-link" href="${_esc(n.link)}" onclick="event.stopPropagation()">
            <i class="fas fa-external-link-alt" style="font-size:9px;"></i> View
          </a>` : ''}
          <div class="gx-notif-time"><i class="fas fa-clock" style="font-size:9px;margin-right:3px;"></i>${ts}</div>
        </div>
        ${isUnread ? '<div class="gx-unread-dot"></div>' : ''}
      </div>`;
    }).join('');
  }

  /* ─────────────────────────────────────────
     5. Dashboard widget
  ───────────────────────────────────────── */
  function _renderWidget() {
    const widget = document.getElementById('notif-widget-list');
    if (!widget) return;

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
      const bg       = COLORS[n.type] || '#fde8d8';
      const icolor   = ICOLOR[n.type] || '#e65100';
      const ts = n.createdAt?.toDate?.()?.toLocaleString('en-IN', {
        day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'
      }) || '';

      return `<div class="gx-widget-item ${isUnread ? 'gx-unread' : ''}"
                   onclick="${n.link ? `window.location='${_esc(n.link)}'` : 'GxNotifications.toggle(event)'}">
        <div style="width:32px;height:32px;border-radius:50%;background:${bg};flex-shrink:0;
                    display:flex;align-items:center;justify-content:center;">
          <i class="fas ${icon}" style="color:${icolor};font-size:13px;"></i>
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:${isUnread?'700':'600'};color:#1e293b;
                      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${_esc(n.title || '(No title)')}
          </div>
          <div style="font-size:12px;color:#64748b;margin-top:1px;
                      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${_esc(n.body || '')}
          </div>
          <div style="font-size:11px;color:#94a3b8;margin-top:2px;">${ts}</div>
        </div>
        ${isUnread ? '<div style="width:7px;height:7px;border-radius:50%;background:#e65100;flex-shrink:0;margin-top:4px;"></div>' : ''}
      </div>`;
    }).join('');
  }

  function _esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  /* ─────────────────────────────────────────
     Public API
  ───────────────────────────────────────── */
  window.GxNotifications = {
    init(user) {
      _user = user;
      _injectPanel();
      _load();
    },
    toggle(e) {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      if (!_panel) return;
      const open = _panel.style.display === 'flex';
      _panel.style.display = open ? 'none' : 'flex';
      if (!open) _panel.style.flexDirection = 'column';
    },
    close() { if (_panel) _panel.style.display = 'none'; },
    markAllRead() {
      localStorage.setItem('gx_notifs_seen', Math.floor(Date.now() / 1000));
      _updateBadge();
      _renderPanel();
      _renderWidget();
      if (typeof Utils !== 'undefined' && Utils.toast) Utils.toast('All notifications marked as read.', 'success');
    },
    reload() { _load(); },
  };

})();
