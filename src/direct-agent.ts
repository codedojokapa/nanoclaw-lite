/**
 * Direct Agent Runner for NanoClaw
 *
 * Runs the Claude Agent SDK directly in the main process (no container).
 * This is for development mode - production should use container isolation.
 *
 * Adapted from container/agent-runner/src/index.ts with these key differences:
 * - No IPC file polling (direct function calls)
 * - No workspace mounting (runs in main process)
 * - Direct NanoClaw MCP tools (not IPC-based)
 * - Main process working directory
 * - Credential proxy still used for API calls
 */

import fs from 'fs';
import path from 'path';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { CronExpressionParser } from 'cron-parser';

import {
  ASSISTANT_NAME,
  CREDENTIAL_PROXY_PORT,
  DATA_DIR,
  GROUPS_DIR,
  TIMEZONE,
} from './config.js';
import { resolveGroupFolderPath } from './group-folder.js';
import { logger } from './logger.js';
import { RegisteredGroup } from './types.js';
import { getAllTasks } from './db.js';
import { ContainerOutput, AvailableGroup } from './container-runner.js';

export interface DirectInput {
  prompt: string;
  sessionId?: string;
  groupFolder: string;
  chatJid: string;
  isMain: boolean;
  isScheduledTask?: boolean;
  assistantName?: string;
  /** Function to send messages back to the user */
  sendMessage: (text: string, sender?: string) => Promise<void>;
  /** Function to register a new group (main only) - uses same signature as index.ts registerGroup */
  registerGroup?: (jid: string, group: RegisteredGroup) => void | Promise<void>;
  /** Available groups for main's register_group tool */
  availableGroups?: AvailableGroup[];
  /** Registered JIDs for validation */
  registeredJids?: Set<string>;
}

/** Tool context for NanoClaw-specific tools */
interface ToolContext {
  chatJid: string;
  groupFolder: string;
  isMain: boolean;
  sendMessage: (text: string, sender?: string) => Promise<void>;
  registerGroup?: (jid: string, group: RegisteredGroup) => void | Promise<void>;
  availableGroups?: AvailableGroup[];
  registeredJids?: Set<string>;
}

export interface DirectOutput {
  status: 'success' | 'error';
  result: string | null;
  newSessionId?: string;
  error?: string;
}

interface SessionEntry {
  sessionId: string;
  fullPath: string;
  summary: string;
  firstPrompt: string;
}

interface SessionsIndex {
  entries: SessionEntry[];
}

interface ParsedMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Get the group's Claude session directory
 */
function getGroupSessionsDir(groupFolder: string): string {
  return path.join(DATA_DIR, 'sessions', groupFolder, '.claude');
}

/**
 * Ensure the group's Claude session directory exists with proper settings
 */
function ensureGroupSessions(groupFolder: string): string {
  const sessionsDir = getGroupSessionsDir(groupFolder);
  fs.mkdirSync(sessionsDir, { recursive: true });

  const settingsFile = path.join(sessionsDir, 'settings.json');
  if (!fs.existsSync(settingsFile)) {
    fs.writeFileSync(
      settingsFile,
      JSON.stringify(
        {
          env: {
            CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1',
            CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD: '1',
            CLAUDE_CODE_DISABLE_AUTO_MEMORY: '0',
          },
        },
        null,
        2,
      ) + '\n',
    );
  }

  // Sync skills from container/skills/ into each group's .claude/skills/
  const skillsSrc = path.join(process.cwd(), 'container', 'skills');
  const skillsDst = path.join(sessionsDir, 'skills');
  if (fs.existsSync(skillsSrc)) {
    for (const skillDir of fs.readdirSync(skillsSrc)) {
      const srcDir = path.join(skillsSrc, skillDir);
      if (!fs.statSync(srcDir).isDirectory()) continue;
      const dstDir = path.join(skillsDst, skillDir);
      fs.cpSync(srcDir, dstDir, { recursive: true });
    }
  }

  return sessionsDir;
}

/**
 * Get session summary from sessions index
 */
function getSessionSummary(
  sessionId: string,
  sessionsDir: string,
): string | null {
  const indexPath = path.join(sessionsDir, 'sessions-index.json');

  if (!fs.existsSync(indexPath)) {
    return null;
  }

  try {
    const index: SessionsIndex = JSON.parse(
      fs.readFileSync(indexPath, 'utf-8'),
    );
    const entry = index.entries.find((e) => e.sessionId === sessionId);
    return entry?.summary || null;
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      'Failed to read sessions index',
    );
    return null;
  }
}

/**
 * Parse transcript JSON lines into messages
 */
function parseTranscript(content: string): ParsedMessage[] {
  const messages: ParsedMessage[] = [];

  for (const line of content.split('\n')) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      if (entry.type === 'user' && entry.message?.content) {
        const text =
          typeof entry.message.content === 'string'
            ? entry.message.content
            : entry.message.content
                .map((c: { text?: string }) => c.text || '')
                .join('');
        if (text) messages.push({ role: 'user', content: text });
      } else if (entry.type === 'assistant' && entry.message?.content) {
        const textParts = entry.message.content
          .filter((c: { type: string }) => c.type === 'text')
          .map((c: { text: string }) => c.text);
        const text = textParts.join('');
        if (text) messages.push({ role: 'assistant', content: text });
      }
    } catch {
      // Skip invalid lines
    }
  }

  return messages;
}

/**
 * Sanitize a summary for use as a filename
 */
function sanitizeFilename(summary: string): string {
  return summary
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

/**
 * Generate a fallback conversation name
 */
function generateFallbackName(): string {
  const time = new Date();
  return `conversation-${time.getHours().toString().padStart(2, '0')}${time.getMinutes().toString().padStart(2, '0')}`;
}

/**
 * Build SDK options for the query
 */
function buildSdkOptions(input: DirectInput, sessionsDir: string) {
  // Get global CLAUDE.md for non-main groups
  const globalClaudeMdPath = path.join(GROUPS_DIR, 'global', 'CLAUDE.md');
  let globalClaudeMd: string | undefined;
  if (!input.isMain && fs.existsSync(globalClaudeMdPath)) {
    globalClaudeMd = fs.readFileSync(globalClaudeMdPath, 'utf-8');
  }

  // Discover additional directories mounted at groups/{group}/extra/*
  const groupDir = resolveGroupFolderPath(input.groupFolder);
  const extraDirs: string[] = [];
  const extraBase = path.join(groupDir, 'extra');
  if (fs.existsSync(extraBase)) {
    for (const entry of fs.readdirSync(extraBase)) {
      const fullPath = path.join(extraBase, entry);
      if (fs.statSync(fullPath).isDirectory()) {
        extraDirs.push(fullPath);
      }
    }
  }

  if (extraDirs.length > 0) {
    logger.debug({ extraDirs }, 'Additional directories discovered');
  }

  // Get credential proxy URL
  const credentialProxyUrl = `http://127.0.0.1:${CREDENTIAL_PROXY_PORT}`;

  // Get paths for the CLI executable
  const cliPath = path.join(
    process.cwd(),
    'node_modules',
    '@anthropic-ai/claude-agent-sdk',
    'cli.js',
  );

  return {
    cwd: groupDir,
    additionalDirectories: extraDirs.length > 0 ? extraDirs : undefined,
    resume: input.sessionId,
    pathToClaudeCodeExecutable: cliPath,
    executable: process.execPath as 'node' | 'bun' | 'deno', // Use absolute path to current Node executable
    systemPrompt: globalClaudeMd
      ? {
          type: 'preset' as const,
          preset: 'claude_code' as const,
          append: globalClaudeMd,
        }
      : undefined,
    allowedTools: [
      'Bash',
      'Read',
      'Write',
      'Edit',
      'Glob',
      'Grep',
      'WebSearch',
      'WebFetch',
      'Task',
      'TaskOutput',
      'TaskStop',
      'TeamCreate',
      'TeamDelete',
      'SendMessage',
      'TodoWrite',
      'ToolSearch',
      'Skill',
      'NotebookEdit',
    ],
    env: {
      ANTHROPIC_BASE_URL: credentialProxyUrl,
      // Set placeholder credentials - the proxy will inject real ones
      ANTHROPIC_API_KEY: 'placeholder',
      ...process.env,
    },
    permissionMode: 'bypassPermissions' as const,
    allowDangerouslySkipPermissions: true,
    settingSources: ['project', 'user'] as ['project', 'user'],
  };
}

/**
 * Run the agent directly (without container)
 */
export async function runDirectAgent(
  group: RegisteredGroup,
  input: DirectInput,
  onOutput?: (output: DirectOutput) => Promise<void>,
): Promise<DirectOutput> {
  const startTime = Date.now();

  // Ensure group sessions directory exists
  const sessionsDir = ensureGroupSessions(input.groupFolder);

  // Build initial prompt
  let prompt = input.prompt;
  if (input.isScheduledTask) {
    prompt = `[SCHEDULED TASK - The following message was sent automatically and is not coming directly from the user or group.]\n\n${prompt}`;
  }

  // Build SDK options
  const sdkOptions = buildSdkOptions(input, sessionsDir);

  let newSessionId: string | undefined;
  let messageCount = 0;
  let resultCount = 0;

  try {
    logger.info(
      { group: group.name, promptLength: prompt.length },
      'Starting direct agent query',
    );

    for await (const message of query({
      prompt,
      options: sdkOptions,
    })) {
      messageCount++;
      const msgType =
        message.type === 'system'
          ? `system/${(message as { subtype?: string }).subtype}`
          : message.type;
      logger.debug(`[msg #${messageCount}] type=${msgType}`);

      if (message.type === 'system' && message.subtype === 'init') {
        newSessionId = message.session_id;
        logger.info(`Session initialized: ${newSessionId}`);
      }

      if (
        message.type === 'system' &&
        (message as { subtype?: string }).subtype === 'task_notification'
      ) {
        const tn = message as {
          task_id: string;
          status: string;
          summary: string;
        };
        logger.debug(
          `Task notification: task=${tn.task_id} status=${tn.status} summary=${tn.summary}`,
        );
      }

      if (message.type === 'result') {
        resultCount++;
        const textResult =
          'result' in message ? (message as { result?: string }).result : null;
        logger.debug(
          `Result #${resultCount}: subtype=${message.subtype}${textResult ? ` text=${textResult.slice(0, 200)}` : ''}`,
        );

        // Stream the output
        if (onOutput) {
          await onOutput({
            status: 'success',
            result: textResult || null,
            newSessionId,
          });
        }
      }
    }

    const duration = Date.now() - startTime;
    logger.info(
      { group: group.name, duration, messageCount, resultCount, newSessionId },
      'Direct agent query completed',
    );

    return {
      status: 'success',
      result: null,
      newSessionId,
    };
  } catch (err) {
    const duration = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack : undefined;

    // Log error with explicit fields for better serialization
    logger.error(
      {
        group: group.name,
        duration,
        errorMessage,
        errorStack,
        errorType: err?.constructor?.name || typeof err,
        errorDetails:
          err instanceof Error ? { name: err.name, message: err.message } : err,
      },
      'Direct agent query failed',
    );

    return {
      status: 'error',
      result: null,
      error: errorMessage,
    };
  }
}

/**
 * Write tasks snapshot for the agent to read
 * This is the same as the container version, but called from the main process
 */
export function writeTasksSnapshot(groupFolder: string, isMain: boolean): void {
  const tasks = getAllTasks();

  // Main sees all tasks, others only see their own
  const filteredTasks = isMain
    ? tasks
    : tasks.filter((t) => t.group_folder === groupFolder);

  // Write to the group's session directory
  const sessionsDir = getGroupSessionsDir(groupFolder);
  fs.mkdirSync(sessionsDir, { recursive: true });

  const tasksFile = path.join(sessionsDir, 'current_tasks.json');
  fs.writeFileSync(tasksFile, JSON.stringify(filteredTasks, null, 2));
}
