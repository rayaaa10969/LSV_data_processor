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
