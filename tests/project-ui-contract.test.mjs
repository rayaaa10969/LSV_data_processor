import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const read = name => readFile(path.join(root, name), 'utf8');

test('项目数据通过 IndexedDB 持久化，并包含项目快照', async () => {
  const source = await read('project.mjs');
  assert.match(source, /indexedDB\.open\(DB_NAME,DB_VERSION\)/);
  assert.match(source, /objectStore\(DB_STORE\)\.put\(data\)/);
  assert.match(source, /portableSnapshot\(payload\(\)\)/);
  assert.match(source, /\.lsvproj/);
});

test('导入页包含新样品/已有样品两种入口，项目样品按 SampleId 分开', async () => {
  const [html, source] = await Promise.all([read('index.html'), read('project.mjs')]);
  assert.match(html, /id="import-mode-new"/);
  assert.match(html, /id="import-mode-test"/);
  assert.match(source, /sampleId===sampleId/);
  assert.match(source, /sampleId:state\.importSampleId/);
  assert.match(source, /testGroupNumber=number/);
});

test('项目 EIS 页面和独立 EIS 页面共享工作区，并提供回到项目主页的挂载点', async () => {
  const [html, source, eis] = await Promise.all([read('index.html'), read('project.mjs'), read('eis.mjs')]);
  assert.match(html, /id="project-eis-page"/);
  assert.match(html, /id="project-eis-workspace"/);
  assert.match(html, /id="import-back-home-mount"/);
  assert.match(html, /id="project-eis-back-home-mount"/);
  assert.match(source, /mountPageBackHomeButton\('import-back-home-mount'\)/);
  assert.match(source, /mountPageBackHomeButton\('project-eis-back-home-mount'\)/);
  assert.match(source, /moveEisWorkspace\('project-eis-workspace'\)/);
  assert.match(eis, /lsv-project-open-eis/);
});

test('项目卡片初次以折叠状态呈现，折叠按钮绑定批量切换', async () => {
  const source = await read('project.mjs');
  assert.match(source, /opened=hadSamples\?openSamples\.has\(sample\.id\):false/);
  assert.match(source, /project-toggle-samples/);
  assert.match(source, /disclosureAction\(cards\.map\(card=>card\.open\)\)/);
});
