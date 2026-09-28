import { describe, expect, it } from 'vitest';

import { checkedChecklistItems } from './release-checklist';

describe('checkedChecklistItems', () => {
  it('joins wrapped checked items and ignores unchecked items', () => {
    const checked = checkedChecklistItems(`## Release gate
- [x] If Riot assets are shipped, include the applicable notice and verify its
      placement is conspicuous and readable.
- [ ] Complete registration.
- [x] Confirm no endorsement.
`);

    expect([...checked]).toEqual([
      'If Riot assets are shipped, include the applicable notice and verify its placement is conspicuous and readable.',
      'Confirm no endorsement.',
    ]);
  });
});
