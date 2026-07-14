const VERSION_FIELDS = ['model', 'prompt', 'provider', 'knowledge', 'retriever', 'scorer', 'dataset'];
const EVIDENCE_FIELDS = ['goldenDataset', 'qualityRuns', 'outcomeSnapshot', 'approvalRecord'];

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function below(blockers, path, value, threshold) {
  if (!finite(value)) blockers.noData.push(`${path}:missing`);
  else if (value < threshold) blockers.fail.push(`${path}<${threshold}`);
}

function above(blockers, path, value, threshold) {
  if (!finite(value)) blockers.noData.push(`${path}:missing`);
  else if (value > threshold) blockers.fail.push(`${path}>${threshold}`);
}

function dateMs(value) {
  const parsed = Date.parse(value ?? '');
  return Number.isFinite(parsed) ? parsed : null;
}

export function evaluateKnowledgeQuality(rubric, report, { now = new Date().toISOString() } = {}) {
  const blockers = { expired: [], fail: [], noData: [] };
  if (!report || typeof report !== 'object') {
    return { status: 'NO_DATA', blockers: ['report:missing'] };
  }

  const nowMs = dateMs(now);
  const evaluatedAtMs = dateMs(report.evaluatedAt);
  if (nowMs === null) throw new TypeError('now must be an ISO timestamp');
  if (evaluatedAtMs === null) blockers.noData.push('evaluatedAt:missing');
  else if (evaluatedAtMs - nowMs > 300_000) blockers.fail.push('evaluatedAt:future');
  else if (nowMs - evaluatedAtMs > rubric.evidenceLifecycle.evaluationReportMaxAgeHours * 3_600_000) {
    blockers.expired.push('evaluation-report:expired');
  }
  const reviewDueMs = dateMs(`${rubric.reviewDueAt}T23:59:59Z`);
  if (reviewDueMs !== null && nowMs > reviewDueMs) blockers.expired.push('rubric:review-due');

  const lifecycleTimestamps = [
    {
      field: 'goldenLabelsReviewedAt',
      maxAgeMs: rubric.evidenceLifecycle.goldenLabelReviewDays * 86_400_000,
      expiredBlocker: 'golden-labels:expired',
    },
    {
      field: 'outcomeSnapshotAt',
      maxAgeMs: rubric.evidenceLifecycle.outcomeSnapshotMaxAgeDays * 86_400_000,
      expiredBlocker: 'outcome-snapshot:expired',
    },
  ];
  for (const lifecycle of lifecycleTimestamps) {
    const timestampMs = dateMs(report[lifecycle.field]);
    if (timestampMs === null) blockers.noData.push(`${lifecycle.field}:missing`);
    else if (timestampMs - nowMs > 300_000) blockers.fail.push(`${lifecycle.field}:future`);
    else if (nowMs - timestampMs > lifecycle.maxAgeMs) blockers.expired.push(lifecycle.expiredBlocker);
  }

  const scope = report.scope ?? {};
  if (
    !rubric.supportedScope.languages.includes(scope.language) ||
    !rubric.supportedScope.jurisdictions.includes(scope.jurisdiction) ||
    !rubric.supportedScope.contractFamilies.includes(scope.contractFamily)
  ) blockers.fail.push('scope:unsupported');

  const dataset = report.dataset ?? {};
  for (const [field, threshold] of Object.entries(rubric.dataset.minimums)) {
    const value = field === 'adversarialTypes' ? new Set(dataset.adversarialTypes ?? []).size : dataset[field];
    if (!finite(value)) blockers.noData.push(`dataset.${field}:missing`);
    else if (value < threshold) blockers.noData.push(`dataset.${field}<${threshold}`);
  }
  for (const field of ['labelsArbitrated', 'sourceAuthorized', 'deidentified']) {
    if (dataset[field] !== true) blockers.noData.push(`dataset.${field}:required`);
  }

  for (const field of VERSION_FIELDS) {
    if (typeof report.versions?.[field] !== 'string' || report.versions[field].trim() === '') {
      blockers.noData.push(`versions.${field}:missing`);
    }
  }

  const metrics = report.metrics ?? {};
  for (const [field, threshold] of Object.entries(rubric.qualityThresholds)) {
    if (field === 'fabricatedClauseCount') above(blockers, `metrics.${field}`, metrics[field], threshold);
    else below(blockers, `metrics.${field}`, metrics[field], threshold);
  }
  if (!Array.isArray(report.runMetrics) || report.runMetrics.length < rubric.dataset.minimums.repeatedRuns) {
    blockers.noData.push(`runMetrics.length<${rubric.dataset.minimums.repeatedRuns}`);
  } else {
    const runIds = new Set();
    report.runMetrics.forEach((run, index) => {
      if (typeof run.runId !== 'string' || run.runId.trim() === '' || runIds.has(run.runId)) {
        blockers.noData.push(`runMetrics[${index}].runId:missing-or-duplicate`);
      } else {
        runIds.add(run.runId);
      }
      for (const [field, threshold] of Object.entries(rubric.qualityThresholds)) {
        const path = `runMetrics[${index}].${field}`;
        if (field === 'fabricatedClauseCount') above(blockers, path, run[field], threshold);
        else below(blockers, path, run[field], threshold);
      }
    });
  }

  const outcomes = report.outcomes ?? {};
  const outcomeMinimums = {
    formalArchives: rubric.outcomeThresholds.formalArchives,
    settled: rubric.outcomeThresholds.settledOutcomes,
    distinctTenants: rubric.outcomeThresholds.distinctTenants,
    observationDays: rubric.outcomeThresholds.observationDays,
  };
  for (const [field, threshold] of Object.entries(outcomeMinimums)) {
    if (!finite(outcomes[field])) blockers.noData.push(`outcomes.${field}:missing`);
    else if (outcomes[field] < threshold) blockers.noData.push(`outcomes.${field}<${threshold}`);
  }
  if (finite(outcomes.formalArchives) && finite(outcomes.settled) && outcomes.settled > outcomes.formalArchives) {
    blockers.fail.push('outcomes.settled>formalArchives');
  }
  if (finite(outcomes.authenticated) && finite(outcomes.settled) && outcomes.authenticated > outcomes.settled) {
    blockers.fail.push('outcomes.authenticated>settled');
  }
  if (!finite(outcomes.settled) || outcomes.settled === 0) {
    blockers.noData.push('outcomes.authenticatedRatio:zero-denominator');
  } else if (!finite(outcomes.authenticated)) {
    blockers.noData.push('outcomes.authenticated:missing');
  } else if (outcomes.authenticated / outcomes.settled < rubric.outcomeThresholds.authenticatedRatio) {
    blockers.fail.push(`outcomes.authenticatedRatio<${rubric.outcomeThresholds.authenticatedRatio}`);
  }

  const economics = report.economics ?? {};
  above(blockers, 'economics.costCnyPerCase', economics.costCnyPerCase, rubric.economicsThresholds.maxCostCnyPerCase);
  above(blockers, 'economics.p95LatencySeconds', economics.p95LatencySeconds, rubric.economicsThresholds.maxP95LatencySeconds);

  for (const field of EVIDENCE_FIELDS) {
    const value = report.evidence?.[field];
    if ((typeof value !== 'string' || value.trim() === '') && (!Array.isArray(value) || value.length === 0)) {
      blockers.noData.push(`evidence.${field}:missing`);
    }
  }

  if (blockers.expired.length > 0) return { status: 'EXPIRED', blockers: blockers.expired };
  if (blockers.fail.length > 0) return { status: 'FAIL', blockers: blockers.fail };
  if (blockers.noData.length > 0) return { status: 'NO_DATA', blockers: blockers.noData };
  return { status: 'PASS', blockers: [] };
}
