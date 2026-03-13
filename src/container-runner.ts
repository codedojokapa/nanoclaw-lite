/**
 * Agent Runner for NanoClaw
 * Runs agents directly in the main process (no container isolation)
 */

import fs from 'fs';
import path from 'path';
import { logger } from './logger.js';
import { resolveGroupFolderPath } from './group-folder.js';
import { RegisteredGroup } from './types.js';
import { runAgent, AgentInput, AgentOutput } from './agent-runner.js';
import { GROUPS_DIR } from './config.js';

export interface ContainerInput {
  prompt: string;
  sessionId?: string;
  groupFolder: string;
  chatJid: string;
  isMain: boolean;
  isScheduledTask?: boolean;
  assistantName?: string;
}

export interface ContainerOutput {
  status: 'success' | 'error';
  result: string | null;
  newSessionId?: string;
  error?: string;
}

export interface VolumeMount {
  hostPath: string;
  containerPath: string;
  readonly: boolean;
}

function setupGroupFolders(group: RegisteredGroup, isMain: boolean): void {
  const groupDir = resolveGroupFolderPath(group.folder);
  fs.mkdirSync(groupDir, { recursive: true });

  // Create conversations directory
  const conversationsDir = path.join(groupDir, 'conversations');
  if (!fs.existsSync(conversationsDir)) {
    fs.mkdirSync(conversationsDir, { recursive: true });
  }

  // Create logs directory
  const logsDir = path.join(groupDir, 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  // For non-main groups, ensure global directory exists
  if (!isMain) {
    const globalDir = path.join(GROUPS_DIR, 'global');
    if (!fs.existsSync(globalDir)) {
      fs.mkdirSync(globalDir, { recursive: true });
    }
  }
}

/**
 * Run an agent for a group directly in the main process.
 */
export async function runContainerAgent(
  group: RegisteredGroup,
  input: ContainerInput,
  _onProcess: (proc: unknown, containerName: string) => void,
  onOutput?: (output: ContainerOutput) => Promise<void>,
): Promise<ContainerOutput> {
  const startTime = Date.now();

  // Setup group folders
  setupGroupFolders(group, input.isMain);

  // Create a fake container name for logging compatibility
  const containerName = `nanoclaw-${group.folder.replace(/[^a-zA-Z0-9-]/g, '-')}-${Date.now()}`;

  logger.info(
    {
      group: group.name,
      containerName,
      isMain: input.isMain,
    },
    'Starting agent (in-process)',
  );

  const groupDir = resolveGroupFolderPath(group.folder);
  const logsDir = path.join(groupDir, 'logs');

  try {
    // Run the agent directly in the main process
    const wrappedOnOutput = async (output: AgentOutput) => {
      if (onOutput) {
        await onOutput(output);
      }
    };

    const result = await runAgent(group, input, wrappedOnOutput);

    const duration = Date.now() - startTime;

    if (result.status === 'error') {
      logger.error(
        {
          group: group.name,
          error: result.error,
          duration,
        },
        'Agent failed',
      );
    } else {
      logger.info(
        {
          group: group.name,
          duration,
          sessionId: result.newSessionId,
        },
        'Agent completed',
      );
    }

    return result;
  } catch (err) {
    const duration = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : String(err);

    logger.error(
      {
        group: group.name,
        error: err,
        duration,
      },
      'Agent error',
    );

    // Write error log
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logFile = path.join(logsDir, `agent-error-${timestamp}.log`);
    fs.writeFileSync(
      logFile,
      [
        `=== Agent Error Log ===`,
        `Timestamp: ${new Date().toISOString()}`,
        `Group: ${group.name}`,
        `Duration: ${duration}ms`,
        `Error: ${errorMessage}`,
      ].join('\n'),
    );

    return {
      status: 'error',
      result: null,
      error: errorMessage,
    };
  }
}

export function writeTasksSnapshot(
  groupFolder: string,
  isMain: boolean,
  tasks: Array<{
    id: string;
    groupFolder: string;
    prompt: string;
    schedule_type: string;
    schedule_value: string;
    status: string;
    next_run: string | null;
  }>,
): void {
  const { resolveGroupIpcPath } = require('./group-folder.js');
  const groupIpcDir = resolveGroupIpcPath(groupFolder);
  fs.mkdirSync(groupIpcDir, { recursive: true });

  const filteredTasks = isMain
    ? tasks
    : tasks.filter((t) => t.groupFolder === groupFolder);

  const tasksFile = path.join(groupIpcDir, 'current_tasks.json');
  fs.writeFileSync(tasksFile, JSON.stringify(filteredTasks, null, 2));
}

export interface AvailableGroup {
  jid: string;
  name: string;
  lastActivity: string;
  isRegistered: boolean;
}

export function writeGroupsSnapshot(
  groupFolder: string,
  isMain: boolean,
  groups: AvailableGroup[],
  registeredJids: Set<string>,
): void {
  const { resolveGroupIpcPath } = require('./group-folder.js');
  const groupIpcDir = resolveGroupIpcPath(groupFolder);
  fs.mkdirSync(groupIpcDir, { recursive: true });

  const visibleGroups = isMain ? groups : [];

  const groupsFile = path.join(groupIpcDir, 'available_groups.json');
  fs.writeFileSync(
    groupsFile,
    JSON.stringify(
      {
        groups: visibleGroups,
        lastSync: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
}
