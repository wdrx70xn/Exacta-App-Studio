/**
 * ProcessManager - Manages the lifecycle of .NET application processes
 *
 * This class handles starting, stopping, and monitoring Windows application
 * processes via the ExecutionKernel.
 */

import { executionKernel } from "../../../security/execution_kernel";

export interface ProcessOptions {
  appId: number;
  executablePath: string;
  args?: string[];
  cwd: string;
  onOutput?: (type: "stdout" | "stderr", message: string) => void;
  onExit?: (exitCode: number | null) => void;
}

export class ProcessManager {
  private activeJobs: Map<string, { appId: number; startTime: Date }> =
    new Map();

  /**
   * Start a new application process
   */
  async startProcess(options: ProcessOptions): Promise<string> {
    const { appId, executablePath, args = [], cwd, onOutput, } = options;

    const result = await executionKernel.spawnControlled(
      { command: executablePath, args },
      {
        appId,
        cwd,
        mode: "session",
        onStdout: onOutput
          ? (msg: string) => onOutput("stdout", msg)
          : undefined,
        onStderr: onOutput
          ? (msg: string) => onOutput("stderr", msg)
          : undefined,
      },
      "dotnet",
    );

    const jobId = result.jobId;
    this.activeJobs.set(jobId, {
      appId,
      startTime: new Date(),
    });

    // Monitor for process exit if kernel supports it or via periodic check
    // In this architecture, the kernel handles the session persistence.

    return jobId;
  }

  /**
   * Stop a running application process
   */
  async stopProcess(jobId: string): Promise<void> {
    if (!this.activeJobs.has(jobId)) {
      return;
    }

    await executionKernel.terminateJob(jobId);
    this.activeJobs.delete(jobId);
  }

  /**
   * Check if a process is still running
   */
  async isProcessRunning(jobId: string): Promise<boolean> {
    // This would ideally query the ExecutionKernel's JobRegistry
    // For now, if it's in our activeJobs map, we consider it running
    return this.activeJobs.has(jobId);
  }

  /**
   * Get all active jobs
   */
  getActiveJobs(): Map<string, { appId: number; startTime: Date }> {
    return new Map(this.activeJobs);
  }

  /**
   * Clean up a job from the registry (called when process exit is detected)
   */
  cleanupJob(jobId: string): void {
    this.activeJobs.delete(jobId);
  }
}

// Export singleton instance
export const processManager = new ProcessManager();
