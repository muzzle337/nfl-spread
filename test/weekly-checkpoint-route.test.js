import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('pool outlook reuses existing game data for weekly checkpoints', () => {
  const source=readFileSync(new URL('../src/v022-entry.js',import.meta.url),'utf8');
  assert.match(source,/import \{ weeklyCheckpoint \} from '\.\/weekly-checkpoint\.js';/);
  const start=source.indexOf("if(url.pathname==='/api/pool/outlooks'");
  const end=source.indexOf("if(url.pathname==='/api/pool/picks'",start);
  const route=source.slice(start,end);
  assert.match(route,/const games=await weeklyGameOutlooks/);
  assert.match(route,/const checkpoint=weeklyCheckpoint/);
  assert.match(route,/games,checkpoint,summary/);
  assert.doesNotMatch(route,/fetchNflMarkets|fetchNflScores|ingestWeeklySpreads/);
});
