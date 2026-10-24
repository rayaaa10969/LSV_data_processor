import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { parse, compute, output, numberText } from '../dist/core.mjs';

const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
const source = (await readFile(new URL('../dist/app.mjs', import.meta.url), 'utf8')).replace(/^import .*?;\s*/, '');

// Minimal DOM adapter: execute the complete production app, including the existing
// form invalidation handler. Values and preset buttons come from the real HTML.
function app() {
  const elements = new Map();
  let focused;
  class Element {
    constructor(id) { this.id=id;this.value='';this.textContent='';this.dataset={};this.listeners={};this.disabled=false;this.open=false;this.classList={toggle(){}}; }
    addEventListener(type, handler) { (this.listeners[type]??=[]).push(handler); }
    dispatchEvent(event) {
      event.target??=this;
      this[`on${event.type}`]?.(event);
      for(const handler of this.listeners[event.type]??[]) handler(event);
      if(event.bubbles && this.id==='voltage') elements.get('form').dispatchEvent(event);
    }
    click(extra={}) { this.dispatchEvent({type:'click',preventDefault(){},...extra}); }
    focus() { focused=this.id; }
    showModal() { this.open=true; }
    close() { this.open=false; }
    getBoundingClientRect() { return {left:10,right:100,top:10,bottom:100}; }
    replaceChildren(...children) { this.children=children; }
    append(child) { (this.children??=[]).push(child); }
    requestSubmit() { this.onsubmit({preventDefault(){}}); }
  }
  for(const match of html.matchAll(/id="([^"]+)"/g)) elements.set(match[1],new Element(match[1]));
  for(const match of html.matchAll(/<input\b[^>]*id="([^"]+)"[^>]*>/g)) {
    const value=match[0].match(/value="([^"]*)"/);if(value)elements.get(match[1]).value=value[1];
  }
  const buttons=[...html.matchAll(/<button\b[^>]*data-copy-voltage="([^"]+)"[^>]*>/g)].map(match=>{
    const b=new Element();b.dataset.copyVoltage=match[1];return b;
  });
  const document={getElementById:id=>elements.get(id),querySelectorAll:selector=>selector==='[data-copy-voltage]'?buttons:[],createElement:()=>new Element()};
  class DOMEvent {constructor(type,options={}){this.type=type;Object.assign(this,options);}}
  runInNewContext(source,{document,Event:DOMEvent,parse,compute,output,numberText,setTimeout});
  return {get:id=>elements.get(id),buttons,focus:()=>focused};
}

test('Xu Lab 弹窗入口和默认值与实际页面一致',()=>{
  const ui=app();
  assert.deepEqual(ui.buttons.map(b=>b.dataset.copyVoltage),['0.91','0.2','0.6']);
  assert.match(html,/aria-haspopup="dialog"/);
  assert.match(html,/aria-labelledby="xu-lab-title"/);
  ui.get('xu-lab-open').click();assert.equal(ui.get('xu-lab-dialog').open,true);
  ui.get('xu-lab-close').click();assert.equal(ui.get('xu-lab-dialog').open,false);
});

for(const [index,name,value] of [[0,'碱性','0.91'],[1,'酸性','0.2'],[2,'中性','0.6']]) {
  test(`${name}参数直接回填、关闭弹窗、聚焦输入框，并使旧计算失效`,()=>{
    const ui=app();ui.get('demo').click();
    assert.equal(ui.get('badge').textContent,'✓ 处理完成');
    assert.equal(ui.get('export-lsv').disabled,false);
    // Ensure this click changes the value, including the acid preset used by the demo.
    if(ui.get('voltage').value===value){ui.get('voltage').value='0.1';ui.get('form').requestSubmit();}
    const area=ui.get('area').value,rs=ui.get('resistance').value;
    ui.get('xu-lab-open').click();ui.buttons[index].click();
    assert.equal(ui.get('voltage').value,value);
    assert.equal(ui.get('xu-lab-dialog').open,false);
    assert.equal(ui.focus(),'voltage');
    assert.equal(ui.get('export-lsv').disabled,true);
    assert.equal(ui.get('export-tafel').disabled,true);
    assert.equal(ui.get('badge').textContent,'待处理');
    assert.equal(ui.get('count').textContent,'—');
    assert.match(ui.get('status').textContent,/请重新处理/);
    assert.equal(ui.get('area').value,area);assert.equal(ui.get('resistance').value,rs);
    ui.get('form').requestSubmit();assert.equal(ui.get('badge').textContent,'✓ 处理完成');
  });
}

test('选择当前相同值保留有效结果，但仍关闭弹窗并聚焦',()=>{
  const ui=app();ui.get('demo').click();
  ui.get('xu-lab-open').click();ui.buttons[1].click();
  assert.equal(ui.get('voltage').value,'0.2');
  assert.equal(ui.get('export-lsv').disabled,false);
  assert.equal(ui.get('badge').textContent,'✓ 处理完成');
  assert.equal(ui.get('xu-lab-dialog').open,false);assert.equal(ui.focus(),'voltage');
});

test('点击弹窗内容不关闭，点击遮罩关闭',()=>{
  const ui=app(),dialog=ui.get('xu-lab-dialog');
  ui.get('xu-lab-open').click();
  dialog.click({target:ui.buttons[0],clientX:30,clientY:30});assert.equal(dialog.open,true);
  dialog.click({clientX:20,clientY:20});assert.equal(dialog.open,true);
  dialog.click({clientX:0,clientY:0});assert.equal(dialog.open,false);
});
