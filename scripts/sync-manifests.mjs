#!/usr/bin/env node
// Propagate version + description from the root package.json into every plugin
// manifest listed in the marketplace, so a single `npm version` covers them all.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const writeJson = (path, obj) =>
  writeFileSync(path, JSON.stringify(obj, null, 2) + "\n");

// Set obj[key] = value, reporting whether anything actually changed.
const set = (obj, key, value) => {
  if (obj[key] === value) return false;
  obj[key] = value;
  return true;
};

const { version, description } = readJson(join(root, "package.json"));
const changed = [];

const marketplacePath = join(root, ".claude-plugin", "marketplace.json");
const marketplace = readJson(marketplacePath);
let marketplaceDirty = false;

for (const plugin of marketplace.plugins) {
  if (set(plugin, "description", description)) marketplaceDirty = true;

  const pluginDir = join(root, plugin.source);
  for (const manifest of [
    ".claude-plugin/plugin.json",
    ".codex-plugin/plugin.json",
  ]) {
    const manifestPath = join(pluginDir, manifest);
    let json;
    try {
      json = readJson(manifestPath);
    } catch {
      continue; // a plugin may not ship every harness's manifest
    }
    let dirty = set(json, "version", version);
    if (set(json, "description", description)) dirty = true;
    if (dirty) {
      writeJson(manifestPath, json);
      changed.push(`${plugin.source}/${manifest}`);
    }
  }
}

if (marketplaceDirty) {
  writeJson(marketplacePath, marketplace);
  changed.push(".claude-plugin/marketplace.json");
}

console.log(`skills ${version} — ${description}`);
console.log(
  changed.length === 0
    ? "Manifests already in sync."
    : "Synced:\n" + changed.map((file) => `  ${file}`).join("\n"),
);
