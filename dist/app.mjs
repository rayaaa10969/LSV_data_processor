import {parse,compute,output,numberText} from './core.mjs';
const $=id=>document.getElementById(id);let rows=null,result=null,name='',tab='lsv',reading=0;
const fmt=n=>Number.isFinite(n)?Number(n.toPrecision(7)).toString():numberText(n);
function status(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);}
function invalidate(){result=null;['export-lsv','export-tafel'].forEach(id=>$(id).disabled=true);$('badge').textContent=rows?'待处理':'等待数据';['count','baseline','potential'].forEach(id=>$(id).textContent='—');$('tbody').innerHTML='<tr><td colspan="5" class="table-empty">处理完成后将在这里展示数据</td></tr>';$('table-note').textContent='导出文件保留全部数据，不含标题行，与原脚本格式一致。';draw();}
async function load(file){const token=++reading;rows=null;invalidate();$('file-info').textContent='正在读取…';status('');try{if(file.size>20*1024*1024)throw Error('文件超过 20 MB，请选择较小的文件。');const text=await file.text();if(token!==reading)return;rows=parse(text);name=file.name.replace(/\.[^.]+$/,'');$('file-info').textContent=`${file.name} · ${rows.length.toLocaleString()} 行`;invalidate();status('文件已读取，确认参数后开始处理。');}catch(e){if(token!==reading)return;$('file-info').textContent='读取失败';status(e.message,true);}}
$('file').addEventListener('change',e=>{if(e.target.files[0])load(e.target.files[0]);e.target.value='';});
const drop=$('drop');drop.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('file').click();}});['dragover','dragleave','drop'].forEach(type=>drop.addEventListener(type,e=>{e.preventDefault();drop.classList.toggle('drag',type==='dragover');if(type==='drop'&&e.dataTransfer.files[0])load(e.dataTransfer.files[0]);}));
$('demo').onclick=()=>{reading++;name='LSV_demo';rows=Array.from({length:201},(_,i)=>{const a=-.8+i*.004;return [a,-.00002*(Math.exp(-a*8)-1)];});$('file-info').textContent='LSV_demo.txt · 201 行 · 示例数据';$('voltage').value='0.2';$('area').value='1';$('resistance').value='5';invalidate();$('form').requestSubmit();};
$('form').addEventListener('input',()=>{invalidate();status('参数已修改，请重新处理。');});
$('form').onsubmit=e=>{e.preventDefault();if(!rows){status('请先选择数据文件，或载入示例数据。',true);return;}try{const values=['voltage','area','resistance'].map(id=>{if(!$(id).value.trim())throw Error('请完整填写三个参数。');return Number($(id).value);});result=compute(rows,...values);$('count').textContent=rows.length.toLocaleString();$('baseline').textContent=fmt(result.baseline);$('potential').textContent=fmt(result.data[result.index].c);$('badge').textContent='✓ 处理完成';$('tbody').replaceChildren(...result.data.slice(0,100).map((r,i)=>{const tr=document.createElement('tr');[i+1,fmt(r.f),fmt(r.e),fmt(r.t1),fmt(r.t2)].forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.append(td);});return tr;}));$('table-note').textContent=`预览前 ${Math.min(rows.length,100)} / ${rows.length} 行，下载文件包含全部数据。`;['export-lsv','export-tafel'].forEach(id=>$(id).disabled=false);status('计算完成，可分别下载 LSV 和 Tafel 数据。');draw();}catch(err){invalidate();status(err.message,true);}};
document.querySelectorAll('[data-tab]').forEach(btn=>btn.onclick=()=>{tab=btn.dataset.tab;document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('active',b===btn);b.setAttribute('aria-selected',String(b===btn));});draw();});
function draw(){if(!result){$('chart').innerHTML='<div class="empty"><span>∿</span><h3>你的下一条曲线，从这里开始</h3><p>导入实验文件并设置参数，即可查看处理结果</p></div>';return;}const pts=result.data.map(r=>tab==='lsv'?[r.f,r.e]:[r.t2,r.t1]);const valid=pts.filter(p=>p.every(Number.isFinite));$('chart-note').textContent=tab==='lsv'?'保留原始采样顺序':`已忽略 ${pts.length-valid.length} 个非有限值点`;
if(!valid.length){$('chart').textContent='没有可绘制的有限值数据点。';return;}
let xmin=Infinity,xmax=-Infinity,ymin=Infinity,ymax=-Infinity;for(const [x,y]of valid){xmin=Math.min(xmin,x);xmax=Math.max(xmax,x);ymin=Math.min(ymin,y);ymax=Math.max(ymax,y);}if(xmin===xmax){xmin-=.5;xmax+=.5;}if(ymin===ymax){ymin-=.5;ymax+=.5;}const xp=(x)=>65+(x-xmin)/(xmax-xmin)*615,yp=y=>245-(y-ymin)/(ymax-ymin)*210;
let grid='',labels='';for(let i=0;i<5;i++){let y=35+i*52.5,x=65+i*153.75;grid+=`<path d="M65 ${y}H680 M${x} 35V245" stroke="#edf1f4"/>`;labels+=`<text x="55" y="${y+3}" text-anchor="end">${fmt(ymax-(ymax-ymin)*i/4)}</text><text x="${x}" y="265" text-anchor="middle">${fmt(xmin+(xmax-xmin)*i/4)}</text>`;}
const stride=Math.max(1,Math.ceil(pts.length/4000));let path='',segment=false;pts.forEach(([x,y],i)=>{if(!Number.isFinite(x)||!Number.isFinite(y)){segment=false;return;}if(i%stride&&i!==pts.length-1)return;path+=`${segment?'L':'M'}${xp(x).toFixed(2)},${yp(y).toFixed(2)} `;segment=true;});
$('chart').innerHTML=`<svg viewBox="0 0 720 300" role="img" aria-label="${tab==='lsv'?'LSV':'Tafel'} 数据曲线"><g>${grid}</g><g font-size="9" fill="#91a0af" font-family="sans-serif">${labels}<text x="370" y="291" text-anchor="middle">${tab==='lsv'?'补偿电位 F / V':'log₁₀ |E| / (mA·cm⁻²)'}</text><text transform="translate(12 140) rotate(-90)" text-anchor="middle">${tab==='lsv'?'电流密度 E / mA·cm⁻²':'−F / V'}</text></g><path d="${path}" fill="none" stroke="#0a9385" stroke-width="2.3" stroke-linejoin="round"/></svg>`;}
function download(tafel){if(!result)return;const url=URL.createObjectURL(new Blob([output(result.data,tafel)],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name+(tafel?'Tafel.txt':'_处理后.txt');a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('export-lsv').onclick=()=>download(false);$('export-tafel').onclick=()=>download(true);

const labDialog=document.getElementById("xu-lab-dialog");
document.getElementById("xu-lab-open").onclick=()=>labDialog.showModal();
document.getElementById("xu-lab-close").onclick=()=>labDialog.close();
labDialog.addEventListener("click",e=>{if(e.target!==labDialog)return;const r=labDialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)labDialog.close();});

document.querySelectorAll('[data-copy-voltage]').forEach(button=>{
  button.addEventListener('click',()=>{
    const value=button.dataset.copyVoltage;
    const input=$('voltage');
    if(input.value!==value){
      input.value=value;
      input.dispatchEvent(new Event('input',{bubbles:true}));
      status(`已应用 Xu Lab 电压修正值 ${value} V，请重新处理。`);
    }
    labDialog.close();
    input.focus();
  });
});
