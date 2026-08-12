import { check } from 'k6';
import { cursorMatchesLastMessage } from '../scripts/measure_dm_api.js';

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: { checks: ['rate==1'] },
};

export default function () {
  const content = Array.from({ length: 20 }, (_, index) => ({
    messageId: index + 1,
    sendAt: `2026-01-01T00:00:${String(index).padStart(2, '0')}`,
  }));
  const last = content[19];

  check(null, {
    'matching nextCursor passes': () => cursorMatchesLastMessage({
      content,
      nextCursor: { sentAt: last.sendAt, messageId: last.messageId },
    }),
    'different messageId fails': () => !cursorMatchesLastMessage({
      content,
      nextCursor: { sentAt: last.sendAt, messageId: last.messageId - 1 },
    }),
  });
}
