# [Files2Prompt](https://antgro.github.io/Files2Prompt/)

**Local folders → prompt-ready text**

A sleek, fully client-side tool to browse local directories, select files, and generate prompt-ready text blocks. Perfect for feeding code context to LLMs.

🔒 **Your files never leave your browser** — everything runs locally using the [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API).

## ✨ Features

- **📂 Local Folder Browser** — pick any folder from your machine or drag & drop
- **🌳 File Tree** — expandable tree with file icons, sizes, and token estimates
- **⭐ Smart Prioritization** — README, entry points, configs sorted to the top
- **🧠 Token Budget Bar** — set a budget (4K–128K), color-coded progress bar warns when you're close
- **📝 Prompt Templates** — 6 built-in templates (Code Review, Explain, Find Bugs, Write Tests, Refactor, Documentation)
- **✏️ Custom Templates** — write your own with `{files}` placeholder, saved to localStorage
- **🔍 Filter** — quickly find files by name or path
- **📋 Copy / Download** — one-click copy or download as `.txt`
- **🌙 Dark Mode** — default dark theme, toggle to light
- **🚫 Smart Ignores** — built-in patterns for node_modules, .git, images, etc.
- **📄 .gitignore Support** — auto-loads `.gitignore` patterns when present

## 🚀 Usage

1. Open `index.html` in Chrome, Edge, or Brave
2. Click "Choose Folder" or drag & drop a folder
3. Select files from the tree
4. Optionally pick a prompt template
5. Click "Generate" → Copy to clipboard

**No installation, no server, no dependencies.**

## ⚠️ Browser Support

Requires the [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API), which is supported in:
- ✅ Chrome 86+
- ✅ Edge 86+
- ✅ Brave
- ❌ Firefox (not supported)
- ❌ Safari (not supported)

## 🔗 See Also

- [repo-to-prompt](https://github.com/AntGro/repo-to-prompt) — the GitHub repo version (browse remote repos via GitHub API)
