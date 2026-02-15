/**
 * Property test for .NET Runtime Provider build execution
 * Validates Requirement 4.1, 4.3: Build execution and validation
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { dotNetRuntimeProvider } from "../providers/DotNetRuntimeProvider";
import { executionKernel } from "../../security/execution_kernel";
import path from "node:path";

describe("DotNetRuntimeProvider - Build Execution Property Tests", () => {
  beforeEach(() => {
    // Mock execution kernel for controlled testing
    vi.spyOn(executionKernel, "execute").mockImplementation(
      async (kernelCommand, _options) => {
        // Simulate successful build
        if (kernelCommand.args.includes("build")) {
          return {
            stdout: "Build succeeded.",
            stderr: "",
            exitCode: 0,
            duration: 2000,
            riskLevel: "medium" as const,
          };
        }
        return {
          stdout: "",
          stderr: "",
          exitCode: 0,
          duration: 100,
          riskLevel: "low" as const,
        };
      },
    );
  });

  it("should successfully build with various configurations", async () => {
    const configurations = ["Debug", "Release", "Custom"];

    for (const config of configurations) {
      const result = await dotNetRuntimeProvider.build({
        appPath: "/test/project",
        appId: 123,
        configuration: config,
      });

      expect(result.success).toBe(true);
      expect(result.outputPath).toContain(path.join("bin", config));
    }
  });

  it("should handle arbitrary app IDs and paths", async () => {
    const testCases = [
      { appId: 1, path: "C:\\Temp\\App" },
      { appId: 99999, path: "/usr/local/bin/app" },
      { appId: 0, path: "./relative" },
    ];

    for (const testCase of testCases) {
      const result = await dotNetRuntimeProvider.build({
        appPath: testCase.path,
        appId: testCase.appId,
      });

      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("outputPath");
    }
  });

  it("should produce valid BuildResult structure regardless of completion status", async () => {
    // Mock a failed build
    vi.spyOn(executionKernel, "execute").mockResolvedValueOnce({
      stdout: "",
      stderr: "C:\\File.cs(1,1): error CS0001: Msg",
      exitCode: 1,
      duration: 500,
      riskLevel: "medium" as const,
    });

    const result = await dotNetRuntimeProvider.build({
      appPath: "/test/fail",
      appId: 1,
    });

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors?.length).toBeGreaterThan(0);
    expect(typeof result.outputPath).toBe("string");
  });
});
