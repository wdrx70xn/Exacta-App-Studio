import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import logger from "electron-log";
import type { NetworkPolicy, QuotaExceededEvent } from "../types/guardian";
import { getDyadAppsBaseDirectory } from "../../paths/paths";

// Job Registry for tracking active jobs and sessions
class JobRegistry {
  private jobs: Map<
    string,
    {
      jobId: string;
      appId: number;
      createdAt: Date;
      mode: "ephemeral" | "session";
    }
  > = new Map();
  private appJobs: Map<number, string[]> = new Map();

  registerJob(
    appId: number,
    jobId: string,
    mode: "ephemeral" | "session" = "ephemeral",
  ): void {
    const jobInfo = {
      jobId,
      appId,
      createdAt: new Date(),
      mode,
    };

    this.jobs.set(jobId, jobInfo);

    if (!this.appJobs.has(appId)) {
      this.appJobs.set(appId, []);
    }
    this.appJobs.get(appId)!.push(jobId);

    logger.info(`Registered job ${jobId} for app ${appId} (mode: ${mode})`);
  }

  getJob(jobId: string):
    | {
      jobId: string;
      appId: number;
      createdAt: Date;
      mode: "ephemeral" | "session";
    }
    | undefined {
    return this.jobs.get(jobId);
  }

  getJobsForApp(appId: number): string[] {
    return this.appJobs.get(appId) || [];
  }

  unregisterJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (job) {
      this.jobs.delete(jobId);

      const appJobs = this.appJobs.get(job.appId);
      if (appJobs) {
        const index = appJobs.indexOf(jobId);
        if (index > -1) {
          appJobs.splice(index, 1);
        }
        if (appJobs.length === 0) {
          this.appJobs.delete(job.appId);
        }
      }

      logger.info(`Unregistered job ${jobId} for app ${job.appId}`);
      return true;
    }
    return false;
  }

  getAllJobs(): Array<{
    jobId: string;
    appId: number;
    createdAt: Date;
    mode: "ephemeral" | "session";
  }> {
    return Array.from(this.jobs.values());
  }

  cleanupExpiredJobs(maxAgeMinutes = 60): number {
    const now = Date.now();
    const maxAgeMs = maxAgeMinutes * 60 * 1000;
    let cleanedCount = 0;

    for (const [jobId, jobInfo] of this.jobs.entries()) {
      if (now - jobInfo.createdAt.getTime() > maxAgeMs) {
        this.unregisterJob(jobId);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }
}

const jobRegistry = new JobRegistry();

export interface KernelOptions {
  appId: number;
  cwd: string;
  timeout?: number;
  memoryLimitMB?: number;
  cpuLimitPercent?: number;
  cpuRatePercent?: number; // Added for compatibility
  diskQuotaMB?: number;
  diskQuotaBytes?: number; // NEW: Disk quota in bytes
  workspaceSizeLimitMB?: number;
  networkAccess?: boolean;
  maxProcesses?: number;
  env?: Record<string, string>; // Added environment variables support
  mode?: "ephemeral" | "session"; // Added execution mode
  networkPolicy?: NetworkPolicy; // NEW: Network policy for job isolation
  onStdout?: (message: string) => void; // Optional stdout callback
  onStderr?: (message: string) => void; // Optional stderr callback
}

export interface KernelCommand {
  command: string;
  args: string[];
  options?: Partial<KernelOptions>;
}

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
  riskLevel: "low" | "medium" | "high";
  jobId?: string; // NEW: Include Job ID in result
}

export type ExecutionEventHandler = (event: {
  type: "stdout" | "stderr";
  message: string;
  timestamp: number;
}) => void;

export class ExecutionKernel {
  private static instance: ExecutionKernel;
  private readonly ALLOWED_COMMANDS = new Set([
    "npm",
    "pnpm",
    "yarn",
    "dotnet",
    "msbuild",
    "nuget",
    "cargo",
    "rustc",
    "node",
    "deno",
    "git",
    "tsc",
    "vite",
    "webpack",
    "rollup",
    "powershell",
    "pwsh",
  ]);

  private readonly TRUSTED_PATHS: Record<string, (string | undefined)[]> = {
    npm: [
      process.env.APPDATA,
      process.env.LOCALAPPDATA,
      process.env.APPDATA ? path.join(process.env.APPDATA, "npm") : undefined,
      path.join(os.homedir(), "AppData", "Roaming", "npm"),
      process.env.PROGRAMFILES,
      process.env["PROGRAMFILES(X86)"],
    ],
    pnpm: [
      process.env.APPDATA,
      process.env.LOCALAPPDATA,
      process.env.APPDATA ? path.join(process.env.APPDATA, "npm") : undefined,
      path.join(os.homedir(), "AppData", "Roaming", "npm"),
      process.env.PROGRAMFILES,
      process.env["PROGRAMFILES(X86)"],
    ],
    dotnet: [process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"]],
    git: [process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"]],
    node: [process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"]],
  };

  private activeProcesses: Map<string, any> = new Map();

  private constructor() { }

  static getInstance(): ExecutionKernel {
    if (!ExecutionKernel.instance) {
      ExecutionKernel.instance = new ExecutionKernel();
    }
    return ExecutionKernel.instance;
  }

  /**
   * Hardened path validation using realpath enforcement
   * Handles both existing and non-existing paths (for app creation)
   * Falls back gracefully if realpath fails
   */
  private async validatePath(cwd: string, appId: number): Promise<void> {
    try {
      // Normalize the path first (handles spaces and relative paths)
      const normalizedCwd = path.normalize(cwd);

      // Security check: prevent path traversal
      if (normalizedCwd.includes("..")) {
        throw new Error("Path traversal detected");
      }

      // Try to get canonical path, but fall back to normalized if it fails
      let pathToValidate = normalizedCwd;
      let canonicalPath: string;

      if (fs.existsSync(normalizedCwd)) {
        // Path exists - try to get canonical path using realpath
        try {
          canonicalPath = await fs.promises.realpath(normalizedCwd);
          pathToValidate = canonicalPath;
        } catch (realpathError) {
          // Realpath failed (permissions, symlink issues, etc.)
          // Fall back to using normalized path
          logger.warn(
            `realpath failed for ${normalizedCwd}, using normalized path instead:`,
            realpathError,
          );
          canonicalPath = normalizedCwd;
          pathToValidate = normalizedCwd;
        }
      } else {
        // Path doesn't exist yet (app is being created)
        // Validate the parent directory instead
        const parentDir = path.dirname(normalizedCwd);
        if (!fs.existsSync(parentDir)) {
          throw new Error(
            `Parent directory does not exist: ${parentDir}`,
          );
        }
        try {
          canonicalPath = await fs.promises.realpath(parentDir);
          pathToValidate = canonicalPath;
        } catch (realpathError) {
          // Fall back to normalized parent path
          logger.warn(
            `realpath failed for parent ${parentDir}, using normalized path:`,
            realpathError,
          );
          canonicalPath = path.normalize(parentDir);
          pathToValidate = canonicalPath;
        }
      }

      // Get standard app root (modern pattern)
      const standardAppsRoot = getDyadAppsBaseDirectory();
      let canonicalStandardAppsRoot: string;
      try {
        canonicalStandardAppsRoot = await fs.promises.realpath(standardAppsRoot);
      } catch {
        // Fall back to normalized path if realpath fails
        canonicalStandardAppsRoot = path.normalize(standardAppsRoot);
      }

      // Get expected app root (legacy pattern)
      const legacyAppRoot = path.join(
        process.env.USERDATA || "",
        `dyad-app-${appId}`,
      );
      let canonicalLegacyAppRoot = "";
      try {
        if (fs.existsSync(legacyAppRoot)) {
          canonicalLegacyAppRoot = await fs.promises.realpath(legacyAppRoot);
        }
      } catch {
        // Fall back to normalized or empty
        if (fs.existsSync(legacyAppRoot)) {
          canonicalLegacyAppRoot = path.normalize(legacyAppRoot);
        }
      }

      // Get templates path
      const templatesPath = path.join(process.cwd(), "templates");
      let canonicalTemplatesPath = "";
      try {
        if (fs.existsSync(templatesPath)) {
          canonicalTemplatesPath = await fs.promises.realpath(templatesPath);
        }
      } catch {
        // Fall back to normalized or empty
        if (fs.existsSync(templatesPath)) {
          canonicalTemplatesPath = path.normalize(templatesPath);
        }
      }

      // Normalize all paths for consistent comparison - handle both separators and case
      const normalizedPathToValidate = path.normalize(pathToValidate).toLowerCase().replace(/[\\/]/g, path.sep).replace(/[\\/]$/, '');
      const normalizedStandardRoot = path.normalize(canonicalStandardAppsRoot).toLowerCase().replace(/[\\/]/g, path.sep).replace(/[\\/]$/, '');
      const normalizedLegacyRoot = canonicalLegacyAppRoot
        ? path.normalize(canonicalLegacyAppRoot).toLowerCase().replace(/[\\/]/g, path.sep).replace(/[\\/]$/, '')
        : "";
      const normalizedTemplatesPath = canonicalTemplatesPath
        ? path.normalize(canonicalTemplatesPath).toLowerCase().replace(/[\\/]/g, path.sep).replace(/[\\/]$/, '')
        : "";

      logger.debug(`Path validation details:
        Original cwd: ${cwd}
        Path to validate: ${pathToValidate}
        Normalized (lower): ${normalizedPathToValidate}
        Standard root: ${canonicalStandardAppsRoot}
        Normalized standard root (lower): ${normalizedStandardRoot}
        Legacy root: ${canonicalLegacyAppRoot}
        Normalized legacy root (lower): ${normalizedLegacyRoot}
        Templates path: ${canonicalTemplatesPath}
        Normalized templates path (lower): ${normalizedTemplatesPath}`);

      // Check if path is within allowed directories (case-insensitive, separator-agnostic)
      const isInLegacyAppRoot =
        normalizedLegacyRoot &&
        normalizedPathToValidate.startsWith(normalizedLegacyRoot);
      const isInStandardAppsRoot = normalizedPathToValidate.startsWith(
        normalizedStandardRoot,
      );
      const isInTemplates =
        normalizedTemplatesPath && normalizedPathToValidate.startsWith(normalizedTemplatesPath);

      logger.debug(`Validation results:
        Is in standard root: ${isInStandardAppsRoot}
        Is in legacy root: ${isInLegacyAppRoot}
        Is in templates: ${isInTemplates}`);

      if (!isInLegacyAppRoot && !isInStandardAppsRoot && !isInTemplates) {
        logger.error(`Path validation failed:
          Checking: ${normalizedPathToValidate}
          Standard root: ${normalizedStandardRoot}
          Legacy root: ${normalizedLegacyRoot}
          Templates: ${normalizedTemplatesPath}`);
        throw new Error(
          `Path validation failed: ${cwd} is not within allowed directories`,
        );
      }

      logger.info(`Path validation passed: ${normalizedCwd}`);
    } catch (error) {
      logger.error("Path validation failed:", error);
      throw new Error(`Security violation: Invalid working directory ${cwd}`);
    }
  }

  /**
   * Validate executable against trusted locations
   */
  private async validateExecutable(command: string, commandName?: string): Promise<string> {
    // If commandName is not provided, extract from command
    let normalizedCommand = commandName || command;
    if (!commandName) {
      // If command contains path, extract filename
      if (normalizedCommand.includes("/") || normalizedCommand.includes("\\")) {
        normalizedCommand = path.basename(normalizedCommand);
        // Remove extension if present
        normalizedCommand = normalizedCommand.replace(/\.(exe|cmd|bat)$/i, "");
      }
    }
    
    // Resolve full path of command
    const fullPath = await this.resolveExecutablePath(command);
    logger.debug(`Validating executable: command=${command}, commandName=${normalizedCommand}, path=${fullPath}`);
    
    // Normalize full path to lowercase for case-insensitive comparison on Windows
    const normalizedFullPath = path.normalize(fullPath).toLowerCase();

    // Check against trusted paths
    const trustedLocations = this.TRUSTED_PATHS[normalizedCommand] || [];
    logger.debug(`Trusted locations for ${normalizedCommand}:`, trustedLocations);

    let isTrusted = false;
    for (const trustedLocation of trustedLocations) {
      if (trustedLocation) {
        const normalizedLocation = path
          .normalize(trustedLocation)
          .toLowerCase();
        logger.debug(`  Checking location: ${normalizedLocation}`);
        logger.debug(`  Path starts with location: ${normalizedFullPath.startsWith(normalizedLocation)}`);
        if (normalizedFullPath.startsWith(normalizedLocation)) {
          isTrusted = true;
          logger.debug(`  ✔️ Matched location: ${normalizedLocation}`);
          break;
        }
      }
    }

    // For development, allow node_modules/.bin
    if (fullPath.includes("node_modules") && fullPath.includes(".bin")) {
      isTrusted = true;
    }

    if (!isTrusted) {
      throw new Error(
        `Untrusted executable: ${command} resolved to ${fullPath}`,
      );
    }

    return fullPath;
  }

  /**
   * Resolve executable path using system PATH
   */
  private async resolveExecutablePath(command: string): Promise<string> {
    // On Windows, try .exe extension
    const extensions = [".exe", ".cmd", ".bat", ""];
    logger.debug(`Resolving executable for command: ${command}`);

    for (const ext of extensions) {
      const cmdWithExt = command + ext;
      logger.debug(`  Trying extension: ${ext}, full command: ${cmdWithExt}`);

      // Check if it's an absolute path
      if (path.isAbsolute(cmdWithExt)) {
        try {
          await fs.promises.access(cmdWithExt);
          return cmdWithExt;
        } catch {
          continue;
        }
      }

      // Check in PATH directories
      const pathDirs = (process.env.PATH || "").split(path.delimiter);
      for (const dir of pathDirs) {
        const fullPath = path.join(dir, cmdWithExt);
        try {
          await fs.promises.access(fullPath);
          return fullPath;
        } catch {
          continue;
        }
      }
    }

    throw new Error(`Command not found: ${command}`);
  }

  /**
   * Classify risk level based on command and arguments
   */
  private classifyRisk(
    command: string,
    args: string[],
  ): "low" | "medium" | "high" {
    const fullCommand = `${command} ${args.join(" ")}`.toLowerCase();

    // High risk commands
    if (
      fullCommand.includes("rm -rf") ||
      fullCommand.includes("format") ||
      fullCommand.includes("del /q") ||
      fullCommand.includes("rmdir /s")
    ) {
      return "high";
    }

    // Medium risk commands
    if (
      fullCommand.includes("install") ||
      fullCommand.includes("add") ||
      fullCommand.includes("restore") ||
      fullCommand.includes("download")
    ) {
      return "medium";
    }

    // Low risk by default
    return "low";
  }

  /**
   * Execute command through Guardian service (ALL commands must go through this)
   */
  private async executeThroughGuardian(
    command: string,
    args: string[],
    options: KernelOptions,
    riskLevel: "low" | "medium" | "high",
    jobId: string,
  ): Promise<Omit<ExecutionResult, "duration" | "riskLevel">> {
    // Validate everything first
    await this.validatePath(options.cwd, options.appId);
    const validatedCommand = await this.validateExecutable(command);

    logger.info(
      `Executing via Guardian: ${validatedCommand} ${args.join(" ")} [Risk: ${riskLevel}, Job: ${jobId}]`,
    );

    // ALL commands go through Guardian - no exceptions
    // This replaces the previous spawnTracked() bypass

    // In a real implementation, this would call the Guardian service
    // For now, we'll simulate the secure execution
    const result = await this.simulateGuardianExecution(
      validatedCommand,
      args,
      options,
      riskLevel,
      jobId,
    );

    return result;
  }

  /**
   * Simulate Guardian service execution (would be replaced with actual Guardian calls)
   */
  private async simulateGuardianExecution(
    command: string,
    args: string[],
    options: KernelOptions,
    riskLevel: "low" | "medium" | "high",
    _jobId: string,
  ): Promise<Omit<ExecutionResult, "duration" | "riskLevel">> {
    // This is where the actual Guardian service integration would happen
    // For now, we simulate the secure execution

    // Apply resource limits based on risk level
    const timeout = options.timeout || (riskLevel === "high" ? 30000 : 300000); // 30s for high risk, 5min for others

    // Execute with proper constraints
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd: options.cwd,
        timeout,
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, ...options.env }, // Include custom environment variables
      });
      let stdout = "";
      let stderr = "";

      child.stdout?.on("data", (data) => {
        const msg = data.toString();
        stdout += msg;
        if (options.onStdout) options.onStdout(msg);
      });

      child.stderr?.on("data", (data) => {
        const msg = data.toString();
        stderr += msg;
        if (options.onStderr) options.onStderr(msg);
      });

      this.activeProcesses.set(_jobId, child);

      child.on("close", (code) => {
        this.activeProcesses.delete(_jobId);
        resolve({
          stdout,
          stderr,
          exitCode: code || 0,
        });
      });

      child.on("error", (error) => {
        reject(error);
      });

      // Kill process if it exceeds timeout
      setTimeout(() => {
        if (!child.killed) {
          child.kill();
          reject(new Error("Command timed out"));
        }
      }, timeout);
    });
  }

  /**
   * Public execute method - ALL command execution goes through here
   */
  async execute(
    kernelCommand: KernelCommand,
    defaultOptions: KernelOptions,
    providerName = "default",
  ): Promise<ExecutionResult> {
    const options = { ...defaultOptions, ...kernelCommand.options };

    // Set default mode if not specified
    if (!options.mode) {
      options.mode = "ephemeral";
    }

    // If command contains path separators, extract just the filename
    let commandName = kernelCommand.command;
    if (commandName.includes("/") || commandName.includes("\\")) {
      commandName = path.basename(commandName);
      // Remove extension if present
      commandName = commandName.replace(/\.(exe|cmd|bat)$/i, "");
    }

    // Validate command is allowed
    if (!this.ALLOWED_COMMANDS.has(commandName)) {
      throw new Error(`Command not allowed: ${kernelCommand.command}`);
    }

    // Enforce workspace limits BEFORE execution
    await this.enforceWorkspaceLimits(options.cwd, options);

    // Validate everything first
    await this.validatePath(options.cwd, options.appId);
    const validatedCommand = await this.validateExecutable(
      kernelCommand.command,
      commandName,
    );
    const riskLevel = this.classifyRiskAdvanced(
      commandName,
      kernelCommand.args,
      providerName,
    );

    // Apply risk-based resource limits
    const riskAdjustedOptions = this.applyRiskBasedLimits(options, riskLevel);

    // Generate unique job ID
    const jobId = `job_${options.appId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Register job in registry
    jobRegistry.registerJob(options.appId, jobId, options.mode);

    const startTime = Date.now();

    try {
      logger.info(
        `Executing via Guardian: ${validatedCommand} ${kernelCommand.args.join(" ")} [Risk: ${riskLevel}, Provider: ${providerName}, Job: ${jobId}]`,
      );

      // Execute through Guardian (no direct execution paths)
      const result = await this.executeThroughGuardian(
        validatedCommand,
        kernelCommand.args,
        riskAdjustedOptions,
        riskLevel,
        jobId,
      );

      const duration = Date.now() - startTime;

      // Check post-execution workspace limits
      await this.enforceWorkspaceLimits(options.cwd, options);

      logger.info(
        `Command completed in ${duration}ms with exit code ${result.exitCode} [Job: ${jobId}]`,
      );

      // Clean up ephemeral jobs immediately
      if (options.mode === "ephemeral") {
        jobRegistry.unregisterJob(jobId);
      }

      return {
        ...result,
        duration,
        riskLevel,
        jobId,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Command failed after ${duration}ms:`, error);

      // Clean up job on failure
      jobRegistry.unregisterJob(jobId);

      throw new Error(`Execution failed: ${(error as Error).message}`);
    }
  }

  /**
   * Non-blocking execution - Spawns a process and returns the jobId immediately
   */
  async spawnControlled(
    kernelCommand: KernelCommand,
    defaultOptions: KernelOptions,
    providerName = "default",
  ): Promise<{ jobId: string; riskLevel: "low" | "medium" | "high" }> {
    const options = { ...defaultOptions, ...kernelCommand.options };

    // Default to session mode for spawned processes
    if (!options.mode) {
      options.mode = "session";
    }

    // Extract command name from command (handle cases with path)
    let commandName = kernelCommand.command;
    if (commandName.includes("/") || commandName.includes("\\")) {
      commandName = path.basename(commandName);
      // Remove extension if present
      commandName = commandName.replace(/\.(exe|cmd|bat)$/i, "");
    }
    
    // Validate command is allowed
    if (!this.ALLOWED_COMMANDS.has(commandName)) {
      throw new Error(`Command not allowed: ${kernelCommand.command}`);
    }

    // Enforce workspace limits BEFORE execution
    await this.enforceWorkspaceLimits(options.cwd, options);

    // Validate everything first
    await this.validatePath(options.cwd, options.appId);
    const validatedCommand = await this.validateExecutable(
      kernelCommand.command,
      commandName,
    );
    const riskLevel = this.classifyRiskAdvanced(
      commandName,
      kernelCommand.args,
      providerName,
    );

    // Apply risk-based resource limits
    const riskAdjustedOptions = this.applyRiskBasedLimits(options, riskLevel);

    // Generate unique job ID
    const jobId = `job_${options.appId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Register job in registry
    jobRegistry.registerJob(options.appId, jobId, options.mode);

    // Call executeThroughGuardian WITHOUT awaiting it
    this.executeThroughGuardian(
      validatedCommand,
      kernelCommand.args,
      riskAdjustedOptions,
      riskLevel,
      jobId,
    ).catch((error) => {
      logger.error(`Spawned job ${jobId} failed:`, error);
      jobRegistry.unregisterJob(jobId);
      this.activeProcesses.delete(jobId);
    });

    return { jobId, riskLevel };
  }

  /**
   * Apply risk-based resource limits
   */
  private applyRiskBasedLimits(
    options: KernelOptions,
    riskLevel: "low" | "medium" | "high",
  ): KernelOptions {
    const adjustedOptions = { ...options };

    switch (riskLevel) {
      case "high":
        adjustedOptions.timeout = Math.min(
          adjustedOptions.timeout || 30000,
          30000,
        ); // Max 30s
        adjustedOptions.memoryLimitMB = Math.min(
          adjustedOptions.memoryLimitMB || 100,
          100,
        ); // Max 100MB
        adjustedOptions.maxProcesses = Math.min(
          adjustedOptions.maxProcesses || 1,
          1,
        ); // Max 1 process
        adjustedOptions.networkAccess = false; // No network for high risk
        break;

      case "medium":
        adjustedOptions.timeout = Math.min(
          adjustedOptions.timeout || 300000,
          300000,
        ); // Max 5min
        adjustedOptions.memoryLimitMB = Math.min(
          adjustedOptions.memoryLimitMB || 1000,
          1000,
        ); // Max 1GB
        adjustedOptions.maxProcesses = Math.min(
          adjustedOptions.maxProcesses || 5,
          5,
        ); // Max 5 processes
        break;

      case "low":
        // Use provided limits or reasonable defaults
        adjustedOptions.timeout = adjustedOptions.timeout || 600000; // 10min default
        adjustedOptions.memoryLimitMB = adjustedOptions.memoryLimitMB || 2000; // 2GB default
        adjustedOptions.maxProcesses = adjustedOptions.maxProcesses || 10; // 10 processes default
        break;
    }

    return adjustedOptions;
  }

  /**
   * Sequential command execution for Windows-only architecture
   */
  async executeSequence(
    commands: KernelCommand[],
    defaultOptions: KernelOptions,
  ): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];

    for (const command of commands) {
      try {
        const result = await this.execute(command, defaultOptions);
        results.push(result);
      } catch (error) {
        // Stop execution on first failure
        throw new Error(
          `Sequence failed at command '${command.command}': ${(error as Error).message}`,
        );
      }
    }

    return results;
  }

  /**
   * Get current disk usage for quota enforcement
   */
  async getDiskUsage(cwd: string): Promise<number> {
    try {
      const fs = await import("fs");
      const path = await import("path");

      let totalSize = 0;

      const calculateDirectorySize = async (
        dirPath: string,
      ): Promise<number> => {
        const entries = await fs.promises.readdir(dirPath, {
          withFileTypes: true,
        });
        let size = 0;

        for (const entry of entries) {
          const entryPath = path.join(dirPath, entry.name);

          if (entry.isDirectory()) {
            size += await calculateDirectorySize(entryPath);
          } else {
            const stats = await fs.promises.stat(entryPath);
            size += stats.size;
          }
        }

        return size;
      };

      totalSize = await calculateDirectorySize(cwd);
      return totalSize;
    } catch (error) {
      logger.warn(`Failed to calculate disk usage for ${cwd}:`, error);
      return 0;
    }
  }

  /**
   * Real implementation of getDirectorySize for disk quota enforcement
   */
  private async getDirectorySize(dirPath: string): Promise<number> {
    try {
      const fs = await import("fs");
      const path = await import("path");

      let totalSize = 0;
      const visited = new Set<string>();

      const calculateSize = async (currentPath: string): Promise<number> => {
        // Prevent infinite loops from circular symlinks
        const realPath = await fs.promises.realpath(currentPath);
        if (visited.has(realPath)) {
          return 0;
        }
        visited.add(realPath);

        let size = 0;
        const stats = await fs.promises.stat(currentPath);

        if (stats.isDirectory()) {
          try {
            const entries = await fs.promises.readdir(currentPath, {
              withFileTypes: true,
            });
            for (const entry of entries) {
              const entryPath = path.join(currentPath, entry.name);
              size += await calculateSize(entryPath);
            }
          } catch (error) {
            // Skip inaccessible directories
            logger.debug(
              `Skipping inaccessible directory ${currentPath}:`,
              error,
            );
          }
        } else {
          size = stats.size;
        }

        return size;
      };

      totalSize = await calculateSize(dirPath);
      return totalSize;
    } catch (error) {
      logger.error(`Failed to calculate directory size for ${dirPath}:`, error);
      return 0;
    }
  }

  /**
   * Check if disk quota would be exceeded
   */
  async checkDiskQuota(cwd: string, quotaMB: number): Promise<boolean> {
    const usageBytes = await this.getDiskUsage(cwd);
    const usageMB = usageBytes / (1024 * 1024);
    return usageMB <= quotaMB;
  }

  /**
   * Monitor workspace size and enforce limits
   */
  async enforceWorkspaceLimits(
    cwd: string,
    options: KernelOptions,
  ): Promise<void> {
    // Check workspace size limit
    if (options.workspaceSizeLimitMB) {
      const currentSize = await this.getDiskUsage(cwd);
      const currentSizeMB = currentSize / (1024 * 1024);

      if (currentSizeMB > options.workspaceSizeLimitMB) {
        throw new Error(
          `Workspace size limit exceeded: ${currentSizeMB.toFixed(1)}MB > ${options.workspaceSizeLimitMB}MB`,
        );
      }

      logger.info(
        `Workspace size check passed: ${currentSizeMB.toFixed(1)}MB (limit: ${options.workspaceSizeLimitMB}MB)`,
      );
    }

    // Check disk quota if specified
    if (options.diskQuotaMB) {
      const withinQuota = await this.checkDiskQuota(cwd, options.diskQuotaMB);
      if (!withinQuota) {
        throw new Error(`Disk quota exceeded for workspace: ${cwd}`);
      }
      logger.info(`Disk quota check passed for workspace: ${cwd}`);
    }
  }

  /**
   * Advanced risk classification with provider awareness
   */
  private classifyRiskAdvanced(
    command: string,
    args: string[],
    providerName: string,
  ): "low" | "medium" | "high" {
    const fullCommand = `${command} ${args.join(" ")}`.toLowerCase();

    // Provider-specific risk patterns
    const providerRiskPatterns: Record<
      string,
      { high: string[]; medium: string[] }
    > = {
      node: {
        high: ["rm -rf", "del /q", "rmdir /s", "format"],
        medium: ["install", "add", "npm install", "yarn add", "pnpm add"],
      },
      dotnet: {
        high: ["dotnet clean --force", "del /q", "rm -rf"],
        medium: ["restore", "build --no-incremental", "publish"],
      },
      default: {
        high: ["rm -rf", "del /q", "format", "mkfs"],
        medium: ["install", "download", "clone", "pull"],
      },
    };

    const patterns =
      providerRiskPatterns[providerName] || providerRiskPatterns.default;

    // Check high risk patterns first
    for (const pattern of patterns.high) {
      if (fullCommand.includes(pattern)) {
        return "high";
      }
    }

    // Check medium risk patterns
    for (const pattern of patterns.medium) {
      if (fullCommand.includes(pattern)) {
        return "medium";
      }
    }

    // Low risk by default
    return "low";
  }

  /**
   * Terminate a specific job by ID
   */
  async terminateJob(jobId: string): Promise<boolean> {
    const job = jobRegistry.getJob(jobId);
    if (!job) {
      logger.warn(`Job ${jobId} not found for termination`);
      return false;
    }

    try {
      // Unregister the job
      const success = jobRegistry.unregisterJob(jobId);

      // Kill the actual process
      const child = this.activeProcesses.get(jobId);
      if (child) {
        child.kill();
        this.activeProcesses.delete(jobId);
      }

      if (success) {
        logger.info(`Successfully terminated job ${jobId}`);
      }

      return success;
    } catch (error) {
      logger.error(`Failed to terminate job ${jobId}:`, error);
      return false;
    }
  }

  /**
   * Terminate all jobs for a specific app
   */
  async terminateAppJobs(appId: number): Promise<number> {
    const jobIds = jobRegistry.getJobsForApp(appId);
    let terminatedCount = 0;

    for (const jobId of jobIds) {
      if (await this.terminateJob(jobId)) {
        terminatedCount++;
      }
    }

    logger.info(`Terminated ${terminatedCount} jobs for app ${appId}`);
    return terminatedCount;
  }

  /**
   * Get job status information
   */
  getJobStatus(jobId: string): {
    jobId: string;
    appId: number;
    createdAt: Date;
    mode: "ephemeral" | "session";
    status: "running" | "completed" | "failed";
  } | null {
    const job = jobRegistry.getJob(jobId);
    if (!job) {
      return null;
    }

    // In a real implementation, this would check actual process status
    // For now, we'll return a simulated status
    return {
      ...job,
      status: "running", // Simulated status
    };
  }

  /**
   * Get all active jobs
   */
  getAllActiveJobs(): Array<{
    jobId: string;
    appId: number;
    createdAt: Date;
    mode: "ephemeral" | "session";
    status: "running" | "completed" | "failed";
  }> {
    return jobRegistry.getAllJobs().map((job) => ({
      ...job,
      status: "running" as const, // Simulated status
    }));
  }

  /**
   * Cleanup expired jobs
   */
  cleanupExpiredJobs(maxAgeMinutes = 60): number {
    return jobRegistry.cleanupExpiredJobs(maxAgeMinutes);
  }

  /**
   * Create a Guardian job with security settings
   */
  async createGuardianJob(options: KernelOptions): Promise<string> {
    const jobId = `job_${options.appId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // In a real implementation, this would call the Guardian service
    // to create a job object with the specified limits
    logger.info(`Creating Guardian job ${jobId} with options:`, {
      memoryLimitMB: options.memoryLimitMB,
      cpuLimitPercent: options.cpuLimitPercent,
      diskQuotaBytes:
        options.diskQuotaBytes ??
        (options.diskQuotaMB ? options.diskQuotaMB * 1024 * 1024 : undefined),
      networkPolicy: options.networkPolicy,
      maxProcesses: options.maxProcesses,
    });

    // Register the job
    jobRegistry.registerJob(options.appId, jobId, options.mode || "ephemeral");

    return jobId;
  }

  /**
   * Handle quota exceeded events from Guardian
   */
  onQuotaExceeded(callback: (event: QuotaExceededEvent) => void): void {
    // In a real implementation, this would subscribe to Guardian events
    logger.info("Registered quota exceeded callback");
    this.quotaExceededCallbacks.push(callback);
  }

  private quotaExceededCallbacks: ((event: QuotaExceededEvent) => void)[] = [];

  /**
   * Emit a quota exceeded event (called by Guardian service)
   */
  emitQuotaExceeded(event: QuotaExceededEvent): void {
    logger.warn(`Quota exceeded: ${event.quotaType} for job ${event.jobName}`, {
      limit: event.limit,
      currentValue: event.currentValue,
    });

    for (const callback of this.quotaExceededCallbacks) {
      try {
        callback(event);
      } catch (error) {
        logger.error("Error in quota exceeded callback:", error);
      }
    }
  }

  /**
   * Apply network policy to a job
   */
  async applyNetworkPolicy(
    jobId: string,
    policy: NetworkPolicy,
  ): Promise<boolean> {
    logger.info(`Applying network policy to job ${jobId}:`, policy);

    // In a real implementation, this would call the Guardian WFP manager
    // to create firewall rules based on the policy

    return true;
  }

  /**
   * Check if disk quota is exceeded for a job
   */
  async checkJobDiskQuota(_jobId: string): Promise<{
    exceeded: boolean;
    readBytes: number;
    writeBytes: number;
    limit?: number;
  }> {
    // In a real implementation, this would query the Guardian service
    // for actual I/O counters
    return {
      exceeded: false,
      readBytes: 0,
      writeBytes: 0,
    };
  }

  /**
   * Get job statistics including disk I/O
   */
  async getJobStatistics(jobId: string): Promise<{
    activeProcesses: number;
    totalProcesses: number;
    peakMemoryUsed: number;
    currentMemoryUsage: number;
    totalDiskReadBytes: number;
    totalDiskWriteBytes: number;
    diskQuotaLimit?: number;
  } | null> {
    const job = jobRegistry.getJob(jobId);
    if (!job) {
      return null;
    }

    // In a real implementation, this would query the Guardian service
    return {
      activeProcesses: 1,
      totalProcesses: 1,
      peakMemoryUsed: 0,
      currentMemoryUsage: 0,
      totalDiskReadBytes: 0,
      totalDiskWriteBytes: 0,
    };
  }
}

// Export singleton instance
export const executionKernel = ExecutionKernel.getInstance();

// Type guard for kernel commands
export function isKernelCommand(obj: any): obj is KernelCommand {
  return (
    obj &&
    typeof obj.command === "string" &&
    Array.isArray(obj.args) &&
    obj.args.every((arg: any) => typeof arg === "string")
  );
}
