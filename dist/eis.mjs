import {parseEIS,intersections,selectedResistance} from './eis-core.mjs';
const $=id=>document.getElementById(id), fmt=n=>n===null?'未确定':Number(n.toPrecision(8)).toString();
let rows=[],points=[],left=null,right=null,focus=null,raw='',filename='',view=null,token=0;
function page(eis){$('lsv-page').hidden=eis;$('eis-page').hidden=!eis;$('nav-lsv').setAttribute('aria-current',eis?'false':'page');$('nav-eis').setAttribute('aria-current',eis?'page':'false');if(eis)draw();}
$('nav-lsv').onclick=$('eis-back').onclick=()=>page(false);
$('nav-eis').onclick=$('open-eis').onclick=()=>page(true);page(false);
function message(text){$('eis-status').textContent=text;}
function refresh(){
  let result;try{result=selectedResistance(points,left,right);}catch(e){message(e.message);return;}
  $('eis-rs').textContent=fmt(result.rs);$('eis-total').textContent=fmt(result.total);$('eis-rct').textContent=fmt(result.rct);
  $('eis-apply').disabled=result.rs===null;$('eis-export').disabled=!rows.some(Boolean);
  $('eis-candidates').replaceChildren(...points.map(p=>{
    const tr=document.createElement('tr');tr.id=`eis-point-${p.id}`;tr.classList.toggle('eis-selected',focus===p.id||left===p.id||right===p.id);
    [`P${p.id+1}`,fmt(p.x),`${p.line}–${p.endLine}`,`${fmt(p.f1)} → ${fmt(p.f2)}`,p.kind].forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.append(td);});
    const td=document.createElement('td');['Rs','右截点'].forEach((role,i)=>{const b=document.createElement('button');b.type='button';b.className='secondary';b.textContent=(i?right:left)===p.id?`✓ ${role}`:`设为 ${role}`;b.setAttribute('aria-pressed',String((i?right:left)===p.id));b.onclick=()=>{
      const l=i?left:p.id,r=i?p.id:right;
      if(i&&l===null){message('请先选择 Rs。');return;}
      try{selectedResistance(points,l,r);left=l;right=r;focus=p.id;message('已更新选择。只有 Rs 时也可以应用到 LSV。');refresh();}catch(e){message(e.message);}
    };td.append(b);});tr.append(td);return tr;
  }));
  if(!points.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=6;td.textContent=rows.length?'未发现实轴交点，可继续浏览曲线。':'请先导入 EIS 文件。';tr.append(td);$('eis-candidates').append(tr);}draw();
}
function ingest(manual=false){left=right=focus=null;rows=[];points=[];view=null;try{
 const cols=['eis-fcol','eis-xcol','eis-ycol'].map(id=>Number($(id).value)-1);
 if(cols.some(c=>!Number.isInteger(c)||c<0)||new Set(cols).size!==3)throw Error('请选择三个不同的有效列号。');
 rows=parseEIS(raw,cols,!manual);points=intersections(rows);message(`已读取 ${rows.filter(Boolean).length} 个采样点，找到 ${points.length} 个候选截点。请人工确认。`);
 }catch(e){message(e.message);}refresh();}
$('eis-file').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;const version=++token;raw='';filename=file.name;rows=[];points=[];left=right=focus=null;view=null;refresh();$('eis-file-info').textContent=`${filename} · 正在读取…`;try{if(file.size>20*1024*1024)throw Error('文件超过 20 MB。');const text=await file.text();if(version!==token)return;raw=text;$('eis-file-info').textContent=filename;ingest();}catch(err){if(version===token){$('eis-file-info').textContent='读取失败';message(err.message);}}};
$('eis-reparse').onclick=()=>{if(raw)ingest(true);else message('请先导入文件。');};
$('eis-demo').onclick=()=>{token++;filename='EIS_demo.txt';raw='Frequency/Hz,Zreal/ohm,Zimag/ohm\n100000,4,2\n50000,6,-2\n10000,10,-8\n1000,20,-10\n100,30,-8\n10,34,-2\n1,36,2';$('eis-file-info').textContent=filename;ingest();};
$('eis-clear').onclick=()=>{left=right=focus=null;message('已清除选择。');refresh();};
$('eis-sign').onchange=()=>{view=null;draw();};$('eis-reset').onclick=()=>{view=null;draw();};
$('eis-zero').onclick=()=>{view=null;draw();if(view){const span=(view[3]-view[2])*.12;view[2]=-span;view[3]=span;draw();}};
$('eis-apply').onclick=()=>{const r=selectedResistance(points,left,right);if(r.rs===null)return;const input=$('resistance'),changed=Number(input.value)!==r.rs||!input.value.trim();input.value=String(r.rs);if(changed)input.dispatchEvent(new Event('input',{bubbles:true}));$('rs-source').textContent=`来自 ${filename} · P${left+1} · Rs = ${fmt(r.rs)} Ω`;page(false);input.focus();};
$('resistance').addEventListener('input',()=>{$('rs-source').textContent='';});
$('demo').addEventListener('click',()=>{$('rs-source').textContent='';});
$('eis-export').onclick=()=>{const r=selectedResistance(points,left,right);const csv=[['文件',filename],['Rs / ohm',r.rs??'未确定'],['Rs+Rct / ohm',r.total??'未确定'],['Rct / ohm',r.rct??'未确定'],['方法','相邻点线性插值；零轴区间仅列出端点；Rct 适用于相应简单等效电路'],['编号','Zreal / ohm','起始行','结束行','频率1 / Hz','频率2 / Hz','方式','角色'],...points.map(p=>[`P${p.id+1}`,p.x,p.line,p.endLine,p.f1,p.f2,p.kind,p.id===left?'Rs':p.id===right?'Rs+Rct':''])].map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n');const url=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=filename.replace(/\.[^.]+$/,'')+'_EIS.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
function draw(){
 const chart=$('eis-chart');if(!rows.some(Boolean)){chart.textContent='导入 EIS 文件后显示曲线。';return;}
 const sign=$('eis-sign').checked?-1:1;
 if(!view){let x0=Infinity,x1=-Infinity,y0=0,y1=0;for(const p of rows){if(!p)continue;x0=Math.min(x0,p.x);x1=Math.max(x1,p.x);y0=Math.min(y0,p.y*sign);y1=Math.max(y1,p.y*sign);}const dx=(x1-x0)||1,dy=(y1-y0)||1;view=[x0-dx*.08,x1+dx*.08,y0-dy*.08,y1+dy*.08];}
 const [xmin,xmax,ymin,ymax]=view,xp=x=>75+(x-xmin)/(xmax-xmin)*595,yp=y=>245-(y-ymin)/(ymax-ymin)*215;
 let grid='';for(let i=0;i<5;i++){const x=75+i*148.75,y=30+i*53.75;grid+=`<path d="M75 ${y}H670 M${x} 30V245" stroke="#edf1f4"/><text x="${x}" y="267" text-anchor="middle">${fmt(xmin+(xmax-xmin)*i/4)}</text><text x="68" y="${y+3}" text-anchor="end">${fmt(ymax-(ymax-ymin)*i/4)}</text>`;}
 let d='',segment=false;for(const p of rows){if(!p){segment=false;continue;}d+=`${segment?'L':'M'}${xp(p.x)},${yp(p.y*sign)} `;segment=true;}
 const dots=rows.filter(Boolean).filter((_,i)=>i%Math.max(1,Math.ceil(rows.length/1500))===0).map(p=>`<circle cx="${xp(p.x)}" cy="${yp(p.y*sign)}" r="2" fill="#0a9385"><title>行 ${p.line} · ${p.f} Hz · Z′ ${p.x} · Z″ ${p.y}</title></circle>`).join('');
 chart.innerHTML=`<svg viewBox="0 0 720 300" aria-label="EIS Nyquist 曲线"><defs><clipPath id="eis-clip"><rect x="75" y="30" width="595" height="215"/></clipPath></defs><g font-size="9" fill="#778899">${grid}<text x="370" y="293" text-anchor="middle">Z′ / Ω</text><text transform="translate(14 140) rotate(-90)" text-anchor="middle">${sign===-1?'−':''}Z″ / Ω</text></g><g clip-path="url(#eis-clip)"><path d="M75 ${yp(0)}H670" stroke="#8998a8" stroke-dasharray="4 3"/><path d="${d}" fill="none" stroke="#0a9385" stroke-width="1.5"/>${dots}${points.map(p=>`<g data-point="${p.id}" style="cursor:pointer"><circle cx="${xp(p.x)}" cy="${yp(0)}" r="9" fill="${p.id===left?'#087e76':p.id===right?'#d58b25':'#6069bb'}"/><text x="${xp(p.x)}" y="${yp(0)-14}" text-anchor="middle" font-size="11">P${p.id+1}</text><title>P${p.id+1}: ${p.x} Ω</title></g>`).join('')}</g></svg>`;
 chart.querySelectorAll('[data-point]').forEach(g=>g.onclick=()=>{focus=Number(g.dataset.point);refresh();$(`eis-point-${focus}`).scrollIntoView({block:'nearest',behavior:'smooth'});});
}
const chart=$('eis-chart');chart.addEventListener('wheel',e=>{if(!view)return;e.preventDefault();const scale=e.deltaY>0?1.2:1/1.2,cx=(view[0]+view[1])/2,cy=(view[2]+view[3])/2;const next=[cx+(view[0]-cx)*scale,cx+(view[1]-cx)*scale,cy+(view[2]-cy)*scale,cy+(view[3]-cy)*scale];if(next.every(Number.isFinite)&&next[1]>next[0]&&next[3]>next[2]){view=next;draw();}},{passive:false});
let drag=null;chart.onpointerdown=e=>{if(!view||e.target.closest('[data-point]'))return;drag={x:e.clientX,y:e.clientY,view:[...view]};chart.setPointerCapture(e.pointerId);};chart.onpointermove=e=>{if(!drag)return;const rect=chart.getBoundingClientRect(),dx=(e.clientX-drag.x)/rect.width*720/595*(drag.view[1]-drag.view[0]),dy=(e.clientY-drag.y)/rect.height*300/215*(drag.view[3]-drag.view[2]);view=[drag.view[0]-dx,drag.view[1]-dx,drag.view[2]+dy,drag.view[3]+dy];draw();};chart.onpointerup=chart.onpointercancel=()=>{drag=null;};refresh();
