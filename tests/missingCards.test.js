const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { findMissingCardNumbers, insertPlaceholders } = require('../lib/missingCards');

describe('findMissingCardNumbers', () => {
    it('returns empty array when there are no gaps', () => {
        const rows = [
            { 'Card Number': '1' },
            { 'Card Number': '2' },
            { 'Card Number': '3' },
        ];
        const { missing } = findMissingCardNumbers(rows);
        assert.deepEqual(missing, []);
    });

    it('finds a single gap in the middle', () => {
        const rows = [
            { 'Card Number': '1' },
            { 'Card Number': '3' },
        ];
        const { missing } = findMissingCardNumbers(rows);
        assert.deepEqual(missing, [2]);
    });

    it('finds multiple consecutive gaps', () => {
        const rows = [
            { 'Card Number': '1' },
            { 'Card Number': '4' },
        ];
        const { missing } = findMissingCardNumbers(rows);
        assert.deepEqual(missing, [2, 3]);
    });

    it('finds gaps at the boundaries and interior', () => {
        const rows = [
            { 'Card Number': '1' },
            { 'Card Number': '3' },
            { 'Card Number': '5' },
        ];
        const { missing } = findMissingCardNumbers(rows);
        assert.deepEqual(missing, [2, 4]);
    });

    it('returns correct min and max values', () => {
        const rows = [
            { 'Card Number': '3' },
            { 'Card Number': '7' },
        ];
        const { min, max } = findMissingCardNumbers(rows);
        assert.equal(min, 3);
        assert.equal(max, 7);
    });

    it('ignores non-numeric card numbers', () => {
        const rows = [
            { 'Card Number': '1' },
            { 'Card Number': 'abc' },
            { 'Card Number': '3' },
        ];
        const { missing } = findMissingCardNumbers(rows);
        assert.deepEqual(missing, [2]);
    });

    it('extends missing range to maxCardNum when provided', () => {
        const rows = [
            { 'Card Number': '1' },
            { 'Card Number': '3' },
        ];
        const { missing, max } = findMissingCardNumbers(rows, 5);
        assert.deepEqual(missing, [2, 4, 5]);
        assert.equal(max, 5);
    });

    it('ignores maxCardNum when it is less than the natural max', () => {
        const rows = [
            { 'Card Number': '1' },
            { 'Card Number': '5' },
        ];
        const { missing } = findMissingCardNumbers(rows, 3);
        assert.deepEqual(missing, [2, 3, 4]);
    });

    it('always starts from 1 even when the lowest card number is greater than 1', () => {
        const rows = [
            { 'Card Number': '3' },
            { 'Card Number': '5' },
        ];
        const { missing } = findMissingCardNumbers(rows);
        assert.deepEqual(missing, [1, 2, 4]);
    });
});

describe('insertPlaceholders', () => {
    it('creates placeholder rows with the correct structure', () => {
        const rows = [{ 'Card Number': '1', 'Card Name': 'Opt', 'Quantity': 1 }];
        const result = insertPlaceholders(rows, [2]);
        const placeholder = result.find(r => r['Card Number'] === '2');
        assert.ok(placeholder, 'placeholder row should exist');
        assert.equal(placeholder['Quantity'], 0);
        assert.equal(placeholder['Card Name'], '???');
        assert.equal(placeholder['Printing'], 'Normal');
        assert.equal(placeholder['MARKET'], '');
    });

    it('returns the combined list sorted by Card Number', () => {
        const rows = [{ 'Card Number': '5', 'Card Name': 'Test', 'Quantity': 1 }];
        const result = insertPlaceholders(rows, [3, 4]);
        assert.equal(result[0]['Card Number'], '3');
        assert.equal(result[1]['Card Number'], '4');
        assert.equal(result[2]['Card Number'], '5');
    });

    it('preserves existing rows in the result', () => {
        const rows = [{ 'Card Number': '1', 'Card Name': 'Opt', 'Quantity': 1 }];
        const result = insertPlaceholders(rows, [2]);
        assert.equal(result.length, 2);
        const existing = result.find(r => r['Card Number'] === '1');
        assert.equal(existing['Card Name'], 'Opt');
    });

    it('inserts multiple placeholders', () => {
        const rows = [
            { 'Card Number': '1', 'Quantity': 1 },
            { 'Card Number': '5', 'Quantity': 1 },
        ];
        const result = insertPlaceholders(rows, [2, 3, 4]);
        assert.equal(result.length, 5);
        assert.equal(result.filter(r => r['Card Name'] === '???').length, 3);
    });
});
