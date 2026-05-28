const fs = require('fs');
const { Transform } = require('stream');
const csv = require('csv-parser');
const { createObjectCsvWriter } = require('csv-writer');

function stripSepLine() {
    let checked = false;
    let buf = '';
    return new Transform({
        transform(chunk, _enc, cb) {
            if (checked) return cb(null, chunk);
            buf += chunk.toString('utf8');
            const nl = buf.indexOf('\n');
            if (nl === -1) return cb();
            checked = true;
            const firstLine = buf.slice(0, nl);
            const rest = buf.slice(nl + 1);
            buf = '';
            const output = (firstLine.startsWith('sep=,') || firstLine.startsWith('"sep=,'))
                ? rest
                : firstLine + '\n' + rest;
            cb(null, output);
        },
        flush(cb) { cb(null, buf); },
    });
}

function readCsv(filePath) {
    return new Promise((resolve, reject) => {
        const rows = [];
        fs.createReadStream(filePath)
            .on('error', reject)
            .pipe(stripSepLine())
            .pipe(csv())
            .on('data', row => rows.push(row))
            .on('end', () => resolve(rows))
            .on('error', reject);
    });
}

function writeCsv(filePath, headers, data) {
    const writer = createObjectCsvWriter({ path: filePath, header: headers });
    return writer.writeRecords(data);
}

module.exports = { readCsv, writeCsv };
