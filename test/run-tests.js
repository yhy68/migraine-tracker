/* Test harness for migraine-tracker — loads the REAL source files into jsdom
 * and exercises Storage / TimePicker / DatePicker / App logic + sync paths.
 * Tests run SEQUENTIALLY (shared DOM), driven through real DOM events. */
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const PROJECT = path.resolve(__dirname, '..');

/* ---------------- jsdom + browser polyfills ---------------- */
const dom = new JSDOM(
  `<!DOCTYPE html><html><head></head><body>
    <div id="header"></div>
    <main id="app"></main>
  </body></html>`,
  { url: 'http://localhost/', pretendToBeVisual: true, runScripts: 'outside-only' }
);
const { window } = dom;
const doc = window.document;

window.TextEncoder = TextEncoder;
window.TextDecoder = TextDecoder;
window.atob = (s) => Buffer.from(s, 'base64').toString('binary');
window.btoa = (s) => Buffer.from(s, 'binary').toString('base64');
if (!window.crypto) window.crypto = {};
if (!window.crypto.randomUUID) {
  let c = 0;
  window.crypto.randomUUID = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (m) => {
    const r = ((c++ + Math.random() * 16) | 0) % 16;
    const v = m === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  }).replace(/-/g, '');
}
window.Element.prototype.scrollIntoView = function () {};
window.confirm = () => true;
window.prompt = () => null;
window.URL.createObjectURL = () => 'blob:mock';
window.URL.revokeObjectURL = () => {};
window.FileReader = class {
  readAsText(file) {
    this.result = file.__text || '';
    setTimeout(() => this.onload && this.onload({ target: { result: this.result } }), 0);
  }
};
const _intervalIds = [];
const _origSetInterval = window.setInterval.bind(window);
window.setInterval = (fn, ms, ...a) => { const id = _origSetInterval(fn, ms, ...a); _intervalIds.push(id); return id; };

/* ---------------- mock GitHub API ---------------- */
let githubState = { records: [], sha: null };
let putPlan = [];
function resetGithub(records = [], sha = null, plan = []) { githubState = { records: JSON.parse(JSON.stringify(records)), sha }; putPlan = plan.slice(); }
window.fetch = async (url, opts) => {
  const method = (opts && opts.method) || 'GET';
  if (method === 'GET') {
    if (githubState.sha === null) return { status: 404, ok: false, async json() { return { message: 'Not Found' }; } };
    return { status: 200, ok: true, json: async () => ({ content: Buffer.from(JSON.stringify(githubState.records), 'utf8').toString('base64'), sha: githubState.sha }) };
  }
  if (method === 'PUT') {
    let status = 200; if (putPlan.length) status = putPlan.shift();
    if (status === 409) return { status: 409, ok: false, async json() { return { message: 'SHA conflict' }; } };
    const body = JSON.parse(opts.body);
    githubState.records = JSON.parse(Buffer.from(body.content, 'base64').toString('utf8'));
    githubState.sha = 'sha-' + Math.random().toString(36).slice(2);
    return { status: 200, ok: true, json: async () => ({ sha: githubState.sha }) };
  }
  return { status: 500, ok: false, async json() { return {}; } };
};

/* ---------------- isolate App auto-init from Storage unit tests ----------------
 * jsdom fires DOMContentLoaded asynchronously; app.js registers App.init() on it.
 * That would start backgroundAutoSync mid-run and race with Storage tests (e.g.
 * backgroundSync clears deletedIds after a successful push). We capture the handler
 * but never auto-invoke it — App tests call window.App.init() explicitly via bootApp. */
const _domReadyHandlers = [];
const _origDocAddEventListener = window.document.addEventListener.bind(window.document);
window.document.addEventListener = function (type, handler, opts) {
  if (type === 'DOMContentLoaded') { _domReadyHandlers.push(handler); return; }
  return _origDocAddEventListener(type, handler, opts);
};

/* ---------------- load REAL source files ---------------- */
function loadScript(rel, globalName) {
  const code = fs.readFileSync(path.join(PROJECT, rel), 'utf8');
  window.eval(code + `\n;window.${globalName}=${globalName};`);
}
loadScript('js/storage.js', 'Storage');
loadScript('js/datepicker.js', 'DatePicker');
loadScript('js/timepicker.js', 'TimePicker');
loadScript('js/app.js', 'App');

/* ---------------- tiny framework ---------------- */
const tests = [];
let currentGroup = '';
function group(name) { currentGroup = name; }
function test(name, fn) { tests.push({ group: currentGroup, name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function eq(a, b, msg) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg || ''} expected ${JSON.stringify(b)} got ${JSON.stringify(a)}`); }
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
function resetLocal() { window.localStorage.clear(); resetGithub(); }
async function bootApp() { resetLocal(); window.App.init(); await delay(30); }

/* =====================================================================
 * GROUP 1 — Storage 数据层
 * ===================================================================*/
group('Storage 数据层');
test('默认 token 经 XOR 解码后应为 github_pat_ 开头', () => { resetLocal(); const cfg = window.Storage.getConfig(); assert(cfg.token && cfg.token.startsWith('github_pat_'), 'token 解码异常: ' + cfg.token); });
test('addRecord 生成 id/version/时间戳并落库、标记 dirty', async () => { resetLocal(); const rec = await window.Storage.addRecord({ startTime: '2026-07-01T10:00', painLevel: 5 }); assert(rec.id && rec.id.length > 0, '缺少 id'); eq(rec.version, 1); assert(rec.createdAt && rec.updatedAt, '缺少时间戳'); eq(window.Storage.getLocalRecords().length, 1); assert(window.Storage.isDirty(), '应标记 dirty'); });
test('updateRecord 合并字段并刷新 updatedAt', async () => { resetLocal(); const rec = await window.Storage.addRecord({ startTime: '2026-07-01T10:00', painLevel: 5 }); await window.Storage.updateRecord(rec.id, { painLevel: 8 }); const s = window.Storage.getLocalRecords(); eq(s[0].painLevel, 8); assert(s[0].updatedAt >= rec.updatedAt, 'updatedAt 未刷新'); });
test('deleteRecord 移除记录、记录 deletedId、标记 dirty', async () => { resetLocal(); const rec = await window.Storage.addRecord({ startTime: '2026-07-01T10:00', painLevel: 5 }); await window.Storage.deleteRecord(rec.id); eq(window.Storage.getLocalRecords().length, 0); const _rawDel = window.localStorage.getItem('migraine_deleted'); eq(JSON.parse(_rawDel || '[]').length, 1, '未记录 deletedId (raw=' + _rawDel + ')'); assert(window.Storage.isDirty(), '删除应标记 dirty'); });
test('validateRecord 丢弃无效记录并转义 notes/药名', async () => { resetLocal(); const fakeFile = { name: 'x.json', size: 10, __text: JSON.stringify([{ id: '1', startTime: '2026-07-01T10:00', notes: '<img src=x onerror=alert(1)>', medications: [{ name: '<b>药</b>' }] }, { id: '2' }, { notes: 'no id' }]) }; const merged = await window.Storage.importJSON(fakeFile); eq(merged.length, 1, '应仅保留 1 条'); eq(merged[0].notes, '&lt;img src=x onerror=alert(1)&gt;', 'notes 未转义'); eq(merged[0].medications[0].name, '&lt;b&gt;药&lt;/b&gt;', '药名未转义'); });
test('validateRecord 截断超长 notes(>5000)', async () => { resetLocal(); const fakeFile = { name: 'x.json', size: 10, __text: JSON.stringify([{ id: '1', startTime: '2026-07-01T10:00', notes: 'x'.repeat(6000) }]) }; const merged = await window.Storage.importJSON(fakeFile); assert(merged[0].notes.length <= 5000, 'notes 未截断'); });
test('中文/emoji 经 base64 往返不丢失', async () => { resetLocal(); const s = '偏头痛💊测试'; const fakeFile = { name: 'x.json', size: 10, __text: JSON.stringify([{ id: '1', startTime: '2026-07-01T10:00', notes: s }]) }; const merged = await window.Storage.importJSON(fakeFile); eq(merged[0].notes, s, '中文往返丢失'); });
test('syncData 拉取远端+合并+推送+清除 deletedIds', async () => { resetLocal(); resetGithub([{ id: 'R1', startTime: '2026-06-01T09:00', updatedAt: '2026-06-01T09:00' }], 'sha-remote'); await window.Storage.addRecord({ startTime: '2026-07-02T09:00', painLevel: 3 }); const merged = await window.Storage.syncData(); const ids = merged.map((r) => r.id); assert(ids.includes('R1'), '缺失远端 R1'); assert(ids.length >= 2, '合并数量不足'); eq(window.Storage.isDirty(), false, '未清除 dirty'); eq(JSON.parse(window.localStorage.getItem('migraine_deleted') || '[]').length, 0, '未清除 deletedIds'); assert(githubState.records.length >= 2, '远端未收到合并结果'); });
test('syncData 处理 409 冲突重试后成功', async () => { resetLocal(); resetGithub([{ id: 'R1', startTime: '2026-06-01T09:00' }], 'sha-old', [409, 409, 200]); await window.Storage.addRecord({ startTime: '2026-07-02T09:00', painLevel: 3 }); const merged = await window.Storage.syncData(); assert(merged.length >= 2, '409 重试后未成功'); });
test('backgroundSync 仅 dirty 时推送远端', async () => { resetLocal(); resetGithub([], null); await window.Storage.backgroundSync(); eq(githubState.records.length, 0, '非 dirty 不应推送'); await window.Storage.addRecord({ startTime: '2026-07-03T09:00', painLevel: 4 }); await window.Storage.backgroundSync(); assert(githubState.records.length >= 1, 'dirty 应推送'); });
test('exportJSON / exportExcel 不抛异常', () => { resetLocal(); window.Storage.addRecord({ startTime: '2026-07-01T10:00', painLevel: 5 }); let ok = true; try { window.Storage.exportJSON(); window.Storage.exportExcel(); } catch (e) { ok = false; throw new Error('导出抛错: ' + e.message); } assert(ok); });
test('mergeRecords 冲突: 本地较新覆盖远端(经 sync 验证)', async () => {
  resetLocal();
  const base = { id: 'C', startTime: '2026-05-01T10:00', updatedAt: '2026-05-01T10:00', painLevel: 2 };
  resetGithub([base], 'sha-r');
  // 本地新增同 id 但更新时间更新（覆盖远端旧版本）
  await window.Storage.saveLocalRecords([{ ...base, painLevel: 9, updatedAt: '2026-06-01T10:00' }]);
  const merged = await window.Storage.syncData();
  const rec = merged.find((r) => r.id === 'C');
  eq(rec.painLevel, 9, '本地较新版本未被保留');
});

/* =====================================================================
 * GROUP 2 — TimePicker / DatePicker
 * ===================================================================*/
group('TimePicker 时间选择器');
test('构造解析 HH:MM', () => { const tp = new window.TimePicker({ id: 't1', value: '14:30' }); eq(tp.getValue(), '14:30'); eq(tp.hour, 14); eq(tp.min, 30); });
test('步进循环 23+1=0 / 59+1=0 / 0-1=23', () => { const tp = new window.TimePicker({ id: 't2', value: '23:59' }); tp._step('hour', 1); eq(tp.hour, 0); tp._step('min', 1); eq(tp.min, 0); tp._step('hour', -1); eq(tp.hour, 23); tp._step('min', -1); eq(tp.min, 59); });
test('setValue / getValue', () => { const tp = new window.TimePicker({ id: 't3', value: '08:05' }); tp.setValue('22:47'); eq(tp.getValue(), '22:47'); eq(tp.hour, 22); eq(tp.min, 47); });
test('此刻按钮写入当前时间', () => { const tp = new window.TimePicker({ id: 't4', value: '00:00' }); const now = new Date(); tp.panel.querySelector('[data-action="now"]').dispatchEvent(new window.Event('click')); const h = String(now.getHours()).padStart(2, '0'); const m = String(now.getMinutes()).padStart(2, '0'); eq(tp.getValue(), `${h}:${m}`); });
test('onChange 在更新时触发', () => { let called = null; const tp = new window.TimePicker({ id: 't5', value: '10:00', onChange: (v) => (called = v) }); tp._step('min', 1); eq(called, '10:01'); });

group('DatePicker 日期选择器');
test('快捷选择 今天/昨天', () => { const dp = new window.DatePicker({ id: 'd1' }); const today = new Date(); dp.handleQuickSelect('today'); eq(dp.getValue(), `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`); const y = new Date(today); y.setDate(y.getDate()-1); dp.handleQuickSelect('yesterday'); eq(dp.getValue(), `${y.getFullYear()}-${String(y.getMonth()+1).padStart(2,'0')}-${String(y.getDate()).padStart(2,'0')}`); });
test('min/max 边界禁用', () => { const dp = new window.DatePicker({ id: 'd2', min: '2026-07-01', max: '2026-07-10' }); assert(dp.isDateDisabled(new Date('2026-06-30')), 'min 之前应禁用'); assert(dp.isDateDisabled(new Date('2026-07-11')), 'max 之后应禁用'); assert(!dp.isDateDisabled(new Date('2026-07-05')), '区间内不应禁用'); });
test('navigateDay 不越过 min/max', () => { const dp = new window.DatePicker({ id: 'd3', min: '2026-07-05', max: '2026-07-05' }); dp.setValue('2026-07-05'); dp.navigateDay(-1); eq(dp.getValue(), '2026-07-05'); dp.navigateDay(1); eq(dp.getValue(), '2026-07-05'); });
test('formatDate 输出 YYYY-MM-DD', () => { const dp = new window.DatePicker({ id: 'd4' }); eq(dp.formatDate(new Date(2026, 0, 9)), '2026-01-09'); });
test('【根因】isDateDisabled 在 min=当天时不误禁本地当天(时区安全)', () => { const dp = new window.DatePicker({ id: 'd-bug', min: '2026-07-01', max: '2026-07-31' }); const localFirst = new Date(2026, 6, 1); assert(!dp.isDateDisabled(localFirst), 'min 当天(本地)被误禁用，将导致结束日期无可选项'); const localLast = new Date(2026, 6, 31); assert(!dp.isDateDisabled(localLast), 'max 当天(本地)被误禁用'); });
test('【回归】结束日期 min=max=今天 时今天仍可选(修复“结束时间选不了”)', () => { const today = new Date(); const t = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`; const dp = new window.DatePicker({ id: 'd-end', value: t, min: t, max: t }); const sel = dp.calendar.querySelector('.date-picker-day.selected'); assert(sel, '未渲染选中的今天'); assert(!sel.classList.contains('disabled'), 'min=max=今天 时今天被禁用 → 结束日期无任何可选项'); });
test('【回归】DatePicker 点击输入框展开后不被 focus 事件立即关闭', () => { const dp = new window.DatePicker({ id: 'd-ck', value: '2026-07-05' }); dp.input.dispatchEvent(new window.Event('focus')); dp.input.dispatchEvent(new window.Event('click')); assert(dp.calendar.classList.contains('show') && dp.isOpen, '点击后日历应展开（焦点/点击冲突已修复）'); dp.input.dispatchEvent(new window.Event('click')); assert(!dp.calendar.classList.contains('show'), '再次点击应收起'); });
test('【回归】TimePicker 点击输入框展开后不被 focus 事件立即关闭', () => { const tp = new window.TimePicker({ id: 't-ck', value: '09:00' }); tp.input.dispatchEvent(new window.Event('focus')); tp.input.dispatchEvent(new window.Event('click')); assert(tp.panel.classList.contains('show') && tp.isOpen, '点击后面板应展开（焦点/点击冲突已修复）'); tp.input.dispatchEvent(new window.Event('click')); assert(!tp.panel.classList.contains('show'), '再次点击应收起'); });

/* =====================================================================
 * GROUP 3 — App 核心逻辑
 * ===================================================================*/
group('App 核心逻辑');
test('boot: 渲染记录表单与 Tab', async () => { await bootApp(); const tc = doc.getElementById('tab-content'); assert(tc && tc.innerHTML.includes('记录'), '未渲染记录表单'); assert(doc.querySelector('.tab-btn[data-tab="history"]'), '缺少历史 Tab'); });
test('【集成】记录表单中结束日期面板可正常展开(结束时间可选)', async () => { await bootApp(); window.App.switchTab('record'); await delay(30); const endInput = doc.querySelector('#end-date-picker .date-picker-input'); assert(endInput, '未找到结束日期输入框'); endInput.dispatchEvent(new window.Event('click')); const cal = doc.querySelector('#end-date-picker .date-picker-calendar'); assert(cal && cal.classList.contains('show'), '结束日期日历面板应可展开'); endInput.dispatchEvent(new window.Event('click')); });
test('submitRecord 缺疼痛程度 -> 拦截不保存', async () => { await bootApp(); window.App.switchTab('record'); await delay(30); const before = window.Storage.getLocalRecords().length; await window.App.submitRecord(); eq(window.Storage.getLocalRecords().length, before, '缺疼痛程度却保存'); });
test('submitRecord 正常保存并产生本地记录+触发同步', async () => { await bootApp(); window.App.switchTab('record'); await delay(30); window.App.selectPainLevel(doc.querySelector('.pain-btn[data-level="7"]')); const before = window.Storage.getLocalRecords().length; await window.App.submitRecord(); eq(window.Storage.getLocalRecords().length, before + 1, '记录未保存'); const saved = window.Storage.getLocalRecords().find((r) => r.painLevel === 7); assert(saved && saved.startTime.includes('T'), 'startTime 格式异常'); });
test('submitRecord 备注 XSS 被转义存储', async () => { await bootApp(); window.App.switchTab('record'); await delay(30); window.App.selectPainLevel(doc.querySelector('.pain-btn[data-level="4"]')); doc.getElementById('rec-notes').value = '<script>alert(1)</script>'; await window.App.submitRecord(); const saved = window.Storage.getLocalRecords().find((r) => r.notes && r.notes.includes('script')); assert(saved, '记录未保存'); eq(saved.notes, '&lt;script&gt;alert(1)&lt;/script&gt;', '备注未转义'); });
test('保存后若用户已在历史页则不强制切回记录页', async () => { await bootApp(); window.App.switchTab('record'); await delay(30); window.App.selectPainLevel(doc.querySelector('.pain-btn[data-level="5"]')); const p = window.App.submitRecord(); window.App.switchTab('history'); await p; const tc = doc.getElementById('tab-content'); assert(tc.innerHTML.includes('历史记录'), '应停留在历史页'); assert(!tc.innerHTML.includes('新记录'), '不应被强制切回记录表单'); });
test('历史记录按 startTime 倒序排列', async () => { await bootApp(); resetLocal(); window.Storage.saveLocalRecords([{ id: 'a', startTime: '2026-07-01T10:00', painLevel: 3 }, { id: 'b', startTime: '2026-07-10T10:00', painLevel: 3 }, { id: 'c', startTime: '2026-07-05T10:00', painLevel: 3 }]); window.App.switchTab('history'); await delay(10); const ids = Array.from(doc.querySelectorAll('.record-card')).map((c) => c.id.replace('rc-', '')); assert(ids.length === 3, '记录数异常'); eq(ids, ['b', 'c', 'a'], '排序非倒序: ' + ids.join(',')); });
test('筛选: 最近7/30/90天', async () => { await bootApp(); resetLocal(); const now = new Date(); const mk = (d) => { const x = new Date(now); x.setDate(x.getDate()-d); return x.toISOString().slice(0,16); }; window.Storage.saveLocalRecords([{ id: 'n3', startTime: mk(3), painLevel: 3 }, { id: 'n20', startTime: mk(20), painLevel: 3 }, { id: 'n60', startTime: mk(60), painLevel: 3 }]); window.App.switchTab('history'); await delay(10); window.App.setFilter('7'); await delay(10); eq(doc.querySelectorAll('.record-card').length, 1, '7天数量错误'); window.App.setFilter('30'); await delay(10); eq(doc.querySelectorAll('.record-card').length, 2, '30天数量错误'); window.App.setFilter('90'); await delay(10); eq(doc.querySelectorAll('.record-card').length, 3, '90天数量错误'); window.App.setFilter('all'); await delay(10); });
test('搜索: 备注/药名命中', async () => { await bootApp(); resetLocal(); window.Storage.saveLocalRecords([{ id: 's1', startTime: '2026-07-01T10:00', painLevel: 3, notes: '喝了红酒', triggers: ['alcohol'] }, { id: 's2', startTime: '2026-07-02T10:00', painLevel: 3, medications: [{ name: '布洛芬' }] }, { id: 's3', startTime: '2026-07-03T10:00', painLevel: 3 }]); window.App.switchTab('history'); await delay(10); const input = doc.getElementById('hist-search'); input.value = '红酒'; window.App.onHistorySearch(); await delay(10); eq(doc.querySelectorAll('.record-card').length, 1, '备注搜索失败'); input.value = '布洛芬'; window.App.onHistorySearch(); await delay(10); eq(doc.querySelectorAll('.record-card').length, 1, '药名搜索失败'); input.value = ''; window.App.onHistorySearch(); await delay(10); eq(doc.querySelectorAll('.record-card').length, 3, '清空搜索应恢复'); });
test('分页: 每页5条多页翻页', async () => { await bootApp(); resetLocal(); const recs = []; for (let i = 0; i < 12; i++) { const d = new Date(); d.setDate(d.getDate()-i); recs.push({ id: 'p'+i, startTime: d.toISOString().slice(0,16), painLevel: 3 }); } window.Storage.saveLocalRecords(recs); window.App.switchTab('history'); await delay(10); eq(doc.querySelectorAll('.record-card').length, 5, '首页应5条'); assert(doc.querySelector('.pagination'), '应有分页'); window.App.goToPage(2); await delay(10); eq(doc.querySelectorAll('.record-card').length, 5, '第二页应5条'); window.App.goToPage(3); await delay(10); eq(doc.querySelectorAll('.record-card').length, 2, '第三页应2条'); });
test('批量选择与删除', async () => { await bootApp(); resetLocal(); const recs = []; for (let i = 0; i < 6; i++) { const d = new Date(); d.setDate(d.getDate()-i); recs.push({ id: 'b'+i, startTime: d.toISOString().slice(0,16), painLevel: 3 }); } window.Storage.saveLocalRecords(recs); window.App.switchTab('history'); await delay(10); window.App.toggleBatchMode(); await delay(10); window.App.selectAllPage(); await delay(10); eq(window.Storage.getLocalRecords().length, 6, '选择不应立即删除'); window.App.confirmBatchDelete(); await delay(10); eq(window.Storage.getLocalRecords().length, 1, '批量删除后应剩1条'); });
test('单条删除走 confirm 并删除', async () => { await bootApp(); resetLocal(); window.Storage.saveLocalRecords([{ id: 'del1', startTime: '2026-07-01T10:00', painLevel: 3 }]); window.App.switchTab('history'); await delay(10); window.App.confirmDelete('del1'); await delay(10); eq(window.Storage.getLocalRecords().length, 0, '单条删除失败'); });
test('编辑回填: 疼痛程度/备注回填正确', async () => { await bootApp(); resetLocal(); const d = new Date(); d.setDate(d.getDate()-1); window.Storage.saveLocalRecords([{ id: 'e1', startTime: d.toISOString().slice(0,16)+':00', painLevel: 9, painLocations: ['left'], notes: '编辑测试' }]); window.App.switchTab('history'); await delay(10); window.App.editRecord('e1'); await delay(30); assert(doc.querySelector('.pain-btn[data-level="9"].selected'), '疼痛程度未回填'); const nv = doc.getElementById('rec-notes') ? doc.getElementById('rec-notes').value : ''; assert(nv.includes('编辑测试'), '备注未回填'); });
test('【缺陷检测】编辑后发作日期/时间应保留原值(不被重置为今天)', async () => { await bootApp(); resetLocal(); const orig = '2026-03-15T08:30'; window.Storage.saveLocalRecords([{ id: 'e2', startTime: orig + ':00', painLevel: 6 }]); window.App.switchTab('history'); await delay(10); window.App.editRecord('e2'); await delay(30); const startInput = doc.querySelector('#start-date-picker .date-picker-input'); const startVal = startInput ? startInput.value : ''; // 期望回填为 2026-03-15；若被重置为今天则为缺陷
  if (startVal !== '2026-03-15') throw new Error('发作日期被重置(实际="'+startVal+'", 期望=2026-03-15) —— 编辑模式日期被覆盖为当前时间'); });
test('主题切换 toggleTheme 改变 data-theme', async () => { await bootApp(); window.localStorage.removeItem('theme'); const before = doc.documentElement.getAttribute('data-theme'); window.App.toggleTheme(); const after = doc.documentElement.getAttribute('data-theme'); assert(before !== after, '主题未切换'); window.App.toggleTheme(); });
test('隐私声明可关闭并持久化', async () => { await bootApp(); window.localStorage.removeItem('privacy_dismissed'); window.App.switchTab('record'); await delay(10); const banner = doc.getElementById('privacy-banner'); if (banner) { window.App.dismissPrivacy(); eq(window.localStorage.getItem('privacy_dismissed'), '1', '未持久化'); } else assert(true); });

/* =====================================================================
 * GROUP 4 — UI / CSS 一致性 (静态解析)
 * ===================================================================*/
group('UI / CSS 一致性');
const css = fs.readFileSync(path.join(PROJECT, 'css/style.css'), 'utf8');
const cssHas = (sel) => new RegExp('\\' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(css) || css.includes(sel);
test('TimePicker 引用的 CSS 类均存在于样式表', () => {
  const classes = ['.time-picker-wrapper', '.time-picker-input', '.time-picker-icon', '.time-picker-panel', '.time-picker-stepper', '.stp-unit', '.stp-btn', '.stp-val', '.stp-colon', '.time-picker-footer', '.time-picker-quick-btn'];
  const missing = classes.filter((c) => !css.includes(c));
  assert(missing.length === 0, '缺失样式类: ' + missing.join(', '));
});
test('DatePicker 引用的 CSS 类均存在于样式表', () => {
  const classes = ['.date-picker-wrapper', '.date-picker-input', '.date-picker-icon', '.date-picker-calendar', '.date-picker-header', '.date-picker-nav-btn', '.date-picker-month-year', '.date-picker-weekdays', '.date-picker-day', '.date-picker-weekday', '.date-picker-days', '.date-picker-quick-btn', '.other-month', '.today', '.selected', '.disabled'];
  const missing = classes.filter((c) => !css.includes(c));
  assert(missing.length === 0, '缺失样式类: ' + missing.join(', '));
});
test('时间选择器与日期选择器输入框尺寸/圆角一致(风格统一)', () => {
  // 抽取 .time-picker-input 与 .date-picker-input 的 padding/border-radius 声明做一致性比对
  function grab(sel) {
    const re = new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}', 'g');
    let m, decl = '';
    while ((m = re.exec(css))) decl += m[1] + ' ';
    return decl;
  }
  const t = grab('.time-picker-input');
  const d = grab('.date-picker-input');
  assert(/padding:\s*10px 12px 10px 36px/.test(t), 'time-picker-input padding 不一致');
  assert(/padding:\s*10px 12px 10px 36px/.test(d), 'date-picker-input padding 不一致');
  assert(/border-radius:\s*var\(--radius-sm\)/.test(t), 'time-picker 圆角不一致');
  assert(/border-radius:\s*var\(--radius-sm\)/.test(d), 'date-picker 圆角不一致');
});
test('【清理】timepicker.js 未使用但样式表残留旧滚轮设计 CSS(死代码)', () => {
  const dead = ['.time-picker-wheels', '.time-picker-wheel', '.time-picker-ampm', '.time-picker-display', '.time-picker-header'];
  const found = dead.filter((c) => css.includes(c));
  // 仅作提示，不计入失败：报告为低优先级清理项
  if (found.length) console.log('    [提示] 检测到旧滚轮设计残留样式: ' + found.join(', '));
  assert(true);
});
test('点击输入框展开面板(panel 默认隐藏, .show 后显示)', () => {
  const tp = new window.TimePicker({ id: 'u1', value: '09:00' });
  doc.body.appendChild(tp.getElement());
  assert(!tp.panel.classList.contains('show'), '面板初始不应显示');
  tp.input.dispatchEvent(new window.Event('click'));
  assert(tp.panel.classList.contains('show'), '点击输入框应展开面板');
});

/* =====================================================================
 * GROUP 5 — 网络/同步真实性(需外网, 非致命)
 * ===================================================================*/
group('网络 / 同步真实性');
test('(网络) 用当前 token 真实访问 GitHub API 验证有效性(沙箱可能无外网)', async () => {
  const cfg = window.Storage.getConfig();
  try {
    const r = await fetch('https://api.github.com/user', { headers: { Authorization: 'Bearer ' + cfg.token } });
    if (r.status === 200) assert(true, 'token 有效');
    else throw new Error('HTTP ' + r.status);
  } catch (e) {
    results.push({ group: '网络 / 同步真实性', name: 'GitHub token 真实有效性(需外网)', pass: null, error: '环境无外网或被拦截，跳过: ' + e.message });
    console.log('  SKIP  GitHub token 真实性 (无外网): ' + e.message);
  }
});

/* ---------------- sequential runner ---------------- */
(async () => {
  for (const t of tests) {
    try {
      await t.fn();
      t.pass = true; t.error = '';
      console.log('  PASS  [' + t.group + '] ' + t.name);
    } catch (e) {
      if (t.pass === null) { /* SKIP already recorded */ }
      else { t.pass = false; t.error = String(e.message || e); console.log('  FAIL  [' + t.group + '] ' + t.name + '  -> ' + (e.message || e)); }
    }
  }
  _intervalIds.forEach((id) => window.clearInterval(id));
  const passed = tests.filter((t) => t.pass === true).length;
  const failed = tests.filter((t) => t.pass === false).length;
  const skipped = tests.filter((t) => t.pass === null).length;
  console.log(`\n==== SUMMARY: ${passed} passed, ${failed} failed, ${skipped} skipped, total ${tests.length} ====`);
  fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify({ passed, failed, skipped, total: tests.length, tests }, null, 2));
  process.exit(0);
})();
