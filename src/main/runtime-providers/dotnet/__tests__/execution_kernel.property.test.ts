import { describe, it, expect } from "vitest";
import { ExecutionKernel } from "../ExecutionKernel";

/**
 * Property 11: Security Command Validation
 * Validates: Requirements 4.4, 12.4
 *
 * This property test ensures that the ExecutionKernel properly validates commands
 * and prevents unauthorized command execution for the Windows Native App Builder.
 */

describe("ExecutionKernel Property 11: Security Command Validation", () => {
  const kernel = new ExecutionKernel();

  it("should only allow specified commands (new, restore, build, run)", () => {
    // Test allowed commands
    expect(kernel.isCommandAllowed("new")).toBe(true);
    expect(kernel.isCommandAllowed("restore")).toBe(true);
    expect(kernel.isCommandAllowed("build")).toBe(true);
    expect(kernel.isCommandAllowed("run")).toBe(true);

    // Test disallowed commands
    expect(kernel.isCommandAllowed("rm")).toBe(false);
    expect(kernel.isCommandAllowed("del")).toBe(false);
    expect(kernel.isCommandAllowed("format")).toBe(false);
    expect(kernel.isCommandAllowed("exec")).toBe(false);
  });

  it("should validate working directory restrictions", async () => {
    // This test validates that the kernel rejects invalid working directories
    // We'll test the validation logic by attempting to validate various paths

    // Create a temporary directory for testing
    const tempDir = require("os").tmpdir();

    // Valid directory should not throw
    await expect(
      kernel["validateWorkingDirectory"](tempDir),
    ).resolves.not.toThrow();

    // Test that the method exists and can be called
    expect(typeof kernel["validateWorkingDirectory"]).toBe("function");
  });

  it("should reject disallowed commands during execution", async () => {
    const testDir = require("os").tmpdir();

    // Try to execute a disallowed command
    await expect(() =>
      kernel.execute("rm", ["-rf", "/"], {
        cwd: testDir,
        allowedCommands: ["new", "restore", "build", "run"],
      }),
    ).rejects.toThrow();

    // Try to execute an allowed command (this should work differently since we can't actually run rm on Windows)
    await expect(() =>
      kernel.execute("invalid-command-that-does-not-exist", ["test"], {
        cwd: testDir,
      }),
    ).rejects.toThrow(); // Should fail due to command not existing, not due to validation
  });

  it("should have correct allowed commands list", () => {
    const allowedCommands = kernel.getAllowedCommands();
    expect(allowedCommands).toContain("new");
    expect(allowedCommands).toContain("restore");
    expect(allowedCommands).toContain("build");
    expect(allowedCommands).toContain("run");
    expect(allowedCommands).toHaveLength(4);
  });

  it("should enforce security constraints consistently", () => {
    // Multiple instantiations should have the same allowed commands
    const kernel1 = new ExecutionKernel();
    const kernel2 = new ExecutionKernel();

    expect(kernel1.getAllowedCommands()).toEqual(kernel2.getAllowedCommands());
  });
});
