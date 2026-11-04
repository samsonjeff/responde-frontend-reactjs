import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isEmergencyReportIntent,
  isIncidentIntent,
  isGeneralLogIntent,
  normalizeIntent,
} from '../src/utils/intentUtils.ts';

// Pins the rule behind the Messenger "Incidents" vs "All Logs" view-mode tabs:
// the Incidents tab shows strictly EMERGENCY_REPORT conversations, everything
// else (Resource Request, greetings, Other, …) falls under All Logs.
describe('messenger view-mode split', () => {
  it('flags only the Emergency Report intent as an emergency report', () => {
    assert.equal(isEmergencyReportIntent('EMERGENCY_REPORT'), true);
    assert.equal(isEmergencyReportIntent('emergency_report'), true);
    assert.equal(isEmergencyReportIntent('Resource Request'), false);
    assert.equal(isEmergencyReportIntent('RESOURCE_REQUEST'), false);
    assert.equal(isEmergencyReportIntent('Casual or Greeting'), false);
    assert.equal(isEmergencyReportIntent('Other'), false);
    assert.equal(isEmergencyReportIntent(null), false);
    assert.equal(isEmergencyReportIntent(''), false);
  });

  it('treats resource requests as incident intent but not emergency reports', () => {
    assert.equal(isIncidentIntent('EMERGENCY_REPORT'), true);
    assert.equal(isIncidentIntent('RESOURCE_REQUEST'), true);
    assert.equal(isIncidentIntent('Casual or Greeting'), false);
  });

  it('routes general chatter to the raw-logs side', () => {
    assert.equal(isGeneralLogIntent('Casual or Greeting'), true);
    assert.equal(isGeneralLogIntent('Other'), true);
    assert.equal(isGeneralLogIntent('Status Inquiry'), true);
    assert.equal(isGeneralLogIntent('Feedback or Thanks'), true);
    assert.equal(isGeneralLogIntent('EMERGENCY_REPORT'), false);
    assert.equal(isGeneralLogIntent('RESOURCE_REQUEST'), false);
  });

  it('normalizes stored intent keys before the split', () => {
    assert.equal(normalizeIntent('EMERGENCY_REPORT'), 'Emergency Report');
    assert.equal(normalizeIntent('RESOURCE_REQUEST'), 'Resource Request');
    assert.equal(normalizeIntent('CASUAL_OR_GREETING'), 'Casual or Greeting');
  });
});
