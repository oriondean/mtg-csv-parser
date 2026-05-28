const fs = require('fs');
const csv = require('csv-parser');

const PRICES_FILE = 'data/cardPrices.csv';

function loadCardPrices(uuidSet) {
    return new Promise((resolve, reject) => {
        const priceMap = {};
        const priceDates = {};
        if (uuidSet.size === 0) return resolve(priceMap);

        fs.createReadStream(PRICES_FILE)
            .pipe(csv())
            .on('data', row => {
                if (
                    uuidSet.has(row.uuid) &&
                    row.priceProvider === 'tcgplayer' &&
                    row.providerListing === 'retail' &&
                    row.currency === 'USD' &&
                    row.gameAvailability === 'paper'
                ) {
                    const key = `${row.uuid}_${row.cardFinish}`;
                    if (!priceDates[key] || row.date > priceDates[key]) {
                        priceMap[key] = row.price;
                        priceDates[key] = row.date;
                    }
                }
            })
            .on('end', () => resolve(priceMap))
            .on('error', reject);
    });
}

module.exports = { loadCardPrices };
