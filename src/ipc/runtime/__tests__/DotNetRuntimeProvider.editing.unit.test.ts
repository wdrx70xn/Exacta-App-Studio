import { describe, it, expect, vi, beforeEach } from "vitest";
import { editValidator } from "../providers/dotnet/EditValidator";
import { dotNetRuntimeProvider } from "../providers/DotNetRuntimeProvider";
import fs from "fs-extra";
import path from "node:path";

vi.mock("fs-extra");

describe("DotNetRuntimeProvider - Iterative Editing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("EditValidator", () => {
    it("should validate healthy XAML", () => {
      const xaml = `<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"><Grid></Grid></Window>`;
      const result = editValidator.validateXaml(xaml);
      expect(result.isValid).toBe(true);
    });

    it("should reject XAML without namespaces", () => {
      const xaml = `<Window><Grid></Grid></Window>`;
      const result = editValidator.validateXaml(xaml);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("namespaces");
    });

    it("should reject unbalanced XAML", () => {
      const xaml = `<Window xmlns="..."><Grid></Window>`;
      const result = editValidator.validateXaml(xaml);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("unbalanced");
    });

    it("should validate healthy C#", () => {
      const code = `using System;
using System.Windows;

namespace MyApp {
    public class Test {
        public void DoSomething() {
            Console.WriteLine("Hello World");
        }
    }
}`;
      const result = editValidator.validateCSharp(code);
      expect(result.isValid).toBe(true);
    });

    it("should reject C# without class", () => {
      const code = `using System;
using System.Collections.Generic;
using System.Linq;

namespace MyApp {
    // This file intentionally has no actual C# type definition to test validation
    // Adding some comments to make it longer than 50 characters.
}`;
      const result = editValidator.validateCSharp(code);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("class definition");
    });
  });

  describe("applyEdit", () => {
    it("should apply a valid XAML edit and sync project", async () => {
      const options = {
        appId: 1,
        appPath: "/test/app",
        filePath: "Views/Main.xaml",
        content: `<Window xmlns="..."><Button>Click Me</Button></Window>`,
        projectName: "MyApp",
      };

      vi.mocked(fs.pathExists).mockResolvedValue(true as never);
      vi.mocked(fs.readFile).mockResolvedValue("<Project></Project>" as never);
      const writeFileSpy = vi
        .mocked(fs.writeFile)
        .mockResolvedValue(undefined as never);

      // Mock the state
      (dotNetRuntimeProvider as any).setProjectState(1, {
        projectPath: "/test/app",
        projectName: "MyApp",
        framework: "WPF",
        files: new Map(),
      });

      const result = await (dotNetRuntimeProvider as any).applyEdit(options);

      expect(result.success).toBe(true);
      expect(writeFileSpy).toHaveBeenCalled();
      // Verify syncCsproj was called (implicitly by checking writeFile on .csproj)
      const csprojPath = path.normalize("/test/app/MyApp.csproj");
      expect(writeFileSpy).toHaveBeenCalledWith(
        csprojPath,
        expect.any(String),
        "utf-8",
      );
    });

    it("should reject invalid XAML edit", async () => {
      const options = {
        appId: 1,
        appPath: "/test/app",
        filePath: "Views/Main.xaml",
        content: `<Window>No Namespace</Window>`,
        projectName: "MyApp",
      };

      const result = await (dotNetRuntimeProvider as any).applyEdit(options);
      expect(result.success).toBe(false);
      expect(result.error).toContain("namespaces");
    });
  });
});
