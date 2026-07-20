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

const REQUIRED_CONTROLS = Object.freeze([
  'git diff --binary <B>..<H> | sha256sum',
  'decision != GO',
  'OQ-02',
  'OQ-03',
  'OQ-09',
  'OQ-10',
  'PENDING_G0_HOSTED_MERGE',
  'NOT_GRANTED_BY_THIS_DRAFT',
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

export function validateR0AmendmentMarkdown(source) {
  if (typeof source !== 'string') {
    return ['amendment source must be a string'];
  }

  const requirementRows = collectRows(source, /^\| (\d{3}) \| (W\d{2}) \|/gm);
  const exitGateRows = collectRows(source, /^\| (G\d{2}) \| (W\d{2}) \|/gm);
  const errors = [
    ...validateExactRows(requirementRows, EXPECTED_REQUIREMENT_PACKAGES, 'REQ'),
    ...validateExactRows(exitGateRows, EXPECTED_EXIT_GATE_PACKAGES, 'exit gate'),
  ];

  for (let index = 0; index <= 9; index += 1) {
    const workPackage = `R0-W${String(index).padStart(2, '0')}`;
    const count = source.split(`### ${workPackage}`).length - 1;
    if (count !== 1) {
      errors.push(`${workPackage} must have exactly one packet card, got ${count}`);
    }
  }

  for (const control of REQUIRED_CONTROLS) {
    if (!source.includes(control)) {
      errors.push(`missing required approval control: ${control}`);
    }
  }

  return errors;
}

export const R0_AMENDMENT_EXPECTATIONS = Object.freeze({
  requirements: EXPECTED_REQUIREMENT_PACKAGES,
  exitGates: EXPECTED_EXIT_GATE_PACKAGES,
  controls: REQUIRED_CONTROLS,
});
