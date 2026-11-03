import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isReportIncomplete, getIncompleteReasons } from '../src/services/reportTriage.ts';

describe('isReportIncomplete', () => {
  it('flags a missing barangay as incomplete', () => {
    assert.equal(isReportIncomplete({ barangay: 'Unknown', type: 'Flood' }), true);
    assert.equal(isReportIncomplete({ barangay: '', type: 'Flood' }), true);
    assert.equal(isReportIncomplete({ barangay: 'None', type: 'Fire' }), true);
  });

  it('flags an unknown/unclassified incident type as incomplete', () => {
    // The review modal offers "No Incident Stated" as an incomplete reason,
    // so a type-only gap must land in the Incomplete queue too.
    assert.equal(isReportIncomplete({ barangay: 'Sampaloc', type: 'Unknown' }), true);
    assert.equal(isReportIncomplete({ barangay: 'Sampaloc', type: 'Unclassified' }), true);
    assert.equal(isReportIncomplete({ barangay: 'Sampaloc', type: '' }), true);
  });

  it('flags both-missing reports as incomplete', () => {
    assert.equal(isReportIncomplete({ barangay: 'Unknown', type: 'Unknown' }), true);
  });

  it('treats null/undefined input as incomplete', () => {
    assert.equal(isReportIncomplete(null), true);
    assert.equal(isReportIncomplete(undefined), true);
  });

  it('treats fully-specified reports as complete', () => {
    assert.equal(isReportIncomplete({ barangay: 'Sampaloc', type: 'Flood' }), false);
    assert.equal(isReportIncomplete({ barangay: '  Sampaloc  ', type: 'Fire' }), false);
  });
});

describe('getIncompleteReasons', () => {
  it('lists each missing dimension', () => {
    assert.deepEqual(getIncompleteReasons({ barangay: 'Unknown', type: 'Flood' }), ['Missing Barangay']);
    assert.deepEqual(getIncompleteReasons({ barangay: 'Sampaloc', type: 'Unknown' }), ['Missing Incident Type']);
    assert.deepEqual(getIncompleteReasons({ barangay: 'Unknown', type: 'Unknown' }), [
      'Missing Barangay',
      'Missing Incident Type',
    ]);
  });

  it('returns Incomplete Details for edge cases with no named gap', () => {
    assert.deepEqual(getIncompleteReasons({ barangay: 'Sampaloc', type: 'Flood' }), ['Incomplete Details']);
  });
});
