export function parseEIS(text, columns = [0, 1, 2], auto = true) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const split = line => line.trim().split(/[,;\t]+/).map(s => s.trim());
  const finite = s => s !== undefined && s !== '' && Number.isFinite(Number(s));
  const header = lines.findIndex(line => /freq/i.test(line) && /(?:imag|z''|zim)/i.test(line));
  if (auto && header >= 0) {
    const names = split(lines[header]);
    const f = names.findIndex(s => /freq/i.test(s));
    const im = names.findIndex(s => /imag|z''|zim/i.test(s));
    const re = names.findIndex(s => /real|zre|z'(?!')/i.test(s) && !/imag|z''/i.test(s));
    if ([f,re,im].every(i => i >= 0)) columns = [f,re,im];
  }
  const rows = []; let started = false;
  for (let i = header >= 0 ? header + 1 : 0; i < lines.length; i++) {
    const values = split(lines[i]);
    if (columns.every(c => finite(values[c]))) {
      started = true;
      rows.push({f:Number(values[columns[0]]),x:Number(values[columns[1]]),y:Number(values[columns[2]]),line:i+1});
    } else if (started) rows.push(null);
  }
  if (!rows.some(Boolean)) throw Error('未找到有效 EIS 数据，请检查频率、实部、虚部列。');
  return rows;
}
export function intersections(rows) {
  const points = [];
  for (let i=0;i<rows.length;i++) {
    const a=rows[i]; if (!a) continue;
    if (a.y===0) {
      let end=i; while(rows[end+1]?.y===0) end++;
      if(end===i) points.push({x:a.x,line:a.line,endLine:a.line,f1:a.f,f2:a.f,kind:'采样点'});
      else {
        points.push({x:a.x,line:a.line,endLine:rows[end].line,f1:a.f,f2:rows[end].f,kind:'零轴区间起点'});
        points.push({x:rows[end].x,line:a.line,endLine:rows[end].line,f1:a.f,f2:rows[end].f,kind:'零轴区间终点'});
      }
      i=end; continue;
    }
    const b=rows[i+1];
    if(b && b.y!==0 && Math.sign(a.y)!==Math.sign(b.y)) {
      const t=Math.abs(a.y)/(Math.abs(a.y)+Math.abs(b.y));
      const x=(1-t)*a.x+t*b.x;
      if(Number.isFinite(x)) points.push({x,line:a.line,endLine:b.line,f1:a.f,f2:b.f,kind:'线性插值'});
    }
  }
  return points.map((p,i)=>({...p,id:i}));
}
export function selectedResistance(points,left,right) {
  const rs=points.find(p=>p.id===left), total=points.find(p=>p.id===right);
  if(!rs) return {rs:null,total:null,rct:null};
  if(rs.x<0) throw Error('Rs 不能为负数。');
  if(total && (total.id===rs.id || total.x<=rs.x)) throw Error('右截点必须大于 Rs，且不能选择同一点。');
  return {rs:rs.x,total:total?.x??null,rct:total?total.x-rs.x:null};
}


export function eisGuidance(hasData, count, rs, total) {
  if (!hasData) return {
    import: '先选择 EIS 文件，读取后即可查看曲线。', curve: '', selection: '', next: ''
  };
  if (!count) return {
    import: '数据已读取，可在下方浏览曲线。',
    curve: '未找到实轴交点，可放大零轴附近检查。',
    selection: '当前没有可选截点，请确认数据列和测量范围。',
    next: '可导出当前数据记录；尚无法通过截点确定 Rs。'
  };
  return {
    import: '数据已就绪，接下来查看曲线中的候选截点。',
    curve: '点击截点，在下方表格中确认角色。',
    selection: rs === null ? '先指定 Rs；右截点可选。' : total === null ? 'Rs 已选定；可继续指定右截点计算 Rct。' : '两个截点已选定，可随时调整。',
    next: rs === null ? '确认 Rs 后，即可应用到 LSV。' : total === null ? 'Rs 已确认，可应用到 LSV；也可继续选择右截点计算 Rct。' : 'Rs 与 Rct 已确定，可导出结果或返回 LSV。'
  };
}
