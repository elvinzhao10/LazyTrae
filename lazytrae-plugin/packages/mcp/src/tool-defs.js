// LazyTrae MCP — Tool definitions (tools/list schema)

const TOOLS = [
  {
    name: 'lazytrae.get_active_plan',
    description: 'Read .lazytraework/state/boulder.json, return active plan name, plan path, task list with statuses. No mutation.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'lazytrae.get_boulder_status',
    description: 'Read .lazytraework/state/boulder.json, return summary: total tasks, completed, pending, in_progress, blocked, blockers list, active work ID. No mutation.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'lazytrae.get_next_task',
    description: 'Read .lazytraework/state/boulder.json, find the first task with status "pending" or "in_progress", return its description, index, and any blockers. No mutation.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'lazytrae.record_evidence',
    description: 'Record verification evidence. Takes parameters: gate_type, commands, outputs, exit_status, changed_files, manual_checks, reviewer_findings. Writes to .lazytraework/evidence/{gate_type}.md. Returns confirmation with file path.',
    inputSchema: {
      type: 'object',
      properties: {
        gate_type: { type: 'string', description: 'Evidence gate type', enum: ['plan_reread', 'automated_verification', 'manual_qa', 'adversarial_qa', 'cleanup'] },
        commands: { type: 'array', items: { type: 'object', properties: { command: { type: 'string' }, description: { type: 'string' }, expected_exit_code: { type: 'integer' } } } },
        outputs: { type: 'array', items: { type: 'string' } },
        exit_status: { type: 'object', additionalProperties: { type: 'integer' } },
        changed_files: { type: 'array', items: { type: 'string' } },
        manual_checks: { type: 'array', items: { type: 'object', properties: { scenario: { type: 'string' }, channel: { type: 'string', enum: ['cli', 'http', 'tmux', 'browser', 'gui', 'data'] }, invocation: { type: 'string' }, expected: { type: 'string' }, actual: { type: 'string' }, verdict: { type: 'string', enum: ['pass', 'fail'] } } } },
        reviewer_findings: { type: 'array', items: { type: 'object', properties: { category: { type: 'string' }, finding: { type: 'string' }, severity: { type: 'string', enum: ['pass', 'info', 'warning', 'fail'] } } } },
        verdict: { type: 'string', description: 'Overall verdict', enum: ['pass', 'fail', 'blocked'] },
        notes: { type: 'string', description: 'Additional notes' },
      },
      required: ['gate_type'],
    },
  },
  {
    name: 'lazytrae.mark_task_done',
    description: 'Mark a task as complete. Takes task_id, task_index, or task_description plus evidence_summary and evidence_paths. Refuses missing or nonexistent evidence. Returns updated task status.',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: 'Task ID to mark complete (alternative to task_index or task_description)' },
        task_index: { type: 'integer', description: 'Zero-based index of the task in the active work task list' },
        task_description: { type: 'string', description: 'Task description to match (alternative to task_index)' },
        evidence_summary: { type: 'string', description: 'Summary of evidence proving task completion' },
        evidence_paths: { type: 'array', items: { type: 'string' }, description: 'Existing non-empty evidence files proving completion' },
      },
    },
  },
  {
    name: 'lazytrae.add_blocker',
    description: 'Add a blocker to the active work. Updates .lazytraework/state/boulder.json. Returns confirmation.',
    inputSchema: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Reason for the blocker' },
        task_index: { type: 'integer', description: 'Optional zero-based index of the task to block' },
        severity: { type: 'string', description: 'Optional severity', enum: ['pass', 'info', 'warning', 'fail'] },
      },
      required: ['reason'],
    },
  },
  {
    name: 'lazytrae.request_review',
    description: 'Create a review request entry in .lazytraework/evidence/oracle-review.md. Does NOT perform the review — that is the Oracle agent\'s job. Returns review request details.',
    inputSchema: {
      type: 'object',
      properties: {
        review_type: { type: 'string', description: 'Type of review', enum: ['plan_reread', 'adversarial_qa', 'full'] },
        context: { type: 'string', description: 'Context about what was implemented' },
        files_changed: { type: 'array', items: { type: 'string' } },
        task_id: { type: 'string', description: 'Optional task ID being reviewed' },
      },
      required: ['review_type'],
    },
  },
  {
    name: 'lazytrae.generate_handoff',
    description: 'Read boulder.json, active-loop.json, evidence directory. Return a handoff summary matching the CLI handoff command format. Also persists to .lazytraework/evidence/handoff.md.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'lazytrae.get_parity_status',
    description: 'Read docs/lazytrae-parity-ledger.md, parse summary table, return: total, complete, design, gap, deferred, na, coverage_percentage. No mutation.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'lazytrae.symbol_search',
    description: 'Heuristic local symbol/text search across project files. Returns provenance, file, line, and preview.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Symbol or text to search for' },
        limit: { type: 'integer', description: 'Maximum results to return' },
      },
      required: ['query'],
    },
  },
  {
    name: 'lazytrae.find_references',
    description: 'Heuristic local reference search for a symbol. Returns provenance, file, line, and preview.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Symbol to find references for' },
        limit: { type: 'integer', description: 'Maximum references to return' },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'lazytrae.goto_definition',
    description: 'Heuristic local definition search for JavaScript/TypeScript-style declarations. Returns provenance and no_result when not found.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Symbol to locate' },
        limit: { type: 'integer', description: 'Maximum definitions to return' },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'lazytrae.diagnostics',
    description: 'Detect project-native diagnostic commands such as npm test, go test, cargo check, or Python checks. Returns project-tool-backed provenance.',
    inputSchema: {
      type: 'object',
      properties: {
        run: { type: 'boolean', description: 'Reserved for future execution; currently reports detected commands without running them' },
      },
    },
  },
  {
    name: 'lazytrae.docs_lookup',
    description: 'Project-backed lookup across local README, package metadata, and docs files before any external documentation source.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Documentation query' },
        limit: { type: 'integer', description: 'Maximum matches to return' },
      },
      required: ['query'],
    },
  },
  {
    name: 'lazytrae.dependency_graph',
    description: 'Heuristic file-level dependency graph from import/require statements plus reverse text references.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Project-relative file path to inspect' },
        limit: { type: 'integer', description: 'Maximum reverse references to return' },
      },
      required: ['path'],
    },
  },
];

module.exports = { TOOLS };
