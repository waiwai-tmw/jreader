#!/usr/bin/env bash
# scripts/render_build.sh
# Render Native buildpacks: install private uv, force Python 3.13, sync deps, build Rust.

set -euxo pipefail

echo "[render_build] repo root: $(pwd)"

# ---- Paths & ensure our bin first
HOME_LOCAL_BIN="${HOME}/.local/bin"
UV_BIN="${HOME_LOCAL_BIN}/uv"
mkdir -p "${HOME_LOCAL_BIN}"
export PATH="${HOME_LOCAL_BIN}:$PATH"

# Note: We don't need uv at runtime anymore since we use the venv Python directly

# ---- Install uv privately (idempotent)
if [ ! -x "${UV_BIN}" ]; then
  echo "[render_build] installing uv to ${UV_BIN}..."
  curl -LsSf https://astral.sh/uv/install.sh | sh
else
  echo "[render_build] uv already installed at ${UV_BIN}"
fi

echo "[render_build] uv version: $(${UV_BIN} --version)"

# ---- Make sure Python 3.13 (from Render) is used
# Render's Native buildpack installs python3 during this build step.
# After that, `command -v python3` should point to 3.13.x (NOT /usr/bin/python3).
PY313_PATH="$(command -v python3)"
echo "[render_build] python3 path: ${PY313_PATH}"
"${PY313_PATH}" --version

# Some Render images set VIRTUAL_ENV to a global .venv; that confuses uv resolution.
unset VIRTUAL_ENV || true
# Hint uv explicitly (env + CLI)
export UV_PYTHON="${PY313_PATH}"

# ---- Sync Python deps (no dev deps) with the forced interpreter
# ---- Clone syosetu2epub if not already present
if [ ! -d syosetu2epub ]; then
  echo "[render_build] Cloning syosetu2epub repo..."
  git clone --depth 1 git@github-waiwai:waiwai-tmw/syosetu2epub-jreader.git syosetu2epub
fi
pushd syosetu2epub

# Show what uv thinks the interpreter is (for debugging clarity)
echo "[render_build] uv will use: ${UV_PYTHON}"
"${PY313_PATH}" --version

# Force interpreter via --python to avoid falling back to /usr/bin/python3 (3.11)
"${UV_BIN}" sync --python "${PY313_PATH}" --frozen --no-dev

popd

# Verify the venv Python interpreter exists (safety check)
test -x syosetu2epub/.venv/bin/python || { echo "[render_build] ERROR: venv python missing"; exit 1; }
echo "[render_build] ✅ venv Python interpreter verified: syosetu2epub/.venv/bin/python"

# ---- Build Rust
if command -v cargo >/dev/null 2>&1; then
  echo "[render_build] cargo: $(cargo --version)"
else
  echo "[render_build] ERROR: cargo not found on PATH"; exit 1
fi

cargo build --release

echo "[render_build] build finished successfully"
