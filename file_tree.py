import re
from pathlib import Path

import streamlit as st


class FileTree:
    def __init__(
            self,
            root: Path,
            max_file_size: int = 500_000,
            filter_pattern: re.Pattern | None = None,
            state_key: str = "file_tree",
    ):
        self.root = root
        self.max_file_size = max_file_size
        self.filter_pattern = filter_pattern
        self.state_key = state_key
        self.forbidden_patterns = self._load_forbidden_patterns()

        st.session_state.setdefault(f"{state_key}_open_dirs", set())
        st.session_state.setdefault(f"{state_key}_selected_files", {})

    def _load_forbidden_patterns(self) -> list[re.Pattern]:
        """Load global and project-specific forbidden patterns."""
        patterns = []

        # Load global forbidden patterns
        global_forbidden_path = Path(__file__).parent / "FORBIDDEN_PATTERNS.txt"
        if global_forbidden_path.exists():
            with open(global_forbidden_path, "r") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#"):
                        patterns.append(re.compile(line.replace(".", r"\.").replace("*", ".*")))

        # Load project-specific forbidden patterns
        project_forbidden_path = self.root / ".filetreeignore"
        if project_forbidden_path.exists():
            with open(project_forbidden_path, "r") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#"):
                        patterns.append(re.compile(line.replace(".", r"\.").replace("*", ".*")))

        return patterns

    def _is_forbidden(self, rel_path: str) -> bool:
        """Check if a path matches any forbidden pattern."""
        for pattern in self.forbidden_patterns:
            if pattern.search(rel_path):
                return True
        return False

    # ---------- public ----------
    @property
    def selected_files(self) -> dict[str, str]:
        return st.session_state[f"{self.state_key}_selected_files"]

    def render(self):
        self._render_dir(self.root, depth=0)

    # ---------- internal ----------
    def _allowed(self, rel_path: str) -> bool:
        """Check if a path is allowed (not forbidden and matches filter)."""
        if self._is_forbidden(rel_path):
            return False
        if self.filter_pattern:
            return bool(self.filter_pattern.search(rel_path))
        return True

    def _select_all_files(self, folder: Path):
        for path in folder.rglob("*"):
            if not path.is_file():
                continue

            rel_path = path.relative_to(self.root).as_posix()

            if not self._allowed(rel_path):
                continue

            if path.stat().st_size > self.max_file_size:
                continue

            if rel_path not in self.selected_files:
                try:
                    with open(path, "r", encoding="utf-8", errors="ignore") as f:
                        self.selected_files[rel_path] = f.read()
                except Exception:
                    pass

    def _render_dir(self, current: Path, depth: int):
        try:
            entries = sorted(
                current.iterdir(),
                key=lambda p: (p.is_file(), p.name.lower()),
            )
        except PermissionError:
            return

        open_dirs = st.session_state[f"{self.state_key}_open_dirs"]

        for path in entries:
            rel_path = path.relative_to(self.root).as_posix()
            if not self._allowed(rel_path):
                continue

            indent = " " * depth  # thin unicode space

            if path.is_dir():
                is_open = rel_path in open_dirs
                icon = "▼" if is_open else "▶"

                cols = st.sidebar.columns([0.85, 0.15])
                with cols[0]:
                    clicked = st.button(
                        f"{indent}{icon} {path.name}",
                        key=f"{self.state_key}_dir_{rel_path}",
                        use_container_width=True,
                    )

                with cols[1]:
                    if is_open:
                        if st.button(
                                "＋",
                                key=f"{self.state_key}_select_all_{rel_path}",
                                help="Select all files in folder",
                        ):
                            self._select_all_files(path)
                            st.rerun()

                if clicked:
                    if is_open:
                        open_dirs.remove(rel_path)
                    else:
                        open_dirs.add(rel_path)
                    st.rerun()

                if is_open:
                    self._render_dir(path, depth + 1)
            else:
                cols = st.sidebar.columns([0.9, 0.1])
                with cols[0]:
                    st.markdown(f"{indent}📄 {path.name}")

                with cols[1]:
                    checked = st.checkbox(
                        "",
                        key=f"{self.state_key}_file_{rel_path}",
                        label_visibility="collapsed",
                    )

                if checked:
                    if rel_path not in self.selected_files:
                        if path.stat().st_size <= self.max_file_size:
                            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                                self.selected_files[rel_path] = f.read()
                else:
                    self.selected_files.pop(rel_path, None)
