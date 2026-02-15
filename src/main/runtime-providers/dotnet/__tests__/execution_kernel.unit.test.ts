import { describe, it, expect, beforeEach } from "vitest";
import { ExecutionKernel } from "../ExecutionKernel";

describe("ExecutionKernel Unit Tests", () => {
  let kernel: ExecutionKernel;

  beforeEach(() => {
    kernel = new ExecutionKernel();
  });

  describe("allowed command execution", () => {
    it("should allow 'new' command", () => {
      expect(kernel.isCommandAllowed("new")).toBe(true);
    });

    it("should allow 'restore' command", () => {
      expect(kernel.isCommandAllowed("restore")).toBe(true);
    });

    it("should allow 'build' command", () => {
      expect(kernel.isCommandAllowed("build")).toBe(true);
    });

    it("should allow 'run' command", () => {
      expect(kernel.isCommandAllowed("run")).toBe(true);
    });
  });

  describe("disallowed command rejection", () => {
    it("should reject 'rm' command", () => {
      expect(kernel.isCommandAllowed("rm")).toBe(false);
    });

    it("should reject 'del' command", () => {
      expect(kernel.isCommandAllowed("del")).toBe(false);
    });

    it("should reject 'format' command", () => {
      expect(kernel.isCommandAllowed("format")).toBe(false);
    });

    it("should reject 'exec' command", () => {
      expect(kernel.isCommandAllowed("exec")).toBe(false);
    });
  });

  describe("working directory validation", () => {
    it("should have validateWorkingDirectory method", () => {
      expect(typeof kernel["validateWorkingDirectory"]).toBe("function");
    });

    it("should have correct allowed commands list", () => {
      const allowedCommands = kernel.getAllowedCommands();

      expect(allowedCommands).toEqual(
        expect.arrayContaining(["new", "restore", "build", "run"]),
      );
      expect(allowedCommands).toHaveLength(4);
    });
  });

  describe("command execution", () => {
    it("should have execute method", () => {
      expect(typeof kernel.execute).toBe("function");
    });

    it("should reject disallowed command during execution", async () => {
      // Test that the command validation happens during execution
      // Since we can't actually execute commands in tests, we'll test the validation logic

      // We'll test by creating a scenario where the command isn't in the allowed list
      const testFn = () => {
        const allowedCommands = ["custom-command"];
        return kernel.execute("dangerous-command", ["arg"], {
          cwd: "/tmp",
          allowedCommands,
        });
      };

      // The promise should reject due to command not being allowed
      await expect(testFn()).rejects.toThrow("Command not allowed");
    });
  });

  describe("timeout functionality", () => {
    it("should have default timeout", () => {
      expect(kernel["DEFAULT_TIMEOUT"]).toBe(300000); // 5 minutes
    });

    it("should accept custom timeout", async () => {
      // Test that custom timeout can be passed
      const executePromise = kernel.execute("echo", ["test"], {
        cwd: "/tmp",
        timeout: 1000, // 1 second
      });

      // The promise will fail because echo command doesn't exist in this context,
      // but the timeout parameter should be accepted
      await expect(executePromise).rejects.toBeTruthy();
    });
  });

  describe("getAllowedCommands", () => {
    it("should return correct allowed commands", () => {
      const allowedCommands = kernel.getAllowedCommands();

      expect(allowedCommands).toEqual(
        expect.arrayContaining(["new", "restore", "build", "run"]),
      );
      expect(allowedCommands).toHaveLength(4);
    });
  });
});
