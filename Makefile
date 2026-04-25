.PHONY: help setup install build dev dev-node start test test-full unit e2e workflows ci ci-stop \
        logic-build app-install app-build app-typecheck app-lint clean

# ── Help ───────────────────────────────────────────────────────────────────────

help:
	@echo ""
	@echo "  Mero Chat — available targets"
	@echo ""
	@echo "  Setup"
	@echo "    setup          Check prereqs, build logic, install app deps"
	@echo "    dev-node       Start a single local merod node for dev"
	@echo "    install        Install frontend dependencies (pnpm)"
	@echo ""
	@echo "  Build"
	@echo "    build          Build Rust WASM logic + frontend"
	@echo "    logic-build    Compile logic/src → logic/res/curb.wasm"
	@echo "    app-build      Bundle frontend (dist/)"
	@echo ""
	@echo "  Dev"
	@echo "    start          Start node + frontend in one shot (full dev setup)"
	@echo "    dev            Start Vite dev server (http://localhost:5173)"
	@echo ""
	@echo "  Quality"
	@echo "    app-typecheck  Run tsc --noEmit on frontend"
	@echo "    app-lint       Run ESLint on frontend"
	@echo ""
	@echo "  Test"
	@echo "    test-full      1 node: rpc + rpc-admin + mocked + live (58 tests, skips 2-node)"
	@echo "    ci             2 nodes: rpc + rpc-admin + mocked — full suite (90 tests)"
	@echo "    test           Run unit tests + e2e tests"
	@echo "    unit           Vitest unit tests"
	@echo "    e2e            Playwright e2e tests"
	@echo "    ci-stop        Stop nodes started by 'make ci' or setup-nodes.sh"
	@echo "    workflows      merobox workflow tests (requires merobox)"
	@echo ""
	@echo "  Other"
	@echo "    clean          Remove all build artifacts"
	@echo ""

# ── Setup ──────────────────────────────────────────────────────────────────────

setup:
	@bash scripts/setup.sh

dev-node:
	@bash scripts/dev-node.sh

install: app-install

# ── Build ──────────────────────────────────────────────────────────────────────

logic-build:
	cd logic && ./build.sh

app-install:
	cd app && pnpm install

app-build:
	cd app && pnpm build

build: logic-build app-build

# ── Dev ────────────────────────────────────────────────────────────────────────

dev: app-install
	cd app && pnpm dev

# Full dev setup: node + frontend in one shot.
# Runs dev-node.sh (blocking until node is ready), then starts Vite.
start: app-install
	@bash scripts/dev-node.sh
	cd app && pnpm dev

# ── Quality ────────────────────────────────────────────────────────────────────

app-typecheck:
	cd app && pnpm exec tsc --noEmit

app-lint:
	cd app && pnpm lint

# ── Test ───────────────────────────────────────────────────────────────────────

# Start a single dev node, run all test suites, stop node on exit.
# Projects:
#   rpc + rpc-admin  — headless HTTP/RPC tests (no browser, no Vite)
#   mocked           — browser tests with mock API (Playwright starts Vite)
#   live             — browser tests with real auth injected from .env.integration
test-full: app-install
	@REPO_ROOT="$$(pwd)"; \
	bash scripts/dev-node.sh; \
	trap "bash $$REPO_ROOT/scripts/dev-node.sh --stop 2>/dev/null || true" EXIT; \
	cd app && \
	  SKIP_DEV_SERVER=1 pnpm exec playwright test --project=rpc --project=rpc-admin && \
	  pnpm exec playwright test --project=mocked && \
	  LIVE_AUTH=1 pnpm exec playwright test --project=live

unit:
	cd app && pnpm test

e2e:
	cd app && pnpm exec playwright test

test: unit e2e

# Build WASM, spin up 2 nodes, run all RPC+admin tests, tear down.
# Nodes are stopped even if tests fail (trap EXIT in ci.sh).
ci:
	@bash scripts/ci.sh

ci-no-build:
	@bash scripts/ci.sh --no-build

ci-stop:
	@bash scripts/setup-nodes.sh --stop

WORKFLOW_FILES := \
	workflows/e2e.yml \
	workflows/integration-setup.yml

workflows: logic-build
	@command -v merobox >/dev/null 2>&1 || { \
		echo ""; \
		echo "  merobox not found."; \
		echo "  Install it first: https://calimero-network.github.io/docs/merobox/install"; \
		echo ""; \
		exit 1; \
	}
	@for yml in $(WORKFLOW_FILES); do \
		echo ""; \
		echo "▶  Running $$yml ..."; \
		merobox stop --all 2>/dev/null || true; \
		merobox nuke --force 2>/dev/null || true; \
		if ! merobox bootstrap run $$yml; then \
			echo ""; \
			echo "  ✗  $$yml failed"; \
			merobox stop --all 2>/dev/null || true; \
			merobox nuke --force 2>/dev/null || true; \
			exit 1; \
		fi; \
		echo "  ✓  $$yml passed"; \
	done
	@merobox stop --all 2>/dev/null || true
	@merobox nuke --force 2>/dev/null || true
	@echo ""
	@echo "  ✓  All workflow tests passed"

# ── Clean ──────────────────────────────────────────────────────────────────────

clean:
	cd logic && rm -rf res target
	cd app && rm -rf dist e2e-report playwright-report test-results
