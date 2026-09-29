// Read-only repository schema inventory. Never connects to D1 or runs migrations.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : entry.name.endsWith('.js') ? [path] : [];
  });
}
function declarations(content) {
  const found = [];
  // Match SQL embedded in JS template literals or strings, without executing code.
  const regex = /\bCREATE\s+(?:UNIQUE\s+)?(TABLE|INDEX)\s+(?:IF\s+NOT\s+EXISTS\s+)?(["\x60\[]?[a-z_][\w]*["\x60\]]?)/gi;
  for (const match of content.matchAll(regex)) {
    found.push({ kind: match[1].toUpperCase(), name: match[2].replace(/["\x60\[\]]/g, '').toLowerCase() });
  }
  return found;
}
const source = walk(join(root, 'src')).flatMap(path =>
  declarations(readFileSync(path, 'utf8')).map(item => ({ ...item, file: relative(root, path) }))
);
const migrationDir = join(root, 'migrations');
const migrationFiles = readdirSync(migrationDir).filter(file => file.endsWith('.sql')).sort();
const migrated = new Set(migrationFiles.flatMap(file =>
  declarations(readFileSync(join(migrationDir, file), 'utf8')).map(item => item.kind + ':' + item.name)
));
const unique = [...new Map(source.map(item => [item.kind + ':' + item.name, item])).values()]
  .sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
const missing = unique.filter(item => !migrated.has(item.kind + ':' + item.name));
console.log(JSON.stringify({ migrationFiles, sourceDeclarations: unique, notInCheckedInMigrations: missing }, null, 2));
if (missing.length) {
  console.log('\nInventory only: missing declarations detected. Do not apply migrations without staging and production-schema verification.');
}
