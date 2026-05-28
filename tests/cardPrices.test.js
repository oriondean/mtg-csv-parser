const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { Readable } = require('stream');
const { loadCardPrices } = require('../lib/cardPrices');

function makeStream(content) {
    const s = new Readable({ read() {} });
    s.push(content);
    s.push(null);
    return s;
}

const VALID_ROW_FIELDS = 'uuid,priceProvider,providerListing,currency,gameAvailability,cardFinish,price,date';
const VALID_ROW_VALUES = 'uuid-001,tcgplayer,retail,USD,paper,normal,1.50,2024-01-01';

describe('loadCardPrices', () => {
    it('returns an empty map immediately for an empty uuid set', async () => {
        const result = await loadCardPrices(new Set());
        assert.deepEqual(result, {});
    });

    it('stores price under a uuid_finish compound key', async (t) => {
        const csv = `${VALID_ROW_FIELDS}\n${VALID_ROW_VALUES}\n`;
        t.mock.method(fs, 'createReadStream', () => makeStream(csv));
        const result = await loadCardPrices(new Set(['uuid-001']));
        assert.ok('uuid-001_normal' in result);
        assert.equal(result['uuid-001_normal'], '1.50');
    });

    it('filters out non-tcgplayer price providers', async (t) => {
        const csv = `${VALID_ROW_FIELDS}\nuuid-001,cardmarket,retail,USD,paper,normal,1.50,2024-01-01\n`;
        t.mock.method(fs, 'createReadStream', () => makeStream(csv));
        const result = await loadCardPrices(new Set(['uuid-001']));
        assert.deepEqual(result, {});
    });

    it('filters out non-retail provider listings', async (t) => {
        const csv = `${VALID_ROW_FIELDS}\nuuid-001,tcgplayer,buylist,USD,paper,normal,1.50,2024-01-01\n`;
        t.mock.method(fs, 'createReadStream', () => makeStream(csv));
        const result = await loadCardPrices(new Set(['uuid-001']));
        assert.deepEqual(result, {});
    });

    it('filters out non-USD currency', async (t) => {
        const csv = `${VALID_ROW_FIELDS}\nuuid-001,tcgplayer,retail,EUR,paper,normal,1.50,2024-01-01\n`;
        t.mock.method(fs, 'createReadStream', () => makeStream(csv));
        const result = await loadCardPrices(new Set(['uuid-001']));
        assert.deepEqual(result, {});
    });

    it('filters out non-paper game availability', async (t) => {
        const csv = `${VALID_ROW_FIELDS}\nuuid-001,tcgplayer,retail,USD,mtgo,normal,1.50,2024-01-01\n`;
        t.mock.method(fs, 'createReadStream', () => makeStream(csv));
        const result = await loadCardPrices(new Set(['uuid-001']));
        assert.deepEqual(result, {});
    });

    it('keeps only the most recent price for the same uuid and finish', async (t) => {
        const csv = [
            VALID_ROW_FIELDS,
            'uuid-001,tcgplayer,retail,USD,paper,normal,1.00,2024-01-01',
            'uuid-001,tcgplayer,retail,USD,paper,normal,2.00,2024-06-01',
            'uuid-001,tcgplayer,retail,USD,paper,normal,0.50,2023-12-01',
        ].join('\n') + '\n';
        t.mock.method(fs, 'createReadStream', () => makeStream(csv));
        const result = await loadCardPrices(new Set(['uuid-001']));
        assert.equal(result['uuid-001_normal'], '2.00');
    });

    it('keeps separate entries for normal and foil finishes', async (t) => {
        const csv = [
            VALID_ROW_FIELDS,
            'uuid-001,tcgplayer,retail,USD,paper,normal,1.00,2024-01-01',
            'uuid-001,tcgplayer,retail,USD,paper,foil,5.00,2024-01-01',
        ].join('\n') + '\n';
        t.mock.method(fs, 'createReadStream', () => makeStream(csv));
        const result = await loadCardPrices(new Set(['uuid-001']));
        assert.equal(result['uuid-001_normal'], '1.00');
        assert.equal(result['uuid-001_foil'], '5.00');
    });

    it('ignores uuids not present in the requested set', async (t) => {
        const csv = `${VALID_ROW_FIELDS}\nuuid-999,tcgplayer,retail,USD,paper,normal,1.50,2024-01-01\n`;
        t.mock.method(fs, 'createReadStream', () => makeStream(csv));
        const result = await loadCardPrices(new Set(['uuid-001']));
        assert.deepEqual(result, {});
    });
});
