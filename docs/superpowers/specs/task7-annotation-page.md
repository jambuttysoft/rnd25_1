# Task 7 Spec — Annotation Helper Page

> **Read first:** `docs/superpowers/specs/00-project-context.md`
> **Prerequisites:** Tasks 3, 4, 5, 6 complete.
> The Annotate tab UI already exists in `public/index.html` and `public/app.js`
> (it was included in Task 4). This task only adds the backend routes that the tab calls.

---

## Scope

Two changes, both small:

1. **Create `data/annotations/ground_truth.json`** — empty array, initial state
2. **Add 3 routes to `server.js`:**
   - `GET /api/receipts` — list filenames from the `CASH_RECIEPTS/` directory
   - `GET /api/annotations` — read all annotation records from `ground_truth.json`
   - `POST /api/annotations` — upsert one annotation record into `ground_truth.json`

No new files beyond the JSON. No changes to `public/`.

---

## Step 1: Create `data/annotations/ground_truth.json`

Create the file at `/Volumes/extdisk/WORK/RND2026/RND1/data/annotations/ground_truth.json`:

```json
[]
```

This is the persistent store for human annotations. Each call to `POST /api/annotations` either adds a new record or updates an existing one (matched by `filename`).

---

## Step 2: Add constants and helper functions to `server.js`

Add these after the existing `import` statements and before the first route:

```javascript
// Paths for annotation storage
const GT_PATH = join(__dirname, 'data', 'annotations', 'ground_truth.json');
const RECEIPTS_DIR = join(__dirname, 'CASH_RECIEPTS');

function loadAnnotations() {
  try {
    return JSON.parse(readFileSync(GT_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function saveAnnotations(data) {
  writeFileSync(GT_PATH, JSON.stringify(data, null, 2));
}
```

Note: `readFileSync` and `writeFileSync` are already imported at the top of `server.js`.
`readdirSync` is NOT yet imported — add it to the existing fs import line.

The existing import line is:
```javascript
import { readFileSync, writeFileSync } from 'fs';
```

Change it to:
```javascript
import { readFileSync, writeFileSync, readdirSync } from 'fs';
```

---

## Step 3: Add annotation routes to `server.js`

Add these routes **before** the `app.listen(...)` line (after the E6 route added in Task 6):

```javascript
// ─── GET /api/receipts ────────────────────────────────────────────────────────
// List all receipt filenames from the CASH_RECIEPTS directory.
// Returns filenames sorted alphabetically.
// Used by the Annotate tab to populate the file dropdown.
//
// Response: string[]  e.g. ["receipt_001.jpg", "receipt_002.png", ...]
app.get('/api/receipts', (req, res) => {
  try {
    const files = readdirSync(RECEIPTS_DIR)
      .filter(f => /\.(jpg|jpeg|png|pdf)$/i.test(f))
      .sort();
    res.json(files);
  } catch (e) {
    res.json({ error: `Cannot read CASH_RECIEPTS: ${e.message}` });
  }
});


// ─── GET /api/annotations ─────────────────────────────────────────────────────
// Return all annotation records from ground_truth.json.
//
// Response: AnnotationRecord[]
// AnnotationRecord shape:
//   {
//     filename: string,
//     vendor: string | null,
//     date: string | null,        ISO 8601 date
//     amount: number | null,
//     currency: string | null,    ISO 4217 code
//     category: string,           equipment | software | travel | meals | services | supplies | other
//     human_verdict: string,      justified | suspicious | unclear
//     human_verdict_reason: string,
//     is_ambiguous: boolean,
//     notes: string
//   }
app.get('/api/annotations', (req, res) => {
  res.json(loadAnnotations());
});


// ─── POST /api/annotations ────────────────────────────────────────────────────
// Upsert one annotation record.
// If a record with the same `filename` already exists, it is replaced.
// If no record exists for this filename, a new one is appended.
//
// Body: AnnotationRecord (see schema above)
// Response: { ok: true } | { error: string }
app.post('/api/annotations', (req, res) => {
  const entry = req.body;
  if (!entry || !entry.filename) {
    return res.json({ error: 'filename is required' });
  }
  try {
    const all = loadAnnotations();
    const idx = all.findIndex(a => a.filename === entry.filename);
    if (idx >= 0) {
      all[idx] = entry;  // update existing
    } else {
      all.push(entry);   // insert new
    }
    saveAnnotations(all);
    res.json({ ok: true });
  } catch (e) {
    res.json({ error: e.message });
  }
});
```

---

## Verify

### Test 1: Server starts

```bash
node server.js
```
Expected: `Server running at http://localhost:3000` — no errors.

### Test 2: Receipts list

```bash
curl http://localhost:3000/api/receipts
```
Expected: a JSON array of filenames from `CASH_RECIEPTS/`, e.g.:
```json
["IMG_5381.JPG", "IMG_5382.JPG", ...]
```
There should be approximately 25-26 files.

### Test 3: Annotations (empty initial state)

```bash
curl http://localhost:3000/api/annotations
```
Expected: `[]`

### Test 4: Full annotation flow via browser

1. Open `http://localhost:3000`
2. Click the "Annotate" tab
3. The file dropdown should populate with receipt filenames from `CASH_RECIEPTS/`
4. Select any receipt, fill in: vendor, date, amount, currency, category, verdict, reason
5. Optionally check "Mark as ambiguous"
6. Click "Save Annotation"
7. Expected: "✓ Saved [filename]" message appears

### Test 5: Persistence and update

1. After saving (Test 4), run:
```bash
cat data/annotations/ground_truth.json
```
Expected: a JSON array with one record.

2. Re-select the same receipt in the Annotate tab — form values should be restored from the saved annotation.
3. Change one field, click Save again.
4. Run `cat data/annotations/ground_truth.json` again — the record should be updated, not duplicated.

### Test 6: Annotate 3 receipts

Annotate 3 different receipts to confirm:
- Each receipt gets its own record
- `data/annotations/ground_truth.json` grows to 3 entries
- Re-selecting each receipt restores the correct form values

---

## Commit

```bash
git add server.js data/annotations/ground_truth.json
git commit -m "feat: annotation routes — list receipts, read/write ground_truth.json"
```

---

## Notes for Paper Use

After annotating all 26 receipts, `data/annotations/ground_truth.json` becomes the ground truth dataset for computing experiment metrics:
- E1 field precision: compare model extraction to `vendor`, `date`, `amount`, `currency`, `category` fields
- E2/E3 Cohen's κ: compare model `verdict` to `human_verdict`
- E5 uncertainty rate: filter records where `is_ambiguous === true`, check model verdict
- E6 hallucination rate: use all records, compare model `policy_clarity` to actual policy variant

The file path is: `/Volumes/extdisk/WORK/RND2026/RND1/data/annotations/ground_truth.json`
