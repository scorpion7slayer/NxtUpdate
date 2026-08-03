export interface ExecOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  onLine?: (line: string) => void;
}

async function readStream(
  stream: ReadableStream<Uint8Array>,
  onLine?: (line: string) => void,
): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let output = "";
  let buffer = "";

  const emitCompleteLines = () => {
    const parts = buffer.split(/[\r\n]+/);
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.trim();
      if (line) onLine?.(line);
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value, { stream: true });
    output += text;
    buffer += text;
    emitCompleteLines();
  }

  const tail = decoder.decode();
  output += tail;
  buffer += tail;
  const finalLine = buffer.trim();
  if (finalLine) onLine?.(finalLine);

  return output.trim();
}

export async function exec(
  command: string[],
  options?: ExecOptions,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(command, {
    cwd: options?.cwd,
    env: { ...process.env, ...options?.env },
    stdout: "pipe",
    stderr: "pipe",
    timeout: options?.timeout ?? 300_000,
  });

  const [stdout, stderr] = await Promise.all([
    readStream(proc.stdout, options?.onLine),
    readStream(proc.stderr, options?.onLine),
  ]);

  await proc.exited;

  return {
    stdout,
    stderr,
    exitCode: proc.exitCode ?? 1,
  };
}

export function execSync(
  command: string[]
): { stdout: string; stderr: string; exitCode: number } {
  const proc = Bun.spawnSync(command, {
    stdout: "pipe",
    stderr: "pipe",
  });

  return {
    stdout: proc.stdout.toString().trim(),
    stderr: proc.stderr.toString().trim(),
    exitCode: proc.exitCode ?? 1,
  };
}

export async function execStream(
  command: string[],
  onLine: (line: string) => void,
  options?: { cwd?: string }
): Promise<{ exitCode: number; lines: string[] }> {
  const lines: string[] = [];
  const result = await exec(command, {
    cwd: options?.cwd,
    onLine: (line) => {
      lines.push(line);
      onLine(line);
    },
  });
  return { exitCode: result.exitCode, lines };
}

const executableCache = new Map<string, boolean>();

export function isInstalled(command: string): boolean {
  const cached = executableCache.get(command);
  if (cached !== undefined) return cached;
  const installed = Bun.which(command) !== null;
  executableCache.set(command, installed);
  return installed;
}
