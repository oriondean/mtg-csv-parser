const fs = require('fs');
const csv = require('csv-parser');

const CARDS_FILE = 'data/cards.csv';

function loadCardNames(setCodes) {
    return new Promise((resolve, reject) => {
        const result = {};
        const codeSet = new Set(Array.isArray(setCodes) ? setCodes.filter(Boolean) : [setCodes].filter(Boolean));

        if (codeSet.size === 0) return resolve(result);

        for (const code of codeSet) {
            result[code] = { nameMap: {}, uuidMap: {}, rarityMap: {} };
        }

        fs.createReadStream(CARDS_FILE)
            .pipe(csv())
            .on('data', row => {
                if (codeSet.has(row.setCode) && (!row.side || row.side === 'a')) {
                    result[row.setCode].nameMap[row.number] = row.name;
                    result[row.setCode].uuidMap[row.number] = row.uuid;
                    result[row.setCode].rarityMap[row.number] = row.rarity;
                }
            })
            .on('end', () => resolve(result))
            .on('error', reject);
    });
}

function fillMissingNames(rows, cardData, fallbackCodes) {
    rows.forEach(row => {
        if (row['Card Name'] === '???') {
            const codesToTry = row['Set Code'] ? [row['Set Code']] : fallbackCodes;
            for (const code of codesToTry) {
                const { nameMap = {} } = cardData[code] || {};
                const name = nameMap[row['Card Number']];
                if (name) { row['Card Name'] = name; if (!row['Set Code']) row['Set Code'] = code; break; }
            }
        }
    });
}

function fillRarity(rows, cardData, fallbackCodes) {
    rows.forEach(row => {
        const codesToTry = row['Set Code'] ? [row['Set Code']] : fallbackCodes;
        for (const code of codesToTry) {
            const { rarityMap = {} } = cardData[code] || {};
            const rarity = rarityMap[row['Card Number']];
            if (rarity) { row['Rarity'] = rarity; break; }
        }
    });
}

function fillMissingPrices(rows, cardData, priceMap) {
    rows.forEach(row => {
        if (!row['MARKET']) {
            const { uuidMap = {} } = cardData[row['Set Code']] || {};
            const uuid = uuidMap[row['Card Number']];
            if (uuid) {
                let minPrice = null;
                for (const finish of ['normal', 'foil']) {
                    const price = priceMap[`${uuid}_${finish}`];
                    if (price !== undefined) {
                        const parsed = parseFloat(price);
                        if (minPrice === null || parsed < minPrice) minPrice = parsed;
                    }
                }
                if (minPrice !== null) row['MARKET'] = String(minPrice);
            }
        }
    });
}

module.exports = { loadCardNames, fillMissingNames, fillRarity, fillMissingPrices };
