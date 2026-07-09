// LazyTrae MCP — Tool definitions and handler registry
// Re-exports from split modules for backward compatibility.

const { TOOLS } = require('./tool-defs');
const { handleGetActivePlan, handleGetBoulderStatus, handleGetNextTask, handleGetParityStatus } = require('./handlers-read');
const { handleRecordEvidence, handleMarkTaskDone } = require('./handlers-evidence');
const { handleAddBlocker, handleRequestReview } = require('./handlers-review');
const { handleGenerateHandoff } = require('./handlers-handoff');

const HANDLERS = {
  'lazytrae.get_active_plan': handleGetActivePlan,
  'lazytrae.get_boulder_status': handleGetBoulderStatus,
  'lazytrae.get_next_task': handleGetNextTask,
  'lazytrae.record_evidence': handleRecordEvidence,
  'lazytrae.mark_task_done': handleMarkTaskDone,
  'lazytrae.add_blocker': handleAddBlocker,
  'lazytrae.request_review': handleRequestReview,
  'lazytrae.generate_handoff': handleGenerateHandoff,
  'lazytrae.get_parity_status': handleGetParityStatus,
};

module.exports = { TOOLS, HANDLERS };
