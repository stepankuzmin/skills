#!/usr/bin/env node
// The CLI for this marketplace.
//
//   ./skills.ts add <source> [-s <skill>]...   Vendor external skills into the plugin
//   ./skills.ts update [<skill>]...            Re-fetch vendored skills (default: all)
//   ./skills.ts remove <skill>...              Drop vendored skills
//   ./skills.ts sync                           Propagate version and description
//
// Vendoring is npx skills (https://npmjs.com/package/skills) run inside the
// plugin, so its own skills-lock.json records what came from where. Every
// command that touches the plugin ends with a manifest sync.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = import.meta.dirname;
const PLUGIN = join(root, "plugins/stepankuzmin-skills");

const USAGE = `usage: skills <command>

  add <source> [-s <skill>]...   Vendor skills from a source into the plugin
  update [<skill>]...            Re-fetch vendored skills (default: all)
  remove <skill>...              Drop vendored skills
  sync                           Propagate version and description into the manifests

Sources take any form npx skills accepts: owner/repo, owner/repo#ref,
a GitHub tree URL, a git URL, or a local path.`;

const readJson = (path: string) => JSON.parse(readFileSync(path, "utf8"));

const writeJson = (path: string, value: unknown) =>
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");

// Set obj[key] = value, reporting whether anything actually changed.
const set = (obj: Record<string, unknown>, key: string, value: unknown): boolean => {
  if (obj[key] === value) return false;
  obj[key] = value;
  return true;
};

// Propagate version + description from the root package.json into every plugin
// manifest listed in the marketplace, so a single `npm version` covers them all.
function sync(): void {
  const { version, description } = readJson(join(root, "package.json"));
  const marketplacePath = join(root, ".claude-plugin/marketplace.json");
  const marketplace = readJson(marketplacePath);
  const changed: string[] = [];
  let marketplaceDirty = false;

  for (const plugin of marketplace.plugins) {
    if (set(plugin, "description", description)) marketplaceDirty = true;

    for (const manifest of [".claude-plugin/plugin.json", ".codex-plugin/plugin.json"]) {
      const manifestPath = join(root, plugin.source, manifest);
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
}

// npx skills installs into the project skills path of whichever agent it
// targets. The openclaw target's is a plain skills/, which is where the plugin
// already keeps its skills.
function vendor(...args: string[]): void {
  // skills also installs into every agent it detects; the plugin ships skills/.
  // Only the directories this run creates are cleared, so anything already
  // in the plugin survives, including when the command fails partway.
  const strays = [".agents", ".claude"]
    .map((dir) => join(PLUGIN, dir))
    .filter((dir) => !existsSync(dir));

  const run = spawnSync("npx", ["--yes", "skills@latest", ...args], {
    cwd: PLUGIN,
    stdio: "inherit",
  });

  for (const dir of strays) rmSync(dir, { recursive: true, force: true });

  if (run.status !== 0) process.exit(run.status ?? 1);
  sync();
}

const [command, ...args] = process.argv.slice(2);

switch (command) {
  case "add": {
    const [source, ...rest] = args;
    if (!source) {
      console.error(USAGE);
      process.exit(1);
    }
    // npx skills runs in PLUGIN, where a relative local source would resolve.
    const from = existsSync(source) ? resolve(source) : source;
    vendor("add", from, ...rest, "-a", "openclaw", "--copy");
    break;
  }
  case "update":
    vendor("update", ...args, "-p");
    break;
  case "remove":
    vendor("remove", ...args);
    break;
  case "sync":
    sync();
    break;
  default:
    console.error(USAGE);
    process.exit(1);
}
