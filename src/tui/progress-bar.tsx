import { Box, Text } from "ink";

interface Props {
  current: number;
  total: number;
  width?: number;
}

export function ProgressBar({ current, total, width = 20 }: Props) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  const filled = total > 0 ? Math.round((current / total) * width) : 0;
  const bar = "█".repeat(filled) + "░".repeat(width - filled);

  return (
    <Box>
      <Text color={pct === 100 ? "green" : "cyan"}>[{bar}]</Text>
      <Text> {current}/{total}</Text>
    </Box>
  );
}
