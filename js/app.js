/**
 * app.js - Main application logic for Migraine Tracker
 */

const App = (() => {
  /* ---- Constants: trigger/symptom/medication presets ---- */
  const PAIN_LOCATIONS = [
    { id: 'left', label: '左侧' },
    { id: 'right', label: '右侧' },
    { id: 'both', label: '双侧' },
    { id: 'forehead', label: '前额' },
    { id: 'back', label: '后脑' },
    { id: 'temple', label: '眼眶/太阳穴' },
    { id: 'top', label: '头顶' },
    { id: 'neck', label: '后颈' },
    { id: 'jaw', label: '下颌/脸颊' },
    { id: 'whole', label: '全头' }
  ];

  const PAIN_TYPES = [
    { id: 'throbbing', label: '搏动性' },
    { id: 'pressing', label: '压迫性' },
    { id: 'stabbing', label: '刺痛' },
    { id: 'dull', label: '钝痛' },
    { id: 'electric', label: '电击样' },
    { id: 'tearing', label: '撕裂感' },
    { id: 'burning', label: '烧灼感' }
  ];

  const AURA_OPTIONS = [
    { id: 'visual_blur', label: '视觉模糊' },
    { id: 'flashes', label: '闪光/暗点' },
    { id: 'yawning', label: '频繁打哈欠' },
    { id: 'fatigue', label: '疲劳' },
    { id: 'numbness', label: '肢体麻木' },
    { id: 'speech', label: '言语困难' }
  ];

  const SYMPTOM_OPTIONS = [
    { id: 'nausea', label: '恶心' },
    { id: 'vomiting', label: '呕吐' },
    { id: 'photophobia', label: '畏光' },
    { id: 'phonophobia', label: '畏声' },
    { id: 'dizziness', label: '头晕' },
    { id: 'neck_pain', label: '颈部僵硬' },
    { id: 'scalp_tender', label: '头皮触痛' }
  ];

  const TRIGGER_OPTIONS = [
    { id: 'stress', label: '压力/焦虑' },
    { id: 'sleep_debt', label: '睡眠不足' },
    { id: 'sleep_excess', label: '睡眠过多' },
    { id: 'weather', label: '天气变化' },
    { id: 'food', label: '特定食物' },
    { id: 'alcohol', label: '酒精/红酒' },
    { id: 'caffeine', label: '咖啡因' },
    { id: 'hunger', label: '饥饿/不规律进食' },
    { id: 'light', label: '强光/闪烁' },
    { id: 'smell', label: '刺激性气味' },
    { id: 'noise', label: '噪音' },
    { id: 'hormone', label: '经期/激素' },
    { id: 'ovulation', label: '排卵期' },
    { id: 'screen', label: '屏幕时间过长' },
    { id: 'posture', label: '姿势/颈椎问题' },
    { id: 'dehydration', label: '脱水/饮水不足' },
    { id: 'exercise', label: '剧烈运动' },
    { id: 'chocolate', label: '巧克力/奶酪' },
    { id: 'aircon', label: '空调/冷风直吹' },
    { id: 'mood_swing', label: '情绪波动' },
    { id: 'altitude', label: '气压/海拔变化' }
  ];

  const MED_PRESETS = [
    '喜适美（佐米曲普坦口腔崩解片）', '舒马曲坦', '利扎曲普坦', '那拉曲坦', '依来曲普坦',
    '布洛芬', '散利痛', '对乙酰氨基酚', '萘普生'
  ];

  const MY_MED = { name: '喜适美（佐米曲普坦口腔崩解片）', dose: '2.5mg' };

  /* ---- State ---- */
  let currentTab = 'record';
  let editingId = null;

  /* ---- Init ---- */
  function init() {
    initTheme();
    renderHeader();
    loadMainUI();
    tryAutoSync();
    switchTab('record');
  }
  
  /* ---- Theme Management ---- */
  function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);
  }
  
  function applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.body.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      document.body.removeAttribute('data-theme');
    }
    localStorage.setItem('theme', theme);
  }
  
  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
    showToast(`已切换到${newTheme === 'dark' ? '深色' : '浅色'}模式`, 'success');
  }

  /* ---- Auto Sync ---- */
  async function tryAutoSync() {
    updateSyncStatus('syncing');
    try {
      await Storage.syncData();
      updateSyncStatus('synced');
    } catch (e) {
      console.error('Sync failed:', e);
      updateSyncStatus('error');
      showToast('同步失败: ' + e.message, 'error');
    }
  }

  function updateSyncStatus(status) {
    const dot = document.querySelector('#sync-dot');
    const text = document.querySelector('#sync-text');
    if (!dot || !text) return;
    dot.className = 'dot ' + status;
    const msgs = {
      synced: '已同步',
      syncing: '同步中...',
      error: '同步失败'
    };
    text.textContent = msgs[status] || status;
  }

  /* ---- Main UI ---- */
  function loadMainUI() {
    const app = document.getElementById('app');
    app.innerHTML = `
      ${renderPrivacyBanner()}
      <div class="tab-nav">
        <button class="tab-btn active" data-tab="record" onclick="App.switchTab('record')">记录发作</button>
        <button class="tab-btn" data-tab="history" onclick="App.switchTab('history')">历史记录</button>
        <button class="tab-btn" data-tab="backup" onclick="App.switchTab('backup')">备份与设置</button>
      </div>
      <div id="tab-content"></div>
    `;
    switchTab('record');
  }

  function renderPrivacyBanner() {
    const dismissed = localStorage.getItem('privacy_dismissed');
    if (dismissed) return '';
    return `
      <div class="privacy-banner" id="privacy-banner">
        <span class="icon">&#x1F512;</span>
        <span class="text">你的偏头痛记录仅保存在浏览器本地和你的私有 GitHub 仓库中。本工具不会收集或上传任何个人信息。</span>
        <button class="dismiss" onclick="App.dismissPrivacy()">&#x2715;</button>
      </div>
    `;
  }

  function dismissPrivacy() {
    localStorage.setItem('privacy_dismissed', '1');
    const banner = document.getElementById('privacy-banner');
    if (banner) banner.remove();
  }

  /* ---- Tab Switching ---- */
  function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    const content = document.getElementById('tab-content');
    if (!content) return;

    switch (tab) {
      case 'record': renderRecordForm(content); break;
      case 'history': renderHistory(content); break;
      case 'backup': renderBackup(content); break;
    }
  }

  /* ---- Record Form ---- */
  function renderRecordForm(container) {
    const now = new Date();
    const isoNow = toDateTimeLocal(now);
    const isoOneHourLater = toDateTimeLocal(new Date(now.getTime() + 3600000));

    container.innerHTML = `
      <div class="card">
        <div class="section-title">
          <svg width="28" height="24" viewBox="0 0 28 24"><ellipse cx="8" cy="16" rx="7" ry="5" fill="white" stroke="#B8DDF0" stroke-width="1"/><ellipse cx="18" cy="14" rx="7" ry="5" fill="white" stroke="#B8DDF0" stroke-width="1"/><ellipse cx="13" cy="11" rx="10" ry="8" fill="white" stroke="#B8DDF0" stroke-width="1"/><circle cx="10" cy="10" r="1.5" fill="#5BA4CF"/><circle cx="15" cy="10" r="1.5" fill="#5BA4CF"/><ellipse cx="12.5" cy="14" rx="2" ry="1.3" fill="#F2A5B5"/></svg>
          ${editingId ? '编辑记录' : '记录发作'}
        </div>

        <div class="form-group">
          <label class="form-label">发作时间</label>
          <div class="datetime-row">
            <input type="datetime-local" id="rec-start" value="${isoNow}" step="60">
            <span class="datetime-separator">至</span>
            <input type="datetime-local" id="rec-end" value="${isoOneHourLater}" step="60">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">疼痛程度 <span class="form-hint">1=轻微 10=无法忍受</span></label>
          <div class="pain-level-group" id="pain-level-group">
            ${Array.from({length:10}, (_,i) => i+1).map(n => {
              let cls = n<=2?'level1':n<=4?'level2':n<=6?'level3':n<=8?'level4':'level5';
              return `<button class="pain-btn ${cls}" data-level="${n}" onclick="App.selectPainLevel(this)">${n}</button>`;
            }).join('')}
          </div>
          <div class="pain-scale-labels">
            <span style="color:var(--pain-1-2)">轻度</span><span style="color:var(--pain-3-4)">中度</span><span style="color:var(--pain-5-6)">较重</span><span style="color:var(--pain-7-8)">重度</span><span style="color:var(--pain-9-10)">剧烈</span>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">疼痛部位</label>
          <div class="chip-group" id="pain-location-group">
            ${PAIN_LOCATIONS.map(l => `<button class="chip" data-id="${l.id}" onclick="App.toggleChip(this)">${l.label}</button>`).join('')}
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">疼痛类型</label>
          <div class="radio-chips" id="pain-type-group">
            ${PAIN_TYPES.map(t => `<button class="radio-chip" data-id="${t.id}" onclick="App.selectRadio(this,'pain-type-group')">${t.label}</button>`).join('')}
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">用药记录 <span class="form-hint">默认喜适美 2.5mg</span></label>
          <div id="medications-container">
            ${renderMedRow()}
          </div>
          <button class="btn-add-med" style="margin-top:8px;" onclick="App.addMedRow()">+ 添加其他用药</button>
        </div>

        <div class="form-group">
          <label class="form-label">可能的诱因</label>
          <div class="chip-group" id="trigger-group">
            ${TRIGGER_OPTIONS.slice(0,6).map(t => `<button class="chip" data-id="${t.id}" onclick="App.toggleChip(this)">${t.label}</button>`).join('')}
          </div>
        </div>

        <button class="btn-more" onclick="App.toggleMoreDetails()" id="btn-more-details">+ 更多细节（症状、备注等）</button>

        <div id="more-details" style="display:none;">
          <div class="form-group">
            <label class="form-label">前驱症状</label>
            <div class="chip-group" id="aura-group">
              ${AURA_OPTIONS.map(a => `<button class="chip" data-id="${a.id}" onclick="App.toggleChip(this)">${a.label}</button>`).join('')}
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">伴随症状</label>
            <div class="chip-group" id="symptom-group">
              ${SYMPTOM_OPTIONS.map(s => `<button class="chip" data-id="${s.id}" onclick="App.toggleChip(this)">${s.label}</button>`).join('')}
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">其他诱因</label>
            <div class="chip-group" id="trigger-group-extra">
              ${TRIGGER_OPTIONS.slice(6).map(t => `<button class="chip" data-id="${t.id}" onclick="App.toggleChip(this)">${t.label}</button>`).join('')}
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">备注</label>
            <textarea class="form-textarea" id="rec-notes" placeholder="特殊饮食、天气、经期、情绪变化等..."></textarea>
          </div>
        </div>

        <button class="btn btn-primary" onclick="App.submitRecord()" style="margin-top:4px;">
          ${editingId ? '保存修改' : '保存记录'}
        </button>
        ${editingId ? `<button class="btn btn-secondary" onclick="App.cancelEdit()" style="margin-top:8px;margin-left:8px;">取消编辑</button>` : ''}
      </div>
    `;

    if (editingId) {
      prefillForm(editingId);
    }
  }

  function renderMedRow(data) {
    const idx = Math.random().toString(36).substr(2, 4);
    const d = data || MY_MED;
    const selected = d.name || MY_MED.name;
    return `
      <div class="med-row" data-med-row="${idx}">
        <select class="med-name" onchange="App.onMedSelect(this)">
          <option value="">选择药品...</option>
          ${MED_PRESETS.map(m => `<option value="${m}" ${m===selected?'selected':''}>${m}</option>`).join('')}
          <option value="__custom__">其他（手动输入）</option>
        </select>
        <input class="med-dose" placeholder="剂量" value="${d.dose || ''}" autocomplete="off">
        <input class="med-time" type="time" value="${d.time || ''}">
        <select class="med-effect">
          <option value="0" ${d.effect===0?'selected':''}>效果?</option>
          <option value="1" ${d.effect===1?'selected':''}>&#9733; 无效</option>
          <option value="2" ${d.effect===2?'selected':''}>&#9733;&#9733; 轻微</option>
          <option value="3" ${d.effect===3?'selected':''}>&#9733;&#9733;&#9733; 有效</option>
          <option value="4" ${d.effect===4?'selected':''}>&#9733;&#9733;&#9733;&#9733; 显效</option>
          <option value="5" ${d.effect===5?'selected':''}>&#9733;&#9733;&#9733;&#9733;&#9733; 显著</option>
        </select>
        <button class="btn-remove-med" onclick="App.removeMedRow(this)" title="删除">&#x2715;</button>
      </div>
    `;
  }

  function onMedSelect(select) {
    if (select.value === '__custom__') {
      const input = document.createElement('input');
      input.className = 'med-name';
      input.type = 'text';
      input.placeholder = '输入药名...';
      input.autocomplete = 'off';
      input.style.cssText = 'flex:2;min-width:100px;padding:8px 10px;border-radius:6px;border:1.5px solid var(--border);background:var(--bg-card);color:var(--text);font-size:13px;';
      select.replaceWith(input);
      input.focus();
    }
  }

  function addMedRow() {
    const container = document.getElementById('medications-container');
    const div = document.createElement('div');
    div.innerHTML = renderMedRow();
    container.appendChild(div.firstElementChild);
  }

  function removeMedRow(btn) {
    const row = btn.closest('.med-row');
    if (row) row.remove();
  }

  /* ---- Chip/Select Interactions ---- */
  function selectPainLevel(btn) {
    const group = document.getElementById('pain-level-group');
    group.querySelectorAll('.pain-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  }

  function toggleChip(btn) {
    btn.classList.toggle('selected');
  }

  function selectRadio(btn, groupId) {
    const group = document.getElementById(groupId);
    if (!group) return;
    group.querySelectorAll('.radio-chip').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  }

  /* ---- Prefill form for editing ---- */
  function prefillForm(id) {
    const records = Storage.getLocalRecords();
    const r = records.find(rec => rec.id === id);
    if (!r) return;

    document.getElementById('rec-start').value = r.startTime ? toDateTimeLocal(new Date(r.startTime)) : '';
    document.getElementById('rec-end').value = r.endTime ? toDateTimeLocal(new Date(r.endTime)) : '';

    if (r.painLevel) {
      const btn = document.querySelector(`.pain-btn[data-level="${r.painLevel}"]`);
      if (btn) selectPainLevel(btn);
    }

    if (r.painLocations) {
      r.painLocations.forEach(loc => {
        const chip = document.querySelector(`#pain-location-group .chip[data-id="${loc}"]`);
        if (chip) chip.classList.add('selected');
      });
    }

    if (r.painType) {
      const chip = document.querySelector(`#pain-type-group .radio-chip[data-id="${r.painType}"]`);
      if (chip) selectRadio(chip, 'pain-type-group');
    }

    if (r.aura) r.aura.forEach(a => toggleById('#aura-group', a));
    if (r.symptoms) r.symptoms.forEach(s => toggleById('#symptom-group', s));
    if (r.triggers) {
      const mainTriggers = TRIGGER_OPTIONS.slice(0, 6).map(t => t.id);
      r.triggers.filter(t => mainTriggers.includes(t)).forEach(t => toggleById('#trigger-group', t));
      r.triggers.filter(t => !mainTriggers.includes(t)).forEach(t => toggleById('#trigger-group-extra', t));
    }

    const hasExtra = (r.aura && r.aura.length > 0) ||
      (r.symptoms && r.symptoms.length > 0) ||
      (r.triggers && r.triggers.some(t => !TRIGGER_OPTIONS.slice(0, 6).map(x => x.id).includes(t))) ||
      (r.notes && r.notes.trim());

    if (hasExtra) {
      const more = document.getElementById('more-details');
      const btn = document.getElementById('btn-more-details');
      if (more) more.style.display = 'block';
      if (btn) btn.textContent = '- 收起细节';
    }

    if (r.medications && r.medications.length > 0) {
      const container = document.getElementById('medications-container');
      container.innerHTML = '';
      r.medications.forEach(m => {
        const div = document.createElement('div');
        div.innerHTML = renderMedRow(m);
        container.appendChild(div.firstElementChild);
      });
    }

    if (r.notes) {
      document.getElementById('rec-notes').value = r.notes;
    }
  }

  function toggleById(groupId, id) {
    const chip = document.querySelector(`${groupId} .chip[data-id="${id}"]`);
    if (chip) chip.classList.add('selected');
  }

  function toggleMoreDetails() {
    const more = document.getElementById('more-details');
    const btn = document.getElementById('btn-more-details');
    if (more.style.display === 'none') {
      more.style.display = 'block';
      btn.textContent = '- 收起细节';
    } else {
      more.style.display = 'none';
      btn.textContent = '+ 更多细节（症状、备注等）';
    }
  }

  /* ---- Submit Record ---- */
  async function submitRecord() {
    const startTime = document.getElementById('rec-start').value;
    const endTime = document.getElementById('rec-end').value;
    const painBtn = document.querySelector('.pain-btn.selected');
    const notes = document.getElementById('rec-notes').value.trim();

    if (!startTime) { showToast('请选择发作开始时间', 'error'); return; }
    if (!painBtn) { showToast('请选择疼痛程度', 'error'); return; }

    if (endTime && new Date(endTime) <= new Date(startTime)) {
      showToast('结束时间必须晚于开始时间', 'error');
      return;
    }

    const painLevel = parseInt(painBtn.dataset.level);
    const painLocations = getSelectedIds('#pain-location-group .chip');
    const painType = getSelectedId('#pain-type-group .radio-chip');
    const aura = getSelectedIds('#aura-group .chip');
    const symptoms = getSelectedIds('#symptom-group .chip');
    const triggers = [
      ...getSelectedIds('#trigger-group .chip'),
      ...getSelectedIds('#trigger-group-extra .chip')
    ];
    const medications = collectMedications();

    const record = {
      startTime: startTime + ':00',
      endTime: endTime ? endTime + ':00' : null,
      painLevel,
      painLocations,
      painType: painType || null,
      aura,
      symptoms,
      triggers,
      medications,
      notes
    };

    try {
      if (editingId) {
        await Storage.updateRecord(editingId, record);
        editingId = null;
        showToast('记录已更新', 'success');
      } else {
        await Storage.addRecord(record);
        showToast('记录已保存', 'success');
      }

      const autoSync = localStorage.getItem('auto_sync') !== '0';
      if (autoSync) {
        try {
          await Storage.syncData();
          updateSyncStatus('synced');
        } catch (e) {
          updateSyncStatus('error');
          showToast('本地已保存，同步失败（下次联网自动重试）', 'info');
        }
      }

      const container = document.getElementById('tab-content');
      renderRecordForm(container);
    } catch (e) {
      showToast('保存失败: ' + e.message, 'error');
    }
  }

  function cancelEdit() {
    editingId = null;
    const container = document.getElementById('tab-content');
    renderRecordForm(container);
  }

  function getSelectedIds(selector) {
    return Array.from(document.querySelectorAll(selector + '.selected')).map(c => c.dataset.id);
  }

  function getSelectedId(selector) {
    const el = document.querySelector(selector + '.selected');
    return el ? el.dataset.id : null;
  }

  function collectMedications() {
    const rows = document.querySelectorAll('.med-row');
    const meds = [];
    rows.forEach(row => {
      const name = row.querySelector('.med-name').value.trim();
      const dose = row.querySelector('.med-dose').value.trim();
      const time = row.querySelector('.med-time').value;
      const effect = parseInt(row.querySelector('.med-effect').value);
      if (name) {
        meds.push({ name, dose: dose || null, time, effect: effect || null });
      }
    });
    return meds;
  }

  /* ---- History ---- */
  function renderHistory(container) {
    const records = Storage.getLocalRecords().sort((a, b) =>
      new Date(b.startTime) - new Date(a.startTime)
    );

    container.innerHTML = `
      <div class="card">
        <div class="section-title">
          <svg width="22" height="20" viewBox="0 0 22 20"><ellipse cx="6" cy="13" rx="6" ry="4" fill="white" stroke="#B8DDF0" stroke-width="0.8"/><ellipse cx="14" cy="12" rx="6" ry="4" fill="white" stroke="#B8DDF0" stroke-width="0.8"/><ellipse cx="10" cy="9" rx="8" ry="6" fill="white" stroke="#B8DDF0" stroke-width="0.8"/><circle cx="7" cy="8" r="1.2" fill="#5BA4CF"/><circle cx="12" cy="8" r="1.2" fill="#5BA4CF"/><ellipse cx="9.5" cy="11" rx="1.5" ry="1" fill="#F2A5B5"/></svg>
          历史记录
        </div>
        <div class="history-controls">
          <select id="hist-filter" onchange="App.applyHistoryFilter()">
            <option value="all">全部记录</option>
            <option value="7">最近7天</option>
            <option value="30">最近30天</option>
            <option value="90">最近90天</option>
          </select>
          <input type="text" id="hist-search" placeholder="搜索备注..." oninput="App.applyHistoryFilter()" autocomplete="off">
          <span class="history-count" id="hist-count">${records.length} 条记录</span>
        </div>
        <div id="history-list">${renderHistoryList(records)}</div>
      </div>
    `;
  }

  function renderHistoryList(records) {
    if (records.length === 0) {
      return `<div class="empty-state"><span class="empty-icon">&#x1F4CB;</span><p>还没有记录</p><p style="font-size:12px;">切换到"记录发作"页面开始记录</p></div>`;
    }

    return records.map(r => `
      <div class="record-card" id="rc-${r.id}" onclick="App.toggleRecordDetail('${r.id}')">
        <div class="rc-header">
          <div>
            <div class="rc-date">${formatDate(r.startTime)}</div>
            ${r.endTime ? `<div style="font-size:12px;color:var(--text-secondary);">持续 ${calcDuration(r.startTime, r.endTime)}</div>` : ''}
          </div>
          <span class="rc-pain ${getPainClass(r.painLevel)}">${r.painLevel}</span>
        </div>
        <div class="rc-tags">
          ${(r.painLocations||[]).map(l => `<span class="rc-tag">${getLocationLabel(l)}</span>`).join('')}
          ${(r.triggers||[]).slice(0,2).map(t => `<span class="rc-tag">${getTriggerLabel(t)}</span>`).join('')}
          ${r.medications&&r.medications.length>0 ? `<span class="rc-tag">用药: ${r.medications.map(m=>m.name).join(',')}</span>` : ''}
        </div>
        <div class="rc-detail">
          ${r.painType ? `<div>类型: ${getPainTypeLabel(r.painType)}</div>` : ''}
          ${r.aura&&r.aura.length>0 ? `<div>前驱: ${r.aura.map(a=>getAuraLabel(a)).join('、')}</div>` : ''}
          ${r.symptoms&&r.symptoms.length>0 ? `<div>症状: ${r.symptoms.map(s=>getSymptomLabel(s)).join('、')}</div>` : ''}
          ${r.triggers&&r.triggers.length>0 ? `<div>诱因: ${r.triggers.map(t=>getTriggerLabel(t)).join('、')}</div>` : ''}
          ${r.medications&&r.medications.length>0 ? `<div>用药: ${r.medications.map(m=>`${m.name} ${m.dose||''} ${m.time||''} ${m.effect?'效果'+(m.effect)+'/5':''}`).join('; ')}</div>` : ''}
          ${r.notes ? `<div style="margin-top:4px;padding:8px;background:var(--bg);border-radius:6px;">备注: ${escapeHtml(r.notes)}</div>` : ''}
          <div class="rc-actions" onclick="event.stopPropagation()">
            <button class="btn btn-sm btn-secondary" onclick="App.editRecord('${r.id}')">编辑</button>
            <button class="btn btn-sm btn-danger" onclick="App.confirmDelete('${r.id}')">删除</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  function toggleRecordDetail(id) {
    const card = document.getElementById('rc-' + id);
    if (!card) return;
    card.classList.toggle('expanded');
  }

  function applyHistoryFilter() {
    const filter = document.getElementById('hist-filter').value;
    const search = (document.getElementById('hist-search').value || '').toLowerCase();
    let records = Storage.getLocalRecords();

    if (filter !== 'all') {
      const days = parseInt(filter);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      records = records.filter(r => new Date(r.startTime) >= cutoff);
    }

    if (search) {
      records = records.filter(r => (r.notes || '').toLowerCase().includes(search));
    }

    records.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

    document.getElementById('history-list').innerHTML = renderHistoryList(records);
    document.getElementById('hist-count').textContent = records.length + ' 条记录';
  }

  function editRecord(id) {
    editingId = id;
    switchTab('record');
  }

  function confirmDelete(id) {
    if (confirm('确定要删除这条记录吗？此操作不可撤销。')) {
      Storage.deleteRecord(id);
      showToast('记录已删除', 'success');
      applyHistoryFilter();
    }
  }

  /* ---- Backup & Settings ---- */
  function renderBackup(container) {
    const count = Storage.countRecords();
    container.innerHTML = `
      <div class="card backup-section">
        <div class="section-title">
          <svg width="22" height="20" viewBox="0 0 22 20"><ellipse cx="6" cy="13" rx="6" ry="4" fill="white" stroke="#B8DDF0" stroke-width="0.8"/><ellipse cx="14" cy="12" rx="6" ry="4" fill="white" stroke="#B8DDF0" stroke-width="0.8"/><ellipse cx="10" cy="9" rx="8" ry="6" fill="white" stroke="#B8DDF0" stroke-width="0.8"/><circle cx="7" cy="8" r="1.2" fill="#5BA4CF"/><circle cx="12" cy="8" r="1.2" fill="#5BA4CF"/><ellipse cx="9.5" cy="11" rx="1.5" ry="1" fill="#F2A5B5"/></svg>
          数据备份
        </div>
        <p>当前共有 <strong>${count}</strong> 条记录。导出的 JSON 文件可跨设备导入，也可作为安全备份。</p>
        <div class="backup-actions">
          <button class="btn btn-primary" style="width:auto" onclick="Storage.exportJSON();App.showToast('已导出','success')">导出 JSON</button>
          <button class="btn btn-primary" style="width:auto;background:linear-gradient(135deg,#58D68D,#2ECC71)" onclick="Storage.exportExcel();App.showToast('已导出 Excel','success')">导出 Excel</button>
          <button class="btn btn-secondary" style="width:auto" onclick="document.getElementById('import-file').click()">导入 JSON 文件</button>
          <input type="file" id="import-file" accept=".json" style="display:none" onchange="App.handleImport(this)">
        </div>
      </div>

      <div class="card backup-section">
        <div class="section-title">
          <svg width="22" height="20" viewBox="0 0 22 20"><ellipse cx="6" cy="13" rx="6" ry="4" fill="white" stroke="#B8DDF0" stroke-width="0.8"/><ellipse cx="14" cy="12" rx="6" ry="4" fill="white" stroke="#B8DDF0" stroke-width="0.8"/><ellipse cx="10" cy="9" rx="8" ry="6" fill="white" stroke="#B8DDF0" stroke-width="0.8"/><circle cx="7" cy="8" r="1.2" fill="#5BA4CF"/><circle cx="12" cy="8" r="1.2" fill="#5BA4CF"/><ellipse cx="9.5" cy="11" rx="1.5" ry="1" fill="#F2A5B5"/></svg>
          手动同步
        </div>
        <p>将本地记录与 GitHub 私有仓库同步。</p>
        <div class="backup-actions">
          <button class="btn btn-secondary" style="width:auto" id="btn-sync" onclick="App.manualSync()">立即同步</button>
        </div>
      </div>

      <div class="card backup-section">
        <div class="section-title">
          <svg width="22" height="20" viewBox="0 0 22 20"><ellipse cx="6" cy="13" rx="6" ry="4" fill="white" stroke="#B8DDF0" stroke-width="0.8"/><ellipse cx="14" cy="12" rx="6" ry="4" fill="white" stroke="#B8DDF0" stroke-width="0.8"/><ellipse cx="10" cy="9" rx="8" ry="6" fill="white" stroke="#B8DDF0" stroke-width="0.8"/><circle cx="7" cy="8" r="1.2" fill="#5BA4CF"/><circle cx="12" cy="8" r="1.2" fill="#5BA4CF"/><ellipse cx="9.5" cy="11" rx="1.5" ry="1" fill="#F2A5B5"/></svg>
          设置
        </div>
        <div class="settings-section">
          <div class="settings-item">
            <label>🌙 深色模式</label>
            <button class="btn btn-sm btn-secondary" onclick="App.toggleTheme()">
              切换主题
            </button>
          </div>
          <div class="settings-item">
            <label>自动同步（保存后同步到 GitHub）</label>
            <label class="toggle">
              <input type="checkbox" id="auto-sync-toggle" checked onchange="App.toggleAutoSync(this)">
              <span class="slider"></span>
            </label>
          </div>
          <div class="settings-item">
            <label>隐私声明</label>
            <button class="btn btn-sm btn-secondary" onclick="localStorage.removeItem('privacy_dismissed');location.reload()">重新显示</button>
          </div>
        </div>
        <div style="font-size:12px;color:var(--text-secondary);margin-top:12px;">
          数据仓库: yhy68/migraine-data
        </div>
      </div>
    `;
  }

  async function manualSync() {
    const btn = document.getElementById('btn-sync');
    btn.textContent = '同步中...';
    btn.disabled = true;
    updateSyncStatus('syncing');

    try {
      await Storage.syncData();
      updateSyncStatus('synced');
      showToast('同步成功', 'success');
    } catch (e) {
      updateSyncStatus('error');
      showToast('同步失败: ' + e.message, 'error');
    }

    btn.textContent = '立即同步';
    btn.disabled = false;
  }

  async function handleImport(input) {
    try {
      const merged = await Storage.importJSON(input.files[0]);
      showToast(`已导入，合并后共 ${merged.length} 条记录`, 'success');
      try {
        await Storage.pushToGitHub(merged);
        updateSyncStatus('synced');
      } catch(e) {
        updateSyncStatus('error');
      }
    } catch (e) {
      showToast('导入失败: 文件格式不正确', 'error');
    }
    input.value = '';
  }

  function toggleAutoSync(toggle) {
    localStorage.setItem('auto_sync', toggle.checked ? '1' : '0');
  }

  /* ---- Header ---- */
  function renderHeader() {
    const header = document.getElementById('header');
    header.innerHTML = `
      <svg class="mascot-icon" width="80" height="72" viewBox="0 0 80 72" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="22" cy="48" rx="16" ry="11" fill="white" stroke="#B8DDF0" stroke-width="1.2"/>
        <ellipse cx="40" cy="40" rx="22" ry="16" fill="white" stroke="#B8DDF0" stroke-width="1.5"/>
        <ellipse cx="58" cy="46" rx="16" ry="11" fill="white" stroke="#B8DDF0" stroke-width="1.2"/>
        <circle cx="32" cy="40" r="3.5" fill="#5BA4CF"/>
        <circle cx="48" cy="40" r="3.5" fill="#5BA4CF"/>
        <circle cx="33" cy="39" r="1.2" fill="white"/>
        <circle cx="49" cy="39" r="1.2" fill="white"/>
        <ellipse cx="40" cy="47" rx="5" ry="3.5" fill="#F2A5B5"/>
        <path d="M36 51 Q40 55 44 51" fill="none" stroke="#5BA4CF" stroke-width="1" stroke-linecap="round"/>
      </svg>
      <h1>偏头痛记录</h1>
      <div class="subtitle">追踪每一次发作，找到你的规律</div>
      <div class="sync-indicator">
        <span class="dot" id="sync-dot"></span>
        <span id="sync-text">已配置</span>
      </div>
    `;
    updateSyncStatus('synced');
  }

  /* ---- Toast ---- */
  function showToast(msg, type) {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); if (container.children.length === 0) container.remove(); }, 3000);
  }

  /* ---- Utilities ---- */
  function toDateTimeLocal(date) {
    const pad = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function formatDate(isoString) {
    const d = new Date(isoString);
    const now = new Date();
    const diffDays = Math.floor((now - d) / 86400000);
    const time = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    const date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (diffDays === 0) return '今天 ' + time;
    if (diffDays === 1) return '昨天 ' + time;
    if (diffDays < 7) return diffDays + '天前 ' + time;
    return date + ' ' + time;
  }

  function calcDuration(start, end) {
    if (!end) return '?';
    const ms = new Date(end) - new Date(start);
    const hrs = Math.floor(ms / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);
    if (hrs === 0) return mins + '分钟';
    if (mins === 0) return hrs + '小时';
    return hrs + '小时' + mins + '分钟';
  }

  function getPainClass(level) {
    if (level <= 2) return 'pl-l1';
    if (level <= 4) return 'pl-l2';
    if (level <= 6) return 'pl-l3';
    if (level <= 8) return 'pl-l4';
    return 'pl-l5';
  }

  function getLocationLabel(id) {
    const found = PAIN_LOCATIONS.find(l => l.id === id);
    return found ? found.label : id;
  }

  function getPainTypeLabel(id) {
    const found = PAIN_TYPES.find(t => t.id === id);
    return found ? found.label : id;
  }

  function getAuraLabel(id) {
    const found = AURA_OPTIONS.find(a => a.id === id);
    return found ? found.label : id;
  }

  function getSymptomLabel(id) {
    const found = SYMPTOM_OPTIONS.find(s => s.id === id);
    return found ? found.label : id;
  }

  function getTriggerLabel(id) {
    const found = TRIGGER_OPTIONS.find(t => t.id === id);
    return found ? found.label : id;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /* ---- Public API ---- */
  return {
    init,
    switchTab,
    selectPainLevel,
    toggleChip,
    selectRadio,
    addMedRow,
    removeMedRow,
    toggleMoreDetails,
    onMedSelect,
    submitRecord,
    cancelEdit,
    editRecord,
    confirmDelete,
    applyHistoryFilter,
    toggleRecordDetail,
    handleImport,
    manualSync,
    toggleAutoSync,
    toggleTheme,
    dismissPrivacy,
    showToast
  };
})();

/* Boot */
document.addEventListener('DOMContentLoaded', () => App.init());
