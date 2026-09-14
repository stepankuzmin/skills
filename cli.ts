#!/usr/bin/env node
// The CLI for this marketplace.
//
//   ./cli.ts version    Propagate version, description, catalog
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = import.meta.dirname;
const README = join(root, "README.md");
const MARKETPLACE = join(root, ".claude-plugin/marketplace.json");

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

type PluginSource =
  | { kind: "local"; path: string }
  | { kind: "github"; repo: string; ref: string; skills: string[] };

type Plugin = { name: string; description: string; source: PluginSource };

// Claude's marketplace is the one that says where each plugin lives.
// A string source is a local path; an object source is someone else's repo.
function parseMarketplace(input: unknown): Plugin[] {
  if (!isRecord(input) || !Array.isArray(input.plugins)) {
    throw new Error(`${MARKETPLACE}: "plugins" must be an array`);
  }
  return input.plugins.map((entry: unknown, index) => {
    const where = `${MARKETPLACE} plugins[${index}]`;
    if (!isRecord(entry)) throw new Error(`${where}: must be an object`);
    const name = field(entry, "name", where);
    const description = field(entry, "description", where);
    if (typeof entry.source === "string") {
      return { name, description, source: { kind: "local", path: entry.source } };
    }
    if (!isRecord(entry.source) || entry.source.source !== "github") {
      throw new Error(`${where}: source must be a path or a github source`);
    }
    const skills = Array.isArray(entry.skills) ? entry.skills : [];
    if (!skills.every((skill) => typeof skill === "string")) {
      throw new Error(`${where}: "skills" must be strings`);
    }
    const ref =
      typeof entry.source.sha === "string" ? entry.source.sha
      : typeof entry.source.ref === "string" ? entry.source.ref
      : "HEAD";
    return {
      name,
      description,
      source: { kind: "github", repo: field(entry.source, "repo", where), ref, skills },
    };
  });
}

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

const table = ({ kind, rows }: { kind: string; rows: Row[] }) =>
  [`| ${kind} | Description |`, "| --- | --- |", ...rows.map(
    ({ name, url, text }) => `| [\`${name}\`](${url}) | ${summarize(text).replaceAll("|", "\\|")} |`,
  )].join("\n");

// Every SKILL.md (or agent .md) under a local plugin's `skills/` or `agents/` dir.
function localRows({ path, kind }: { path: string; kind: "skills" | "agents" }): Row[] {
  const dir = join(root, path, kind);
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir, { withFileTypes: true });
  const names =
    kind === "agents"
      ? entries.filter((entry) => entry.isFile() && entry.name.endsWith(".md")).map((entry) => entry.name.slice(0, -3))
      : entries.filter((entry) => entry.isDirectory() && existsSync(join(dir, entry.name, "SKILL.md"))).map((entry) => entry.name);
  return names.sort().map((name) => {
    const file = `${path.replace(/^\.\//, "")}/${kind}/${kind === "agents" ? `${name}.md` : `${name}/SKILL.md`}`;
    return { name, url: file, text: readFileSync(join(root, file), "utf8") };
  });
}

// External skills live in someone else's repo; their SKILL.md is fetched at
// the pinned commit.
async function externalRows({ repo, ref, skills }: { repo: string; ref: string; skills: string[] }): Promise<Row[]> {
  const rows: Row[] = [];
  for (const skillPath of skills) {
    const file = `${skillPath.replace(/^\.\//, "")}/SKILL.md`;
    const raw = `https://raw.githubusercontent.com/${repo}/${ref}/${file}`;
    const response = await fetch(raw);
    if (!response.ok) throw new Error(`${raw}: ${response.status}`);
    rows.push({
      name: skillPath.replace(/^.*\//, ""),
      url: `https://github.com/${repo}/blob/${ref}/${file}`,
      text: await response.text(),
    });
  }
  return rows;
}

async function tables(source: PluginSource): Promise<{ kind: string; rows: Row[] }[]> {
  switch (source.kind) {
    case "local":
      return [
        { kind: "Agent", rows: localRows({ path: source.path, kind: "agents" }) },
        { kind: "Skill", rows: localRows({ path: source.path, kind: "skills" }) },
      ];
    case "github":
      return [{ kind: "Skill", rows: await externalRows(source) }];
    default: {
      const _exhaustive: never = source;
      return _exhaustive;
    }
  }
}

// One README section per marketplace plugin, so editing the marketplace is
// the only step in editing the README.
async function catalog(plugins: Plugin[]): Promise<boolean> {
  const sections: string[] = [];
  for (const plugin of plugins) {
    const heading = plugin.name[0].toUpperCase() + plugin.name.slice(1);
    const body = (await tables(plugin.source)).filter(({ rows }) => rows.length > 0).map(table);
    sections.push([`## ${heading}`, plugin.description, ...body].join("\n\n"));
  }
  const start = "<!-- catalog:start -->";
  const end = "<!-- catalog:end -->";
  const readme = readFileSync(README, "utf8");
  // A replacer callback, so a $ in a description stays literal.
  const updated = readme.replace(
    new RegExp(`${start}[\\s\\S]*?${end}`),
    () => `${start}\n\n${sections.join("\n\n")}\n\n${end}`,
  );
  if (updated === readme) return false;
  writeFileSync(README, updated);
  return true;
}

// Set the key, reporting whether anything actually changed.
function set(record: Record<string, unknown>, key: string, value: string): boolean {
  if (record[key] === value) return false;
  record[key] = value;
  return true;
}

const USAGE = `usage: cli version

  version    Propagate version and description into every plugin manifest,
             and regenerate the README catalog`;

if (process.argv[2] !== "version") {
  console.error(USAGE);
  process.exit(1);
}

const pkg = readJson(join(root, "package.json"));
if (!isRecord(pkg)) throw new Error("package.json: must be an object");
const version = field(pkg, "version", "package.json");
const description = field(pkg, "description", "package.json");
const plugins = parseMarketplace(readJson(MARKETPLACE));
const changed: string[] = [];

for (const plugin of plugins) {
  if (plugin.source.kind !== "local") continue;
  for (const manifest of [".claude-plugin/plugin.json", ".codex-plugin/plugin.json"]) {
    const manifestPath = join(root, plugin.source.path, manifest);
    if (!existsSync(manifestPath)) continue; // a plugin may not ship every harness's manifest
    const json = readJson(manifestPath);
    if (!isRecord(json)) throw new Error(`${manifestPath}: must be an object`);
    let dirty = set(json, "version", version);
    if (set(json, "description", description)) dirty = true;
    if (dirty) {
      writeJson(manifestPath, json);
      changed.push(`${plugin.source.path}/${manifest}`);
    }
  }
}

if (await catalog(plugins)) changed.push("README.md");

console.log(`skills ${version} — ${description}`);
console.log(
  changed.length === 0
    ? "Manifests already current."
    : "Synced:\n" + changed.map((file) => `  ${file}`).join("\n"),
);
