// src/ipc/runtime/providers/NodeRuntimeProvider.ts
// Node.js runtime implementation

import {
  type RuntimeProvider,
  type ScaffoldOptions,
  type ScaffoldResult,
  type BuildOptions,
  type BuildResult,
  type RunOptions,
  type RunResult,
  type PreviewOptions,
  type RiskProfile,
} from "../RuntimeProvider";
import {
  executionKernel,
  type ExecutionResult,
} from "../../security/execution_kernel";
import { getAppPort } from "../../../../shared/ports";
import path from "node:path";
import { execSync } from "node:child_process";
import fs from "fs-extra";
import { copyDirectoryRecursive } from "../../utils/file_utils";
import logger from "electron-log";

/**
 * Check if pnpm is available on the system
 */
function isPnpmAvailable(): boolean {
  try {
    execSync("pnpm --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Detect the package manager to use for an app.
 * Prefers pnpm if pnpm-lock.yaml exists AND pnpm is installed,
 * otherwise falls back to npm.
 */
async function detectPackageManager(appPath: string): Promise<"pnpm" | "npm"> {
  const hasPnpmLock = await fs.pathExists(
    path.join(appPath, "pnpm-lock.yaml"),
  );
  if (hasPnpmLock && isPnpmAvailable()) {
    return "pnpm";
  }
  if (hasPnpmLock && !isPnpmAvailable()) {
    logger.warn(
      `App at ${appPath} has pnpm-lock.yaml but pnpm is not installed. Falling back to npm.`,
    );
  }
  return "npm";
}

// Type for event handlers
type ExecutionEventHandler = (event: {
  type: "stdout" | "stderr";
  message: string;
  timestamp: number;
}) => void;

export const nodeRuntimeProvider: RuntimeProvider = {
  runtimeId: "node",
  runtimeName: "Node.js",
  supportedStackTypes: ["react", "nextjs", "express-react"],
  previewStrategy: "iframe",
  diskQuotaBytes: 2 * 1024 * 1024 * 1024, // 2GB

  async checkPrerequisites(): Promise<{
    installed: boolean;
    missing: string[];
  }> {
    try {
      await executionKernel.execute(
        { command: "node", args: ["--version"] },
        { appId: 0, cwd: process.cwd() },
        "node",
      );
      return { installed: true, missing: [] };
    } catch {
      return { installed: false, missing: ["Node.js"] };
    }
  },

  getRiskProfile(command: string, args: string[]): RiskProfile {
    // Node specific risk analysis
    const fullCmd = `${command} ${args.join(" ")}`.toLowerCase();
    if (fullCmd.includes("install") || fullCmd.includes("add")) return "high"; // Network + Disk write
    if (fullCmd.includes("build")) return "medium"; // High CPU/Mem
    return "low";
  },

  async scaffold(options: ScaffoldOptions): Promise<ScaffoldResult> {
    try {
      if (options.templateId === "react") {
        // Use app.getAppPath() instead of relative paths
        const { app } = await import("electron");
        const scaffoldSource = path.join(app.getAppPath(), "scaffold");
        await copyDirectoryRecursive(scaffoldSource, options.fullAppPath);
        return { success: true, entryPoint: "src/main.tsx" };
      }

      // For other templates (GitHub clones), use kernel
      // This would be implemented based on existing createFromTemplate logic
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  async resolveDependencies(options: {
    appPath: string;
    appId: number;
  }): Promise<ExecutionResult> {
    // Detect Package Manager (with fallback if pnpm not installed)
    const pm = await detectPackageManager(options.appPath);
    const args = pm === "pnpm" ? ["install"] : ["install", "--legacy-peer-deps"];

    // Execute Directly (No Shell)
    return executionKernel.execute(
      { command: pm, args },
      {
        appId: options.appId,
        cwd: options.appPath,
        networkAccess: true,
        memoryLimitMB: 2048,
        diskQuotaMB: 2048,
        timeout: 300000,
      },
      "node",
    );
  },

  async build(
    options: BuildOptions,
    _onEvent?: ExecutionEventHandler,
  ): Promise<BuildResult> {
    const result = await executionKernel.execute(
      { command: "npm", args: ["run", "build"] },
      {
        appId: options.appId,
        cwd: options.appPath,
        networkAccess: false,
        timeout: 300000,
      },
      "node",
    );

    return {
      success: result.exitCode === 0,
      errors: result.exitCode !== 0 ? [result.stderr] : undefined,
    };
  },

  async run(
    options: RunOptions,
    _onEvent?: ExecutionEventHandler,
  ): Promise<RunResult> {
    const port = getAppPort(options.appId);

    // NO SHELL: Direct execution only.
    // We expect dependencies to be resolved already.

    const pm = await detectPackageManager(options.appPath);

    // Command: [p]npm run dev -- --port X
    const args = ["run", "dev"];
    if (pm === "npm") args.push("--");
    args.push("--port", String(port));

    const result = await executionKernel.execute(
      { command: pm, args },
      {
        appId: options.appId,
        cwd: options.appPath,
        networkAccess: true, // Dev server needs network
        memoryLimitMB: 2048,
        mode: "session", // Non-blocking, returns Job ID
      },
      "node",
    );

    return {
      ready: result.exitCode === 0,
      jobId:
        result.exitCode === 0
          ? `job_${options.appId}_${Date.now()}`
          : undefined,
    };
  },

  async stop(appId: number, jobId?: string): Promise<void> {
    // Use kernel to terminate job if we have a jobId
    if (jobId) {
      await executionKernel.terminateJob(jobId);
      return;
    }

    // Fallback: Stop via process_manager
    const { stopAppByInfo, runningApps } =
      await import("../../utils/process_manager");
    const appInfo = runningApps.get(appId);
    if (appInfo) {
      await stopAppByInfo(appId, appInfo);
    }
  },

  async startPreview(_options: PreviewOptions): Promise<void> {
    // Node apps use iframe - no external window needed
    // Preview is handled by the iframe loading localhost
  },

  async stopPreview(appId: number): Promise<void> {
    // Cleanup handled by stop()
    await this.stop(appId);
  },

  isReady(message: string): boolean {
    // Node web apps ready when localhost URL detected
    return /https?:\/\/localhost:\d+/.test(message);
  },
};
