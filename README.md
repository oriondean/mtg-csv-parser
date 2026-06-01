# mtg-csv-parser

Processes Magic: The Gathering card collection CSVs exported from [TCGPlayer](https://www.tcgplayer.com/). For each input file it merges duplicate card entries, fills in missing card numbers with placeholders, enriches card names, rarities, and market prices from reference data, and writes a clean output CSV.

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- Reference data files in `data/` (see [Reference Data](#reference-data))

## Installation

```bash
npm install
```

## Usage

```bash
node index.js
# or
npm start
```

All `.csv` files found in the `input/` directory are processed. Output files are written to `output/` with the same filename as their corresponding input file. The `output/` directory is created automatically if it does not exist.

### Example console output

```
[final_fantasy.csv]
  Output:     output/final_fantasy.csv
  Rows:       312 -> 267 (45 merged)
  Quantities: 312 -> 312
  common  : 80/110 (need 30)
  uncommon: 60/80 (need 20)
  rare    : 50/60 (need 10)
  mythic  : 17/17 (need 0)

Done. Processed 1 file(s).
```

A `*** WARNING: quantity mismatch!` message is printed if the total quantity of cards changes during processing, which should never happen under normal circumstances.

---

## Project Structure

```
index.js              Entry point — orchestrates the full pipeline
package.json
input/                Raw TCGPlayer export CSVs (one per set)
output/               Processed output CSVs (generated)
data/
  sets.csv            Reference: set metadata (type, base set size)
  cards.csv           Reference: card number → name, UUID & rarity (per set)
  cardPrices.csv      Reference: UUID → market prices (per finish)
lib/
  csv.js              CSV read/write helpers
  mergeRows.js        Deduplication and sorting logic
  missingCards.js     Placeholder insertion for missing card numbers
  cardNames.js        Name, rarity and UUID lookup against cards.csv
  cardPrices.js       Price lookup against cardPrices.csv
```

---

## Pipeline

Processing runs in three phases to avoid reading the large reference files more than once, regardless of how many input files are provided.

Before Phase 1, **`data/sets.csv`** is streamed once to build three lookups used throughout the pipeline: the set of main-set codes (`expansion` and `core` types), the set of all known codes, and a map of base set sizes per code.

### Phase 1 — Read & transform all input files

For each input CSV:

1. **Read** — parses the raw TCGPlayer export; strips the `sep=,` header line if present.
2. **Filter** — rows whose `Set Code` is a known non-main set (e.g. commander, promo) are dropped. Rows with a collector number above the set's base set size are also dropped.
3. **Merge** — duplicate rows for the same `Card Number` are collapsed into a single row. Quantities are summed, and the lowest `MARKET` price found across the duplicates is kept.
4. **Sort** — rows are sorted numerically by `Card Number`.
5. **Fill gaps** — any card numbers missing from `[1, max]` have placeholder rows inserted (`Card Name: ???`, `Quantity: 0`), where `max` is the greater of the highest card number found and the set's base set size.
6. **Detect set codes** — all unique set codes present in the file's rows are collected for use in Phase 2.

### Phase 2 — Load reference data (once)

All unique set codes collected in Phase 1 are used to load reference data in a single pass each:

- **`data/cards.csv`** is streamed once, building per-set maps of `Card Number → Card Name`, `Card Number → UUID`, and `Card Number → rarity`.
- All UUIDs across every set are combined into one set.
- **`data/cardPrices.csv`** is streamed once, building a map of `UUID_finish → price` filtered to TCGPlayer retail USD paper prices. When multiple price entries exist for the same key, the most recent date wins.

### Phase 3 — Enrich & write output

For each entry produced in Phase 1:

1. **Fill names** — any row whose `Card Name` is `???` is resolved using the set's name map.
2. **Fill rarities** — every row's `Rarity` is populated from the set's rarity map.
3. **Fill prices** — any row missing a `MARKET` price is resolved by taking the lower of the normal and foil prices for the card's UUID.
4. **Write** — the enriched data is written to `output/<filename>.csv` with the columns below.

---

## Input Format

TCGPlayer export CSVs. The `sep=,` directive line at the top is handled automatically. Expected columns:

| Column | Description |
|---|---|
| `Quantity` | Number of copies |
| `Card Number` | Card's collector number within the set |
| `Card Name` | Name of the card |
| `Set Code` | MTG set code (e.g. `FIN`) |
| `Printing` | `Normal` or `Foil` |
| `Date Bought` | ISO date string |
| `MARKET` | TCGPlayer market price |

---

## Output Format

| Column | Source |
|---|---|
| `Count` | Summed quantity after merging |
| `Card No.` | Collector number |
| `Card Name` | Name (filled from reference data if missing) |
| `Rarity` | Single-letter code: `C` / `U` / `R` / `M` / `B` / `S` |
| `Price` | Lowest TCGPlayer market price across finishes (filled from reference data if missing) |

---

## Reference Data

The files in `data/` are not included in the repository due to their size. They are sourced from the [MTGJSON](https://mtgjson.com/) project.

### `data/sets.csv`

Contains one row per MTG set. The following columns are used:

| Column | Description |
|---|---|
| `code` | MTG set code |
| `type` | Set type (e.g. `expansion`, `core`, `commander`) |
| `baseSetSize` | Number of cards in the main set (used to filter out bonus/promo numbers) |

### `data/cards.csv`

Contains one row per card printing. The following columns are used:

| Column | Description |
|---|---|
| `setCode` | MTG set code |
| `number` | Collector number |
| `name` | Card name |
| `uuid` | MTGJSON unique identifier |
| `rarity` | Card rarity (`common`, `uncommon`, `rare`, `mythic`, etc.) |
| `side` | Card face (`a` = front face; only front-face rows are indexed) |

### `data/cardPrices.csv`

Contains one row per price entry. Rows are filtered to `priceProvider=tcgplayer`, `providerListing=retail`, `currency=USD`, `gameAvailability=paper`. The following columns are used:

| Column | Description |
|---|---|
| `uuid` | MTGJSON unique identifier |
| `cardFinish` | `normal` or `foil` |
| `date` | Price date (most recent entry per `uuid_finish` is used) |
| `price` | Market price in USD |

---

## Modules

### `lib/csv.js`

- **`readCsv(filePath)`** — reads a CSV file into an array of row objects. Strips a leading `sep=,` directive if present.
- **`writeCsv(filePath, headers, data)`** — writes an array of row objects to a CSV file using the provided header mapping.

### `lib/mergeRows.js`

- **`mergeRows(rows)`** — groups rows by `Card Number`, sums quantities, keeps the lowest `MARKET` price, and returns the deduplicated rows sorted by card number.
- **`sortCards(rows)`** — sorts rows numerically by `Card Number`.

### `lib/missingCards.js`

- **`findMissingCardNumbers(rows, maxCardNum)`** — returns `{ missing, min, max }` where `missing` is all integers in `[1, max]` that have no corresponding row. `max` is the greater of the highest card number in `rows` and `maxCardNum` (if provided).
- **`insertPlaceholders(rows, missingNumbers)`** — creates zero-quantity placeholder rows for each missing number and returns the combined sorted list.

### `lib/cardNames.js`

- **`loadCardNames(setCodes)`** — streams `data/cards.csv` once and returns an object keyed by set code, each containing a `nameMap` (`number → name`), `uuidMap` (`number → uuid`), and `rarityMap` (`number → rarity`). Only front-face rows (`side === 'a'` or no side) are indexed.
- **`fillMissingNames(rows, cardData, fallbackCodes)`** — replaces `???` card names using the set's name map; tries `fallbackCodes` if the row has no `Set Code`.
- **`fillRarity(rows, cardData, fallbackCodes)`** — populates `Rarity` on every row from the set's rarity map.
- **`fillMissingPrices(rows, cardData, priceMap)`** — fills any missing `MARKET` values by taking the lower of the normal and foil prices for the card's UUID.

### `lib/cardPrices.js`

- **`loadCardPrices(uuidSet)`** — streams `data/cardPrices.csv` once, filtered to the provided UUID set and TCGPlayer retail USD paper prices. When multiple price entries exist for the same `uuid_finish` key, the most recent date wins. Returns a map keyed by `uuid_finish`.
