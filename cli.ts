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

const table = (kind: string, rows: Row[]) =>
  [`| ${kind} | Description |`, "| --- | --- |", ...rows.map(
    ({ name, url, text }) => `| [\`${name}\`](${url}) | ${summarize(text).replaceAll("|", "\\|")} |`,
  )].join("\n");

// Every SKILL.md (or agent .md) under a local plugin's `skills/` or `agents/` dir.
function localRows(source: string, kind: "skills" | "agents"): Row[] {
  const dir = join(root, source, kind);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .map((entry) => {
      if (kind === "agents") return entry.isFile() && entry.name.endsWith(".md") ? entry.name.slice(0, -3) : "";
      return entry.isDirectory() && existsSync(join(dir, entry.name, "SKILL.md")) ? entry.name : "";
    })
    .filter(Boolean)
    .sort()
    .map((name) => {
      const path = `${source.replace(/^\.\//, "")}/${kind}/${kind === "agents" ? `${name}.md` : `${name}/SKILL.md`}`;
      return { name, url: path, text: readFileSync(join(root, path), "utf8") };
    });
}

// External skills are github marketplace entries; their SKILL.md is fetched
// at the pinned commit.
async function externalRows(plugin: any): Promise<Row[]> {
  const { source } = plugin;
  const ref = source.sha ?? source.ref ?? "HEAD";
  const rows: Row[] = [];
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
  return rows;
}

// One README section per marketplace plugin, so editing the marketplace is
// the only step in editing the README.
async function catalog(): Promise<boolean> {
  const sections: string[] = [];
  for (const plugin of readJson(MARKETPLACE).plugins) {
    const heading = plugin.name[0].toUpperCase() + plugin.name.slice(1);
    const tables: [string, Row[]][] =
      typeof plugin.source === "string"
        ? [["Agent", localRows(plugin.source, "agents")], ["Skill", localRows(plugin.source, "skills")]]
        : [["Skill", await externalRows(plugin)]];
    const body = tables.filter(([, rows]) => rows.length > 0).map(([kind, rows]) => table(kind, rows));
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
