export async function exec(
  command: string[],
  options?: { cwd?: string; env?: Record<string, string>; timeout?: number }
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(command, {
    cwd: options?.cwd,
    env: { ...process.env, ...options?.env },
    stdout: "pipe",
    stderr: "pipe",
    timeout: options?.timeout ?? 300_000,
  });

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);

  await proc.exited;

  return {
    stdout: stdout.trim(),
    stderr: stderr.trim(),
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
  const proc = Bun.spawn(command, {
    cwd: options?.cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  const lines: string[] = [];
  const decoder = new TextDecoder();

  const streamToLines = async (stream: ReadableStream) => {
    const reader = stream.getReader();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n");
      buffer = parts.pop() ?? "";
      for (const line of parts) {
        const trimmed = line.trim();
        if (trimmed) {
          lines.push(trimmed);
          onLine(trimmed);
        }
      }
    }
    if (buffer.trim()) {
      lines.push(buffer.trim());
      onLine(buffer.trim());
    }
  };

  await Promise.all([
    streamToLines(proc.stdout),
    streamToLines(proc.stderr),
  ]);

  await proc.exited;
  return { exitCode: proc.exitCode ?? 1, lines };
}

export function isInstalled(command: string): boolean {
  const result = execSync(["which", command]);
  return result.exitCode === 0;
}
