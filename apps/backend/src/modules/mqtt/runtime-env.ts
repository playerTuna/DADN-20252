import { existsSync } from "fs";
import { resolve } from "path";
import { Logger } from "@nestjs/common";

const ENV_CANDIDATES = [
  resolve(__dirname, "../../../../../.env"),
  resolve(__dirname, "../../../.env"),
] as const;

export function getBackendEnvFilePaths(): string[] {
  return [...ENV_CANDIDATES];
}

export function getResolvedBackendEnvPath(): string | null {
  return ENV_CANDIDATES.find((candidate) => existsSync(candidate)) ?? null;
}

export function logBackendEnvSource(logger: Logger, context = "backend"): void {
  const resolved = getResolvedBackendEnvPath();
  if (resolved) {
    logger.log(`Runtime env source (${context}): ${resolved}`);
    return;
  }

  logger.warn(
    `Runtime env source (${context}): no .env file found in ${ENV_CANDIDATES.join(", ")}`,
  );
}
