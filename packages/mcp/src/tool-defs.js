// LazyTrae MCP — Tool definitions (tools/list schema)

const TOOLS = [
  {
    name: 'lazytrae.get_active_plan',
    description: 'Read .lazytrae/state/boulder.json, return active plan name, plan path, task list with statuses. No mutation.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'lazytrae.get_boulder_status',
    description: 'Read .lazytrae/state/boulder.json, return summary: total tasks, completed, pending, in_progress, blocked, blockers list, active work ID. No mutation.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'lazytrae.get_next_task',
    description: 'Read .lazytrae/state/boulder.json, find the first task with status "pending" or "in_progress", return its description, index, and any blockers. No mutation.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'lazytrae.record_evidence',
    description: 'Record verification evidence. Takes parameters: gate_type, commands, outputs, exit_status, changed_files, manual_checks, reviewer_findings. Writes to .lazytrae/evidence/{gate_type}.md. Returns confirmation with file path.',
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
    description: 'Mark a task as complete. Takes task_index or task_description, evidence_summary. Validates that evidence exists before marking done (refuses if no evidence). Returns updated task status.',
    inputSchema: {
      type: 'object',
      properties: {
        task_index: { type: 'integer', description: 'Zero-based index of the task in the active work task list' },
        task_description: { type: 'string', description: 'Task description to match (alternative to task_index)' },
        evidence_summary: { type: 'string', description: 'Summary of evidence proving task completion' },
      },
    },
  },
  {
    name: 'lazytrae.add_blocker',
    description: 'Add a blocker to the active work. Updates .lazytrae/state/boulder.json. Returns confirmation.',
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
    description: 'Create a review request entry in .lazytrae/evidence/oracle-review.md. Does NOT perform the review — that is the Oracle agent\'s job. Returns review request details.',
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
    description: 'Read boulder.json, active-loop.json, evidence directory. Return a handoff summary matching the CLI handoff command format. Also persists to .lazytrae/evidence/handoff.md.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'lazytrae.get_parity_status',
    description: 'Read docs/lazytrae-parity-ledger.md, parse summary table, return: total, complete, design, gap, deferred, na, coverage_percentage. No mutation.',
    inputSchema: { type: 'object', properties: {} },
  },
];

module.exports = { TOOLS };
