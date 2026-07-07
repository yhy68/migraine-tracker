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
  function updateThemeHint() {
    const hint = document.getElementById('theme-mode-hint');
    const autoBtn = document.getElementById('theme-auto-btn');
    const toggleBtn = document.getElementById('theme-toggle-btn');
    const isAuto = !localStorage.getItem('theme');
    if (autoBtn) {
      autoBtn.classList.toggle('active', isAuto);
      autoBtn.textContent = isAuto ? '自动' : '手动';
    }
    if (toggleBtn) toggleBtn.classList.toggle('active', !isAuto);
    if (!hint) return;
    const pad = n => String(n).padStart(2, '0');
    const now = new Date();
    const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    if (isAuto) {
      const autoT = getAutoTheme() === 'dark' ? '深色' : '浅色';
      hint.textContent = '当前：自动模式 ｜ ' + timeStr + ' 时为' + autoT;
    } else {
      const saved = localStorage.getItem('theme');
      const label = saved === 'dark' ? '深色（手动）' : '浅色（手动）';
      hint.textContent = '当前：' + label + ' ｜ 点击「手动」可切回自动';
    }
  }

  function init() {
    initTheme();
    renderHeader();
    loadMainUI();
    tryAutoSync();
    switchTab('record');
    updateThemeHint();

    // 周期性后台同步：每30秒从云端拉取数据，实现多设备准实时同步
    window._syncTimer = setInterval(() => {
      if (!editingId) backgroundAutoSync();
    }, 30000);

    // 页面从后台恢复时立即同步一次
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && !editingId) {
        setTimeout(backgroundAutoSync, 1000);
      }
    });
  }
  
  /* ---- Theme Management ---- */
  function getAutoTheme() {
    const h = new Date().getHours();
    return (h >= 19 || h < 7) ? 'dark' : 'light';
  }

  function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light' || savedTheme === 'dark') {
      applyTheme(savedTheme, false, true);
    } else {
      applyTheme(getAutoTheme(), false, false);
    }
    setInterval(() => {
      const currentTheme = localStorage.getItem('theme');
      if (currentTheme !== 'light' && currentTheme !== 'dark') {
        applyTheme(getAutoTheme(), false, false);
      }
    }, 60000);
  }
  
  function applyTheme(theme, showToast, persist = true) {
    if (showToast === undefined) showToast = true;
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.body.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      document.body.removeAttribute('data-theme');
    }
    if (persist) {
      localStorage.setItem('theme', theme);
    }
    if (showToast) {
      showToast(`已切换到${theme === 'dark' ? '深色' : '浅色'}模式`, 'success');
    }
    updateThemeHint();
  }
  
  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme, true);
  }

  function resetThemeToAuto() {
    const isAuto = !localStorage.getItem('theme');
    if (isAuto) {
      /* 当前是自动模式 → 切换到手动模式，保存当前主题 */
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
      localStorage.setItem('theme', currentTheme);
      showToast('已切换到手动模式（主题固定不变）', 'success');
    } else {
      /* 当前是手动模式 → 切换回自动模式 */
      localStorage.removeItem('theme');
      /* 直接应用自动检测的主题，不写入 localStorage（保持自动状态） */
      const autoTheme = getAutoTheme();
      if (autoTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.body.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.removeAttribute('data-theme');
        document.body.removeAttribute('data-theme');
      }
      showToast('已恢复自动模式（按时间切换）', 'success');
    }
    updateThemeHint();
  }

  /* ---- Auto Sync ---- */
  async function tryAutoSync() {
    updateSyncStatus('syncing');
    try {
      await Storage.backgroundSync();
      updateSyncStatus('synced');
      // 如果当前在历史页面，刷新列表
      if (currentTab === 'history') refreshHistoryList();
    } catch (e) {
      console.error('Sync failed:', e);
      const lastSt = localStorage.getItem('lastSyncStatus') || 'idle';
      updateSyncStatus(lastSt);
    }
  }

  async function backgroundAutoSync() {
    const autoSync = localStorage.getItem('auto_sync') !== '0';
    if (!autoSync) return;
    updateSyncStatus('syncing');
    try {
      await Storage.backgroundSync();
      updateSyncStatus('synced');
      // 如果当前在历史页面，刷新列表
      if (currentTab === 'history') refreshHistoryList();
    } catch (e) {
      console.error('Background sync failed:', e);
      updateSyncStatus('error');
    }
  }

  function updateSyncStatus(status) {
    localStorage.setItem('lastSyncStatus', status);
    if (status === 'synced') {
      localStorage.setItem('lastSyncTime', Date.now().toString());
    }
    updateSyncIndicator();
  }

  function updateSyncIndicator() {
    const dot = document.getElementById('sync-dot');
    const text = document.getElementById('sync-text');
    const time = document.getElementById('sync-time');
    if (!dot || !text) return;

    const status = localStorage.getItem('lastSyncStatus') || 'idle';
    const lastTime = localStorage.getItem('lastSyncTime');

    dot.className = 'dot ' + status;

    switch (status) {
      case 'synced':
        text.textContent = '已同步';
        break;
      case 'syncing':
        text.textContent = '同步中...';
        break;
      case 'error':
        text.textContent = '同步失败';
        break;
      default:
        text.textContent = '未同步';
    }

    if (time && lastTime) {
      const d = new Date(parseInt(lastTime));
      const pad = n => String(n).padStart(2, '0');
      time.textContent = pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
    } else if (time) {
      time.textContent = '';
    }
  }

  /* ---- Main UI ---- */
  function loadMainUI() {
    const app = document.getElementById('app');
    app.innerHTML = `
      ${renderPrivacyBanner()}
      <div class="tab-nav">
        <button class="tab-btn active" data-tab="record" onclick="App.switchTab('record')">记录</button>
        <button class="tab-btn" data-tab="history" onclick="App.switchTab('history')">历史</button>
        <button class="tab-btn" data-tab="backup" onclick="App.switchTab('backup')">设置</button>
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
  let datePickers = {};
  
  function initDatePickers(startDate, endDate, startTime, endTime) {
    const startDateContainer = document.getElementById('start-date-picker');
    const endDateContainer = document.getElementById('end-date-picker');
    const startTimeContainer = document.getElementById('start-time-picker');
    const endTimeContainer = document.getElementById('end-time-picker');
    if (!startDateContainer || !endDateContainer) return;
    
    if (datePickers.start) datePickers.start.destroy();
    if (datePickers.end) datePickers.end.destroy();
    if (datePickers.startTime) datePickers.startTime.destroy();
    if (datePickers.endTime) datePickers.endTime.destroy();
    
    datePickers.start = new DatePicker({
      id: 'start-date',
      value: startDate,
      max: new Date().toISOString().split('T')[0],
      placeholder: '选择开始日期',
      onChange: (val) => {
        if (datePickers.end && datePickers.end.getValue() && datePickers.end.getValue() < val) {
          datePickers.end.setValue(val);
        }
      }
    });
    
    datePickers.end = new DatePicker({
      id: 'end-date',
      value: endDate,
      min: startDate,
      max: new Date().toISOString().split('T')[0],
      placeholder: '选择结束日期',
      onChange: (val) => {
        if (datePickers.start && datePickers.start.getValue() && datePickers.start.getValue() > val) {
          datePickers.start.setValue(val);
        }
      }
    });
    
    datePickers.startTime = new TimePicker({
      id: 'start-time',
      value: startTime,
      placeholder: '选择开始时间',
      onChange: (val) => {
        if (datePickers.endTime && datePickers.endTime.getValue() && 
            datePickers.end.getValue() === datePickers.start.getValue() &&
            datePickers.endTime.getValue() < val) {
          datePickers.endTime.setValue(val);
        }
      }
    });
    
    datePickers.endTime = new TimePicker({
      id: 'end-time',
      value: endTime,
      placeholder: '选择结束时间',
      onChange: (val) => {
        if (datePickers.startTime && datePickers.startTime.getValue() && 
            datePickers.end.getValue() === datePickers.start.getValue() &&
            datePickers.startTime.getValue() > val) {
          datePickers.startTime.setValue(val);
        }
      }
    });
    
    startDateContainer.appendChild(datePickers.start.getElement());
    endDateContainer.appendChild(datePickers.end.getElement());
    if (startTimeContainer) startTimeContainer.appendChild(datePickers.startTime.getElement());
    if (endTimeContainer) endTimeContainer.appendChild(datePickers.endTime.getElement());
  }
  
  function splitDateTime(date) {
    const pad = n => String(n).padStart(2, '0');
    return {
      date: `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`,
      time: `${pad(date.getHours())}:${pad(date.getMinutes())}`
    };
  }

  function renderRecordForm(container) {
    const now = new Date();
    const start = splitDateTime(now);
    const end = splitDateTime(new Date(now.getTime() + 3600000));

    container.innerHTML = `
      <div class="card">
        <div class="section-title">
          ${editingId ? '编辑记录' : '新记录'}
        </div>

        <div class="form-group">
          <label class="form-label">发作时间</label>
          <div class="datetime-row">
            <div class="datetime-field">
              <span class="datetime-label">开始时间</span>
              <div id="start-date-picker"></div>
              <div id="start-time-picker"></div>
            </div>
            <span class="datetime-separator">—</span>
            <div class="datetime-field">
              <span class="datetime-label">结束时间 <span style="font-size:11px;color:var(--text-muted);font-weight:normal;">（可选）</span></span>
              <div id="end-date-picker"></div>
              <div id="end-time-picker"></div>
            </div>
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
    
    setTimeout(() => {
      initDatePickers(start.date, end.date, start.time, end.time);
    }, 10);
  }

  function renderMedRow(data) {
    const idx = Math.random().toString(36).substr(2, 4);
    const d = data || MY_MED;
    const isPreset = d.name ? MED_PRESETS.includes(d.name) : true;
    const selected = d.name || MY_MED.name;

    const nameField = isPreset ? `
        <select class="med-name" onchange="App.onMedSelect(this)">
          <option value="">选择药品...</option>
          ${MED_PRESETS.map(m => `<option value="${m}" ${m===selected?'selected':''}>${m}</option>`).join('')}
          <option value="__custom__">其他（手动输入）</option>
        </select>` : `
        <input class="med-name" type="text" value="${d.name || ''}" placeholder="药名" autocomplete="off" style="flex:2;min-width:100px;padding:8px 10px;border-radius:6px;border:1.5px solid var(--border);background:var(--bg-card);color:var(--text);font-size:13px;">`;

    return `
      <div class="med-row" data-med-row="${idx}">
        ${nameField}
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

    if (r.startTime) {
      const sd = new Date(r.startTime);
      const pad = n => String(n).padStart(2, '0');
      const startDate = `${sd.getFullYear()}-${pad(sd.getMonth()+1)}-${pad(sd.getDate())}`;
      const startTime = `${pad(sd.getHours())}:${pad(sd.getMinutes())}`;
      if (datePickers.start) datePickers.start.setValue(startDate);
      if (datePickers.startTime) datePickers.startTime.setValue(startTime);
    }
    if (r.endTime) {
      const ed = new Date(r.endTime);
      const pad = n => String(n).padStart(2, '0');
      const endDate = `${ed.getFullYear()}-${pad(ed.getMonth()+1)}-${pad(ed.getDate())}`;
      const endTime = `${pad(ed.getHours())}:${pad(ed.getMinutes())}`;
      if (datePickers.end) datePickers.end.setValue(endDate);
      if (datePickers.endTime) datePickers.endTime.setValue(endTime);
    }

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
  function getStartDateTime() {
    const d = datePickers.start ? datePickers.start.getValue() : '';
    const t = datePickers.startTime ? datePickers.startTime.getValue() : '';
    return (d && t) ? d + 'T' + t : '';
  }
  function getEndDateTime() {
    const d = datePickers.end ? datePickers.end.getValue() : '';
    const t = datePickers.endTime ? datePickers.endTime.getValue() : '';
    return (d && t) ? d + 'T' + t : '';
  }

  async function submitRecord() {
    const startTime = getStartDateTime();
    const endTime = getEndDateTime();
    const painBtn = document.querySelector('.pain-btn.selected');
    const notes = document.getElementById('rec-notes').value.trim();

    if (!startTime) { showToast('请选择发作开始时间', 'error'); return; }
    if (!painBtn) { showToast('请选择疼痛程度', 'error'); return; }

    if (endTime && new Date(endTime) <= new Date(startTime)) {
      showToast('结束时间必须晚于开始时间', 'error');
      return;
    }

    const painLevel = parseInt(painBtn.dataset.level);
    
    if (isNaN(painLevel) || painLevel < 1 || painLevel > 10) {
      showToast('疼痛程度无效', 'error');
      return;
    }

    const painLocations = getSelectedIds('#pain-location-group .chip');
    const painType = getSelectedId('#pain-type-group .radio-chip');
    const aura = getSelectedIds('#aura-group .chip');
    const symptoms = getSelectedIds('#symptom-group .chip');
    const triggers = [
      ...getSelectedIds('#trigger-group .chip'),
      ...getSelectedIds('#trigger-group-extra .chip')
    ];
    const medications = collectMedications();

    const MAX_NOTES_LENGTH = 2000;
    if (notes.length > MAX_NOTES_LENGTH) {
      showToast(`备注内容过长（最大${MAX_NOTES_LENGTH}字符）`, 'error');
      return;
    }

    const sanitizedNotes = escapeHtml(notes);

    const record = {
      startTime: startTime.includes(':') ? startTime + (startTime.match(/:\d{2}$/) ? '' : ':00') : startTime + ':00',
      endTime: endTime ? (endTime.includes(':') ? endTime + (endTime.match(/:\d{2}$/) ? '' : ':00') : endTime + ':00') : null,
      painLevel,
      painLocations,
      painType: painType || null,
      aura,
      symptoms,
      triggers,
      medications,
      notes: sanitizedNotes
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

      // 立即同步到云端
      try {
        updateSyncStatus('syncing');
        await Storage.syncData();
        updateSyncStatus('synced');
      } catch (e) {
        updateSyncStatus('error');
        showToast('本地已保存，同步失败（下次联网自动重试）', 'info');
      }

      // 仅当用户仍在记录页面时才刷新表单，否则刷新对应页面
      if (currentTab === 'record') {
        const container = document.getElementById('tab-content');
        renderRecordForm(container);
      } else if (currentTab === 'history') {
        // 用户已切换到历史页，刷新列表展示新记录
        refreshHistoryList();
      }
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
        meds.push({ name, dose: dose || null, time, effect: effect === null || effect === undefined || isNaN(effect) ? null : effect });
      }
    });
    return meds;
  }

  /* ---- History ---- */
  /* ---- History Filter & Pagination State ---- */
  let histFilterType = 'all';  // 'all' | '7' | '30' | '90' | 'custom'
  let histCustomStart = '';
  let histCustomEnd = '';
  let histSearch = '';
  let histPage = 1;
  let histPageSize = 5;  // 5 | 10 | 20 | 50 | -1 (all)
  let filteredRecords = [];

  function renderHistory(container) {
    const allRecords = Storage.getLocalRecords().sort((a, b) =>
      new Date(b.startTime) - new Date(a.startTime)
    );
    filteredRecords = applyFilterAndSearch(allRecords);
    histPage = 1;

    container.innerHTML = `
      <div class="card">
        <div class="section-title">
          历史记录
        </div>

        <!-- Filter chips -->
        <div class="filter-chips" id="filter-chips">
          <button class="filter-chip ${histFilterType==='all'?'active':''}" data-value="all" onclick="App.setFilter('all')">全部</button>
          <button class="filter-chip ${histFilterType==='7'?'active':''}" data-value="7" onclick="App.setFilter('7')">最近7天</button>
          <button class="filter-chip ${histFilterType==='30'?'active':''}" data-value="30" onclick="App.setFilter('30')">最近30天</button>
          <button class="filter-chip ${histFilterType==='90'?'active':''}" data-value="90" onclick="App.setFilter('90')">最近90天</button>
          <button class="filter-chip ${histFilterType==='custom'?'active':''}" data-value="custom" onclick="App.toggleCustomRange()">自定义范围</button>
        </div>

        <!-- Custom date range -->
        <div class="custom-range-row" id="custom-range-row" style="display:${histFilterType==='custom'?'flex':'none'};">
          <div id="range-start-picker"></div>
          <span class="range-separator">至</span>
          <div id="range-end-picker"></div>
          <button class="btn btn-sm btn-secondary" onclick="App.applyCustomRange()">确定</button>
        </div>

        <!-- Toolbar: search + page size + count -->
        <div class="history-toolbar">
          <input type="text" id="hist-search" placeholder="搜索记录..." oninput="App.onHistorySearch()" autocomplete="off" value="${histSearch}">
          <div class="page-size-selector">
            <span class="page-size-label">每页</span>
            <select id="page-size-select" onchange="App.changePageSize()">
              <option value="5" ${histPageSize===5?'selected':''}>5条</option>
              <option value="10" ${histPageSize===10?'selected':''}>10条</option>
              <option value="20" ${histPageSize===20?'selected':''}>20条</option>
              <option value="50" ${histPageSize===50?'selected':''}>50条</option>
              <option value="-1" ${histPageSize===-1?'selected':''}>全部</option>
            </select>
          </div>
          <span class="history-count" id="hist-count">${filteredRecords.length} 条记录</span>
        </div>

        <div id="history-list"></div>
        <div class="pagination-wrap" id="pagination-wrap">
          <div class="pagination" id="pagination"></div>
        </div>
      </div>
    `;
    renderHistoryPage();
  }

  function setFilter(type) {
    histFilterType = type;
    histPage = 1;
    document.querySelectorAll('#filter-chips .filter-chip').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === type);
    });
    const rangeRow = document.getElementById('custom-range-row');
    if (rangeRow) rangeRow.style.display = type === 'custom' ? 'flex' : 'none';
    refreshHistoryList();
  }

  function toggleCustomRange() {
    const rangeRow = document.getElementById('custom-range-row');
    if (!rangeRow) return;
    if (rangeRow.style.display === 'none') {
      rangeRow.style.display = 'flex';
      histFilterType = 'custom';
      document.querySelectorAll('#filter-chips .filter-chip').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.value === 'custom');
      });
    } else {
      rangeRow.style.display = 'none';
      if (!histCustomStart && !histCustomEnd) {
        setFilter('all');
      }
    }
    
    setTimeout(() => {
      initRangeDatePickers();
    }, 10);
  }

  function initRangeDatePickers() {
    const startContainer = document.getElementById('range-start-picker');
    const endContainer = document.getElementById('range-end-picker');
    if (!startContainer || !endContainer) return;
    
    if (datePickers.rangeStart) datePickers.rangeStart.destroy();
    if (datePickers.rangeEnd) datePickers.rangeEnd.destroy();
    
    datePickers.rangeStart = new DatePicker({
      id: 'range-start',
      value: histCustomStart,
      max: new Date().toISOString().split('T')[0],
      placeholder: '开始日期',
      onChange: (val) => {
        if (datePickers.rangeEnd && datePickers.rangeEnd.getValue() && datePickers.rangeEnd.getValue() < val) {
          datePickers.rangeEnd.setValue(val);
        }
      }
    });
    
    datePickers.rangeEnd = new DatePicker({
      id: 'range-end',
      value: histCustomEnd,
      max: new Date().toISOString().split('T')[0],
      placeholder: '结束日期',
      onChange: (val) => {
        if (datePickers.rangeStart && datePickers.rangeStart.getValue() && datePickers.rangeStart.getValue() > val) {
          datePickers.rangeStart.setValue(val);
        }
      }
    });
    
    startContainer.appendChild(datePickers.rangeStart.getElement());
    endContainer.appendChild(datePickers.rangeEnd.getElement());
  }

  function applyCustomRange() {
    const start = datePickers.rangeStart ? datePickers.rangeStart.getValue() : '';
    const end = datePickers.rangeEnd ? datePickers.rangeEnd.getValue() : '';
    if (!start || !end) {
      showToast('请选择开始和结束日期', 'info');
      return;
    }
    histCustomStart = start;
    histCustomEnd = end;
    histFilterType = 'custom';
    histPage = 1;
    document.querySelectorAll('#filter-chips .filter-chip').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === 'custom');
    });
    const rangeRow = document.getElementById('custom-range-row');
    if (rangeRow) rangeRow.style.display = 'flex';
    refreshHistoryList();
  }

  function onHistorySearch() {
    histSearch = (document.getElementById('hist-search').value || '').toLowerCase();
    histPage = 1;
    refreshHistoryList();
  }

  function changePageSize() {
    const val = document.getElementById('page-size-select').value;
    histPageSize = parseInt(val);
    histPage = 1;
    refreshHistoryList();
  }

  function refreshHistoryList() {
    const allRecords = Storage.getLocalRecords();
    filteredRecords = applyFilterAndSearch(allRecords);
    const countEl = document.getElementById('hist-count');
    if (countEl) countEl.textContent = `${filteredRecords.length} 条记录`;
    const totalPages = histPageSize <= 0 ? 1 : Math.max(1, Math.ceil(filteredRecords.length / histPageSize));
    if (histPage > totalPages) histPage = totalPages;
    const wrap = document.getElementById('pagination-wrap');
    if (wrap) wrap.style.display = totalPages > 1 ? '' : 'none';
    renderHistoryPage();
  }

  function applyFilterAndSearch(records) {
    let result = records;
    const now = new Date();
    
    if (histFilterType === 'custom') {
      if (histCustomStart) {
        const start = new Date(histCustomStart);
        start.setHours(0, 0, 0, 0);
        result = result.filter(r => new Date(r.startTime) >= start);
      }
      if (histCustomEnd) {
        const end = new Date(histCustomEnd);
        end.setHours(23, 59, 59, 999);
        result = result.filter(r => new Date(r.startTime) <= end);
      }
    } else if (histFilterType !== 'all') {
      const days = parseInt(histFilterType);
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - days);
      cutoff.setHours(0, 0, 0, 0);
      result = result.filter(r => new Date(r.startTime) >= cutoff);
    }
    if (histSearch) {
      result = result.filter(r => {
        const searchFields = [
          r.notes || '',
          (r.medications || []).map(m => (m.name || '') + ' ' + (m.dose || '')).join(' '),
          (r.triggers || []).map(t => getTriggerLabel(t)).join(' '),
          (r.symptoms || []).map(s => getSymptomLabel(s)).join(' '),
          getPainTypeLabel(r.painType || ''),
          (r.painLocations || []).map(l => getLocationLabel(l)).join(' ')
        ];
        return searchFields.join(' ').toLowerCase().includes(histSearch);
      });
    }
    
    result.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
    return result;
  }

  function renderHistoryPage() {
    let pageRecords;
    if (histPageSize <= 0) {
      pageRecords = filteredRecords;
    } else {
      const start = (histPage - 1) * histPageSize;
      pageRecords = filteredRecords.slice(start, start + histPageSize);
    }

    const listEl = document.getElementById('history-list');
    if (listEl) listEl.innerHTML = renderHistoryList(pageRecords);

    renderPagination();
  }

  function renderPagination() {
    const el = document.getElementById('pagination');
    if (!el) return;

    if (histPageSize <= 0) { el.innerHTML = ''; return; }

    const totalPages = Math.max(1, Math.ceil(filteredRecords.length / histPageSize));
    if (totalPages <= 1) { el.innerHTML = ''; return; }

    let html = '';
    html += `<button class="page-btn ${histPage===1?'disabled':''}" onclick="App.goToPage(${histPage-1})" ${histPage===1?'disabled':''}>‹</button>`;

    const pages = getPageNumbers(histPage, totalPages);
    pages.forEach(p => {
      if (p === '...') {
        html += `<span class="page-dots">...</span>`;
      } else {
        html += `<button class="page-btn ${p===histPage?'current':''}" onclick="App.goToPage(${p})">${p}</button>`;
      }
    });

    html += `<button class="page-btn ${histPage>=totalPages?'disabled':''}" onclick="App.goToPage(${histPage+1})" ${histPage>=totalPages?'disabled':''}>›</button>`;

    el.innerHTML = html;
  }

  function getPageNumbers(current, total) {
    if (total <= 7) {
      return Array.from({length: total}, (_, i) => i + 1);
    }
    const pages = [1];
    if (current > 3) pages.push('...');
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
      pages.push(i);
    }
    if (current < total - 2) pages.push('...');
    pages.push(total);
    return [...new Set(pages)];
  }

  function goToPage(page) {
    const totalPages = histPageSize <= 0 ? 1 : Math.ceil(filteredRecords.length / histPageSize);
    if (page < 1 || page > totalPages) return;
    histPage = page;
    renderHistoryPage();
    const list = document.getElementById('history-list');
    if (list) list.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }


  function renderHistoryList(records) {
    if (records.length === 0) {
      return `<div class="empty-state"><span class="empty-icon">&#x1F4CB;</span><p>还没有记录</p><p style="font-size:12px;">切换到「记录」页面开始记录</p></div>`;
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
          ${r.medications&&r.medications.length>0 ? `<span class="rc-tag">用药: ${r.medications.map(m=>escapeHtml(m.name)).join(',')}</span>` : ''}
        </div>
        <div class="rc-detail">
          ${r.painType ? `<div>类型: ${getPainTypeLabel(r.painType)}</div>` : ''}
          ${r.aura&&r.aura.length>0 ? `<div>前驱: ${r.aura.map(a=>getAuraLabel(a)).join('、')}</div>` : ''}
          ${r.symptoms&&r.symptoms.length>0 ? `<div>症状: ${r.symptoms.map(s=>getSymptomLabel(s)).join('、')}</div>` : ''}
          ${r.triggers&&r.triggers.length>0 ? `<div>诱因: ${r.triggers.map(t=>getTriggerLabel(t)).join('、')}</div>` : ''}
          ${r.medications&&r.medications.length>0 ? `<div>用药: ${r.medications.map(m=>`${escapeHtml(m.name)} ${escapeHtml(m.dose||'')} ${escapeHtml(m.time||'')} ${m.effect?'效果'+(m.effect)+'/5':''}`).join('; ')}</div>` : ''}
          ${r.notes ? `<div style="margin-top:4px;padding:8px;background:var(--bg);border-radius:6px;">备注: ${r.notes}</div>` : ''}
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

  function editRecord(id) {
    editingId = id;
    switchTab('record');
  }

  function confirmDelete(id) {
    if (confirm('确定要删除这条记录吗？此操作不可撤销。')) {
      Storage.deleteRecord(id);
      showToast('记录已删除', 'success');
      refreshHistoryList();
      
      // 立即同步到云端
      updateSyncStatus('syncing');
      Storage.syncData().then(() => {
        updateSyncStatus('synced');
      }).catch(() => {
        updateSyncStatus('error');
      });
    }
  }

  /* ---- Backup & Settings ---- */
  function renderBackup(container) {
    const count = Storage.countRecords();
    
    container.innerHTML = `
      <div class="card backup-section">
        <div class="section-title">
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
          云端同步
        </div>
        <p style="color:var(--text-secondary);font-size:13px;">数据已自动同步至云端私有仓库，支持多设备共享。</p>
        <div class="backup-actions" style="align-items: center;">
          <button class="btn btn-secondary" style="width:auto" id="btn-sync" onclick="App.manualSync()">立即同步</button>
        </div>
      </div>

      <div class="card backup-section">
        <div class="section-title">
          设置
        </div>
        <div class="settings-section">
          <div class="settings-item">
            <label>主题模式</label>
            <div style="display:flex;gap:6px;align-items:center;">
              <button class="btn btn-sm btn-secondary" onclick="App.toggleTheme()" id="theme-toggle-btn">
                切换主题
              </button>
              <button class="btn btn-sm btn-outline" onclick="App.resetThemeToAuto()" style="font-size:12px;flex:1;min-width:0;" id="theme-auto-btn">
                自动
              </button>
            </div>
          </div>
          <div id="theme-mode-hint" style="font-size:12px;color:var(--text-muted);margin-top:-4px;margin-bottom:8px;"></div>
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
      </div>
    `;
    /* 初始化同步状态显示 */
    const lastSt = localStorage.getItem('lastSyncStatus') || 'idle';
    // 如果从未同步过且有本地数据，显示为 idle（未同步）
    // 如果之前成功过，保持上次状态
    updateSyncStatus(lastSt);
    updateThemeHint();
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
        updateSyncStatus('syncing');
        await Storage.syncData();
        updateSyncStatus('synced');
      } catch(e) {
        updateSyncStatus('error');
        showToast('本地已导入，同步失败（下次联网自动重试）', 'info');
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
      <svg class="mascot-icon" width="100" height="80" viewBox="0 0 100 80" xmlns="http://www.w3.org/2000/svg">
        <!-- sparkles -->
        <path d="M12 30 L6 24 M8 28 L4 22" stroke="#B8DDF0" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M88 30 L94 24 M92 28 L96 22" stroke="#B8DDF0" stroke-width="1.5" stroke-linecap="round"/>
        <!-- cloud body -->
        <path d="M26 60 Q18 60 16 52 Q14 42 24 38 Q24 26 38 24 Q46 16 58 20 Q70 14 78 24 Q90 26 88 38 Q96 44 88 54 Q86 62 76 62 Z" fill="white" stroke="#A8D4F0" stroke-width="1.8"/>
        <!-- eyes -->
        <circle cx="40" cy="45" r="3.5" fill="#333"/>
        <circle cx="61" cy="45" r="3.5" fill="#333"/>
        <circle cx="41" cy="43.5" r="1.2" fill="white"/>
        <circle cx="62" cy="43.5" r="1.2" fill="white"/>
        <!-- blush -->
        <ellipse cx="32" cy="51" rx="6" ry="4" fill="#FFB366" opacity="0.65"/>
        <ellipse cx="69" cy="51" rx="6" ry="4" fill="#FFB366" opacity="0.65"/>
        <!-- smile -->
        <path d="M47 50 Q50.5 55 54 50" fill="none" stroke="#333" stroke-width="1.8" stroke-linecap="round"/>
      </svg>
      <h1>小云私の手账</h1>
      <div class="subtitle">记录每一天，温柔对待自己</div>
      <div class="sync-indicator">
        <span class="dot synced" id="sync-dot"></span>
        <span id="sync-text">已同步</span>
        <span class="sync-time" id="sync-time"></span>
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
  function formatDate(isoString) {
    const d = new Date(isoString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const recordDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.floor((today - recordDate) / 86400000);
    const time = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    const date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (diffDays === 0) return '今天 ' + time;
    if (diffDays === 1) return '昨天 ' + time;
    if (diffDays < 7) return diffDays + '天前 ' + time;
    return date + ' ' + time;
  }

  function calcDuration(start, end) {
    if (!end) return '?';
    const ms = Math.abs(new Date(end) - new Date(start));
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
    setFilter,
    toggleCustomRange,
    applyCustomRange,
    changePageSize,
    onHistorySearch,
    goToPage,
    toggleRecordDetail,
    handleImport,
    manualSync,
    toggleAutoSync,
    toggleTheme,
    resetThemeToAuto,
    dismissPrivacy,
    showToast
  };
})();

/* Boot */
document.addEventListener('DOMContentLoaded', () => App.init());
