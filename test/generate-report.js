/* Generate an HTML test report from results.json produced by run-tests.js */
const fs = require('fs');
const path = require('path');
const __dir = __dirname;
const data = JSON.parse(fs.readFileSync(path.join(__dir, 'results.json'), 'utf8'));

const groups = {};
data.tests.forEach((t) => {
  const g = t.group || '其他';
  groups[g] = groups[g] || { pass: 0, fail: 0, skip: 0, items: [] };
  const st = t.pass === true ? 'pass' : t.pass === false ? 'fail' : 'skip';
  groups[g][st]++;
  groups[g].items.push({ name: t.name, status: st, error: t.error || '' });
});

function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

const now = new Date().toLocaleString('zh-CN', { hour12: false });
let rows = '';
let gi = 0;
for (const g of Object.keys(groups)) {
  gi++;
  const grp = groups[g];
  rows += `<tr class="grp"><td colspan="3">📂 ${esc(g)} <span class="gs">(${grp.pass}✓ / ${grp.fail}✗ / ${grp.skip}⚠)</span></td></tr>`;
  grp.items.forEach((it) => {
    const icon = it.status === 'pass' ? '✅' : it.status === 'fail' ? '❌' : '⚠️';
    const detail = it.status === 'fail' && it.error ? `<div class="err">↳ ${esc(it.error)}</div>` : '';
    rows += `<tr class="${it.status}"><td class="ic">${icon}</td><td class="nm">${esc(it.name)}</td><td class="st">${it.status === 'pass' ? '通过' : it.status === 'fail' ? '失败' : '跳过'}</td></tr>${detail ? `<tr class="drow"><td></td><td colspan="2">${detail}</td></tr>` : ''}`;
  });
}

const total = data.total, p = data.passed, f = data.failed, s = data.skipped;
const pct = total ? Math.round((p / total) * 100) : 0;
const scoreColor = pct >= 90 ? '#2ECC71' : pct >= 70 ? '#F39C12' : '#E74C3C';

const html = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>偏头痛记录应用 · 功能测试报告</title>
<style>
  :root{--bg:#f4f8fb;--card:#fff;--line:#e3edf3;--text:#2c3e50;--muted:#7f8c9a;--blue:#5BA4CF;}
  *{box-sizing:border-box;margin:0;padding:0;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;}
  body{background:var(--bg);color:var(--text);padding:28px;line-height:1.6;}
  .wrap{max-width:960px;margin:0 auto;}
  header{background:linear-gradient(135deg,#7CC5EA,#5BA4CF);color:#fff;border-radius:16px;padding:28px 32px;box-shadow:0 8px 28px rgba(91,164,207,.25);}
  header h1{font-size:24px;margin-bottom:6px;}
  header .meta{opacity:.92;font-size:13px;}
  .score{display:flex;gap:14px;margin:22px 0;flex-wrap:wrap;}
  .box{flex:1;min-width:140px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px;text-align:center;}
  .box .n{font-size:30px;font-weight:700;}
  .box .l{font-size:13px;color:var(--muted);margin-top:4px;}
  .ring{width:120px;height:120px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:700;color:#fff;margin:0 auto;}
  table{width:100%;border-collapse:collapse;background:var(--card);border-radius:14px;overflow:hidden;box-shadow:0 4px 18px rgba(0,0,0,.05);margin-top:10px;}
  tr.grp{background:#eef5fb;font-weight:600;}
  tr.grp td{padding:12px 16px;font-size:15px;}
  tr.grp .gs{font-weight:400;color:var(--muted);font-size:13px;}
  td{padding:11px 16px;border-top:1px solid var(--line);font-size:14px;vertical-align:top;}
  tr.pass td.nm{color:#27632a;} tr.fail td.nm{color:#9b2c2c;} tr.skip td.nm{color:#8a6d1a;}
  .ic{width:34px;text-align:center;}
  .st{width:70px;color:var(--muted);font-size:13px;}
  .err{color:#c0392b;font-size:12.5px;background:#fdecea;padding:8px 10px;border-radius:8px;margin-top:2px;font-family:ui-monospace,Menlo,monospace;}
  .drow{}
  tr.drow td{background:#fff8f7;border-top:none;padding-top:0;}
  .fix{margin-top:24px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:20px 24px;}
  .fix h2{font-size:16px;margin-bottom:12px;color:var(--blue);}
  .fix .item{border-left:4px solid #5BA4CF;padding:8px 14px;margin:10px 0;background:#f6fbfe;border-radius:0 10px 10px 0;}
  .fix .item.fixed{border-left-color:#2ECC71;}
  .fix .item.warn{border-left-color:#F39C12;}
  .fix .tag{display:inline-block;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;margin-right:8px;color:#fff;}
  .fix .tag.b{background:#2ECC71;} .fix .tag.p{background:#E67E22;} .fix .tag.w{background:#F39C12;}
  .fix .tt{font-weight:600;font-size:14px;}
  .fix .ds{font-size:13px;color:var(--muted);margin-top:4px;}
  .note{margin-top:24px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:20px 24px;}
  .note h2{font-size:16px;margin-bottom:10px;color:var(--blue);}
  .note li{margin:6px 0 6px 20px;font-size:14px;}
  .foot{text-align:center;color:var(--muted);font-size:12px;margin-top:22px;}
</style></head>
<body><div class="wrap">
  <header>
    <h1>📋 偏头痛记录应用 · 功能测试报告</h1>
    <div class="meta">项目：migraine-tracker ｜ 版本 v1.16 ｜ 测试时间：${esc(now)} ｜ 测试方式：jsdom 真实加载源码 + DOM 事件驱动</div>
  </header>

  <div class="score">
    <div class="box"><div class="ring" style="background:conic-gradient(${scoreColor} ${pct*3.6}deg,#e9eef2 0);">${pct}%</div><div class="l">通过率</div></div>
    <div class="box"><div class="n" style="color:#2ECC71">${p}</div><div class="l">通过</div></div>
    <div class="box"><div class="n" style="color:#E74C3C">${f}</div><div class="l">失败(缺陷)</div></div>
    <div class="box"><div class="n" style="color:#F39C12">${s}</div><div class="l">跳过/环境</div></div>
    <div class="box"><div class="n">${total}</div><div class="l">用例总数</div></div>
  </div>

  <table>
    <tr class="grp"><td colspan="3">🧪 详细用例</td></tr>
    ${rows}
  </table>

  <div class="note">
    <h2>🔍 测试说明与发现</h2>
    <ul>
      <li><b>测试范围</b>：数据层(增删改/合并/校验/导入导出/同步/409重试)、TimePicker、DatePicker、App 核心业务(表单提交校验/XSS防护/排序/筛选/搜索/分页/批量删除/编辑回填/主题切换/隐私声明)、UI 样式一致性。</li>
      <li><b>测试方法</b>：使用 jsdom 将 storage.js / datepicker.js / timepicker.js / app.js <b>原样加载</b>进真实 DOM，用真实 DOM 事件(click 等)驱动交互，mock 了 GitHub API(fetch)与浏览器 API，覆盖正常路径与边界。</li>
      <li><b>❌ 失败项</b>即发现的缺陷，已逐条附错误原因，建议优先修复。</li>
      <li><b>⚠️ 跳过项</b>为受沙箱网络限制无法验证的部分（如真实 GitHub API 连通性），不影响功能判定，可在有外网环境复测。</li>
      <li><b>静态检查</b>：CSS 类覆盖率、时间/日期选择器输入框风格一致性、旧滚轮设计残留死代码均已纳入。</li>
    </ul>
  </div>

  <div class="fix">
    <h2>🛠 测试过程中发现并修复的问题</h2>

    <div class="item fixed">
      <div class="tt"><span class="tag b">已修复</span>主题切换函数崩溃（产品 Bug）</div>
      <div class="ds">applyTheme(theme, showToast, persist) 的参数名 <code>showToast</code> 遮蔽了全局同名函数，调用 <code>showToast(...)</code> 时触发 TypeError，导致深色/浅色模式切换失败。已将参数重命名为 <code>doToast</code> 解除遮蔽。</div>
    </div>

    <div class="item fixed">
      <div class="tt"><span class="tag b">已修复</span>编辑模式发作日期被重置为今天（产品 Bug）</div>
      <div class="ds">编辑记录时 prefillForm 先填入原发作日期，但 10ms 后 initDatePickers 又用「当前日期」重建日期选择器，覆盖 prefill，造成保存后时间戳被悄悄改成今天。已让初始化尊重已有 prefill 值，编辑后日期/时间保留原值。</div>
    </div>

    <div class="item fixed">
      <div class="tt"><span class="tag b">已修复</span>测试时序竞态（测试框架）</div>
      <div class="ds">jsdom 异步触发 DOMContentLoaded，自动调用 App.init() 启动后台同步；在 Storage 单测的 await 间隙，后台同步的 fetch 解析后清除了刚写入的 deletedIds，导致 deleteRecord 用例偶发失败。已在测试框架中拦截 DOMContentLoaded 自动触发，隔离 App 生命周期，Storage 单测恢复确定性。</div>
    </div>

    <div class="item fixed">
      <div class="tt"><span class="tag b">已修复</span>旧滚轮时间选择器残留死代码（样式表清理）</div>
      <div class="ds">timepicker.js 已重构为「输入框 + 点击展开步进面板」，但 style.css 仍残留旧滚轮设计样式：<code>.time-picker-wheels / .time-picker-wheel / .time-picker-ampm / .time-picker-display / .time-picker-header</code> 及其子规则（约 50 行）。已从样式表中彻底删除（已确认 JS/HTML 无任何引用，且新设计仍在使用的 .time-picker-footer / .time-picker-quick-btn 等保留）。</div>
    </div>
  </div>

  <div class="foot">本报告由自动化测试脚本生成 · 测试引擎 jsdom + Node ${process.version}</div>
</div></body></html>`;

fs.writeFileSync(path.join(__dir, 'report.html'), html);
console.log('report.html written');
