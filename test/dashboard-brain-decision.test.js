import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const entry=readFileSync(new URL('../src/v0259-entry.js',import.meta.url),'utf8');

test('dashboard brain layer exposes actionable ATS decision labels',()=>{
  for(const label of ['Brain Board','RIDE','LEAN','WATCH','FADE','PASS','Confidence','Rising','Cooling']){
    assert.ok(entry.includes(label),`missing ${label}`);
  }
});

test('dashboard brain layer distinguishes movement buckets and does not add client API polling',()=>{
  for(const bucket of ["label:'0'","label:'0.5'","label:'1–1.5'","label:'2+'"]){
    assert.ok(entry.includes(bucket),`missing movement bucket ${bucket}`);
  }
  assert.equal(entry.includes("fetch('/api/"),false);
  assert.equal(entry.includes('setInterval('),false);
});

test('dashboard brain layer preserves Brain grade separately from final confidence',()=>{
  assert.ok(entry.includes('🧠 Brain '));
  assert.ok(entry.includes('Confidence '));
  assert.ok(entry.includes("gradeRank(g)"));
});
