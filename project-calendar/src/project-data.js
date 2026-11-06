export const operationFields = ['所属项目 Project','编码名 Code','工序名称 Operation','计划总量 Planned Qty','累计完成量 Cumulative Done'];
const slotNumbers=[1,2,3,4];
export const reportFields = ['所属项目 Project','日期 Date','备注 Notes',...slotNumbers.flatMap(i => [
  i===1 ? '填报工序编码 Op Code 1' : '填报工序编码'+i+' Op Code '+i,
  i===1 ? '当日完成量 Done Qty' : '当日完成量'+i+' Done Qty '+i,
])];
function textOf(value) {
  if (Array.isArray(value)) return value.map(textOf).join('');
  return String(value?.text ?? value?.name ?? value?.value ?? value ?? '');
}
function linkIds(value) {
  return [value].flat().filter(Boolean).flatMap(v => v.recordIds ?? v.record_ids ?? (v.id ? [v.id] : []));
}
function codeOf(value) {return textOf(value).trim().match(/^OP-\d+\b/i)?.[0].toUpperCase();}
const dateFormat=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Helsinki'});
function splitAdjustment(note,qty,unique) {
  if (qty<0) return [[qty,'数量订正']];
  if (/^\s*[【\[][^】\]]*非当日施工量/.test(note))
    return [[qty,/收口/.test(note)?'补量并确认收口':'数量订正']];
  // Only split an explicit arithmetic breakdown if it uniquely identifies a slot.
  const split=note.match(/(\d+(?:\.\d+)?)\s*[=＝]\s*(?:当天|当日)?新[^\d\n+]{0,8}(\d+(?:\.\d+)?)[^+\n]{0,24}\+\s*(?:历史)?回补[^\d\n]{0,12}(\d+(?:\.\d+)?)/);
  if (unique && split && +split[1]===qty && Math.abs(+split[2]+ +split[3]-qty)<1e-8)
    return [[+split[2],'当日施工'],[+split[3],'历史回补']];
  return [[qty,'当日施工']];
}
export function projectCalendar(operations,reports) {
  const byCode=new Map(), plans=[],entries=[];
  let unmatched=0;
  for (const [link,codeValue,title,plan,current] of operations) {
    const code=codeOf(codeValue);
    if(!code) throw Error('项目工序缺少有效编码');
    const peers=byCode.get(code)??[];
    const op={code,project:linkIds(link)[0],projectName:textOf(link),title:textOf(title),plan:Number(textOf(plan)),current:Number(textOf(current))};
    peers.push(op); byCode.set(code,peers);
  }
  for (const peers of byCode.values()) for (const op of peers) {
    op.name=(peers.length>1 ? op.projectName+' / ' : '')+op.code+' '+op.title;
    plans.push(op);
  }
  plans.sort((a,b)=>a.code.localeCompare(b.code,undefined,{numeric:true}));
  const totals=new Map();
  for(const [link,ts,note,...slots] of reports) {
    const projects=linkIds(link);
    const amounts=slots.filter((_,i)=>i%2===1).map(n=>n==null?null:Number(textOf(n)));
    for(const i of [0,1,2,3]) {
      const qty=amounts[i];
      if(qty===null || qty===0) continue;
      const peers=byCode.get(codeOf(slots[i*2]))??[];
      const matches=projects.length?peers.filter(op=>projects.includes(op.project)):peers;
      if(matches.length!==1 || !Number.isFinite(qty) || ts==null || !Number.isFinite(+ts)){unmatched++;continue;}
      const {name}=matches[0];
      for (const [delta,kind] of splitAdjustment(textOf(note),qty,amounts.filter(n=>n===qty).length===1))
        entries.push({name,day:dateFormat.format(new Date(+ts)),qty:delta,kind});
      totals.set(name,(totals.get(name)??0)+qty);
    }
  }
  const differences=plans.filter(op=>Math.abs(op.current-(totals.get(op.name)??0))>1e-6);
  return {plans,entries,unmatched,differences};
}
