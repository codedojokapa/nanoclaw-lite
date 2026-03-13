# NanoClaw — Post-Containerization Cleanup TODO

Status: **Running locally without containers** (agent runs in-process via `@anthropic-ai/claude-agent-sdk`).

## Bugs Fixed
- [x] `require()` calls in ESM module (`agent-manager.ts`) — replaced with top-level `import`
- [x] `CLAUDECODE` env var blocks SDK's `query()` when started from within Amp/Claude Code session — stripped at startup
- [x] 3 Telegram tests failing — `sendMessage` assertions updated for `parse_mode: 'Markdown'` arg

## Polish & Cleanup

### Code Hygiene
- [ ] Remove backward-compat aliases at bottom of `agent-manager.ts` (`ContainerInput`, `ContainerOutput`, `runContainerAgent`)
- [ ] Remove `ChildProcess` import in `group-queue.ts` (no longer spawning child processes)
- [ ] Remove container-related fields from `GroupState` in `group-queue.ts` (`process`, `containerName`) — these are always `null` now
- [ ] Remove `credential-proxy.ts` and `credential-proxy.test.ts` (was for proxying secrets into containers)
- [ ] Audit `src/agent-runner.ts` line 13: `import { spawn, ChildProcess } from 'child_process'` — unused import from container era
- [ ] Clean up "container" language in log messages and comments throughout codebase (e.g., `group-queue.ts` says "Container active", "Starting container for group")

### Tests
- [ ] Fix 3 failing Telegram tests (`sendMessage` split tests don't account for `parse_mode: 'Markdown'` arg)
- [ ] Add integration test for `agent-runner.ts` → `query()` flow (even a smoke test)
- [ ] Remove or update `container-runner.test.ts` / `container-runtime.test.ts` references if any remain in config

### Configuration
- [ ] Remove `USE_CONTAINERS` from `.env` / `.env.example` (no longer relevant)
- [ ] Review `CREDENTIAL_PROXY_PORT` in `config.ts` — can be removed
- [ ] Review `MAX_CONCURRENT_AGENTS` — still relevant for in-process concurrency, but semantics changed

### Documentation
- [ ] Update `README.md` to reflect no-container architecture
- [ ] Update `docs/REQUIREMENTS.md` if it references container isolation
- [ ] Update `CLAUDE.md` — remove any container references

### Security (when you're ready)
- [ ] Consider process-level sandboxing for the agent (e.g., `--experimental-permission` flag)
- [ ] Agent currently runs with `permissionMode: 'bypassPermissions'` — evaluate if tighter scoping is needed
- [ ] Review filesystem access — agent has full access to host filesystem via `cwd: groupDir`
