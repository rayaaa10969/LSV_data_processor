import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyTextFile,
  nextTestGroupNumber,
  groupProjectFiles,
  isLsvProcessed,
  isEisProcessed,
  isProjectFileProcessed,
  projectGroupStatus,
  matchesProcessFilter,
  disclosureAction,
  computeOverpotentials,
  buildOriginTsv,
} from '../dist/project-domain.mjs';

const parseLsv = text => {
  if (!String(text).includes('Potential')) throw new Error('not LSV');
  return [];
};

test('文件分类忽略扩展名大小写，并优先识别处理结果', () => {
  assert.equal(classifyTextFile('LSV.TXT', 'Potential', parseLsv), 'raw-lsv');
  assert.equal(classifyTextFile('sample-lsv-2.CSV', 'Potential', parseLsv), 'raw-lsv');
  assert.equal(classifyTextFile('lsv-2Tafel.txt', '', parseLsv), 'processed');
  assert.equal(classifyTextFile('CV-5.txt', '', parseLsv), 'cv');
  assert.equal(classifyTextFile('eis-0.5.txt', '', parseLsv), 'eis');
  assert.equal(classifyTextFile('LSV.bin', '', parseLsv), 'other');
  assert.equal(classifyTextFile('LSV.txt', 'no data', parseLsv), 'unknown');
});

test('下一个测试组号只考虑该样品已有且未删除的测试组', () => {
  const files = [
    { sampleId: 's1', testGroupId: 'g1' },
    { sampleId: 's1', testGroupId: 'g3' },
    { sampleId: 's2', testGroupId: 'g9' },
    { sampleId: 's1', testGroupId: 'g8', deletedAt: 'now' },
  ];
  const groups = [{ id: 'g1', number: 1 }, { id: 'g3', number: 3 }, { id: 'g9', number: 9 }, { id: 'g8', number: 8 }];
  assert.equal(nextTestGroupNumber(files, groups, 's1'), 4);
  assert.equal(nextTestGroupNumber(files, groups, 's2'), 10);
  assert.equal(nextTestGroupNumber(files, groups, 'new-sample'), 1);
});

test('样品同名时仍按 SampleId 分组，测试组和文件保持嵌套', () => {
  const samples = groupProjectFiles([
    { id: 'f1', sampleId: 's1', sampleName: 'same', testGroupId: 'g1', testGroup: '测试组 1' },
    { id: 'f2', sampleId: 's1', sampleName: 'same', testGroupId: 'g1', testGroup: '测试组 1' },
    { id: 'f3', sampleId: 's2', sampleName: 'same', testGroupId: 'g2', testGroup: '测试组 1' },
  ], [{ id: 'g1', name: '测试组 1' }, { id: 'g2', name: '测试组 1' }]);
  assert.equal(samples.length, 2);
  assert.deepEqual(samples.map(sample => sample.id), ['s1', 's2']);
  assert.deepEqual(samples[0].files.map(file => file.id), ['f1', 'f2']);
  assert.deepEqual(samples[0].groups.map(group => group.id), ['g1']);
});

test('LSV 和 EIS 完成状态按结果数据判断', () => {
  const lsv = { kind: 'lsv', state: 'raw' };
  const resultOnly = { kind: 'lsv', state: 'result-only' };
  const eis = { kind: 'eis' };
  assert.equal(isLsvProcessed(lsv, { results: { lsv: [{ e: 1, f: 2 }] } }), true);
  assert.equal(isLsvProcessed(lsv, null), false);
  assert.equal(isLsvProcessed(resultOnly, null), true);
  assert.equal(isEisProcessed(eis, { selectedResistance: { rs: 12 } }), true);
  assert.equal(isEisProcessed(eis, null), false);
  assert.equal(isProjectFileProcessed(eis, null, { selectedResistance: { rs: 12 } }), true);
});

test('测试组处理筛选要求组内所有 LSV/EIS 均完成，且附件不改变状态', () => {
  const files = [
    { id: 'e1', kind: 'eis', testGroupId: 'g1' },
    { id: 'l1', kind: 'lsv', testGroupId: 'g1' },
    { id: 'c1', kind: 'cv', testGroupId: 'g1' },
  ];
  const records = { l1: { results: { lsv: [{ e: 1, f: 0.2 }] } } };
  const eis = [{ fileId: 'e1', selectedResistance: { rs: 8 } }];
  assert.equal(projectGroupStatus(files, 'g1', records, eis), 'processed');
  assert.equal(matchesProcessFilter('processed', 'processed'), true);
  assert.equal(matchesProcessFilter('pending', 'processed'), false);
  assert.equal(projectGroupStatus(files, 'g1', {}, []), 'pending');
  assert.equal(projectGroupStatus(files, 'missing', records, eis), 'not-applicable');
});

test('批量展开/折叠时部分展开统一切换到展开，空列表也默认为展开动作', () => {
  assert.equal(disclosureAction([]), 'expand');
  assert.equal(disclosureAction([false, false]), 'expand');
  assert.equal(disclosureAction([true, false]), 'expand');
  assert.equal(disclosureAction([true, true]), 'collapse');
});

test('HER 过电位计算保留 10、100、1000 mA 目标及超出数据范围状态', () => {
  const rows = [
    { e: 0, f: 0 },
    { e: 10, f: 0.1 },
    { e: 100, f: 0.2 },
    { e: 1000, f: 0.3 },
  ];
  const values = computeOverpotentials(rows, 1);
  assert.deepEqual(values.map(row => row.targetCurrent), [10, 100, 1000]);
  assert.deepEqual(values.map(row => row.overpotential), [0.1, 0.2, 0.3]);
  assert.ok(values.every(row => row.status === 'calculated' && row.voltageReference === 'V vs. RHE'));
  assert.equal(computeOverpotentials([{ e: 0, f: 0 }, { e: 1, f: 0.1 }], 1)[2].status, 'outside-data-range');
});

test('Origin LSV 导出列从首列开始，名称、单位、注释和不等长数据对齐', () => {
  const files = [
    { id: 'f1', sampleName: 'Catalyst A', testGroupId: 'g1', testGroup: '测试组 1' },
    { id: 'f2', sampleName: 'Catalyst B', testGroupId: 'g2', testGroup: '测试组 2' },
  ];
  const groups = [{ id: 'g1', name: '测试组 1', acidity: 'H' }, { id: 'g2', name: '测试组 2', acidity: 'neutral' }];
  const records = {
    f1: { results: { lsv: [{ f: 0.2, e: 10 }, { f: 0.3, e: 20 }] } },
    f2: { results: { lsv: [{ f: 0.4, e: 30 }] } },
  };
  const text = buildOriginTsv(files, records, groups, 'lsv', value => String(value));
  const rows = text.slice(0, -2).split('\r\n');
  assert.equal(rows[0], 'Potential\tCurrent density\tPotential\tCurrent density');
  assert.equal(rows[1], 'V vs. RHE\tmA cm⁻²\tV vs. RHE\tmA cm⁻²');
  assert.equal(rows[2], 'Catalyst A / 测试组 1 / H\tCatalyst A / 测试组 1 / H\tCatalyst B / 测试组 2 / 中性\tCatalyst B / 测试组 2 / 中性');
  assert.equal(rows[3], '0.2\t10\t0.4\t30');
  assert.equal(rows[4], '0.3\t20\t\t');
  assert.equal(rows[0].startsWith('\t'), false);
});

test('Origin Tafel 导出优先使用保存结果，并保留 X/Y 列顺序', () => {
  const text = buildOriginTsv(
    [{ id: 'f1', sampleName: 'A', testGroupId: 'g1', testGroup: '测试组 1' }],
    { f1: { results: { lsv: [{ t2: -1, t1: 0.2 }], tafel: [[-0.5, 0.3]] } } },
    [{ id: 'g1', name: '测试组 1', acidity: 'OH' }],
    'tafel',
    String,
  );
  const rows = text.slice(0, -2).split('\r\n');
  assert.equal(rows[0], 'log10|j|\t−F');
  assert.equal(rows[1], 'log₁₀(mA cm⁻²)\tV');
  assert.equal(rows[3], '-0.5\t0.3');
});
