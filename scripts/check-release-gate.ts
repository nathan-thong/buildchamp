import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { checkedChecklistItems } from './release-checklist';

const checklist = readFileSync(join(process.cwd(), 'RELEASE_CHECKLIST.md'), 'utf8');
const checkedItems = checkedChecklistItems(checklist);
const productionChecks = [
  "Assess BuildChamp against Riot Games' then-current game/IP policy and record the rationale for its free, original drafting game.",
  'Complete Riot Developer Portal product registration; the maintainer reports the product is listed as approved (2026-09-28).',
  'Confirm the release uses only approved default champion data, icons, and artwork; no skins, community-uploaded imagery, or unreviewed assets are included.',
  'Confirm every player-visible surface includes the required Riot non-endorsement notice.',
  'If Riot assets are shipped, include the applicable Legal Jibber Jabber notice and verify its placement is conspicuous and readable.',
  'Confirm the product does not imply Riot sponsorship, endorsement, operation, or affiliation.',
  'Record the policy review and registration evidence with the release decision.',
];

const missingChecks = productionChecks.filter((check) => !checkedItems.has(check));
const deploymentTarget = process.argv
  .slice(2)
  .find(
    (argument): argument is 'preview' | 'production' =>
      argument === 'preview' || argument === 'production',
  );
const approvalVariable =
  deploymentTarget === 'preview' ? 'BUILDCHAMP_PREVIEW_APPROVED' : 'BUILDCHAMP_PRODUCTION_APPROVED';
const explicitApproval = deploymentTarget ? process.env[approvalVariable] === '1' : true;

if (missingChecks.length > 0) {
  console.error(
    deploymentTarget
      ? `${deploymentTarget[0].toUpperCase()}${deploymentTarget.slice(1)} deployment remains blocked by the Riot release gate.`
      : 'Public deployment remains blocked by the Riot release gate.',
  );
  for (const check of missingChecks) {
    console.error(`- ${check}`);
  }
}

if (deploymentTarget && !explicitApproval) {
  console.error(
    `${deploymentTarget[0].toUpperCase()}${deploymentTarget.slice(1)} deployment also requires ${approvalVariable}=1 as an explicit operator confirmation.`,
  );
}

if (missingChecks.length > 0 || (deploymentTarget && !explicitApproval)) {
  process.exitCode = 1;
} else {
  console.log('Cloudflare release gate passed.');
}
