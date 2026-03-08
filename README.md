## Prompt From Tree (React + Express)

Small tool to browse a local directory tree, select files, and aggregate their contents into a prompt-ready text block.

Built-in ignore patterns: `*.env`, `.idea`, `__pycache__/`, `*.pyc`, `.DS_Store`, `.git`.

## Prerequisites

- Node.js 18+ (Node.js 20+ recommended)
- npm (comes with Node.js)

## Clone and Setup

```bash
git clone <your-repo-url>
cd prompt-from-tree
npm install
```

## Run Locally

Run frontend + backend together:

```bash
npm run dev:all
```

Then open `http://localhost:5173`.

### Ports

- Frontend (Vite): `5173`
- Backend (Express): `5175`

## Run Frontend and Backend Separately

In terminal 1:

```bash
npm run server
```

In terminal 2:

```bash
npm run dev
```

## Build for Production

```bash
npm run build
```

## Notes

- `node_modules/`, `dist/`, `.idea/`, `.vite/`, `.vercel/`, and `.env*` are ignored by git.
- `.filetreeignore` is committed and defines project-level file exclusion patterns.
- This app reads local filesystem paths through the backend; that behavior is intended for local use.
