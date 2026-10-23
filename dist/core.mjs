export function parse(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const numeric = s => s.trim() !== '' && Number.isFinite(Number(s));
  let start = lines.findIndex(s => /POTENTIAL\/V/i.test(s) && /CURRENT\/A/i.test(s));
  if (start < 0) { start = lines.findIndex(s => { const p=s.split(','); return p.length>=2 && numeric(p[0]) && numeric(p[1]); }); if(start<0) throw Error('未找到 Potential/V, Current/A 标题或有效的两列数值。'); start--; }
  const rows=[];
  for(const line of lines.slice(start+1)) { const p=line.split(','); if(p.length>=2 && numeric(p[0]) && numeric(p[1])) rows.push([Number(p[0]),Number(p[1])]); }
  if(!rows.length) throw Error('文件中没有有效数据。请检查逗号分隔的两列数据。');
  return rows;
}
export function compute(rows,V,S,Rs) {
  if(![V,S,Rs].every(Number.isFinite)||S<=0||Rs<0) throw Error('请输入有效数字，电极面积必须大于 0，电阻不能为负数。');
  let index=0;
  rows.forEach((r,i)=>{ if(Math.abs(r[0]+V)<Math.abs(rows[index][0]+V)) index=i; });
  const baseline=rows[index][1]*1000/S;
  const data=rows.map(([a,b])=>{const c=a+V,e=b*1000/S-baseline,f=c-Rs*e*S/1000;return {a,b,c,e,f,t1:-f,t2:Math.abs(e)<1e-15?-Infinity:Math.log10(Math.abs(e))};});
  if(data.some(r=>![r.c,r.e,r.f,r.t1].every(Number.isFinite)||Number.isNaN(r.t2)||r.t2===Infinity)) throw Error('计算结果超出数值范围，请检查数据和参数。');
  return {data,index,baseline};
}
export const numberText = n => n===-Infinity?'-inf':String(n);
export function output(data,tafel=false) {return data.map(r=>tafel?`${numberText(r.t1)},${numberText(r.t2)}`:`${numberText(r.f)},${numberText(r.e)}`).join('\n')+'\n';}
