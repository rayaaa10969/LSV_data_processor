export function classifyTextFile(name, text, parseLsv) {
  const lower = String(name || '').toLowerCase();
  if (!/\.(txt|csv)$/i.test(lower)) return 'other';
  if (/tafel|处理后|processed|result/.test(lower)) return 'processed';
  if (/eis/.test(lower)) return 'eis';
  if (/(^|[^a-z])cv([^a-z]|$)/.test(lower)) return 'cv';
  if (/(^|[^a-z])lsv([^a-z]|$)/.test(lower)) {
    try { parseLsv(text); return 'raw-lsv'; } catch { return 'unknown'; }
  }
  return 'other';
}

export function nextTestGroupNumber(files, testGroups, sampleId) {
  const usedIds = new Set(files.filter(file => !file.deletedAt && file.sampleId === sampleId).map(file => file.testGroupId));
  const numbers = testGroups.filter(group => usedIds.has(group.id)).map(group => Number(group.number)).filter(number => Number.isInteger(number) && number > 0);
  return Math.max(0, ...numbers) + 1;
}

export function groupProjectFiles(files, testGroups) {
  const samples = new Map();
  for (const file of files) {
    let sample = samples.get(file.sampleId);
    if (!sample) {
      sample = { id: file.sampleId, name: file.sampleName || '未分组', files: [], groups: [], groupMap: new Map() };
      samples.set(file.sampleId, sample);
    }
    sample.files.push(file);
    let group = sample.groupMap.get(file.testGroupId);
    if (!group) {
      const metadata = testGroups.find(item => item.id === file.testGroupId);
      group = { id: file.testGroupId, name: metadata?.name || file.testGroup || '测试组', meta: metadata };
      sample.groupMap.set(file.testGroupId, group);
      sample.groups.push(group);
    }
  }
  return [...samples.values()].map(({ groupMap, ...sample }) => sample);
}

export function isLsvProcessed(file, record) {
  return file?.kind === 'lsv' && (file.state === 'result-only' || (Array.isArray(record?.results?.lsv) && record.results.lsv.length > 0));
}

export function isEisProcessed(file, eis) {
  return file?.kind === 'eis' && (!!file.eisResult || Number.isFinite(eis?.selectedResistance?.rs));
}

export function isProjectFileProcessed(file, record, eis) {
  return isLsvProcessed(file, record) || isEisProcessed(file, eis);
}

export function projectGroupStatus(files, groupId, records = {}, eisEntries = []) {
  const relevant = files.filter(file => file.testGroupId === groupId && (file.kind === 'lsv' || file.kind === 'eis'));
  if (!relevant.length) return 'not-applicable';
  return relevant.every(file => isProjectFileProcessed(file, records[file.id], eisEntries.find(item => item.fileId === file.id))) ? 'processed' : 'pending';
}

export function matchesProcessFilter(status, filter) {
  return filter === 'all' || (filter === 'processed' ? status === 'processed' : status === 'pending');
}

export function disclosureAction(openStates) {
  return openStates.length > 0 && openStates.every(Boolean) ? 'collapse' : 'expand';
}

export function computeOverpotentials(data, area) {
  return [10, 100, 1000].map(target => {
    const density = target / area;
    let potential = null;
    for (let i = 0; i < data.length - 1; i++) {
      const a = data[i], b = data[i + 1], x = Math.abs(a.e), y = Math.abs(b.e);
      if ((density - x) * (density - y) <= 0 && x !== y) {
        const t = (density - x) / (y - x);
        potential = a.f + t * (b.f - a.f);
        break;
      }
    }
    return { targetCurrent: target, currentUnit: 'mA', targetCurrentDensity: density, currentDensityUnit: 'mA/cm^2', potentialAtTargetCurrent: potential, voltageReference: 'V vs. RHE', equilibriumPotentialV_RHE: 0, overpotential: potential === null ? null : Math.abs(potential), voltageUnit: 'V', status: potential === null ? 'outside-data-range' : 'calculated' };
  });
}

export function buildOriginTsv(selectedFiles, records, testGroups, dataset, formatNumber = String) {
  const columns = [];
  for (const file of selectedFiles) {
    const result = records[file.id]?.results || {}, lsv = result.lsv || [];
    const group = testGroups.find(item => item.id === file.testGroupId), acid = group?.acidity;
    const comment = [file.sampleName, group?.name || file.testGroup, acid === 'neutral' ? '中性' : acid].filter(Boolean).join(' / ');
    const tafel = dataset === 'tafel';
    const pairs = tafel ? (Array.isArray(result.tafel) && result.tafel.length ? result.tafel : lsv.map(row => [row.t2, row.t1])) : null;
    const x = tafel ? pairs.map(row => row[0]) : lsv.map(row => row.f);
    const y = tafel ? pairs.map(row => row[1]) : lsv.map(row => row.e);
    columns.push({ name: tafel ? 'log10|j|' : 'Potential', unit: tafel ? 'log₁₀(mA cm⁻²)' : 'V vs. RHE', comment, values: x });
    columns.push({ name: tafel ? '−F' : 'Current density', unit: tafel ? 'V' : 'mA cm⁻²', comment, values: y });
  }
  if (!columns.length) return '';
  const lines = [columns.map(column => column.name), columns.map(column => column.unit), columns.map(column => column.comment)];
  const rowCount = Math.max(...columns.map(column => column.values.length));
  for (let i = 0; i < rowCount; i++) lines.push(columns.map(column => column.values[i] === undefined ? '' : formatNumber(column.values[i])));
  return lines.map(row => row.join('\t')).join('\r\n') + '\r\n';
}
