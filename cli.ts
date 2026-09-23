#!/usr/bin/env node
// The CLI for this marketplace. Run it with no arguments for usage.
//
// Descriptions are set by hand in .claude-plugin/marketplace.json and copied
// everywhere else.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = import.meta.dirname;
const MARKETPLACE = join(root, ".claude-plugin/marketplace.json");
const CODEX_MARKETPLACE = join(root, ".agents/plugins/marketplace.json");

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));

const writeJson = (path: string, value: unknown) =>
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

function field(record: Record<string, unknown>, key: string, where: string): string {
  const value = record[key];
  if (typeof value !== "string") throw new Error(`${where}: "${key}" must be a string`);
  return value;
}

// A string source is a local plugin path; an object source is someone else's
// repo and has no manifest here to update.
function localPlugins(input: unknown): { name: string; path: string; description: string }[] {
  if (!isRecord(input) || !Array.isArray(input.plugins)) {
    throw new Error(`${MARKETPLACE}: "plugins" must be an array`);
  }
  return input.plugins.flatMap((entry: unknown) =>
    isRecord(entry) && typeof entry.source === "string"
      ? [
          {
            name: field(entry, "name", `${MARKETPLACE}: ${entry.source}`),
            path: entry.source,
            description: field(entry, "description", `${MARKETPLACE}: ${entry.source}`),
          },
        ]
      : [],
  );
}

// Set the key, reporting whether anything actually changed.
function set(record: Record<string, unknown>, key: string, value: string): boolean {
  if (record[key] === value) return false;
  record[key] = value;
  return true;
}

function version(): void {
  const pkg = readJson(join(root, "package.json"));
  if (!isRecord(pkg)) throw new Error("package.json: must be an object");
  const version = field(pkg, "version", "package.json");
  const changed: string[] = [];

  const plugins = localPlugins(readJson(MARKETPLACE));
  const codex = readJson(CODEX_MARKETPLACE);
  if (!isRecord(codex) || !Array.isArray(codex.plugins)) {
    throw new Error(`${CODEX_MARKETPLACE}: "plugins" must be an array`);
  }

  for (const { path, description } of plugins) {
    for (const manifest of [".claude-plugin/plugin.json", ".codex-plugin/plugin.json"]) {
      const manifestPath = join(root, path, manifest);
      if (!existsSync(manifestPath)) continue; // a plugin may not ship every harness's manifest
      const json = readJson(manifestPath);
      if (!isRecord(json)) throw new Error(`${manifestPath}: must be an object`);
      let dirty = set(json, "version", version);
      if (set(json, "description", description)) dirty = true;
      if (dirty) {
        writeJson(manifestPath, json);
        changed.push(`${path}/${manifest}`);
      }
    }
  }

  let codexDirty = false;
  for (const entry of codex.plugins) {
    const description = isRecord(entry) && plugins.find((plugin) => plugin.name === entry.name)?.description;
    if (description && set(entry, "description", description)) codexDirty = true;
  }
  if (codexDirty) {
    writeJson(CODEX_MARKETPLACE, codex);
    changed.push(".agents/plugins/marketplace.json");
  }

  console.log(`skills ${version}`);
  console.log(
    changed.length === 0
      ? "Manifests already current."
      : "Synced:\n" + changed.map((file) => `  ${file}`).join("\n"),
  );
}

const USAGE = `usage: cli version

  version    Propagate version and description into every plugin manifest`;

if (process.argv[2] !== "version") {
  console.error(USAGE);
  process.exit(1);
}

version();
