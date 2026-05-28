const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { mergeRows, sortCards } = require('../lib/mergeRows');

describe('sortCards', () => {
    it('sorts numerically, not lexicographically', () => {
        const rows = [
            { 'Card Number': '10' },
            { 'Card Number': '2' },
            { 'Card Number': '1' },
        ];
        const sorted = sortCards(rows);
        assert.deepEqual(sorted.map(r => r['Card Number']), ['1', '2', '10']);
    });

    it('returns a new array without mutating the input', () => {
        const rows = [{ 'Card Number': '2' }, { 'Card Number': '1' }];
        const sorted = sortCards(rows);
        assert.notStrictEqual(sorted, rows);
        assert.equal(rows[0]['Card Number'], '2');
    });

    it('handles an already-sorted array', () => {
        const rows = [{ 'Card Number': '1' }, { 'Card Number': '2' }, { 'Card Number': '3' }];
        const sorted = sortCards(rows);
        assert.deepEqual(sorted.map(r => r['Card Number']), ['1', '2', '3']);
    });
});

describe('mergeRows', () => {
    it('passes a single row through unchanged', () => {
        const rows = [{
            'Card Number': '1', 'Card Name': 'Opt',
            'Quantity': '2', 'Date Bought': '2024-01-01', 'MARKET': '0.50',
        }];
        const data = mergeRows(rows);
        assert.equal(data.length, 1);
        assert.equal(data[0]['Card Name'], 'Opt');
        assert.equal(data[0].Quantity, 2);
    });

    it('sums quantities for duplicate card numbers', () => {
        const rows = [
            { 'Card Number': '1', 'Card Name': 'Opt', 'Quantity': '2', 'Date Bought': '2024-01-01', 'MARKET': '' },
            { 'Card Number': '1', 'Card Name': 'Opt', 'Quantity': '3', 'Date Bought': '2024-01-02', 'MARKET': '' },
        ];
        const data = mergeRows(rows);
        assert.equal(data.length, 1);
        assert.equal(data[0].Quantity, 5);
    });

    it('keeps the first row\'s Date Bought when merging duplicates', () => {
        const rows = [
            { 'Card Number': '1', 'Card Name': 'Opt', 'Quantity': '1', 'Date Bought': '2024-01-01', 'MARKET': '' },
            { 'Card Number': '1', 'Card Name': 'Opt', 'Quantity': '1', 'Date Bought': '2024-06-01', 'MARKET': '' },
        ];
        const data = mergeRows(rows);
        assert.equal(data[0]['Date Bought'], '2024-01-01');
    });

    it('picks the minimum MARKET price across duplicates', () => {
        const rows = [
            { 'Card Number': '1', 'Card Name': 'Opt', 'Quantity': '1', 'Date Bought': '2024-01-01', 'MARKET': '1.50' },
            { 'Card Number': '1', 'Card Name': 'Opt', 'Quantity': '1', 'Date Bought': '2024-01-02', 'MARKET': '0.75' },
        ];
        const data = mergeRows(rows);
        assert.equal(data[0]['MARKET'], '0.75');
    });

    it('preserves MARKET when all duplicates have no price', () => {
        const rows = [
            { 'Card Number': '1', 'Card Name': 'Opt', 'Quantity': '1', 'Date Bought': '2024-01-01', 'MARKET': '' },
            { 'Card Number': '1', 'Card Name': 'Opt', 'Quantity': '1', 'Date Bought': '2024-01-02', 'MARKET': '' },
        ];
        const data = mergeRows(rows);
        assert.equal(data[0]['MARKET'], '');
    });

    it('keeps other fields from the first row when merging duplicates', () => {
        const rows = [
            { 'Card Number': '1', 'Card Name': 'Opt', 'Set Code': 'FIRST', 'Quantity': '1', 'Date Bought': '2024-01-01', 'MARKET': '' },
            { 'Card Number': '1', 'Card Name': 'Opt', 'Set Code': 'SECOND', 'Quantity': '1', 'Date Bought': '2024-06-01', 'MARKET': '' },
        ];
        const data = mergeRows(rows);
        assert.equal(data[0]['Set Code'], 'FIRST');
    });

    it('does not expose internal _parsedDate or _minMarket fields', () => {
        const rows = [{ 'Card Number': '1', 'Quantity': '1', 'Date Bought': '2024-01-01', 'MARKET': '1.0' }];
        const data = mergeRows(rows);
        assert.equal('_parsedDate' in data[0], false);
        assert.equal('_minMarket' in data[0], false);
    });

    it('returns data sorted by Card Number', () => {
        const rows = [
            { 'Card Number': '10', 'Quantity': '1', 'Date Bought': '2024-01-01', 'MARKET': '' },
            { 'Card Number': '2', 'Quantity': '1', 'Date Bought': '2024-01-01', 'MARKET': '' },
        ];
        const data = mergeRows(rows);
        assert.equal(data[0]['Card Number'], '2');
        assert.equal(data[1]['Card Number'], '10');
    });

    it('handles multiple distinct card numbers without merging', () => {
        const rows = [
            { 'Card Number': '1', 'Card Name': 'Opt',   'Quantity': '1', 'Date Bought': '2024-01-01', 'MARKET': '' },
            { 'Card Number': '2', 'Card Name': 'Shock', 'Quantity': '2', 'Date Bought': '2024-01-01', 'MARKET': '' },
        ];
        const data = mergeRows(rows);
        assert.equal(data.length, 2);
        assert.equal(data[0]['Card Name'], 'Opt');
        assert.equal(data[1]['Card Name'], 'Shock');
    });
});
