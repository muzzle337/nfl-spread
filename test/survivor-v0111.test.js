import test from "node:test";
import assert from "node:assert/strict";
import {
  APP_VERSION,
  DEFAULT_SURVIVOR_ENTRIES,
  ensureDefaultSurvivorEntries
} from "../src/v011-entry.js";
import { withSurvivorV0111Ui } from "../src/survivor-v0111-ui.js";

test("v0.11.1 defines the six Muzzle Survivor entries", () => {
  assert.equal(APP_VERSION, "0.11.1");
  assert.deepEqual(DEFAULT_SURVIVOR_ENTRIES, [
    "Muzzle 1",
    "Muzzle 2",
    "Muzzle 3",
    "Muzzle 4",
    "Muzzle 5",
    "Muzzle 6"
  ]);
});

test("Survivor entry bootstrap inserts Muzzle 1 through Muzzle 6 idempotently", async () => {
  let sql = "";
  let values = [];
  let runs = 0;
  const DB = {
    prepare(statement) {
      sql = String(statement);
      return {
        bind(...args) {
          values = args;
          return {
            async run() {
              runs += 1;
              return { success: true };
            }
          };
        }
      };
    }
  };

  await ensureDefaultSurvivorEntries(
    new Request("https://example.com/api/survivor/entries?season=2026"),
    { DB }
  );

  assert.match(sql, /INSERT OR IGNORE INTO survivor_entries/);
  assert.equal(runs, 1);
  assert.deepEqual(values, [
    2026, "Muzzle 1",
    2026, "Muzzle 2",
    2026, "Muzzle 3",
    2026, "Muzzle 4",
    2026, "Muzzle 5",
    2026, "Muzzle 6"
  ]);
});

test("Survivor display hotfix gives percentage enough space and removes manual entry clutter", () => {
  const html = withSurvivorV0111Ui("<html><body><div class=\"survivor-add\"></div></body></html>");
  assert.match(html, /\.survivor-add\{display:none!important\}/);
  assert.match(html, /grid-template-columns:88px minmax\(0,1fr\) auto/);
  assert.match(html, /\.survivor-pct\{text-align:left;font-size:25px/);
  assert.match(html, /@media \(max-width:430px\)/);
});
