import http from 'k6/http';
import { fail } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const mode = requiredEnv('MODE');
const baseUrl = requiredEnv('BASE_URL').replace(/\/$/, '');
const authCookie = requiredEnv('AUTH_COOKIE');
const roomId = requiredEnv('ROOM_ID');
const expectedFirstIds = parseIds(requiredEnv('EXPECTED_FIRST_IDS'));
const expectedDeepIds = parseIds(requiredEnv('EXPECTED_DEEP_IDS'));

if (mode !== 'before' && mode !== 'after') {
  throw new Error('MODE must be before or after');
}

if (mode === 'after') {
  requiredEnv('DEEP_CURSOR_SENT_AT');
  requiredEnv('DEEP_CURSOR_ID');
}

const firstDuration = new Trend('dm_history_first_duration', true);
const deepDuration = new Trend('dm_history_deep_duration', true);
const requestFailed = new Rate('dm_history_failed');
const contractFailed = new Rate('dm_history_contract_failed');

export const options = {
  vus: 1,
  iterations: Number(__ENV.ITERATIONS || 50),
  thresholds: {
    dm_history_failed: ['rate==0'],
    dm_history_contract_failed: ['rate==0'],
  },
};

export function setup() {
  const first = requestHistory('first');
  const deep = requestHistory('deep');

  if (!validResponse(first, 'first') || !validResponse(deep, 'deep')) {
    fail(`warmup contract failed for MODE=${mode}`);
  }
}

export default function () {
  measure('first', firstDuration);
  measure('deep', deepDuration);
}

function measure(scenario, durationMetric) {
  const response = requestHistory(scenario);
  const statusFailed = response.status !== 200;
  const responseContractFailed = !validResponse(response, scenario);

  durationMetric.add(response.timings.duration);
  requestFailed.add(statusFailed);
  contractFailed.add(responseContractFailed);
}

function requestHistory(scenario) {
  return http.get(`${baseUrl}${historyPath(scenario)}`, {
    headers: { Cookie: authCookie },
    tags: { api_version: mode, history_position: scenario },
  });
}

function historyPath(scenario) {
  if (mode === 'before') {
    const page = scenario === 'first' ? 0 : 4500;
    return `/dm/history/${roomId}?page=${page}&size=20`;
  }

  if (scenario === 'first') {
    return `/dm/history/${roomId}?size=20`;
  }

  const sentAt = encodeURIComponent(__ENV.DEEP_CURSOR_SENT_AT);
  const cursorId = encodeURIComponent(__ENV.DEEP_CURSOR_ID);
  return `/dm/history/${roomId}?cursorSentAt=${sentAt}&cursorId=${cursorId}&size=20`;
}

function validResponse(response, scenario) {
  if (response.status !== 200) {
    return false;
  }

  let payload;
  try {
    payload = response.json();
  } catch (_) {
    return false;
  }

  if (!payload || !Array.isArray(payload.content) || payload.content.length !== 20) {
    return false;
  }

  const expectedIds = scenario === 'first' ? expectedFirstIds : expectedDeepIds;
  const actualIds = payload.content.map((message) => Number(message.messageId));
  if (!sameIdSet(actualIds, expectedIds)) {
    return false;
  }

  if (mode === 'before') {
    const expectedPage = scenario === 'first' ? 0 : 4500;
    return payload.number === expectedPage && payload.size === 20;
  }

  return payload.hasNext === true
    && payload.nextCursor !== null
    && typeof payload.nextCursor.sentAt === 'string'
    && Number.isInteger(Number(payload.nextCursor.messageId));
}

function sameIdSet(actual, expected) {
  if (actual.length !== expected.length) {
    return false;
  }

  const sortedActual = [...actual].sort((left, right) => left - right);
  const sortedExpected = [...expected].sort((left, right) => left - right);
  return sortedActual.every((id, index) => id === sortedExpected[index]);
}

function parseIds(value) {
  const ids = value.split(',').map((id) => Number(id));
  if (ids.length !== 20 || ids.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw new Error('EXPECTED_FIRST_IDS and EXPECTED_DEEP_IDS must each contain 20 positive integer IDs');
  }
  return ids;
}

function requiredEnv(name) {
  const value = __ENV[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}
