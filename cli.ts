#!/usr/bin/env node
// The CLI for this marketplace.
//
//   ./cli.ts version    Propagate the version and each plugin's marketplace description into its manifests
//   ./cli.ts vendor     Refresh every vendored skill from its plugin's skills-lock.json
//
// The two marketplace.json files carry the descriptions by hand.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = import.meta.dirname;
const MARKETPLACE = join(root, ".claude-plugin/marketplace.json");
const PLUGINS = join(root, "plugins");
const LOCK_FILE = "skills-lock.json";

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
function localPlugins(input: unknown): { path: string; description: string }[] {
  if (!isRecord(input) || !Array.isArray(input.plugins)) {
    throw new Error(`${MARKETPLACE}: "plugins" must be an array`);
  }
  return input.plugins.flatMap((entry: unknown) =>
    isRecord(entry) && typeof entry.source === "string"
      ? [{ path: entry.source, description: field(entry, "description", `${MARKETPLACE}: ${entry.source}`) }]
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

  for (const { path, description } of localPlugins(readJson(MARKETPLACE))) {
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

  console.log(`skills ${version}`);
  console.log(
    changed.length === 0
      ? "Manifests already current."
      : "Synced:\n" + changed.map((file) => `  ${file}`).join("\n"),
  );
}

// Pin the package: from anywhere in this repo, a bare `npx skills` resolves to
// the local `skills` package in package.json, which has no bin.
const SKILLS_CLI = "skills@latest";

// `skills add` writes into the chosen agent's skills directory, resolved from
// cwd. openclaw's is a bare `skills`, the only one that lands on this repo's
// plugins/<plugin>/skills/<skill> layout. `skills update` and
// `experimental_install` ignore the agent and always write .agents/skills.
const VENDOR_AGENT = "openclaw";

// `<owner>/<repo>#<ref>`, or bare when the entry tracks the default branch.
function sourceSpec(entry: unknown, where: string): string {
  if (!isRecord(entry)) throw new Error(`${where}: must be an object`);
  const sourceType = field(entry, "sourceType", where);
  if (sourceType !== "github") {
    throw new Error(`${where}: only "github" sources are supported, got "${sourceType}"`);
  }
  const source = field(entry, "source", where);
  if (entry.ref === undefined) return source;
  return `${source}#${field(entry, "ref", where)}`;
}

function vendor(): void {
  const locks = readdirSync(PLUGINS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({ plugin: entry.name, path: join(PLUGINS, entry.name, LOCK_FILE) }))
    .filter(({ path }) => existsSync(path));

  if (locks.length === 0) {
    console.log(`No plugin has a ${LOCK_FILE}. Nothing is vendored.`);
    return;
  }

  let failed = 0;
  for (const { plugin, path } of locks) {
    const lock = readJson(path);
    if (!isRecord(lock) || !isRecord(lock.skills)) {
      throw new Error(`${path}: "skills" must be an object`);
    }
    for (const [name, entry] of Object.entries(lock.skills)) {
      const spec = sourceSpec(entry, `${path}: ${name}`);
      console.log(`${plugin}/${name} ← ${spec}`);
      const args = ["--yes", SKILLS_CLI, "add", spec, "--skill", name, "-a", VENDOR_AGENT, "-y"];
      const result = spawnSync("npx", args, { cwd: join(PLUGINS, plugin), encoding: "utf8" });
      if (result.status !== 0) {
        failed++;
        console.error(result.stdout ?? "");
        console.error(result.stderr ?? "");
        console.error(`  failed: ${plugin}/${name}`);
      }
    }
  }

  if (failed > 0) process.exit(1);
  console.log("Review what upstream changed with `git diff`.");
}

const USAGE = `usage: cli <command>

  version    Propagate version and description into every plugin manifest
  vendor     Refresh every vendored skill from its plugin's skills-lock.json`;

const commands: Record<string, () => void> = { version, vendor };
const command = commands[process.argv[2] ?? ""];

if (!command) {
  console.error(USAGE);
  process.exit(1);
}

command();
