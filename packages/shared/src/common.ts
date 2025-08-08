import { existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { RAFI_RUN_DIR, getAIConfig } from './env';

export const defaultRunDirName = 'hirafi_run';
// Define locally for now to avoid import issues
export const isNodeEnv =
  typeof process !== 'undefined' &&
  process.versions != null &&
  process.versions.node != null;

export const getRafiRunDir = () => {
  if (!isNodeEnv) {
    return '';
  }

  return getAIConfig(RAFI_RUN_DIR) || defaultRunDirName;
};

export const getRafiRunBaseDir = () => {
  if (!isNodeEnv) {
    return '';
  }

  let basePath = path.resolve(process.cwd(), getRafiRunDir());

  // Create a base directory
  if (!existsSync(basePath)) {
    try {
      mkdirSync(basePath, { recursive: true });
    } catch (error) {
      // console.error(`Failed to create ${runDirName} directory: ${error}`);
      basePath = path.join(tmpdir(), defaultRunDirName);
      mkdirSync(basePath, { recursive: true });
    }
  }

  return basePath;
};

/**
 * Get the path to the rafi_run directory or a subdirectory within it.
 * Creates the directory if it doesn't exist.
 *
 * @param subdir - Optional subdirectory name (e.g., 'log', 'report')
 * @returns The absolute path to the requested directory
 */
export const getRafiRunSubDir = (
  subdir: 'dump' | 'cache' | 'report' | 'tmp' | 'log' | 'output',
): string => {
  if (!isNodeEnv) {
    return '';
  }

  // Create a log directory
  const basePath = getRafiRunBaseDir();
  const logPath = path.join(basePath, subdir);
  if (!existsSync(logPath)) {
    mkdirSync(logPath, { recursive: true });
  }

  return logPath;
};
