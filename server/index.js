import fs from "fs";
import path from "path";
import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5175;
const MAX_FILE_SIZE = 500_000;

const BUILTIN_PATTERNS = [
  "*.env",
  ".idea",
  "__pycache__/",
  "*.pyc",
  ".DS_Store",
  ".git",
];

function loadPatterns(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  return lines
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

function patternToRegex(line) {
  let pattern = line.replace(/\\/g, "/").trim();
  let isDirectory = false;

  if (pattern.endsWith("/")) {
    isDirectory = true;
    pattern = pattern.slice(0, -1);
  }

  pattern = pattern.replace(/^(\.\/)+/, "");
  pattern = pattern.replace(/^(\.\*\/)+/, "");
  if (!pattern) return null;

  const hasSlash = pattern.includes("/");
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");

  if (hasSlash) {
    return new RegExp(`(^|/)${escaped}${isDirectory ? "($|/)" : "$"}`);
  }

  if (isDirectory) {
    return new RegExp(`(^|/)${escaped}($|/)`);
  }

  return new RegExp(`(^|/)${escaped}$`);
}

function patternsToRegex(patterns) {
  return patterns.map(patternToRegex).filter(Boolean);
}

function isForbidden(relPath, patterns) {
  return patterns.some((pattern) => pattern.test(relPath));
}

function safeRelative(root, target) {
  const rel = path.relative(root, target);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    return null;
  }
  return rel.split(path.sep).join("/");
}

function buildTree(root, current, filterRegex, patterns) {
  let entries = [];
  try {
    entries = fs.readdirSync(current, { withFileTypes: true });
  } catch {
    return { name: path.basename(current), path: current, rel: "", type: "dir", children: [] };
  }

  entries.sort((a, b) => {
    if (a.isFile() !== b.isFile()) return a.isFile() ? 1 : -1;
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });

  const children = [];
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const absPath = path.join(current, entry.name);
    const rel = safeRelative(root, absPath);
    if (!rel) continue;
    if (isForbidden(rel, patterns)) continue;

    if (entry.isDirectory()) {
      const childNode = buildTree(root, absPath, filterRegex, patterns);
      const includeDir = !filterRegex || filterRegex.test(rel) || childNode.children.length > 0;
      if (includeDir) {
        children.push({
          name: entry.name,
          path: absPath,
          rel,
          type: "dir",
          children: childNode.children,
        });
      }
    } else if (entry.isFile()) {
      if (filterRegex && !filterRegex.test(rel)) continue;
      let size = 0;
      try {
        size = fs.statSync(absPath).size;
      } catch {
        size = 0;
      }
      children.push({
        name: entry.name,
        path: absPath,
        rel,
        type: "file",
        size,
      });
    }
  }

  return {
    name: path.basename(current),
    path: current,
    rel: "",
    type: "dir",
    children,
  };
}

app.get("/api/tree", (req, res) => {
  const root = req.query.root;
  const filter = req.query.filter || "";
  if (!root || typeof root !== "string") {
    return res.status(400).json({ error: "root is required" });
  }

  let stat;
  try {
    stat = fs.statSync(root);
  } catch {
    return res.status(400).json({ error: "root is not accessible" });
  }
  if (!stat.isDirectory()) {
    return res.status(400).json({ error: "root is not a directory" });
  }

  let filterRegex = null;
  if (filter) {
    try {
      filterRegex = new RegExp(filter);
    } catch {
      return res.status(400).json({ error: "invalid filter regex" });
    }
  }

  const projectPatterns = loadPatterns(path.join(root, ".filetreeignore"));
  const patterns = [...patternsToRegex(BUILTIN_PATTERNS), ...patternsToRegex(projectPatterns)];

  const tree = buildTree(root, root, filterRegex, patterns);
  res.json({ root, tree });
});

app.get("/api/file", (req, res) => {
  const root = req.query.root;
  const rel = req.query.rel;
  if (!root || !rel || typeof root !== "string" || typeof rel !== "string") {
    return res.status(400).json({ error: "root and rel are required" });
  }

  const absPath = path.resolve(root, rel);
  const safeRel = safeRelative(root, absPath);
  if (!safeRel) {
    return res.status(400).json({ error: "invalid path" });
  }

  const projectPatterns = loadPatterns(path.join(root, ".filetreeignore"));
  const patterns = [...patternsToRegex(BUILTIN_PATTERNS), ...patternsToRegex(projectPatterns)];
  if (isForbidden(safeRel, patterns)) {
    return res.status(403).json({ error: "path is forbidden by ignore rules" });
  }

  let stat;
  try {
    stat = fs.statSync(absPath);
  } catch {
    return res.status(404).json({ error: "file not found" });
  }

  if (!stat.isFile()) {
    return res.status(400).json({ error: "not a file" });
  }

  if (stat.size > MAX_FILE_SIZE) {
    return res.status(413).json({ error: "file too large" });
  }

  let content = "";
  try {
    content = fs.readFileSync(absPath, "utf8");
  } catch {
    return res.status(500).json({ error: "could not read file" });
  }

  res.json({ rel: safeRel, content });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
