# Cursor Contributor Guide for Calimero Curb Chat

This guide helps contributors get the best experience when using [Cursor](https://cursor.com) to work on this repository.

## Repository Overview

This repository contains **three separate projects**:

| Folder | Description | Stack |
|--------|-------------|-------|
| `app/` | Frontend React application | React 19, TypeScript, Vite, styled-components |
| `logic/` | Rust WASM logic module | Rust, calimero-sdk, CRDT collections |
| `logic-js/` | TypeScript logic module | TypeScript, calimero-sdk-js |

**Important**: Each folder is a separate project with its own dependencies and build process.

## Getting Started

### Prerequisites

1. **Rust toolchain** (for `logic/`):
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   rustup component add rustfmt clippy
   ```

2. **Node.js 18+** and **pnpm** (for `app/` and `logic-js/`):
   ```bash
   npm install -g pnpm
   ```

3. **Clone and open in Cursor**:
   ```bash
   git clone https://github.com/calimero-network/calimero-curb-chat.git
   cd calimero-curb-chat
   cursor .
   ```

### Installing Dependencies

```bash
# Frontend app
cd app && pnpm install && cd ..

# TypeScript logic
cd logic-js && pnpm install && cd ..
```

### Building

```bash
# Build Rust WASM module
cd logic
chmod +x ./build.sh
./build.sh
cd ..

# Build frontend app
cd app
pnpm build
cd ..

# Build TypeScript logic
cd logic-js
chmod +x ./build.sh
./build.sh
cd ..
```

## Cursor Best Practices

### Using Cursor Rules

Consider creating a `.cursorrules` file in the repository root to help Cursor understand the project:

```
# Project: Calimero Curb Chat
# A decentralized chat application using Calimero SDK

## Stack
- Frontend: React 19 + TypeScript + Vite
- Backend Logic: Rust (logic/) or TypeScript (logic-js/)
- State: CRDT-based using calimero-storage

## Key Entry Points
- app/src/main.tsx - Frontend entry
- logic/src/lib.rs - Rust logic entry
- logic-js/src/index.ts - TypeScript logic entry

## Important Patterns
- All chat state uses CRDTs (LwwRegister, UnorderedMap, Vector)
- Error handling uses Result<T, String> in Rust
- Frontend uses Calimero client SDK for RPC calls
```

### Composer vs Agent Mode

- **Composer** (Ctrl+K): Use for quick edits, refactoring, and code generation within a single file
- **Agent** (Ctrl+Shift+K): Use for multi-file changes, debugging across files, and understanding code flow

### When to Use Terminal vs In-Editor

| Task | Recommended |
|------|-------------|
| Running builds | Terminal (`Ctrl+``) |
| Running tests | Terminal |
| Formatting code | Terminal or Cursor command |
| Reading errors | In-editor (hover/problems panel) |
| Code navigation | In-editor (Ctrl+Click) |

## Development Workflow

### Running Tests

Currently, the repository has no tests. When adding tests:

```bash
# Rust tests (when added)
cd logic && cargo test && cd ..

# TypeScript tests (when added)
cd logic-js && pnpm test && cd ..

# Frontend tests (when added)
cd app && pnpm test && cd ..
```

### Formatting and Linting

```bash
# Format Rust code
cd logic && cargo fmt && cd ..

# Format TypeScript/JavaScript
cd app && pnpm prettier:write && cd ..
cd logic-js && pnpm prettier:write && cd ..

# Lint frontend
cd app && pnpm lint && cd ..

# Rust clippy
cd logic && cargo clippy && cd ..
```

### Before Committing

1. **Format your code**:
   ```bash
   cargo fmt  # for Rust changes
   pnpm prettier:write  # for TypeScript changes
   ```

2. **Run linting**:
   ```bash
   cargo clippy  # for Rust
   pnpm lint  # for frontend
   ```

3. **Check types** (TypeScript):
   ```bash
   cd app && pnpm build  # includes type checking
   ```

## Working on Bounties

### Finding a Bounty

1. Check `bounties.json` in the repository root
2. Each bounty has:
   - `title`: Short description
   - `description`: What's wrong and what to do
   - `pathHint`: File or folder to look at
   - `estimatedMinutes`: Rough time estimate
   - `category`: Type of issue (bug, security, design-flaw, etc.)
   - `severity`: Priority (critical, high, medium, low)

### Working on a Bounty

1. **Read the bounty carefully** - understand the problem before coding
2. **Use pathHint** - start by reading the file mentioned
3. **Use Cursor's Agent** - paste the bounty description and ask Cursor to help locate and understand the code
4. **Make minimal changes** - fix the issue without unnecessary refactoring
5. **Test your changes** - manually verify the fix works

### Example: Working on a Bug Bounty

```
1. Open bounties.json, find a bounty you want to work on
2. In Cursor Agent mode, type:
   "I'm working on this bounty: [paste bounty]. Help me understand 
   the current code and what needs to change."
3. Cursor will locate relevant code and explain the issue
4. Make your changes
5. Test the changes
6. Format and lint before committing
```

## Key Codebase Locations

### Frontend (`app/`)

| Path | Description |
|------|-------------|
| `src/App.tsx` | Main application router |
| `src/api/clientApi.ts` | API type definitions |
| `src/api/dataSource/clientApiDataSource.ts` | RPC client implementation |
| `src/chat/` | Chat UI components |
| `src/components/virtualized-chat/` | Virtualized message list |
| `src/utils/` | Helper utilities |

### Rust Logic (`logic/`)

| Path | Description |
|------|-------------|
| `src/lib.rs` | All chat logic (~2900 lines) |
| `src/types/id.rs` | ID type definitions |

### TypeScript Logic (`logic-js/`)

| Path | Description |
|------|-------------|
| `src/index.ts` | Main logic entry point |
| `src/channelManagement/` | Channel operations |
| `src/messageManagement/` | Message operations |
| `src/dmManagement/` | DM operations |

## Conventional Commits

Use conventional commit format for all commits:

```
<type>(<scope>): <description>

Types:
- feat: New feature
- fix: Bug fix
- docs: Documentation changes
- refactor: Code refactoring
- test: Adding tests
- chore: Maintenance tasks

Examples:
- feat(chat): add message search functionality
- fix(auth): handle expired session correctly
- docs(readme): add setup instructions
- refactor(logic): extract DM helper functions
- test(api): add unit tests for validation
```

## Pull Request Guidelines

1. **Title**: Use conventional commit format
2. **Description**: 
   - Reference the bounty if applicable
   - Explain what changed and why
   - Note any migration steps needed
3. **Size**: Keep PRs focused - one bounty per PR ideally
4. **Testing**: Document how you tested the changes

## Getting Help

- **Calimero Docs**: https://calimero-network.github.io/build/quickstart
- **Repository Issues**: Check GitHub Issues for known problems
- **Cursor Help**: Use Cursor's Agent mode to ask questions about the codebase

## Environment Variables

The frontend app uses these environment variables (see `app/.env.example`):

| Variable | Description |
|----------|-------------|
| `VITE_APP_ENDPOINT` | Calimero node endpoint |
| `VITE_CONTEXT_ID` | Default context ID |

## Troubleshooting

### Rust Build Fails

```bash
# Update Rust toolchain
rustup update

# Check rust-toolchain.toml for required version
cat logic/rust-toolchain.toml
```

### Node Module Issues

```bash
# Clear and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### WASM Not Loading

- Ensure `./build.sh` completed successfully
- Check browser console for errors
- Verify WASM file exists in build output
