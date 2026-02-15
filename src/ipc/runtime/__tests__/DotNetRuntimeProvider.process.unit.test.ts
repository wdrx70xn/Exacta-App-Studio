/**
 * Unit tests for ProcessManager
 * Validates Requirement 5.1, 5.3, 5.5: Process lifecycle management
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { processManager } from "../providers/dotnet/ProcessManager";
import { executionKernel } from "../../security/execution_kernel";

describe("ProcessManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset active jobs
    (processManager as any).activeJobs.clear();

    // Mock execution kernel
    vi.spyOn(executionKernel, "spawnControlled").mockResolvedValue({
      jobId: "job-123",
      riskLevel: "low" as const,
    });

    vi.spyOn(executionKernel, "terminateJob").mockResolvedValue(true);
  });

  it("should start a process and register the job", async () => {
    const jobId = await processManager.startProcess({
      appId: 1,
      executablePath: "myapp.exe",
      cwd: "/test",
    });

    expect(jobId).toBe("job-123");
    expect(processManager.getActiveJobs().has("job-123")).toBe(true);
    expect(executionKernel.spawnControlled).toHaveBeenCalledWith(
      { command: "myapp.exe", args: [] },
      expect.objectContaining({ mode: "session" }),
      "dotnet",
    );
  });

  it("should throw an error if process fails to start", async () => {
    vi.spyOn(executionKernel, "spawnControlled").mockRejectedValueOnce(
      new Error("Failed to start process: Access denied"),
    );

    await expect(
      processManager.startProcess({
        appId: 1,
        executablePath: "invalid.exe",
        cwd: "/test",
      }),
    ).rejects.toThrow("Failed to start process");
  });

  it("should terminate a running job", async () => {
    // Manually register a job
    (processManager as any).activeJobs.set("job-123", {
      appId: 1,
      startTime: new Date(),
    });

    await processManager.stopProcess("job-123");

    expect(executionKernel.terminateJob).toHaveBeenCalledWith("job-123");
    expect(processManager.getActiveJobs().has("job-123")).toBe(false);
  });

  it("should correctly report running status", async () => {
    expect(await processManager.isProcessRunning("job-123")).toBe(false);

    (processManager as any).activeJobs.set("job-123", {
      appId: 1,
      startTime: new Date(),
    });
    expect(await processManager.isProcessRunning("job-123")).toBe(true);
  });

  it("should cleanup jobs upon request", () => {
    (processManager as any).activeJobs.set("job-123", {
      appId: 1,
      startTime: new Date(),
    });
    processManager.cleanupJob("job-123");
    expect(processManager.getActiveJobs().has("job-123")).toBe(false);
  });
});
