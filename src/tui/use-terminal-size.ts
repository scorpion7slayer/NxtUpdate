import { useStdout } from "ink";
import { useEffect, useState } from "react";

export interface TerminalSize {
  columns: number;
  rows: number;
}

function readSize(stdout: NodeJS.WriteStream): TerminalSize {
  return {
    columns: Math.max(40, stdout.columns ?? process.stdout.columns ?? 80),
    rows: Math.max(16, stdout.rows ?? process.stdout.rows ?? 24),
  };
}

export function useTerminalSize(): TerminalSize {
  const { stdout } = useStdout();
  const [size, setSize] = useState<TerminalSize>(() => readSize(stdout));

  useEffect(() => {
    const update = () => setSize(readSize(stdout));
    update();
    stdout.on("resize", update);
    return () => {
      stdout.off("resize", update);
    };
  }, [stdout]);

  return size;
}

export function getViewportRows(rows: number, reserved: number, maximum: number): number {
  return Math.max(4, Math.min(maximum, rows - reserved));
}
