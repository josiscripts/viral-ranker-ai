import { execFile } from 'child_process';

export interface ProcessResult {
  stdout: string;
  stderr: string;
}

export interface RunProcessOptions {
  timeoutMs?: number;
  cwd?: string;
  // Receives stdout as it arrives (the full output is still returned at the end)
  onStdout?: (chunk: string) => void;
}

export class ProcessError extends Error {
  stdout: string;
  stderr: string;

  constructor(message: string, stdout: string, stderr: string) {
    super(message);
    this.name = 'ProcessError';
    this.stdout = stdout;
    this.stderr = stderr;
  }
}

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const MAX_BUFFER_BYTES = 20 * 1024 * 1024; // 20MB of stdout/stderr

// Runs an external binary WITHOUT a shell. Every argument is passed as-is to the
// process, so user-controlled values (URLs, file names, titles) can never be
// interpreted as shell syntax. Never build a command string for child_process.
export function runProcess(
  bin: string,
  args: string[],
  options: RunProcessOptions = {}
): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      bin,
      args,
      {
        cwd: options.cwd,
        timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        maxBuffer: MAX_BUFFER_BYTES,
        windowsHide: true,
        encoding: 'utf-8'
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(new ProcessError(`${bin} failed: ${error.message}`, stdout, stderr));
        } else {
          resolve({ stdout, stderr });
        }
      }
    );
    if (options.onStdout) child.stdout?.on('data', options.onStdout);
  });
}
