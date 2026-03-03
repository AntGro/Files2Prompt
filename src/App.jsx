import { useEffect, useMemo, useRef, useState } from "react";

const MAX_BATCH = 25;
const MIN_SIDEBAR_WIDTH = 260;
const MAX_SIDEBAR_WIDTH = 680;
const MIN_CONTENT_WIDTH = 420;
const SPLITTER_WIDTH = 10;

function estimateTokens(text) {
  if (!text) return 0;
  return Math.max(1, Math.floor(text.length / 4));
}

function collectFiles(node, out = []) {
  if (!node) return out;
  if (node.type === "file") {
    out.push(node);
    return out;
  }
  if (node.children) {
    for (const child of node.children) {
      collectFiles(child, out);
    }
  }
  return out;
}

function App() {
  const [rootPath, setRootPath] = useState("");
  const [filter, setFilter] = useState("");
  const [tree, setTree] = useState(null);
  const [openDirs, setOpenDirs] = useState(() => new Set());
  const [selected, setSelected] = useState(() => new Map());
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copyState, setCopyState] = useState("idle");
  const [showHelp, setShowHelp] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const appRef = useRef(null);

  const aggregatedText = useMemo(() => {
    const parts = [];
    for (const [rel, content] of selected.entries()) {
      parts.push(`${"=".repeat(20)}\n>>> ${rel}\n${"=".repeat(20)}\n${content}`);
    }
    return parts.join("\n\n");
  }, [selected]);

  const tokenEstimate = useMemo(() => estimateTokens(aggregatedText), [aggregatedText]);

  async function loadTree() {
    setError("");
    setStatus("");

    if (!rootPath.trim()) {
      setError("Provide a root directory.");
      return;
    }

    if (filter) {
      try {
        new RegExp(filter);
      } catch {
        setError("Invalid filter regex.");
        return;
      }
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({ root: rootPath.trim() });
      if (filter) params.set("filter", filter);
      const res = await fetch(`/api/tree?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load tree");
      setTree(data.tree);
      setOpenDirs(new Set([""]));
      setStatus("Tree loaded.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function toggleDir(rel) {
    setOpenDirs((prev) => {
      const next = new Set(prev);
      if (next.has(rel)) next.delete(rel);
      else next.add(rel);
      return next;
    });
  }

  async function fetchFile(rel) {
    const params = new URLSearchParams({ root: rootPath.trim(), rel });
    const res = await fetch(`/api/file?${params.toString()}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Failed to load ${rel}`);
    return data.content;
  }

  async function toggleFile(rel, checked) {
    setError("");
    if (!checked) {
      setSelected((prev) => {
        const next = new Map(prev);
        next.delete(rel);
        return next;
      });
      return;
    }

    setLoading(true);
    try {
      const content = await fetchFile(rel);
      setSelected((prev) => {
        const next = new Map(prev);
        next.set(rel, content);
        return next;
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function selectAllInDir(node) {
    if (!node) return;
    const files = collectFiles(node).filter((file) => !selected.has(file.rel));
    if (files.length === 0) return;

    setLoading(true);
    setStatus(`Selecting ${files.length} files...`);
    try {
      for (let i = 0; i < files.length; i += MAX_BATCH) {
        const batch = files.slice(i, i + MAX_BATCH);
        const contents = await Promise.all(batch.map((file) => fetchFile(file.rel)));
        setSelected((prev) => {
          const next = new Map(prev);
          batch.forEach((file, idx) => next.set(file.rel, contents[idx]));
          return next;
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setStatus("");
    }
  }

  function clearSelection() {
    setSelected(new Map());
  }

  async function copyAggregatedText() {
    if (!aggregatedText) return;
    try {
      await navigator.clipboard.writeText(aggregatedText);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1400);
    } catch {
      setCopyState("error");
      window.setTimeout(() => setCopyState("idle"), 1800);
    }
  }

  function clampSidebarWidth(nextWidth) {
    const appWidth = appRef.current?.clientWidth ?? window.innerWidth;
    const maxAllowedByLayout = Math.max(
      MIN_SIDEBAR_WIDTH,
      appWidth - MIN_CONTENT_WIDTH - SPLITTER_WIDTH,
    );
    const maxAllowed = Math.min(MAX_SIDEBAR_WIDTH, maxAllowedByLayout);
    return Math.max(MIN_SIDEBAR_WIDTH, Math.min(nextWidth, maxAllowed));
  }

  function startResize(event) {
    if (window.matchMedia("(max-width: 960px)").matches) return;
    event.preventDefault();
    setIsResizing(true);
  }

  useEffect(() => {
    if (!isResizing) return undefined;

    function onPointerMove(event) {
      const appLeft = appRef.current?.getBoundingClientRect().left ?? 0;
      const desiredWidth = event.clientX - appLeft;
      setSidebarWidth(clampSidebarWidth(desiredWidth));
    }

    function onPointerUp() {
      setIsResizing(false);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [isResizing]);

  useEffect(() => {
    function onResize() {
      setSidebarWidth((prev) => clampSidebarWidth(prev));
    }

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!showHelp) return undefined;

    function onKeyDown(event) {
      if (event.key === "Escape") {
        setShowHelp(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showHelp]);

  function renderNode(node, depth = 0) {
    if (!node) return null;

    if (node.type === "dir") {
      const isOpen = openDirs.has(node.rel);
      return (
        <div key={node.rel || node.name}>
          <div className="tree-row" style={{ paddingLeft: `${depth * 14 + 8}px` }}>
            <button
              className="tree-toggle"
              onClick={() => toggleDir(node.rel)}
              aria-label={isOpen ? "Collapse folder" : "Expand folder"}
            >
              <span className={`caret ${isOpen ? "open" : ""}`}>▶</span>
              <span className="folder">{node.name}</span>
            </button>
            <button className="tree-action" onClick={() => selectAllInDir(node)}>
              Select all
            </button>
          </div>
          {isOpen && node.children?.map((child) => renderNode(child, depth + 1))}
        </div>
      );
    }

    const isChecked = selected.has(node.rel);
    return (
      <label
        key={node.rel}
        className={`tree-row tree-file ${isChecked ? "selected" : ""}`}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
      >
        <input
          type="checkbox"
          checked={isChecked}
          onChange={(e) => toggleFile(node.rel, e.target.checked)}
        />
        <span className="file">{node.name}</span>
      </label>
    );
  }

  return (
    <>
      <div
        ref={appRef}
        className={`app ${isResizing ? "resizing" : ""}`}
        style={{ "--sidebar-width": `${sidebarWidth}px` }}
      >
        <aside className="sidebar">
          <div className="sidebar-header">
            <div className="app-name">BranchBrief</div>
            <div className="title">Directory Browser</div>
            <div className="subtitle">Point me at a root directory.</div>
          </div>

          <div className="controls">
            <label>
              Root directory
              <input
                type="text"
                value={rootPath}
                onChange={(e) => setRootPath(e.target.value)}
                placeholder="/Users/yourname/project"
              />
            </label>

            <label>
              Filter (regex)
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="src/.*\\.ts$"
              />
            </label>

            <div className="control-row">
              <button className="primary" onClick={loadTree} disabled={loading}>
                {loading ? "Loading..." : "Load tree"}
              </button>
              <button className="secondary" onClick={clearSelection}>
                Clear selection
              </button>
            </div>

            {status && <div className="status">{status}</div>}
            {error && <div className="error">{error}</div>}
          </div>

          <div className="tree">
            {tree ? renderNode(tree) : <div className="placeholder">No tree loaded yet.</div>}
          </div>
        </aside>
        <div
          className="splitter"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize panels"
          onPointerDown={startResize}
        />

        <main className="content">
          <div className="content-header">
            <div>
              <div className="title">Aggregated Content</div>
              <div className="subtitle">Select files to assemble a prompt-ready view.</div>
            </div>
            <div className="content-meta">
              <div className="tokens">Estimated tokens: {tokenEstimate.toLocaleString()}</div>
              <button
                className="secondary copy-button"
                onClick={copyAggregatedText}
                disabled={!aggregatedText}
              >
                {copyState === "copied" ? "Copied" : copyState === "error" ? "Copy failed" : "Copy"}
              </button>
            </div>
          </div>

          <div className="code-block">
            {aggregatedText ? (
              <pre>{aggregatedText}</pre>
            ) : (
              <div className="empty">Select files from the tree to see their content.</div>
            )}
          </div>
        </main>
      </div>

      <footer className="app-footer">
        <div>BranchBrief</div>
        <button className="footer-link" onClick={() => setShowHelp(true)}>
          Help
        </button>
      </footer>

      {showHelp && (
        <div className="help-backdrop" onClick={() => setShowHelp(false)}>
          <div className="help-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="help-header">
              <div className="title">How to use BranchBrief</div>
              <button className="help-close" aria-label="Close help" onClick={() => setShowHelp(false)}>
                Close
              </button>
            </div>
            <div className="help-content">
              <p>1. Set a root directory, optionally add a regex filter, then click Load tree.</p>
              <p>2. Select files or use Select all on a folder to fetch and aggregate content.</p>
              <p>3. To hide files from the tree and prevent fetching, create a `.filetreeignore` in the root.</p>
              <p>4. Add one pattern per line in `.filetreeignore` (supports `*` wildcard), for example:</p>
              <pre>{`node_modules/
dist/
*.log
*.env
coverage/`}</pre>
              <p>5. You can also narrow scope with Filter (regex), for example: `src/.*\\.(js|ts|tsx)$`.</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
