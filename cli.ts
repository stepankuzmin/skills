#!/usr/bin/env node
// The CLI for this marketplace. Run it with no arguments for usage.
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

// `skills` writes into the chosen agent's skills directory, resolved from cwd.
// openclaw's is a bare `skills`, the only one that lands on this repo's
// plugins/<plugin>/skills/<skill> layout. `skills update` ignores the agent and
// writes .agents/skills, so update below re-adds at a fresh commit instead.
const AGENT = "openclaw";

function skills(plugin: string, args: string[]): void {
  const { status, stdout, stderr } = spawnSync(
    "npx",
    // A bare `npx skills` resolves to the local `skills` package, which has no bin.
    ["--yes", "skills@latest", ...args, "-a", AGENT, "-y"],
    { cwd: join(PLUGINS, plugin), encoding: "utf8" },
  );
  if (status !== 0) {
    console.error(stdout ?? "");
    console.error(stderr ?? "");
    throw new Error(`skills ${args[0]} failed in plugins/${plugin}`);
  }
}

function headCommit(source: string): string {
  const { status, stdout } = spawnSync(
    "git",
    ["ls-remote", `https://github.com/${source}`, "HEAD"],
    { encoding: "utf8" },
  );
  const sha = stdout.split(/\s/)[0];
  if (status !== 0 || !sha) throw new Error(`cannot resolve HEAD of ${source}`);
  return sha;
}

function vendored(): { plugin: string; name: string; source: string }[] {
  return readdirSync(PLUGINS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap(({ name: plugin }) => {
      const lock = join(PLUGINS, plugin, LOCK_FILE);
      if (!existsSync(lock)) return [];
      const json = readJson(lock);
      if (!isRecord(json) || !isRecord(json.skills)) {
        throw new Error(`${lock}: "skills" must be an object`);
      }
      return Object.entries(json.skills).map(([name, entry]) => {
        const where = `${lock}: ${name}`;
        if (!isRecord(entry)) throw new Error(`${where}: must be an object`);
        const sourceType = field(entry, "sourceType", where);
        if (sourceType !== "github") {
          throw new Error(`${where}: only "github" sources are supported, got "${sourceType}"`);
        }
        return { plugin, name, source: field(entry, "source", where) };
      });
    });
}

function fetchSkill(plugin: string, source: string, name: string): void {
  const commit = headCommit(source);
  console.log(`plugins/${plugin}/skills/${name} ← ${source}#${commit}`);
  skills(plugin, ["add", `${source}#${commit}`, "--skill", name]);
}

const USAGE = `usage: cli <command>

  version                              Propagate version and description into every plugin manifest
  add <owner>/<repo> <skill> <plugin>  Vendor a skill into a plugin at its current upstream commit
  remove <skill>                       Delete a vendored skill and its lockfile entry
  update [skill...]                    Refetch vendored skills at their current upstream commit`;

function usage(): never {
  console.error(USAGE);
  process.exit(1);
}

// Nothing stops two plugins from vendoring the same skill name, so a name can
// match more than one entry.
function matching(name: string): { plugin: string; name: string; source: string }[] {
  const matches = vendored().filter((entry) => entry.name === name);
  if (matches.length === 0) throw new Error(`${name} is not vendored by any plugin`);
  return matches;
}

function add([source, name, plugin]: string[]): void {
  if (!source || !name || !plugin) usage();
  if (!existsSync(join(PLUGINS, plugin))) throw new Error(`no such plugin: ${plugin}`);
  // Fetching is a clean sync, so an unclaimed directory here is a first-party
  // skill this would replace and the lockfile would then claim.
  const claimed = vendored().some((entry) => entry.plugin === plugin && entry.name === name);
  if (!claimed && existsSync(join(PLUGINS, plugin, "skills", name))) {
    throw new Error(`plugins/${plugin}/skills/${name} already exists and is not vendored`);
  }
  fetchSkill(plugin, source, name);
}

function remove([name]: string[]): void {
  if (!name) usage();
  const matches = matching(name);
  if (matches.length > 1) {
    const plugins = matches.map((entry) => entry.plugin).join(" and ");
    throw new Error(`${name} is vendored by ${plugins}; delete the one you mean from its plugin's skills/ and ${LOCK_FILE}`);
  }
  const [skill] = matches;
  skills(skill.plugin, ["remove", name]);
  console.log(`removed plugins/${skill.plugin}/skills/${name}`);
}

function update(names: string[]): void {
  const targets = names.length === 0 ? vendored() : names.flatMap(matching);
  if (targets.length === 0) {
    console.log(`No plugin has a ${LOCK_FILE}. Nothing is vendored.`);
    return;
  }
  for (const { plugin, source, name } of targets) fetchSkill(plugin, source, name);
  console.log("Review what upstream changed with `git diff`.");
}

const commands: Record<string, (args: string[]) => void> = { version, add, remove, update };
const command = commands[process.argv[2] ?? ""];

if (!command) usage();

command(process.argv.slice(3));
