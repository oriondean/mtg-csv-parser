const { sortCards } = require('./mergeRows');

function findMissingCardNumbers(rows, maxCardNum) {
    const cardNumbers = new Set(rows.map(row => parseInt(row['Card Number'], 10)).filter(n => !isNaN(n)));
    let min = Infinity, max = -Infinity;
    for (const n of cardNumbers) {
        if (n < min) min = n;
        if (n > max) max = n;
    }
    if (maxCardNum != null && maxCardNum > max) max = maxCardNum;
    const missing = [];
    for (let i = 1; i <= max; i++) {
        if (!cardNumbers.has(i)) missing.push(i);
    }
    return { missing, min, max };
}

function insertPlaceholders(rows, missingNumbers) {
    const placeholders = missingNumbers.map(n => ({
        'Quantity': 0,
        'Card Number': String(n),
        'Card Name': '???',
        'Printing': 'Normal',
        'MARKET': '',
    }));
    return sortCards([...rows, ...placeholders]);
}

module.exports = { findMissingCardNumbers, insertPlaceholders };
