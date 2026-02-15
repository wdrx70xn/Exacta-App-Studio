/**
 * Property test for ProcessManager lifecycle and output
 * Validates Requirement 5.4, 8.3, 12: Lifecycle and output capture
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { processManager } from "../providers/dotnet/ProcessManager";
import { executionKernel } from "../../security/execution_kernel";

describe("ProcessManager - Property Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (processManager as any).activeJobs.clear();

    vi.spyOn(executionKernel, "spawnControlled").mockImplementation(
      async (cmd, options) => {
        return {
          jobId: `job-${options.appId}-${Math.random()}`,
          riskLevel: "low" as const,
        };
      },
    );

    vi.spyOn(executionKernel, "terminateJob").mockResolvedValue(true);
  });

  it("should ensure a clean state after start and stop cycle", async () => {
    // Property 12: Process Lifecycle Round-Trip
    const jobId = await processManager.startProcess({
      appId: 1,
      executablePath: "app.exe",
      cwd: "/test",
    });

    expect(processManager.getActiveJobs().size).toBe(1);

    await processManager.stopProcess(jobId);

    expect(processManager.getActiveJobs().size).toBe(0);
  });

  it("should handle varied output volumes correctly", async () => {
    // Property 13: Console Output Capture
    const outputLogs: string[] = [];

    // Simulate complex output streaming
    vi.spyOn(executionKernel, "spawnControlled").mockImplementationOnce(
      async (cmd, options) => {
        if (options.onStdout) {
          options.onStdout("Line 1");
          options.onStdout("Line 2");
        }
        return {
          jobId: "stream-job",
          riskLevel: "low" as const,
        };
      },
    );

    await processManager.startProcess({
      appId: 1,
      executablePath: "app.exe",
      cwd: "/test",
      onOutput: (type, msg) => outputLogs.push(msg),
    });

    expect(outputLogs).toContain("Line 1");
    expect(outputLogs).toContain("Line 2");
  });

  it("should maintain job registry independent of app IDs", async () => {
    const appIds = [101, 202, 303, 404];

    for (const appId of appIds) {
      await processManager.startProcess({
        appId,
        executablePath: `app-${appId}.exe`,
        cwd: `/test/${appId}`,
      });
    }

    expect(processManager.getActiveJobs().size).toBe(appIds.length);

    const activeJobs = processManager.getActiveJobs();
    const registeredAppIds = Array.from(activeJobs.values()).map(
      (j) => j.appId,
    );

    for (const appId of appIds) {
      expect(registeredAppIds).toContain(appId);
    }
  });
});
