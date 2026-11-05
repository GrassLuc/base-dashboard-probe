import {bitable, dashboard} from '@lark-base-open/js-sdk';
import {renderCalendar} from './web/chart.js';

const detail = document.querySelector('#detail');
const save = document.querySelector('#save');
const key = '项目房间工序';
const allowedKinds = ['当日施工', '补量并确认收口', '数量订正'];
// Date-only fields in the trial ledger use the Base calendar's time zone.
const dateFormat = new Intl.DateTimeFormat('sv-SE', {timeZone:'Europe/Helsinki'});

function asText(value) {
  if (Array.isArray(value)) return value.map(asText).join('');
  return String(value?.text ?? value?.name ?? value ?? '');
}
async function readFields(table,names) {
  const fields = await table.getFieldMetaList();
  const ids = names.map(name=>{
    const match=fields.find(f=>f.name===name);
    if (!match) throw Error('缺少字段：'+name);
    return match.id;
  });
  const rows=[];
  const pages=new Set();
  let pageToken;
  do {
    const page=await table.getRecordsByPage({pageToken,pageSize:200});
    for (const record of page.records) rows.push(ids.map(id=>record.fields[id]));
    if (!page.hasMore) break;
    pageToken=page.pageToken;
    if (!pageToken || pages.has(pageToken)) throw Error('分页读取失败');
    pages.add(pageToken);
  } while (true);
  return rows;
}
function failure(error) {
  detail.className='detail error';
  detail.textContent='日历读取失败：'+(error?.message ?? String(error));
}
async function start() {
  if (window.parent === window) {
    detail.textContent='请从飞书仪表盘打开，以读取该表中的报量。';
    return;
  }
  await dashboard.setRendered();
  const [ledger, operations]=await Promise.all(['日期验证·报量流水','日期验证·项目工序'].map(name=>bitable.base.getTableByName(name)));
  let generation=0;
  async function refresh() {
    const current=++generation;
    try {
      const [plans,rows]=await Promise.all([readFields(operations,[key,'计划量']),readFields(ledger,[key,'作业或收口日期','增量','性质'])]);
      if (current!==generation) return;
      const entries=rows.map(([scope,ts,qty,kind])=>{
        const type=asText(kind);
        if (ts==null || !Number.isFinite(Number(ts)) || qty==null || !Number.isFinite(Number(qty)) || !allowedKinds.includes(type)) throw Error('请检查作业日期、增量和性质');
        return {name:asText(scope),day:dateFormat.format(new Date(Number(ts))),qty:Number(qty),kind:type};
      });
      renderCalendar(plans.map(([name,plan])=>({name:asText(name),plan:Number(plan)})),entries);
      detail.className='detail';
      save.hidden=!['Config','Create'].includes(dashboard.state);
    } catch(error) { if(current===generation) failure(error); }
  }
  save.onclick=async()=>{
    save.disabled=true;
    try {
      const saved=await dashboard.saveConfig({customConfig:{version:1},dataConditions:[{tableId:ledger.id},{tableId:operations.id}]});
      if (saved===false) throw Error('仪表盘未确认保存');
      save.hidden=true;
    } catch(error) {failure(error);} finally {save.disabled=false;}
  };
  await refresh();
  dashboard.onDataChange(refresh);
  for(const t of [ledger,operations]) {
    t.onRecordAdd(refresh); t.onRecordModify(refresh); t.onRecordDelete(refresh);
  }
}
start().catch(failure);
