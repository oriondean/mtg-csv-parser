function sortCards(rows) {
    return [...rows].sort((a, b) => {
        const cardA = parseInt(a['Card Number'], 10);
        const cardB = parseInt(b['Card Number'], 10);
        return cardA - cardB;
    });
}

function mergeRows(rows) {
    const grouped = {};

    rows.forEach(row => {
        const key = `${row['Card Number']}`;
        const currentQuantity = parseInt(row['Quantity'], 10) || 0;
        const currentMarket = parseFloat(row['MARKET']) || null;

        if (!grouped[key]) {
            grouped[key] = { ...row };
            grouped[key].Quantity = currentQuantity;
            grouped[key]._minMarket = currentMarket;
        } else {
            grouped[key].Quantity += currentQuantity;

            if (currentMarket !== null && (grouped[key]._minMarket === null || currentMarket < grouped[key]._minMarket)) {
                grouped[key]._minMarket = currentMarket;
            }
        }
    });

    const data = Object.values(grouped).map(row => {
        if (row._minMarket !== null) row['MARKET'] = String(row._minMarket);
        delete row._minMarket;
        return row;
    });

    return sortCards(data);
}

module.exports = { mergeRows, sortCards };
