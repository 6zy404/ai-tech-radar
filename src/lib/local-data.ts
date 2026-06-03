import path from "node:path";

export function getLocalDataDirPath(): string {
  const configuredPath = process.env.LOCAL_DATA_DIR?.trim() || "config";

  return path.isAbsolute(configuredPath)
    ? configuredPath
    : path.join(process.cwd(), configuredPath);
}
