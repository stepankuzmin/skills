#!/usr/bin/env node
// The CLI for this marketplace.
//
//   ./cli.ts version    Propagate version, description, catalog
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = import.meta.dirname;
const PLUGIN = join(root, "plugins/stepankuzmin-skills");
const SKILLS = join(PLUGIN, "skills");
const README = join(root, "README.md");
const MARKETPLACE = join(root, ".claude-plugin/marketplace.json");

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
function summarize(text: string): string {
  const frontmatter = /^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? "";
  const lines = frontmatter.split("\n");
  const start = lines.findIndex((line) => line.startsWith("description:"));
  if (start === -1) return "";

  // YAML carries a long value on the indented lines below, either wrapped or
  // under a block scalar indicator (description: >-) that is not part of it.
  // The next top-level key ends the value.
  const head = lines[start].slice("description:".length).trim();
  const value = [/^[>|][0-9]*[-+]?$/.test(head) ? "" : head];
  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line)) break;
    value.push(line);
  }
  const description = value.join(" ").replace(/\s+/g, " ").trim();
  return /^.*?[.!?](?=\s|$)/.exec(description)?.[0] ?? description;
}

type Row = { name: string; url: string; text: string };

const row = ({ name, url, text }: Row) =>
  `| [\`${name}\`](${url}) | ${summarize(text).replaceAll("|", "\\|")} |`;

function localRows(): Row[] {
  return readdirSync(SKILLS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(SKILLS, entry.name, "SKILL.md")))
    .map((entry) => entry.name)
    .sort()
    .map((name) => {
      const path = `plugins/stepankuzmin-skills/skills/${name}/SKILL.md`;
      return { name, url: path, text: readFileSync(join(root, path), "utf8") };
    });
}

// External skills are github marketplace entries; their SKILL.md is fetched
// at the pinned commit.
async function externalRows(): Promise<Row[]> {
  const rows: Row[] = [];
  for (const plugin of readJson(MARKETPLACE).plugins) {
    const { source } = plugin;
    if (source?.source !== "github") continue;
    const ref = source.sha ?? source.ref ?? "HEAD";
    for (const skillPath of plugin.skills ?? []) {
      const file = `${skillPath.replace(/^\.\//, "")}/SKILL.md`;
      const raw = `https://raw.githubusercontent.com/${source.repo}/${ref}/${file}`;
      const response = await fetch(raw);
      if (!response.ok) throw new Error(`${raw}: ${response.status}`);
      rows.push({
        name: skillPath.split("/").at(-1)!,
        url: `https://github.com/${source.repo}/blob/${ref}/${file}`,
        text: await response.text(),
      });
    }
  }
  return rows;
}

// Rewrite one README table between its markers.
function replaceTable(readme: string, marker: string, rows: Row[]): string {
  const start = `<!-- ${marker}:start -->`;
  const end = `<!-- ${marker}:end -->`;
  const table = ["| Skill | Description |", "| --- | --- |", ...rows.map(row)].join("\n");
  // A replacer callback, so a $ in a description stays literal.
  return readme.replace(new RegExp(`${start}[\\s\\S]*?${end}`), () => `${start}\n\n${table}\n\n${end}`);
}

// Rewrite the README catalogs, so adding a skill is the only step in adding a skill.
async function catalog(): Promise<boolean> {
  const readme = readFileSync(README, "utf8");
  let updated = replaceTable(readme, "skills", localRows());
  updated = replaceTable(updated, "external", await externalRows());
  if (updated === readme) return false;
  writeFileSync(README, updated);
  return true;
}

const USAGE = `usage: cli version

  version    Propagate version and description into every plugin manifest,
             and regenerate the README catalog`;

if (process.argv[2] !== "version") {
  console.error(USAGE);
  process.exit(1);
}

const { version, description } = readJson(join(root, "package.json"));
const changed: string[] = [];

// Claude's marketplace is the one that says where each plugin lives.
// Remote entries (object sources) are other people's plugins; leave them.
const { plugins } = readJson(MARKETPLACE);
for (const plugin of plugins) {
  if (typeof plugin.source !== "string") continue;
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

if (await catalog()) changed.push("README.md");

console.log(`skills ${version} — ${description}`);
console.log(
  changed.length === 0
    ? "Manifests already current."
    : "Synced:\n" + changed.map((file) => `  ${file}`).join("\n"),
);
