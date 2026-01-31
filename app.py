import os
import re
from pathlib import Path

import streamlit as st
from file_tree import FileTree

# ----------------------------
# Session state init
# ----------------------------
st.session_state.setdefault("selected_dir", None)
st.session_state.setdefault("filter_pattern", None)


def load_css(file_path) -> None:
    with open(file_path) as f:
        st.markdown(f"<style>{f.read()}</style>", unsafe_allow_html=True)


load_css("styles.css")

# ----------------------------
# Sidebar controls
# ----------------------------
with st.sidebar:
    st.header("📂 Directory Browser")

    dir_path = st.text_input("Root directory")
    if st.button("Choose directory") and dir_path:
        if os.path.isdir(dir_path):
            st.session_state.selected_dir = os.path.abspath(dir_path)
        else:
            st.error("Invalid directory path")

    filter_pattern = st.text_input("Filter (regex on relative path)")
    if filter_pattern:
        try:
            st.session_state.filter_pattern = re.compile(filter_pattern)
        except re.error:
            st.error("Invalid regex")
    else:
        st.session_state.filter_pattern = None

    st.markdown("---")

# ----------------------------
# Sidebar: tree
# ----------------------------
tree = None
if st.session_state.selected_dir:
    tree = FileTree(
        root=Path(st.session_state.selected_dir),
        filter_pattern=st.session_state.filter_pattern,
    )

    st.sidebar.subheader("Browsing")
    st.sidebar.caption(tree.root.as_posix())
    tree.render()

# ----------------------------
# Main content area
# ----------------------------
st.subheader("📄 Aggregated Content")

if tree and tree.selected_files:
    aggregated = [
        f"{'=' * 20}\n>>> {path}\n{'=' * 20}\n{content}"
        for path, content in tree.selected_files.items()
    ]

    st.code("\n\n".join(aggregated), language=None, line_numbers=True)
else:
    st.info("Select files from the tree to see their content.")
