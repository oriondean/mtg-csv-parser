const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { readCsv, writeCsv } = require('../lib/csv');

function tmpFile() {
    return path.join(os.tmpdir(), `mtg-test-${Date.now()}-${Math.random().toString(36).slice(2)}.csv`);
}

describe('readCsv', () => {
    it('reads a basic CSV and returns an array of objects', async () => {
        const file = tmpFile();
        fs.writeFileSync(file, 'Name,Value\nFoo,1\nBar,2');
        try {
            const rows = await readCsv(file);
            assert.equal(rows.length, 2);
            assert.equal(rows[0].Name, 'Foo');
            assert.equal(rows[0].Value, '1');
            assert.equal(rows[1].Name, 'Bar');
        } finally {
            fs.unlinkSync(file);
        }
    });

    it('strips an unquoted sep=, header line', async () => {
        const file = tmpFile();
        fs.writeFileSync(file, 'sep=,\nName,Value\nFoo,1');
        try {
            const rows = await readCsv(file);
            assert.equal(rows.length, 1);
            assert.equal(rows[0].Name, 'Foo');
        } finally {
            fs.unlinkSync(file);
        }
    });

    it('strips a quoted "sep=," header line', async () => {
        const file = tmpFile();
        fs.writeFileSync(file, '"sep=,"\nName,Value\nFoo,1');
        try {
            const rows = await readCsv(file);
            assert.equal(rows.length, 1);
            assert.equal(rows[0].Name, 'Foo');
        } finally {
            fs.unlinkSync(file);
        }
    });

    it('returns an empty array for a header-only CSV', async () => {
        const file = tmpFile();
        fs.writeFileSync(file, 'Name,Value\n');
        try {
            const rows = await readCsv(file);
            assert.equal(rows.length, 0);
        } finally {
            fs.unlinkSync(file);
        }
    });
});

describe('writeCsv', () => {
    it('writes a CSV file with the correct header titles', async () => {
        const file = tmpFile();
        const headers = [
            { id: 'qty', title: 'Quantity' },
            { id: 'name', title: 'Card Name' },
        ];
        try {
            await writeCsv(file, headers, [{ qty: 2, name: 'Opt' }]);
            const content = fs.readFileSync(file, 'utf-8');
            assert.ok(content.includes('Quantity'), 'header title should appear');
            assert.ok(content.includes('Card Name'), 'header title should appear');
        } finally {
            fs.unlinkSync(file);
        }
    });

    it('writes row data under the correct column', async () => {
        const file = tmpFile();
        const headers = [
            { id: 'cardNumber', title: 'Card No.' },
            { id: 'cardName', title: 'Card Name' },
        ];
        try {
            await writeCsv(file, headers, [{ cardNumber: '42', cardName: 'Shock' }]);
            const rows = await readCsv(file);
            assert.equal(rows[0]['Card No.'], '42');
            assert.equal(rows[0]['Card Name'], 'Shock');
        } finally {
            fs.unlinkSync(file);
        }
    });

    it('writes multiple rows', async () => {
        const file = tmpFile();
        const headers = [{ id: 'n', title: 'N' }];
        try {
            await writeCsv(file, headers, [{ n: '1' }, { n: '2' }, { n: '3' }]);
            const rows = await readCsv(file);
            assert.equal(rows.length, 3);
        } finally {
            fs.unlinkSync(file);
        }
    });
});
