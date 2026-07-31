'use strict';

module.exports = `Usage: lazytrae lifecycle <subcommand> [options]
Durable package lifecycle, separate from project init/sync/uninstall.
Subcommands:
  onboard   Install a verified official release into the durable root
  update    Verify and promote an official release; retain one rollback
  status    Report package readiness separately from host readiness
  offboard  Print a removal plan; --yes removes exact receipt-owned state
  recover-bootstrap-lock  Recover a verified stale sibling bootstrap lock
Common: --install-root <absolute-path> --project <absolute-path> --json
Onboard/update: --source <canonical-official-url>
Update: --confirm-revision <full-sha>
Offboard/recover-bootstrap-lock: --yes
`;
