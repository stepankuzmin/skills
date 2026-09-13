#!/usr/bin/env node
// The CLI for this marketplace.
//
//   ./skills.ts add <source> -s <skill>...     Vendor external skills into the plugin
//   ./skills.ts update [<skill>]...            Re-fetch vendored skills (default: all)
//   ./skills.ts remove <skill>...              Drop vendored skills
//   ./skills.ts sync                           Propagate version, description, catalog
//
// Vendoring is npx skills (https://npmjs.com/package/skills) run inside the
// plugin, so its own skills-lock.json records what came from where. Every
// command that touches the plugin ends with a manifest sync.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = import.meta.dirname;
const PLUGIN = join(root, "plugins/stepankuzmin-skills");
const SKILLS = join(PLUGIN, "skills");
const README = join(root, "README.md");
const START = "<!-- skills:start -->";
const END = "<!-- skills:end -->";

const USAGE = `usage: skills <command>

  add <source> -s <skill>...     Vendor named skills from a source into the plugin
  update [<skill>]...            Re-fetch vendored skills (default: all)
  remove <skill>...              Drop vendored skills
  sync                           Propagate version, description, and the README catalog

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

// The first sentence of the skill's frontmatter description.
function summarize(skill: string): string {
  const text = readFileSync(join(SKILLS, skill, "SKILL.md"), "utf8");
  const frontmatter = /^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? "";
  const lines = frontmatter.split("\n");
  const start = lines.findIndex((line) => line.startsWith("description:"));
  if (start === -1) return "";

  // YAML wraps long values onto indented continuation lines; the next
  // top-level key ends the value.
  const value = [lines[start].slice("description:".length)];
  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line)) break;
    value.push(line);
  }
  const description = value.join(" ").replace(/\s+/g, " ").trim();
  return /^.*?[.!?](?=\s|$)/.exec(description)?.[0] ?? description;
}

// Vendored skills carry a link to the upstream file they were copied from.
function origin(skill: string, lock: Record<string, any>): string {
  const entry = lock[skill];
  if (!entry) return "";
  const [repo, ref = "HEAD"] = String(entry.source).split("#");
  if (entry.sourceType !== "github") return ` (\`${entry.source}\`)`;
  const url = `https://github.com/${repo}/blob/${ref}/${entry.skillPath}`;
  return ` ([${repo}](${url}))`;
}

// Rewrite the README catalog from the skills on disk and the vendoring
// lockfile, so adding a skill is the only step in adding a skill.
function catalog(): boolean {
  const lock = readJson(join(PLUGIN, "skills-lock.json")).skills ?? {};
  const skills = readdirSync(SKILLS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(SKILLS, entry.name, "SKILL.md")))
    .map((entry) => entry.name)
    .sort();

  const rows = skills.map((skill) => {
    const path = `plugins/stepankuzmin-skills/skills/${skill}/SKILL.md`;
    const summary = summarize(skill).replaceAll("|", "\\|");
    return `| [\`${skill}\`](${path})${origin(skill, lock)} | ${summary} |`;
  });

  const table = ["| Skill | Description |", "| --- | --- |", ...rows].join("\n");
  const readme = readFileSync(README, "utf8");
  const updated = readme.replace(
    new RegExp(`${START}[\\s\\S]*?${END}`),
    `${START}\n\n${table}\n\n${END}`,
  );
  if (updated === readme) return false;
  writeFileSync(README, updated);
  return true;
}

// Propagate version + description from the root package.json into every plugin
// manifest listed in the marketplace, so a single `npm version` covers them all.
function sync(): void {
  const { version, description } = readJson(join(root, "package.json"));
  const changed: string[] = [];

  // Each harness keeps its own marketplace descriptor, with its own copy of
  // the description.
  for (const file of [".claude-plugin/marketplace.json", ".agents/plugins/marketplace.json"]) {
    const marketplacePath = join(root, file);
    const marketplace = readJson(marketplacePath);
    let dirty = false;
    for (const plugin of marketplace.plugins) {
      if (set(plugin, "description", description)) dirty = true;
    }
    if (dirty) {
      writeJson(marketplacePath, marketplace);
      changed.push(file);
    }
  }

  // Claude's marketplace is the one that says where each plugin lives.
  const { plugins } = readJson(join(root, ".claude-plugin/marketplace.json"));
  for (const plugin of plugins) {
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

  if (catalog()) changed.push("README.md");

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
    // -y suppresses the scope prompt, whose Global option would install
    // outside the plugin. It also means "every skill in the source" unless
    // the skills are named, so name them.
    const named = rest.includes("-s") || rest.includes("--skill");
    if (!source || source.startsWith("-") || !named) {
      console.error(USAGE);
      process.exit(1);
    }
    // npx skills runs in PLUGIN, where a relative local source would resolve.
    const from = existsSync(source) ? resolve(source) : source;
    vendor("add", from, ...rest, "-a", "openclaw", "--copy", "-y");
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
