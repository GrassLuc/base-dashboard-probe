const byId = id => document.getElementById(id);
const dayMs = 86400000;
let calendar;
let mode = 'work';
let selected;

function appendCell(parent, tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  parent.append(node);
  return node;
}

export function renderCalendar(plans, entries) {
  const groups = new Map();
  for (const {name, plan} of plans) {
    if (!name || groups.has(name)) throw Error('工序标识为空或重复');
    groups.set(name, {name, plan, days: new Map()});
  }
  for (const {name, day, qty, kind} of entries) {
    const group = groups.get(name);
    if (!group) throw Error('报量缺少对应工序');
    const cell = group.days.get(day) || {work: 0, total: 0, notes: [], closure: false};
    cell.total += qty;
    if (kind === '当日施工') cell.work += qty;
    if (kind === '补量并确认收口') cell.closure = true;
    cell.notes.push(kind + ' ' + qty);
    group.days.set(day, cell);
  }
  calendar = {groups, dates: entries.map(x => x.day).sort()};
  draw();
}

function draw() {
  if (!calendar) return;
  const {dates, groups} = calendar;
  byId('days').replaceChildren();
  byId('cells').replaceChildren();
  byId('total').textContent = groups.size + ' 道工序';
  for (const key of ['work','progress']) byId(key).setAttribute('aria-pressed',key === mode);
  if (!dates.length) {
    byId('detail').textContent = '暂无报量';
    return;
  }
  const end = Date.parse(dates.at(-1)) + dayMs;
  const start = Math.max(Date.parse(dates[0]) - dayMs, end - 61 * dayMs);
  const visible = [];
  appendCell(byId('days'), 'th', '工序 / 日期');
  for (let t=start; t<=end; t+=dayMs) {
    const date = new Date(t);
    const day = date.toISOString().slice(0,10);
    visible.push(day);
    const th = appendCell(byId('days'), 'th', day.slice(5).replace('-','/'));
    appendCell(th, 'small', '周' + '日一二三四五六'[date.getUTCDay()]);
  }
  let selectedDetail = '';
  for (const group of groups.values()) {
    const row = document.createElement('tr');
    byId('cells').append(row);
    appendCell(row,'th',group.name);
    const days = [...group.days.keys()].sort();
    const firstWork = days.find(day => group.days.get(day).work > 0);
    const lastActivity = days.filter(day => {
      const entry = group.days.get(day);
      return entry.work > 0 || entry.total !== 0 || entry.closure;
    }).at(-1);
    let running = days.filter(d=>d<visible[0]).reduce((sum,d)=>sum+group.days.get(d).total,0);
    for (const day of visible) {
      const cell = group.days.get(day);
      const within = firstWork && day >= firstWork && day <= lastActivity;
      running += cell?.total ?? 0;
      const pct = group.plan > 0 ? Math.round(running / group.plan * 100) : null;
      const state = cell?.work > 0 ? 'work' : cell && (cell.total !== 0 || cell.closure) ? 'adjust' : within ? 'gap' : '';
      const note = cell ? cell.notes.join('；') : within ? '区间内无当日施工报量' : '区间外';
      const detail = group.name + '　' + day + '　' + note + '　·　累计 ' + running + (pct === null ? '（计划量待定）' : ' / ' + group.plan + '（' + pct + '%）');
      const td = appendCell(row, 'td', '');
      td.className = 'cell';
      const button = appendCell(td, 'button', '');
      button.title = detail;
      button.setAttribute('aria-label', detail);
      if (mode === 'progress') {
        button.textContent = pct === null ? '—' : pct + '%';
        if (pct !== null) button.style.background = 'hsl(' + Math.max(0, Math.min(100,pct))*1.4 + ' 49% 85%)';
      } else {
        button.className = state;
        button.textContent = state === 'work' ? '+' + cell.work : state === 'adjust' ? (cell.closure ? '收口' : '订正') : state === 'gap' ? '─' : '';
      }
      button.onclick = () => { selected = [group.name, day]; byId('detail').textContent = detail; };
      if (selected?.[0] === group.name && selected?.[1] === day) selectedDetail = detail;
    }
  }
  byId('detail').textContent = selectedDetail || '点日期格查看当日报量及累计';
  byId('legend').textContent = mode === 'work' ? '实绿：当日施工　浅线：区间内无施工报量　斜纹：补量或订正　留白：区间外' : '红 0% → 黄 50% → 绿 100%';
  byId('source').textContent = visible[0] + ' 至 ' + visible.at(-1) + ' · 最多显示最近 62 个日历日';
}
for (const key of ['work','progress']) byId(key).onclick = () => {mode = key; draw();};
