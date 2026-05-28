const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { Readable } = require('stream');
const { loadCardNames, fillMissingNames, fillRarity, fillMissingPrices } = require('../lib/cardNames');

function makeStream(content) {
    const s = new Readable({ read() {} });
    s.push(content);
    s.push(null);
    return s;
}

describe('fillMissingNames', () => {
    const cardData = {
        'M21': { nameMap: { '1': 'Opt', '2': 'Shock' }, uuidMap: {} },
    };

    it('fills a ??? name using the row\'s own set code', () => {
        const rows = [{ 'Card Number': '1', 'Card Name': '???', 'Set Code': 'M21' }];
        fillMissingNames(rows, cardData, []);
        assert.equal(rows[0]['Card Name'], 'Opt');
    });

    it('fills a ??? name via fallback codes when the row has no set code', () => {
        const rows = [{ 'Card Number': '2', 'Card Name': '???', 'Set Code': '' }];
        fillMissingNames(rows, cardData, ['M21']);
        assert.equal(rows[0]['Card Name'], 'Shock');
        assert.equal(rows[0]['Set Code'], 'M21');
    });

    it('does not modify rows whose name is not ???', () => {
        const rows = [{ 'Card Number': '1', 'Card Name': 'Opt', 'Set Code': 'M21' }];
        fillMissingNames(rows, cardData, []);
        assert.equal(rows[0]['Card Name'], 'Opt');
    });

    it('leaves ??? unchanged when the card number is not in the data', () => {
        const rows = [{ 'Card Number': '99', 'Card Name': '???', 'Set Code': 'M21' }];
        fillMissingNames(rows, cardData, []);
        assert.equal(rows[0]['Card Name'], '???');
    });

    it('leaves ??? unchanged when the set code is not in cardData', () => {
        const rows = [{ 'Card Number': '1', 'Card Name': '???', 'Set Code': 'ZZZ' }];
        fillMissingNames(rows, cardData, []);
        assert.equal(rows[0]['Card Name'], '???');
    });
});

describe('fillMissingPrices', () => {
    const cardData = {
        'M21': { nameMap: {}, uuidMap: { '1': 'uuid-001', '2': 'uuid-002' } },
    };

    it('fills missing MARKET from a normal-finish price', () => {
        const rows = [{ 'Card Number': '1', 'Set Code': 'M21', 'MARKET': '' }];
        fillMissingPrices(rows, cardData, { 'uuid-001_normal': '1.50' });
        assert.equal(rows[0]['MARKET'], '1.5');
    });

    it('fills missing MARKET from a foil-finish price', () => {
        const rows = [{ 'Card Number': '1', 'Set Code': 'M21', 'MARKET': '' }];
        fillMissingPrices(rows, cardData, { 'uuid-001_foil': '3.00' });
        assert.equal(rows[0]['MARKET'], '3');
    });

    it('picks the minimum price when both normal and foil exist', () => {
        const rows = [{ 'Card Number': '1', 'Set Code': 'M21', 'MARKET': '' }];
        fillMissingPrices(rows, cardData, { 'uuid-001_normal': '2.00', 'uuid-001_foil': '0.50' });
        assert.equal(rows[0]['MARKET'], '0.5');
    });

    it('does not overwrite a row that already has a MARKET price', () => {
        const rows = [{ 'Card Number': '1', 'Set Code': 'M21', 'MARKET': '5.00' }];
        fillMissingPrices(rows, cardData, { 'uuid-001_normal': '1.50' });
        assert.equal(rows[0]['MARKET'], '5.00');
    });

    it('leaves MARKET empty when the card number has no uuid', () => {
        const rows = [{ 'Card Number': '99', 'Set Code': 'M21', 'MARKET': '' }];
        fillMissingPrices(rows, cardData, { 'uuid-999_normal': '1.50' });
        assert.equal(rows[0]['MARKET'], '');
    });

    it('leaves MARKET empty when the set code is not in cardData', () => {
        const rows = [{ 'Card Number': '1', 'Set Code': 'ZZZ', 'MARKET': '' }];
        fillMissingPrices(rows, cardData, { 'uuid-001_normal': '1.50' });
        assert.equal(rows[0]['MARKET'], '');
    });
});

describe('fillRarity', () => {
    const cardData = {
        'M21': { nameMap: {}, uuidMap: {}, rarityMap: { '1': 'common', '2': 'uncommon' } },
    };

    it('sets Rarity using the row\'s own set code', () => {
        const rows = [{ 'Card Number': '1', 'Set Code': 'M21' }];
        fillRarity(rows, cardData, []);
        assert.equal(rows[0]['Rarity'], 'common');
    });

    it('sets Rarity via fallback codes when the row has no set code', () => {
        const rows = [{ 'Card Number': '2', 'Set Code': '' }];
        fillRarity(rows, cardData, ['M21']);
        assert.equal(rows[0]['Rarity'], 'uncommon');
    });

    it('does not backfill Set Code when using a fallback', () => {
        const rows = [{ 'Card Number': '1', 'Set Code': '' }];
        fillRarity(rows, cardData, ['M21']);
        assert.equal(rows[0]['Set Code'], '');
    });

    it('overwrites an existing Rarity value', () => {
        const rows = [{ 'Card Number': '1', 'Set Code': 'M21', 'Rarity': 'mythic' }];
        fillRarity(rows, cardData, []);
        assert.equal(rows[0]['Rarity'], 'common');
    });

    it('leaves Rarity unset when the card number is not in rarityMap', () => {
        const rows = [{ 'Card Number': '99', 'Set Code': 'M21' }];
        fillRarity(rows, cardData, []);
        assert.equal(rows[0]['Rarity'], undefined);
    });

    it('leaves Rarity unset when the set code is not in cardData', () => {
        const rows = [{ 'Card Number': '1', 'Set Code': 'ZZZ' }];
        fillRarity(rows, cardData, []);
        assert.equal(rows[0]['Rarity'], undefined);
    });
});

describe('loadCardNames', () => {
    it('indexes cards by set code, building nameMap, uuidMap, and rarityMap', async (t) => {
        const csv = 'setCode,number,name,uuid,side,rarity\nM21,1,Opt,uuid-001,,common\nM21,2,Shock,uuid-002,a,uncommon\n';
        t.mock.method(fs, 'createReadStream', () => makeStream(csv));
        const result = await loadCardNames(['M21']);
        assert.ok(result['M21'], 'M21 key should exist');
        assert.equal(result['M21'].nameMap['1'], 'Opt');
        assert.equal(result['M21'].nameMap['2'], 'Shock');
        assert.equal(result['M21'].uuidMap['1'], 'uuid-001');
        assert.equal(result['M21'].uuidMap['2'], 'uuid-002');
        assert.equal(result['M21'].rarityMap['1'], 'common');
        assert.equal(result['M21'].rarityMap['2'], 'uncommon');
    });

    it('filters out non-a sides of double-faced cards', async (t) => {
        const csv = 'setCode,number,name,uuid,side,rarity\nM21,1,FrontFace,uuid-001,a,rare\nM21,1,BackFace,uuid-001,b,rare\n';
        t.mock.method(fs, 'createReadStream', () => makeStream(csv));
        const result = await loadCardNames(['M21']);
        assert.equal(result['M21'].nameMap['1'], 'FrontFace');
    });

    it('only includes set codes that were requested', async (t) => {
        const csv = 'setCode,number,name,uuid,side,rarity\nM21,1,Opt,uuid-001,,common\nKLD,1,Glint-Nest Crane,uuid-002,,common\n';
        t.mock.method(fs, 'createReadStream', () => makeStream(csv));
        const result = await loadCardNames(['M21']);
        assert.ok(result['M21']);
        assert.equal(result['KLD'], undefined);
    });

    it('returns an empty object when given no set codes', async () => {
        const result = await loadCardNames([]);
        assert.deepEqual(result, {});
    });

    it('returns an empty object when given only falsy set codes', async () => {
        const result = await loadCardNames([null, undefined, '']);
        assert.deepEqual(result, {});
    });
});
