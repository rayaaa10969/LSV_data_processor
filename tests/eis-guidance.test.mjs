import test from 'node:test';
import assert from 'node:assert/strict';
import { eisGuidance } from '../dist/eis-core.mjs';
test('EIS guidance follows import, candidate and selection states',()=>{
 const empty=eisGuidance(false,0,null,null);
 assert.match(empty.import,/先选择 EIS/);assert.equal(empty.next,'');
 const missing=eisGuidance(true,0,null,null);
 assert.match(missing.selection,/没有可选截点/);assert.doesNotMatch(missing.next,/应用到 LSV/);
 assert.match(eisGuidance(true,3,null,null).selection,/先指定 Rs/);
 const rs=eisGuidance(true,3,0,null);
 assert.match(rs.next,/Rs 已确认/);assert.match(rs.next,/继续选择右截点/);
 const both=eisGuidance(true,3,5,35);
 assert.match(both.next,/Rs 与 Rct 已确定/);
 assert.match(eisGuidance(true,3,null,null).next,/确认 Rs 后/);
});
