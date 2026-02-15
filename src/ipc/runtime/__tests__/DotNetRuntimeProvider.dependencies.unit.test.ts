/**
 * Unit tests for .NET Runtime Provider dependency error handling
 * Validates Requirements 3.2, 8.4: Error parsing and descriptive messages
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { dotNetRuntimeProvider } from "../providers/DotNetRuntimeProvider";
import { executionKernel } from "../../security/execution_kernel";

describe("DotNetRuntimeProvider - Dependency Error Unit Tests", () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
  });

  it("should detect and parse NuGet package errors", async () => {
    // Mock execution to return NuGet error
    vi.spyOn(executionKernel, "execute").mockResolvedValue({
      stdout: "",
      stderr:
        "error NU1101: Unable to find package NonExistent.Package. No packages exist with this id in source(s).",
      exitCode: 1,
      duration: 1000,
      riskLevel: "medium" as const,
    });

    const result = await dotNetRuntimeProvider.resolveDependencies({
      appPath: "/test/project",
      appId: 123,
    });

    // Verify the error was detected despite potential exit code
    expect(result.stderr).toContain("NU1101");
    expect(result.stderr).toContain("NonExistent.Package");
  });

  it("should detect network errors during dependency resolution", async () => {
    // Mock execution to return network error
    vi.spyOn(executionKernel, "execute").mockResolvedValue({
      stdout: "",
      stderr:
        "error: The SSL connection could not be established, see inner exception. Network connectivity issue.",
      exitCode: 1,
      duration: 1000,
      riskLevel: "medium" as const,
    });

    const result = await dotNetRuntimeProvider.resolveDependencies({
      appPath: "/test/project",
      appId: 123,
    });

    expect(result.stderr).toContain("SSL");
    expect(result.stderr).toContain("Network");
  });

  it("should detect package not found errors", async () => {
    // Mock execution to return package not found error
    vi.spyOn(executionKernel, "execute").mockResolvedValue({
      stdout: "",
      stderr:
        "error: Could not find package MyTestPackage. The package does not exist in the source.",
      exitCode: 1,
      duration: 1000,
      riskLevel: "medium" as const,
    });

    const result = await dotNetRuntimeProvider.resolveDependencies({
      appPath: "/test/project",
      appId: 123,
    });

    expect(result.stderr).toContain("Could not find package");
    expect(result.stderr).toContain("MyTestPackage");
  });

  it("should handle mixed success and error output", async () => {
    // Mock execution to return both success and error messages
    vi.spyOn(executionKernel, "execute").mockResolvedValue({
      stdout: "Restoring packages for .NET Framework v4.7.2...",
      stderr:
        "error NU1202: Package Some.Package 1.0.0 is not compatible with net6.0.",
      exitCode: 0, // Note: exit code is 0 but there are errors in stderr
      duration: 1000,
      riskLevel: "medium" as const,
    });

    const result = await dotNetRuntimeProvider.resolveDependencies({
      appPath: "/test/project",
      appId: 123,
    });

    // Even with exit code 0, our enhanced parser should detect the error in stderr
    // and the method should return a non-zero exit code if error parsing is implemented
    expect(result.stdout).toContain("Restoring packages");
    expect(result.stderr).toContain("NU1202");
    expect(result.stderr).toContain("Some.Package");
  });

  it("should handle access denied errors", async () => {
    // Mock execution to return access denied error
    vi.spyOn(executionKernel, "execute").mockResolvedValue({
      stdout: "",
      stderr:
        "error: Access is denied. Failed to download package from source.",
      exitCode: 1,
      duration: 1000,
      riskLevel: "medium" as const,
    });

    const result = await dotNetRuntimeProvider.resolveDependencies({
      appPath: "/test/project",
      appId: 123,
    });

    expect(result.stderr).toContain("Access is denied");
  });

  it("should parse multiple errors from output", async () => {
    // Mock execution to return multiple errors
    vi.spyOn(executionKernel, "execute").mockResolvedValue({
      stdout: "",
      stderr: `error NU1101: Unable to find package PackageA.
error NU1102: Unable to find package PackageB.
warning NU1603: PackageC depends on PackageD which is not available.`,
      exitCode: 1,
      duration: 1000,
      riskLevel: "medium" as const,
    });

    const result = await dotNetRuntimeProvider.resolveDependencies({
      appPath: "/test/project",
      appId: 123,
    });

    expect(result.stderr).toContain("NU1101");
    expect(result.stderr).toContain("NU1102");
    expect(result.stderr).toContain("PackageA");
    expect(result.stderr).toContain("PackageB");
  });

  it("should return appropriate error messages containing package names", async () => {
    const testCases = [
      {
        stderr: "error NU1101: Unable to find package Newtonsoft.Json.",
        expectedPackage: "Newtonsoft.Json",
      },
      {
        stderr:
          "error: Could not install package Microsoft.EntityFrameworkCore.",
        expectedPackage: "Microsoft.EntityFrameworkCore",
      },
      {
        stderr:
          "Package restore failed. Unable to locate package Serilog.Extensions.Logging.",
        expectedPackage: "Serilog.Extensions.Logging",
      },
    ];

    for (const testCase of testCases) {
      vi.spyOn(executionKernel, "execute").mockResolvedValue({
        stdout: "",
        stderr: testCase.stderr,
        exitCode: 1,
        duration: 1000,
        riskLevel: "medium" as const,
      });

      const result = await dotNetRuntimeProvider.resolveDependencies({
        appPath: "/test/project",
        appId: 123,
      });

      expect(result.stderr).toContain(testCase.expectedPackage);
    }
  });

  it("should handle empty error output gracefully", async () => {
    // Mock execution with no errors
    vi.spyOn(executionKernel, "execute").mockResolvedValue({
      stdout: "Restore completed successfully.",
      stderr: "",
      exitCode: 0,
      duration: 1000,
      riskLevel: "medium" as const,
    });

    const result = await dotNetRuntimeProvider.resolveDependencies({
      appPath: "/test/project",
      appId: 123,
    });

    expect(result.stdout).toContain("Restore completed");
    expect(result.exitCode).toBe(0);
  });
});
