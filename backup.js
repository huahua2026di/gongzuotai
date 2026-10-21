// 云端自动备份：把手机里的任务/备忘/图片悄悄存一份到网上。
// 换手机、清缓存、不小心删了，都能一键恢复。断网时静默跳过，不打扰使用。
(function () {
  var API = window.__WB_BACKUP_API__ || '/api/backup';
  // 只有部署到正经网址（https）后才做云备份；本地局域网模式自动跳过，不打扰
  function enabled() {
    if (window.__WB_BACKUP_API__) return true;
    return location.protocol === 'https:';
  }
  var KEYS = [
    'wb_ec_tasks_v1',
    'wb_ec_img_v1',
    'wb_ec_memos_v1',
    'wb_ec_samples_v1',
    'wb_ec_seeded_v1',
    'wb_ec_today_hidden_v1',
    'wb_ec_memo_hidden_v1'
  ];
  var LS_LAST = 'wb_ec_last_backup';
  var LS_DEV = 'wb_ec_device_id';
  var LS_HASH = 'wb_ec_backup_hash';
  var INTERVAL = 20 * 60 * 60 * 1000; // 至少每隔 20 小时备份一次

  function ls(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {}
    return null;
  }
  function devId() {
    var d = ls(LS_DEV);
    if (!d) { d = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); ls(LS_DEV, d); }
    return d;
  }
  function collect() {
    var d = {};
    KEYS.forEach(function (k) { var v = ls(k); if (v != null) d[k] = v; });
    return d;
  }
  function hash(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
    return h;
  }
  function setStatus(text) {
    var el = document.getElementById('syncText');
    if (el) el.textContent = text;
  }
  function fmtTime(ts) {
    var d = new Date(ts);
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' +
      ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }
  function refreshStatus() {
    var t = Number(ls(LS_LAST) || 0);
    setStatus(t ? '已备份 ' + fmtTime(t) : '待备份');
  }

  function upload(manual) {
    if (!enabled()) { if (manual) window.__wbToast && window.__wbToast('云备份要在正式网址上才生效'); return Promise.resolve(false); }
    if (!navigator.onLine) { if (manual) window.__wbToast && window.__wbToast('现在没网，连上网会自动备份'); return Promise.resolve(false); }
    var payload = { dev: devId(), ts: Date.now(), data: collect() };
    setStatus('备份中…');
    return fetch(API + '/backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      ls(LS_LAST, String(Date.now()));
      ls(LS_HASH, String(hash(JSON.stringify(payload.data))));
      refreshStatus();
      if (manual) window.__wbToast && window.__wbToast('已备份到云端');
      return true;
    }).catch(function () {
      setStatus('备份失败');
      if (manual) window.__wbToast && window.__wbToast('备份失败，稍后再试');
      return false;
    });
  }

  function restore() {
    if (!enabled()) { window.__wbToast && window.__wbToast('云备份要在正式网址上才生效'); return; }
    if (!navigator.onLine) { window.__wbToast && window.__wbToast('连上网才能恢复'); return; }
    return fetch(API + '/backup?dev=' + encodeURIComponent(devId())).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    }).then(function (res) {
      if (!res || !res.data) { window.__wbToast && window.__wbToast('云端还没有备份'); return; }
      Object.keys(res.data).forEach(function (k) { ls(k, res.data[k]); });
      window.__wbToast && window.__wbToast('已恢复 ' + fmtTime(res.ts || Date.now()) + ' 的数据');
      setTimeout(function () { location.reload(); }, 800);
    }).catch(function () {
      window.__wbToast && window.__wbToast('没恢复成功，稍后再试');
    });
  }

  function maybeAuto() {
    if (!enabled()) return;
    var last = Number(ls(LS_LAST) || 0);
    if (Date.now() - last < INTERVAL) return;
    var data = collect();
    if (last && ls(LS_HASH) === String(hash(JSON.stringify(data)))) return; // 没改动就不用传
    upload(false);
  }

  window.addEventListener('load', function () {
    refreshStatus();
    if (!enabled()) setStatus('本地');
    setTimeout(maybeAuto, 3000);
    setInterval(maybeAuto, 5 * 60 * 1000);
    var badge = document.getElementById('syncStatus');
    if (badge) badge.addEventListener('click', function () { upload(true); });
    var rb = document.getElementById('btnRestore');
    if (rb) rb.addEventListener('click', function () {
      if (confirm('从云端恢复最近一次备份？会覆盖手机上现在的数据')) restore();
    });
  });

  window.__wbBackupNow = upload;
})();
