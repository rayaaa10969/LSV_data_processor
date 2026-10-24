import test from 'node:test';
import assert from 'node:assert/strict';
import {parseEIS,intersections,selectedResistance} from '../dist/eis-core.mjs';
test('multiple crossings preserve sampling order and interpolate',()=>{
 const points=intersections(parseEIS('Frequency/Hz,Zreal/ohm,Zimag/ohm\n100,10,2\n50,6,-2\n10,20,2\n1,30,-2'));
 assert.deepEqual(points.map(p=>p.x),[8,13,25]);
 assert.deepEqual(selectedResistance(points,0,2),{rs:8,total:25,rct:17});
 assert.deepEqual(selectedResistance(points,0,null),{rs:8,total:null,rct:null});
 assert.throws(()=>selectedResistance(points,2,0));assert.throws(()=>selectedResistance(points,0,0));
});
test('zero sample deduplicates; zero interval endpoints remain explicit',()=>{
 const points=intersections(parseEIS('10,1,1\n9,2,0\n8,3,-1\n7,4,0\n6,5,0\n5,6,1'));
 assert.deepEqual(points.map(p=>p.x),[2,4,5]);assert.match(points[1].kind,/区间/);
});
test('invalid rows break interpolation and absent crossings remain absent',()=>{
 assert.equal(intersections(parseEIS('10,1,1\ninvalid\n1,2,-1')).length,0);
 assert.equal(intersections(parseEIS('10,1,1\n1,2,2')).length,0);
 assert.throws(()=>parseEIS('header only'));assert.throws(()=>selectedResistance([{id:0,x:-1}],0,null));
});
test('header mappings, BOM, manual columns and scientific notation',()=>{
 assert.equal(parseEIS('\uFEFFZimag/ohm,Frequency/Hz,Zreal/ohm\n-2,1e3,15')[0].x,15);
 assert.equal(parseEIS('3;4;5',[2,0,1],false)[0].x,3);
});

for (const imaginary of ["Z''/ohm", 'Z"/ohm']) {
 test(`CHI760E 表头 ${imaginary} 正确识别、跳过抬头并自动映射乱序列`,()=>{
  const text = `Instrument Model: CHI760E\n100,200,300\nFreq/Hz, Z'/ohm, ${imaginary}, Z/ohm, Phase/deg\n\n1000,4,2,4.47,26.6\n100,6,-2,6.32,-18.4`;
  const expected = [{f:1000,x:4,y:2,line:5},{f:100,x:6,y:-2,line:6}];
  assert.deepEqual(parseEIS(text),expected);
  const reordered = `Instrument Model: CHI760E\n100,200,300\n${imaginary}, Phase/deg, Z'/ohm, Freq/Hz\n\n2,26.6,4,1000\n-2,-18.4,6,100`;
  assert.deepEqual(parseEIS(reordered),expected);
  assert.equal(intersections(parseEIS(reordered))[0].x,5);
  // Explicit manual mapping must still override recognized column labels.
  assert.deepEqual(parseEIS(reordered,[3,2,0],false),expected);
  assert.equal(parseEIS(reordered,[0,2,3],false)[0].f,2);
 });
}
