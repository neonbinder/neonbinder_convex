#!/bin/bash
set -e

# setup-maestro.sh — Install Java 17 and Maestro CLI for E2E testing
# Works on macOS (brew) and Linux (apt / SDKMAN fallback, no sudo required)

MAESTRO_BIN="$HOME/.maestro/bin"
MAESTRO_CLI="$MAESTRO_BIN/maestro"

# ── Helpers ───────────────────────────────────────────────────────────────────
info()    { echo "ℹ️  $*"; }
success() { echo "✅ $*"; }
warn()    { echo "⚠️  $*"; }
die()     { echo "❌ $*"; exit 1; }

# ── Java 17+ ──────────────────────────────────────────────────────────────────
java_major_version() {
  java -version 2>&1 | head -1 | awk -F '"' '{print $2}' | cut -d. -f1
}

has_java17() {
  command -v java &>/dev/null || return 1
  local ver
  ver=$(java_major_version 2>/dev/null)
  [[ "$ver" -ge 17 ]] 2>/dev/null
}

install_java_apt() {
  if command -v sudo &>/dev/null; then
    info "Installing OpenJDK 17 via apt..."
    sudo apt-get update -qq && sudo apt-get install -y openjdk-17-jdk
  else
    warn "apt available but no sudo — falling back to SDKMAN"
    return 1
  fi
}

install_java_brew() {
  info "Installing OpenJDK 17 via Homebrew..."
  brew install openjdk@17
  # Brew-installed JDK isn't on PATH by default
  local brew_jdk
  brew_jdk="$(brew --prefix openjdk@17)/libexec/openjdk.jdk/Contents/Home"
  if [ -d "$brew_jdk" ]; then
    export JAVA_HOME="$brew_jdk"
    export PATH="$JAVA_HOME/bin:$PATH"
  fi
}

install_java_sdkman() {
  info "Installing Java 17 via SDKMAN (no sudo required)..."
  if [ ! -f "$HOME/.sdkman/bin/sdkman-init.sh" ]; then
    curl -s "https://get.sdkman.io" | bash
  fi
  # shellcheck disable=SC1090
  source "$HOME/.sdkman/bin/sdkman-init.sh"
  sdk install java 17-tem < /dev/null   # non-interactive
  sdk use java 17-tem
}

if has_java17; then
  success "Java $(java_major_version) detected — skipping Java install"
else
  info "Java 17+ not found — installing..."
  if [[ "$OSTYPE" == "darwin"* ]]; then
    if command -v brew &>/dev/null; then
      install_java_brew
    else
      install_java_sdkman
    fi
  elif command -v apt-get &>/dev/null; then
    install_java_apt || install_java_sdkman
  else
    install_java_sdkman
  fi

  # Source SDKMAN if it was just installed
  if [ -f "$HOME/.sdkman/bin/sdkman-init.sh" ]; then
    # shellcheck disable=SC1090
    source "$HOME/.sdkman/bin/sdkman-init.sh"
  fi

  has_java17 || die "Java 17 installation failed. Please install Java 17+ manually."
  success "Java $(java_major_version) installed"
fi

# ── Maestro CLI ───────────────────────────────────────────────────────────────
if [ -f "$MAESTRO_CLI" ]; then
  CURRENT_VERSION=$("$MAESTRO_CLI" --version 2>/dev/null || echo "unknown")
  success "Maestro already installed (${CURRENT_VERSION}) at $MAESTRO_CLI"
else
  info "Installing Maestro CLI..."
  curl -Ls "https://get.maestro.mobile.dev" | bash
  success "Maestro installed"
fi

export PATH="$MAESTRO_BIN:$PATH"

# Verify
"$MAESTRO_CLI" --version &>/dev/null || die "Maestro install verification failed"
success "Maestro $("$MAESTRO_CLI" --version) ready"

# ── PATH reminder ─────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Setup complete. To use maestro in your shell, add:"
echo ""
echo "    export PATH=\"\$HOME/.maestro/bin:\$PATH\""
echo ""
echo "  to your ~/.zshrc or ~/.bashrc, then restart your shell."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
