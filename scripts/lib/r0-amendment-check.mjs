const EXPECTED_REQUIREMENT_PACKAGES = Object.freeze({
  '001': 'W03',
  '002': 'W03',
  '003': 'W02',
  '004': 'W02',
  '005': 'W02',
  '006': 'W02',
  '007': 'W02',
  '008': 'W04',
  '009': 'W05',
  '010': 'W05',
  '011': 'W05',
  '012': 'W02',
  '013': 'W04',
  '014': 'W04',
  '015': 'W06',
  '016': 'W06',
  '017': 'W02',
  '018': 'W04',
  '019': 'W03',
  '020': 'W04',
  '021': 'W07',
  '022': 'W04',
});

const EXPECTED_EXIT_GATE_PACKAGES = Object.freeze({
  G01: 'W08',
  G02: 'W08',
  G03: 'W08',
  G04: 'W08',
  G05: 'W08',
  G06: 'W08',
  G07: 'W08',
  G08: 'W08',
  G09: 'W09',
});

const EXPECTED_MILESTONE_DISPOSITIONS = Object.freeze({
  M0: 'R0-W01',
  M1: 'R0-W04',
  M2: 'R0-W02',
  M3: 'FROZEN_POST_R0',
  M4: 'FROZEN_POST_R0',
  M5: 'R0-W05',
  M6: 'R0-W05',
  M7: 'R0-W06',
  M8: 'FROZEN_POST_R0',
  M9: 'R0-W09',
  M10: 'CONDITIONAL_POST_R0',
});

const EXPECTED_NON_OWNER_PACKET_CELLS = Object.freeze({
  W00: '治理前置',
  W01: '追踪全部 REQ，不实现业务',
  W08: '消费 001–022',
  W09: 'release gate',
});

const EXPECTED_OWNER_LABELS = Object.freeze({
  product: 'Product Owner',
  program: 'Program Owner',
  backendApiContract: 'Backend API Contract Owner',
  canonicalRuntime: 'Canonical Runtime Owner',
  securityData: 'Security & Data Owner',
  frontend: 'Frontend Owner',
  qaLegalEvaluation: 'QA & Legal Evaluation Owner',
  release: 'Release Owner',
  security: 'Security Owner',
});
const OWNER_PLACEHOLDERS = new Set(['UNASSIGNED', 'TBD', 'PENDING', 'N/A', '-']);

const REQUIRED_CONTROLS = Object.freeze([
  {
    label: 'git diff --binary <B>..<H> | sha256sum',
    pattern:
      /唯一绑定命令为 `git diff --binary <B>\.\.<H> \| sha256sum`，不得加入 `--full-index`/,
  },
  {
    label: 'decision != GO',
    pattern: /`decision != GO`、字段缺失或包不一致立即 STOP/,
  },
  {
    label: 'OQ-02',
    pattern: /^\| OQ-02：文件\/OCR 阈值 \| W03 RED 前 \| W03 保持 `BLOCKED_INPUT` \|$/m,
  },
  {
    label: 'OQ-01',
    pattern:
      /^\| OQ-01：R0\/R1\/R2 与 M0–M10 唯一映射 \| 本修正案批准前 \| 本修正案不得批准；本文件 §5\.1\/§6 负责关闭 \|$/m,
  },
  {
    label: 'OQ-03',
    pattern:
      /^\| OQ-03：支持\/拒答 taxonomy \| W02 契约冻结前；W08 golden freeze 前复核 \| W02\/W08 保持 `BLOCKED_INPUT` \|$/m,
  },
  {
    label: 'OQ-09',
    pattern: /^\| OQ-09：基础\/附加成果格式 \| W06 schema 前 \| W06 保持 `BLOCKED_INPUT` \|$/m,
  },
  {
    label: 'OQ-10',
    pattern:
      /^\| OQ-10：120 份数据来源\/标注预算 \| W08 从 R0 30\+ 扩展到 R1 数据前 \| 不阻断合成 R0；阻断 R1 数据扩展 \|$/m,
  },
  {
    label: 'OQ-06',
    pattern:
      /^\| OQ-06：Provider\/区域\/训练\/subprocessor\/退出边界 \| W03 RED 前冻结 R0 合成数据最小 policy；真实数据前补齐 DPA\/TOS 全量边界 \| W03 或真实数据阶段分别保持 `BLOCKED_INPUT` \|$/m,
  },
  {
    label: 'G0_MERGED_REPINNED',
    pattern:
      /^> 状态：`PROPOSED \/ G0_MERGED \/ REPINNED \/ PENDING_OWNER_EXACT_APPROVAL`$/m,
  },
  {
    label: 'NOT_GRANTED_BY_THIS_DRAFT',
    pattern: /^> 执行授权：`NOT_GRANTED_BY_THIS_DRAFT`$/m,
  },
  {
    label: 'OQ-01 unique disposition',
    pattern:
      /因此 OQ-01 的唯一答案是：`R0=W00–W09`；`R1\/R2=消费 R0 内核并分别等待新 amendment`；旧 M 只能按上表吸收或冻结，不能与 W 图并存。/,
  },
  {
    label: '1 → 2 → 4 → 5 → 3',
    pattern:
      /条件按 1 → 2 → 4 → 5 → 3 顺序执行；三路 review 必须发生在 rebase\/re-pin 后，Product Owner 最后批准同一 exact H\/tree\/diff\/digest。/,
  },
  {
    label: '明确未批准 W02–W09 runtime',
    pattern:
      /Product Owner 明确回复：Amendment ID、digest、effective base、批准 W01、明确未批准 W02–W09 runtime。/,
  },
  {
    label: '专业安全、法律与发布负责人重新指定门',
    pattern:
      /这些指派仅覆盖 R0 内部合成数据阶段，真实客户数据、W08 和 W09 前必须重新指定专业安全、法律与发布负责人。/,
  },
  {
    label: '专业负责人门尚未运行时强制',
    pattern:
      /当前仅把重新指定记录为后续阶段的批准前置，状态为 `DECLARATIVE_PRECONDITION_NOT_RUNTIME_ENFORCED`；必须由 execution-authority v2 在进入对应阶段前实现可执行阻断。/,
  },
  {
    label: 'Execution Owner Codex',
    pattern: /^\| Execution Owner \| `Codex` \|$/m,
  },
  {
    label: 'Independent Reviewer Claude Code',
    pattern: /^\| Independent Reviewer \| `Claude Code` \|$/m,
  },
]);

function collectRows(source, pattern) {
  const rows = new Map();
  for (const match of source.matchAll(pattern)) {
    const [, id, workPackage] = match;
    const packages = rows.get(id) ?? [];
    packages.push(workPackage);
    rows.set(id, packages);
  }
  return rows;
}

function validateExactRows(rows, expected, label) {
  const errors = [];
  for (const [id, expectedPackage] of Object.entries(expected)) {
    const packages = rows.get(id) ?? [];
    if (packages.length === 0) {
      errors.push(`missing ${label} ${id}`);
    } else if (packages.length > 1) {
      errors.push(`duplicate ${label} ${id}`);
    } else if (packages[0] !== expectedPackage) {
      errors.push(`${label} ${id} must belong to ${expectedPackage}, got ${packages[0]}`);
    }
  }
  for (const id of rows.keys()) {
    if (!(id in expected)) {
      errors.push(`unexpected ${label} ${id}`);
    }
  }
  return errors;
}

function markdownCells(line) {
  return line
    .slice(1, -1)
    .split('|')
    .map((cell) => cell.trim());
}

function expandRequirementCell(cell) {
  const requirements = [];
  for (const match of cell.matchAll(/(\d{3})(?:[–-](\d{3}))?/g)) {
    const start = Number(match[1]);
    const end = Number(match[2] ?? match[1]);
    for (let value = start; value <= end; value += 1) {
      requirements.push(String(value).padStart(3, '0'));
    }
  }
  return requirements;
}

function collectPacketRequirementOwnership(source) {
  const rows = new Map();
  const errors = [];
  for (const line of source.split('\n')) {
    if (!/^\| \d+ \| R0-W\d{2} \|/.test(line)) continue;
    const cells = markdownCells(line);
    const workPackage = cells[1]?.replace('R0-', '');
    const primaryRequirements = cells[3] ?? '';
    if (workPackage in EXPECTED_NON_OWNER_PACKET_CELLS) {
      if (primaryRequirements !== EXPECTED_NON_OWNER_PACKET_CELLS[workPackage]) {
        errors.push(
          `non-owner packet ${workPackage} must declare "${EXPECTED_NON_OWNER_PACKET_CELLS[workPackage]}", got "${primaryRequirements}"`,
        );
      }
      continue;
    }
    if (!/^\d{3}/.test(primaryRequirements)) {
      errors.push(`owner packet ${workPackage} must declare primary requirements`);
      continue;
    }
    for (const requirement of expandRequirementCell(primaryRequirements)) {
      const packages = rows.get(requirement) ?? [];
      packages.push(workPackage);
      rows.set(requirement, packages);
    }
  }
  return { rows, errors };
}

function validateEffectiveBase(source, expectedEffectiveBase) {
  const matches = [
    ...source.matchAll(/^> 当前集成基线：`([^@`\s]+)@([0-9a-f]{40})`$/gm),
  ];
  if (matches.length !== 1) {
    return [`effective base must appear exactly once, got ${matches.length}`];
  }

  const [, ref, sha] = matches[0];
  if (
    expectedEffectiveBase &&
    (ref !== expectedEffectiveBase.ref || sha !== expectedEffectiveBase.sha)
  ) {
    return [
      `effective base must be ${expectedEffectiveBase.ref}@${expectedEffectiveBase.sha}, got ${ref}@${sha}`,
    ];
  }
  return [];
}

function validateNamedOwners(source, expectedOwnerAssignments) {
  const errors = [];
  for (const [key, label] of Object.entries(EXPECTED_OWNER_LABELS)) {
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matches = [
      ...source.matchAll(
        new RegExp('^\\| ' + escapedLabel + ' \\| `([^`]+)` \\|$', 'gm'),
      ),
    ];
    if (matches.length !== 1) {
      errors.push(`${label} must have exactly one named owner, got ${matches.length}`);
      continue;
    }
    const actualOwner = matches[0][1].trim();
    if (actualOwner === '' || OWNER_PLACEHOLDERS.has(actualOwner.toUpperCase())) {
      errors.push(`${label} must be a named owner, not a placeholder`);
      continue;
    }
    const expectedOwner = expectedOwnerAssignments?.[key];
    if (expectedOwner !== undefined && actualOwner !== expectedOwner) {
      errors.push(`${label} must be ${expectedOwner}, got ${actualOwner}`);
    }
  }
  return errors;
}

export function validateR0AmendmentMarkdown(
  source,
  { effectiveBase, ownerAssignments } = {},
) {
  if (typeof source !== 'string') {
    return ['amendment source must be a string'];
  }

  const requirementRows = collectRows(source, /^\| (\d{3}) \| (W\d{2}) \|/gm);
  const exitGateRows = collectRows(source, /^\| (G\d{2}) \| (W\d{2}) \|/gm);
  const milestoneRows = collectRows(
    source,
    /^\| (M(?:10|[0-9])) \| (R0-W\d{2}|FROZEN_POST_R0|CONDITIONAL_POST_R0) \|/gm,
  );
  const packetRequirementOwnership = collectPacketRequirementOwnership(source);
  const errors = [
    ...validateExactRows(requirementRows, EXPECTED_REQUIREMENT_PACKAGES, 'REQ'),
    ...validateExactRows(exitGateRows, EXPECTED_EXIT_GATE_PACKAGES, 'exit gate'),
    ...validateExactRows(
      milestoneRows,
      EXPECTED_MILESTONE_DISPOSITIONS,
      'milestone',
    ),
    ...validateExactRows(
      packetRequirementOwnership.rows,
      EXPECTED_REQUIREMENT_PACKAGES,
      'packet ownership REQ',
    ),
    ...packetRequirementOwnership.errors,
    ...validateEffectiveBase(source, effectiveBase),
    ...validateNamedOwners(source, ownerAssignments),
  ];

  for (let index = 0; index <= 9; index += 1) {
    const workPackage = `R0-W${String(index).padStart(2, '0')}`;
    const count = source.split(`### ${workPackage}`).length - 1;
    if (count !== 1) {
      errors.push(`${workPackage} must have exactly one packet card, got ${count}`);
    }
  }

  for (const control of REQUIRED_CONTROLS) {
    if (!control.pattern.test(source)) {
      errors.push(`missing required approval control: ${control.label}`);
    }
  }

  return errors;
}

export const R0_AMENDMENT_EXPECTATIONS = Object.freeze({
  requirements: EXPECTED_REQUIREMENT_PACKAGES,
  exitGates: EXPECTED_EXIT_GATE_PACKAGES,
  milestones: EXPECTED_MILESTONE_DISPOSITIONS,
  ownerLabels: EXPECTED_OWNER_LABELS,
  controls: REQUIRED_CONTROLS.map(({ label }) => label),
});
