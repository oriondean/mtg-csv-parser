const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { readCsv, writeCsv } = require('./lib/csv');
const { mergeRows } = require('./lib/mergeRows');
const { findMissingCardNumbers, insertPlaceholders } = require('./lib/missingCards');
const { loadCardNames, fillMissingNames, fillRarity, fillMissingPrices } = require('./lib/cardNames');
const { loadCardPrices } = require('./lib/cardPrices');

const INPUT_DIR = 'input';
const OUTPUT_DIR = 'output';
const SETS_FILE = 'data/sets.csv';
const MAIN_SET_TYPES = new Set(['expansion', 'core']);

function loadMainSetCodes() {
    return new Promise((resolve, reject) => {
        const mainCodes = new Set();
        const knownCodes = new Set();
        const baseSizes = new Map();
        fs.createReadStream(SETS_FILE)
            .pipe(csv())
            .on('data', row => {
                knownCodes.add(row.code);
                if (MAIN_SET_TYPES.has(row.type)) mainCodes.add(row.code);
                const size = parseInt(row.baseSetSize, 10);
                if (!isNaN(size)) baseSizes.set(row.code, size);
            })
            .on('end', () => resolve({ mainCodes, knownCodes, baseSizes }))
            .on('error', reject);
    });
}

const RARITY_ORDER  = ['common', 'uncommon', 'rare', 'mythic', 'bonus', 'special'];
const RARITY_LABELS = { common: 'C', uncommon: 'U', rare: 'R', mythic: 'M', bonus: 'B', special: 'S' };

const OUTPUT_HEADERS = [
    { id: 'Quantity',    title: 'Count' },
    { id: 'Card Number', title: 'Card No.' },
    { id: 'Card Name',   title: 'Card Name' },
    { id: 'Rarity',      title: 'Rarity' },
    { id: 'MARKET',      title: 'Price' },
];

async function main() {
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    const inputFiles = fs.readdirSync(INPUT_DIR).filter(f => f.endsWith('.csv'));

    if (inputFiles.length === 0) {
        console.log(`No CSV files found in ${INPUT_DIR}/`);
        return;
    }

    const { mainCodes, knownCodes, baseSizes } = await loadMainSetCodes();

    // Phase 1: Read and transform all input files
    const entries = [];
    for (const file of inputFiles) {
        const allRows = await readCsv(path.join(INPUT_DIR, file));
        const rows = allRows.filter(r => {
            const code = r['Set Code'];
            if (code && knownCodes.has(code) && !mainCodes.has(code)) return false;
            const cardNum = parseInt(r['Card Number'], 10);
            if (!isNaN(cardNum) && code && baseSizes.has(code) && cardNum > baseSizes.get(code)) return false;
            return true;
        });
        const beforeRowCount = rows.length;
        const beforeQuantity = rows.reduce((sum, row) => sum + (parseInt(row['Quantity'], 10) || 0), 0);

        const mergedData = mergeRows(rows);
        const afterRowCount = mergedData.length;

        const mergedSetCodes = [...new Set(mergedData.map(r => r['Set Code']).filter(Boolean))];
        const maxBaseSize = mergedSetCodes.reduce((m, c) => Math.max(m, baseSizes.get(c) || 0), 0) || undefined;
        const { missing } = findMissingCardNumbers(mergedData, maxBaseSize);
        const finalData = missing.length > 0 ? insertPlaceholders(mergedData, missing) : mergedData;

        const setCodes = [...new Set(finalData.map(r => r['Set Code']).filter(Boolean))];
        entries.push({ file, finalData, setCodes, beforeRowCount, beforeQuantity, afterRowCount });
    }

    // Phase 2: Load reference data once for all set codes
    const allSetCodes = [...new Set(entries.flatMap(e => e.setCodes))];
    const cardData = await loadCardNames(allSetCodes);

    const allUuids = new Set(
        Object.values(cardData).flatMap(({ uuidMap }) => Object.values(uuidMap))
    );
    const priceMap = await loadCardPrices(allUuids);

    // Phase 3: Enrich and write each output file
    for (const { file, finalData, setCodes, beforeRowCount, beforeQuantity, afterRowCount } of entries) {
        fillMissingNames(finalData, cardData, setCodes);
        fillRarity(finalData, cardData, setCodes);
        fillMissingPrices(finalData, cardData, priceMap);

        const rarityStats = {};
        for (const row of finalData) {
            const rarity = (row['Rarity'] || 'unknown').toLowerCase();
            if (!rarityStats[rarity]) rarityStats[rarity] = { have: 0, need: 0 };
            if (parseInt(row['Quantity'], 10) > 0) rarityStats[rarity].have++;
            else rarityStats[rarity].need++;
        }

        for (const row of finalData) {
            if (row['Rarity']) row['Rarity'] = RARITY_LABELS[row['Rarity'].toLowerCase()] || row['Rarity'];
        }

        const outputFile = path.join(OUTPUT_DIR, file);
        await writeCsv(outputFile, OUTPUT_HEADERS, finalData);

        const afterQuantity = finalData.reduce((sum, row) => sum + (parseInt(row['Quantity'], 10) || 0), 0);

        console.log(`\n[${file}]`);
        console.log(`  Output:     ${outputFile}`);
        console.log(`  Rows:       ${beforeRowCount} -> ${afterRowCount} (${beforeRowCount - afterRowCount} merged)`);
        console.log(`  Quantities: ${beforeQuantity} -> ${afterQuantity}${beforeQuantity !== afterQuantity ? ' *** WARNING: quantity mismatch!' : ''}`);

        const raritiesInOrder = [
            ...RARITY_ORDER.filter(r => rarityStats[r]),
            ...Object.keys(rarityStats).filter(r => !RARITY_ORDER.includes(r)),
        ];
        for (const rarity of raritiesInOrder) {
            const { have, need } = rarityStats[rarity];
            const total = have + need;
            console.log(`  ${rarity.padEnd(8)}: ${have}/${total} (need ${need})`);
        }
    }

    console.log(`\nDone. Processed ${inputFiles.length} file(s).`);
}

main().catch(console.error);
