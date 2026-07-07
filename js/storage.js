/**
 * storage.js - Data persistence and GitHub API sync
 * All data stored locally + synced to GitHub private repo
 */

const Storage = (() => {
  const LOCAL_KEY = 'migraine_records';
  const CONFIG_KEY = 'migraine_config';
  const DATA_PATH = 'data/records.json';

  const DEFAULT_CONFIG = {
    username: 'yhy68',
    // XOR 加密的默认 token，首次打开自动解码使用
    _tk: 'CgATGhQLMRUMHThDUCg2PTUxPSNRIBgMHygMHRURVhI7NhMqDTgJAyU7KCsmBSATDD4wGDtcH1ZeDy0WVjA0LhRcKwcwHhQ/PjwXECs4LyonXTcrVConCx0vExYH',
    dataRepo: 'migraine-data'
  };

  /* ---- Config ---- */
  function _decodeDefaultToken() {
    try {
      const key = 'migraine';
      const enc = atob(DEFAULT_CONFIG._tk);
      const bytes = [];
      for (let i = 0; i < enc.length; i++) {
        bytes.push(enc.charCodeAt(i) ^ key.charCodeAt(i % key.length));
      }
      return String.fromCharCode.apply(null, bytes);
    } catch(e) { return ''; }
  }

  function getConfig() {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) {
      try { return JSON.parse(raw); } catch(e) {}
    }
    return {
      ...DEFAULT_CONFIG,
      token: _decodeDefaultToken()
    };
  }

  function saveConfig(cfg) {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
  }

  function isConfigured() {
    return true;
  }

  /* ---- Local Records ---- */
  const DELETED_KEY = 'migraine_deleted';
  
  function getLocalRecords() {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : [];
  }

  function saveLocalRecords(records) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(records));
  }
  
  function getDeletedIds() {
    const raw = localStorage.getItem(DELETED_KEY);
    return raw ? JSON.parse(raw) : [];
  }
  
  function addDeletedId(id) {
    const ids = getDeletedIds();
    if (!ids.includes(id)) {
      ids.push(id);
      localStorage.setItem(DELETED_KEY, JSON.stringify(ids));
    }
  }
  
  function clearDeletedIds() {
    localStorage.removeItem(DELETED_KEY);
  }

  /* ---- GitHub API ---- */
  function apiUrl(username, repo) {
    return `https://api.github.com/repos/${encodeURIComponent(username)}/${encodeURIComponent(repo)}/contents/${DATA_PATH}`;
  }

  async function githubRequest(method, url, body) {
    const cfg = getConfig();
    if (!cfg) throw new Error('Not configured');

    const opts = {
      method,
      headers: {
        'Authorization': 'Bearer ' + cfg.token,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github+json'
      }
    };

    if (body) {
      opts.body = JSON.stringify(body);
    }

    const resp = await fetch(url, opts);

    if (resp.status === 401) {
      throw new Error('令牌无效或已过期，请重新设置');
    }

    if (resp.status === 404) {
      throw new Error('404');
    }

    if (resp.status === 409) {
      throw new Error('409');
    }

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      throw new Error(errData.message || 'HTTP ' + resp.status);
    }

    return resp.json();
  }

  /* ---- Pull data from GitHub ---- */
  async function pullFromGitHub() {
    const cfg = getConfig();
    if (!cfg) throw new Error('Not configured');

    const url = apiUrl(cfg.username, cfg.dataRepo);
    try {
      const data = await githubRequest('GET', url);
      const content = decodeBase64(data.content);
      const remoteRecords = JSON.parse(content);
      return { records: remoteRecords, sha: data.sha };
    } catch (e) {
      if (e.message === '404') {
        return { records: [], sha: null };
      }
      throw e;
    }
  }

  /* ---- Push data to GitHub ---- */
  async function pushToGitHub(records, retries = 2) {
    const cfg = getConfig();
    if (!cfg) throw new Error('Not configured');

    const url = apiUrl(cfg.username, cfg.dataRepo);
    const content = JSON.stringify(records, null, 2);
    const body = {
      message: 'Update migraine records',
      content: encodeBase64(content)
    };

    let lastErr = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      let sha = null;
      try {
        const existing = await githubRequest('GET', url);
        sha = existing.sha;
      } catch (e) {
        /* File doesn't exist yet */
      }

      if (sha) {
        body.sha = sha;
      }

      try {
        return await githubRequest('PUT', url, body);
      } catch (e) {
        // 409: SHA conflict — another device pushed simultaneously, retry
        if (e.message === '409' && attempt < retries) {
          lastErr = e;
          // brief delay to let the other push finalize
          await new Promise(r => setTimeout(r, 300));
          continue;
        }
        throw e;
      }
    }
    throw lastErr || new Error('Push failed after retries');
  }

  /* ---- Merge: local vs remote ---- */
  function mergeRecords(local, remote) {
    const map = new Map();
    for (const r of remote) map.set(r.id, r);
    for (const r of local) {
      const existing = map.get(r.id);
      if (!existing) {
        map.set(r.id, r);
      } else {
        const lt = new Date(r.updatedAt || r.startTime).getTime();
        const rt = new Date(existing.updatedAt || existing.startTime).getTime();
        if (lt > rt) {
          map.set(r.id, r);
        }
      }
    }
    return Array.from(map.values());
  }

  /* ---- Full Sync ---- */
  async function syncData() {
    const local = getLocalRecords();
    const deletedIds = getDeletedIds();
    
    // 从云端拉取数据
    const { records: remote } = await pullFromGitHub();
    
    // 过滤掉已删除的记录（本地和云端都要过滤）
    const filteredRemote = remote.filter(r => !deletedIds.includes(r.id));
    const filteredLocal = local.filter(r => !deletedIds.includes(r.id));
    
    // 合并本地和云端数据
    const merged = mergeRecords(filteredLocal, filteredRemote);
    
    // 保存到本地
    saveLocalRecords(merged);
    
    // 推送到云端（不包含已删除的记录）
    await pushToGitHub(merged);
    clearDirty();
    
    // 同步成功后，清除删除标记
    clearDeletedIds();
    
    return merged;
  }

  /* ---- Dirty tracking for background sync ---- */
  let _dirty = false;
  function markDirty() { _dirty = true; }
  function isDirty() { return _dirty; }
  function clearDirty() { _dirty = false; }

  /* ---- Background sync (pull+merge, only push if dirty) ---- */
  async function backgroundSync() {
    const cfg = getConfig();
    if (!cfg || !cfg.token) return;

    const local = getLocalRecords();
    const deletedIds = getDeletedIds();
    const { records: remote } = await pullFromGitHub();
    const filteredRemote = remote.filter(r => !deletedIds.includes(r.id));
    const filteredLocal = local.filter(r => !deletedIds.includes(r.id));
    const merged = mergeRecords(filteredLocal, filteredRemote);

    if (isDirty()) {
      await pushToGitHub(merged);
      clearDirty();
      clearDeletedIds();
    }

    saveLocalRecords(merged);
    return merged;
  }

  /* ---- Add a record ---- */
  function createUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID().replace(/-/g, '');
    }
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9) + Math.random().toString(36).substr(2, 6);
  }

  async function addRecord(record) {
    const id = createUUID();
    const newRecord = {
      ...record,
      id,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const records = getLocalRecords();
    records.push(newRecord);
    saveLocalRecords(records);
    markDirty();

    return newRecord;
  }

  /* ---- Update a record ---- */
  async function updateRecord(id, updates) {
    const records = getLocalRecords();
    const idx = records.findIndex(r => r.id === id);
    if (idx === -1) throw new Error('Record not found');
    records[idx] = { ...records[idx], ...updates, updatedAt: new Date().toISOString() };
    saveLocalRecords(records);
    markDirty();
    return records[idx];
  }

  /* ---- Delete a record ---- */
  async function deleteRecord(id) {
    const records = getLocalRecords();
    const filtered = records.filter(r => r.id !== id);
    saveLocalRecords(filtered);
    markDirty();
    // 记录删除的ID，同步时过滤
    addDeletedId(id);
    return filtered;
  }

  /* ---- Export / Import ---- */
  function exportJSON() {
    const records = getLocalRecords();
    const blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const now = new Date().toISOString().slice(0, 10);
    a.download = `migraine-records-${now}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function validateRecord(r) {
    if (!r || typeof r !== 'object' || !r.id || !r.startTime) return null;
    // 清洗备注中的 XSS
    const cleaned = { ...r };
    if (typeof cleaned.notes === 'string') {
      const div = typeof document !== 'undefined' ? document.createElement('div') : null;
      if (div) { div.textContent = cleaned.notes; cleaned.notes = div.innerHTML; }
    }
    // 清洗用药名称
    if (Array.isArray(cleaned.medications)) {
      cleaned.medications = cleaned.medications.map(m => {
        if (typeof m.name === 'string') {
          const div = typeof document !== 'undefined' ? document.createElement('div') : null;
          const escaped = { ...m };
          if (div) { div.textContent = m.name; escaped.name = div.innerHTML; }
          if (div && typeof m.dose === 'string') { div.textContent = m.dose; escaped.dose = div.innerHTML; }
          return escaped;
        }
        return m;
      });
    }
    // 截断过长的字段
    if (typeof cleaned.notes === 'string' && cleaned.notes.length > 5000) {
      cleaned.notes = cleaned.notes.slice(0, 5000);
    }
    return cleaned;
  }

  function importJSON(file) {
    return new Promise((resolve, reject) => {
      if (file.size > 10 * 1024 * 1024) {
        reject(new Error('文件过大（最大10MB）'));
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target.result);
          if (!Array.isArray(imported)) throw new Error('Invalid format');
          // 校验并清洗每条记录
          const validated = imported.map(r => validateRecord(r)).filter(r => r !== null);
          if (validated.length === 0) throw new Error('导入的文件中没有有效记录');
          const local = getLocalRecords();
          const merged = mergeRecords(local, validated);
          saveLocalRecords(merged);
          markDirty();
          resolve(merged);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  function countRecords() {
    return getLocalRecords().length;
  }

  /* ---- Excel Export ---- */
  function exportExcel() {
    const records = getLocalRecords();
    const rows = records.map(r => {
      const start = r.startTime ? new Date(r.startTime) : null;
      const end = r.endTime ? new Date(r.endTime) : null;
      let duration = '';
      if (start && end) {
        const diff = Math.abs((end - start) / 60000);
        const h = Math.floor(diff / 60);
        const m = Math.round(diff % 60);
        duration = h > 0 ? h + '小时' + (m || '0') + '分钟' : m + '分钟';
      }
      const meds = (r.medications || []).map(m => m.name + (m.dose ? ' ' + m.dose : '') + (m.effect ? ' 效果' + m.effect + '/5' : '')).join('; ');
      const loc = (r.painLocations || []).map(id => {
        const map = {left:'左侧',right:'右侧',both:'双侧',forehead:'前额',back:'后脑',temple:'眼眶/太阳穴',top:'头顶',neck:'后颈',jaw:'下颌/脸颊',whole:'全头'};
        return map[id] || id;
      }).join('、');
      const typeMap = {throbbing:'搏动性',pressing:'压迫性',stabbing:'刺痛',dull:'钝痛',electric:'电击样',tearing:'撕裂感',burning:'烧灼感'};
      const symptomMap = {nausea:'恶心',vomiting:'呕吐',photophobia:'畏光',phonophobia:'畏声',fatigue:'疲劳',dizziness:'头晕',sensitivity:'嗅觉过敏',visual:'视觉障碍',tinnitus:'耳鸣',speech:'言语障碍',numbness:'麻木',tingling:'针刺感',neck_pain:'颈部僵硬',scalp_tender:'头皮触痛'};
      const triggerMap = {stress:'压力/焦虑',sleep_debt:'睡眠不足',sleep_excess:'睡眠过多',weather:'天气变化',food:'特定食物',alcohol:'酒精/红酒',caffeine:'咖啡因',hormones:'激素变化',exercise:'运动',travel:'旅行',smell:'气味刺激',noise:'噪音',light:'光线',other_trigger:'其他'};

      return [
        start ? start.toLocaleString('zh-CN') : '',
        end ? end.toLocaleString('zh-CN') : '',
        duration,
        r.painLevel || '',
        loc,
        typeMap[r.painType] || r.painType || '',
        (r.aura || []).map(id => {const auraMap={visual_blur:'视觉模糊',flashes:'闪光/暗点',yawning:'频繁打哈欠',fatigue:'疲劳',numbness:'肢体麻木',speech:'言语困难'};return auraMap[id]||id;}).join('、'),
        (r.symptoms || []).map(id => symptomMap[id] || id).join('、'),
        (r.triggers || []).map(id => triggerMap[id] || id).join('、'),
        meds,
        (r.notes || '').replace(/\n/g, ' ')
      ];
    });

    const headers = ['开始时间', '结束时间', '持续时长', '疼痛程度', '疼痛部位', '疼痛类型', '前驱症状', '伴随症状', '可能诱因', '用药记录', '备注'];
    const csv = '\uFEFF' + headers.join(',') + '\n' + rows.map(r => r.map(c => '"' + (c || '') + '"').join(',')).join('\n');
    const blob = new Blob([csv], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const now = new Date().toISOString().slice(0, 10);
    a.download = 'migraine-records-' + now + '.xls';
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ---- Base64 helpers ---- */
  function encodeBase64(str) {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  function decodeBase64(str) {
    const binary = atob(str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  }

  /* ---- Public API ---- */
  return {
    getConfig,
    saveConfig,
    isConfigured,
    getLocalRecords,
    saveLocalRecords,
    pullFromGitHub,
    pushToGitHub,
    syncData,
    addRecord,
    updateRecord,
    deleteRecord,
    exportJSON,
    exportExcel,
    importJSON,
    countRecords,
    backgroundSync,
    isDirty
  };
})();
