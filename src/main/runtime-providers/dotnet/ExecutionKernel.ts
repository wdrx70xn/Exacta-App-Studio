import { spawn, SpawnOptions } from "child_process";
import * as fs from "fs/promises";

/**
 * ExecutionKernel - Security layer for Windows Native App Builder
 * Validates and executes dotnet CLI commands safely
 */
export class ExecutionKernel {
  private readonly ALLOWED_COMMANDS = new Set([
    "new",
    "restore",
    "build",
    "run",
  ]);
  private readonly DEFAULT_TIMEOUT = 300000; // 5 minutes

  /**
   * Execute a validated command with security checks
   */
  async execute(
    command: string,
    args: string[],
    options: {
      cwd: string;
      timeout?: number;
      allowedCommands?: string[];
    },
  ): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
    duration: number;
  }> {
    const startTime = Date.now();
    const timeout = options.timeout || this.DEFAULT_TIMEOUT;

    // Validate command is allowed
    const allowedCommands =
      options.allowedCommands || Array.from(this.ALLOWED_COMMANDS);
    if (!allowedCommands.some((allowedCmd) => command.includes(allowedCmd))) {
      throw new Error(
        `Command not allowed: ${command}. Allowed commands: ${allowedCommands.join(", ")}`,
      );
    }

    // Validate working directory
    await this.validateWorkingDirectory(options.cwd);

    // Execute command with timeout
    return new Promise((resolve, reject) => {
      const spawnOptions: SpawnOptions = {
        cwd: options.cwd,
        stdio: ["pipe", "pipe", "pipe"],
        shell: true, // Required for Windows commands
      };

      const childProcess = spawn(command, args, spawnOptions);

      let stdout = "";
      let stderr = "";

      childProcess.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      childProcess.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      const timer = setTimeout(() => {
        if (!childProcess.killed) {
          childProcess.kill();
          reject(
            new Error(
              `Command timed out after ${timeout}ms: ${command} ${args.join(" ")}`,
            ),
          );
        }
      }, timeout);

      childProcess.on("close", (code) => {
        clearTimeout(timer);
        const duration = Date.now() - startTime;

        resolve({
          stdout,
          stderr,
          exitCode: code ?? 1,
          duration,
        });
      });

      childProcess.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  /**
   * Validate that the working directory is safe to execute commands in
   */
  private async validateWorkingDirectory(cwd: string): Promise<void> {
    // Check if directory exists
    try {
      await fs.access(cwd);
    } catch {
      throw new Error(`Working directory does not exist: ${cwd}`);
    }

    // Get real path to prevent directory traversal
    const realPath = await fs.realpath(cwd);

    // Ensure the path is within allowed directories
    // For Windows Native App Builder, we allow execution in dyad app directories
    const allowedPatterns = [
      /dyad-app/i,
      /windows-native/i,
      /dotnet/i,
      /temp/i,
    ];

    const isAllowed = allowedPatterns.some((pattern) =>
      realPath.toLowerCase().includes(pattern.source.toLowerCase()),
    );

    if (!isAllowed) {
      throw new Error(
        `Invalid working directory: ${realPath}. Command execution is only allowed in designated app directories.`,
      );
    }

    // Additional security check: ensure no path traversal attempts
    if (
      realPath.includes("..") ||
      realPath.includes("../") ||
      realPath.includes("..\\\\")
    ) {
      throw new Error("Path traversal detected in working directory");
    }
  }

  /**
   * Validate a specific command is in the allowed list
   */
  isCommandAllowed(command: string): boolean {
    return this.ALLOWED_COMMANDS.has(command);
  }

  /**
   * Get allowed commands
   */
  getAllowedCommands(): string[] {
    return Array.from(this.ALLOWED_COMMANDS);
  }
}

// Export singleton instance
export const executionKernel = new ExecutionKernel();
