import { exec } from "./exec.ts";

export async function runSudo(
  command: string[],
  noSudo = false
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  if (noSudo) {
    return exec(command);
  }
  return exec(["sudo", ...command]);
}

export async function hasSudoAccess(): Promise<boolean> {
  const result = await exec(["sudo", "-n", "true"]);
  return result.exitCode === 0;
}
