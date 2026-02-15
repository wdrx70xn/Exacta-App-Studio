/**
 * Unit tests for DotNetRuntimeProvider scaffold functionality
 *
 * Feature: windows-native-app-builder
 * Tests project scaffolding for WPF, WinUI3, and WinForms
 *
 * Requirements tested:
 * - 1.1: Create complete project structure
 * - 1.2: Use appropriate templates for framework type
 * - 1.3: Include all required configuration files
 * - 1.5: Create valid .csproj file
 * - 7.4: Create complete project structure with all files
 * - 8.1: Error handling for invalid inputs
 */

import os from "node:os";
import path from "node:path";
import fs from "fs-extra";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { dotNetRuntimeProvider } from "../providers/DotNetRuntimeProvider";

describe("DotNetRuntimeProvider - Scaffold", () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create a temporary directory for each test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "dotnet-scaffold-test-"));
  });

  afterEach(async () => {
    // Clean up temporary directory after each test
    await fs.remove(tempDir);
  });

  describe("WPF Project Scaffolding", () => {
    it("should scaffold a complete WPF project", async () => {
      const projectName = "MyWpfApp";
      const fullAppPath = path.join(tempDir, projectName);

      const result = await dotNetRuntimeProvider.scaffold({
        projectName,
        fullAppPath,
        templateId: "wpf",
      });

      expect(result.success).toBe(true);
      expect(result.entryPoint).toBe(`${projectName}.csproj`);

      // Verify directory was created
      expect(await fs.pathExists(fullAppPath)).toBe(true);

      // Verify .csproj file exists
      const csprojPath = path.join(fullAppPath, `${projectName}.csproj`);
      expect(await fs.pathExists(csprojPath)).toBe(true);

      // Verify App.xaml exists
      const appXamlPath = path.join(fullAppPath, "App.xaml");
      expect(await fs.pathExists(appXamlPath)).toBe(true);

      // Verify App.xaml.cs exists
      const appCsPath = path.join(fullAppPath, "App.xaml.cs");
      expect(await fs.pathExists(appCsPath)).toBe(true);

      // Verify MainWindow.xaml exists
      const mainWindowXamlPath = path.join(fullAppPath, "MainWindow.xaml");
      expect(await fs.pathExists(mainWindowXamlPath)).toBe(true);

      // Verify MainWindow.xaml.cs exists
      const mainWindowCsPath = path.join(fullAppPath, "MainWindow.xaml.cs");
      expect(await fs.pathExists(mainWindowCsPath)).toBe(true);
    });

    it("should create valid WPF .csproj file with correct content", async () => {
      const projectName = "MyWpfApp";
      const fullAppPath = path.join(tempDir, projectName);

      await dotNetRuntimeProvider.scaffold({
        projectName,
        fullAppPath,
        templateId: "wpf",
      });

      const csprojPath = path.join(fullAppPath, `${projectName}.csproj`);
      const csprojContent = await fs.readFile(csprojPath, "utf-8");

      // Verify it's valid XML
      expect(csprojContent).toContain('<Project Sdk="Microsoft.NET.Sdk">');
      expect(csprojContent).toContain("<OutputType>WinExe</OutputType>");
      expect(csprojContent).toContain("<UseWPF>true</UseWPF>");
      expect(csprojContent).toContain(
        "<TargetFramework>net8.0-windows</TargetFramework>",
      );
    });

    it("should create valid WPF App.xaml with correct namespace", async () => {
      const projectName = "MyWpfApp";
      const fullAppPath = path.join(tempDir, projectName);

      await dotNetRuntimeProvider.scaffold({
        projectName,
        fullAppPath,
        templateId: "wpf",
      });

      const appXamlPath = path.join(fullAppPath, "App.xaml");
      const appXamlContent = await fs.readFile(appXamlPath, "utf-8");

      expect(appXamlContent).toContain('x:Class="MyWpfApp.App"');
      expect(appXamlContent).toContain('StartupUri="MainWindow.xaml"');
    });

    it("should create valid WPF code-behind files", async () => {
      const projectName = "MyWpfApp";
      const fullAppPath = path.join(tempDir, projectName);

      await dotNetRuntimeProvider.scaffold({
        projectName,
        fullAppPath,
        templateId: "wpf",
      });

      const appCsPath = path.join(fullAppPath, "App.xaml.cs");
      const appCsContent = await fs.readFile(appCsPath, "utf-8");

      expect(appCsContent).toContain("namespace MyWpfApp");
      expect(appCsContent).toContain("public partial class App : Application");

      const mainWindowCsPath = path.join(fullAppPath, "MainWindow.xaml.cs");
      const mainWindowCsContent = await fs.readFile(mainWindowCsPath, "utf-8");

      expect(mainWindowCsContent).toContain("namespace MyWpfApp");
      expect(mainWindowCsContent).toContain(
        "public partial class MainWindow : Window",
      );
    });
  });

  describe("WinUI3 Project Scaffolding", () => {
    it("should scaffold a complete WinUI3 project", async () => {
      const projectName = "MyWinUI3App";
      const fullAppPath = path.join(tempDir, projectName);

      const result = await dotNetRuntimeProvider.scaffold({
        projectName,
        fullAppPath,
        templateId: "winui3",
      });

      expect(result.success).toBe(true);
      expect(result.entryPoint).toBe(`${projectName}.csproj`);

      // Verify all required files exist
      expect(
        await fs.pathExists(path.join(fullAppPath, `${projectName}.csproj`)),
      ).toBe(true);
      expect(await fs.pathExists(path.join(fullAppPath, "App.xaml"))).toBe(
        true,
      );
      expect(await fs.pathExists(path.join(fullAppPath, "App.xaml.cs"))).toBe(
        true,
      );
      expect(
        await fs.pathExists(path.join(fullAppPath, "MainWindow.xaml")),
      ).toBe(true);
      expect(
        await fs.pathExists(path.join(fullAppPath, "MainWindow.xaml.cs")),
      ).toBe(true);
      expect(await fs.pathExists(path.join(fullAppPath, "app.manifest"))).toBe(
        true,
      );
    });

    it("should create WinUI3 .csproj with WindowsAppSDK references", async () => {
      const projectName = "MyWinUI3App";
      const fullAppPath = path.join(tempDir, projectName);

      await dotNetRuntimeProvider.scaffold({
        projectName,
        fullAppPath,
        templateId: "winui3",
      });

      const csprojPath = path.join(fullAppPath, `${projectName}.csproj`);
      const csprojContent = await fs.readFile(csprojPath, "utf-8");

      expect(csprojContent).toContain("<UseWinUI>true</UseWinUI>");
      expect(csprojContent).toContain("Microsoft.WindowsAppSDK");
      expect(csprojContent).toContain("Microsoft.Windows.SDK.BuildTools");
    });

    it("should create valid WinUI3 app.manifest", async () => {
      const projectName = "MyWinUI3App";
      const fullAppPath = path.join(tempDir, projectName);

      await dotNetRuntimeProvider.scaffold({
        projectName,
        fullAppPath,
        templateId: "winui3",
      });

      const manifestPath = path.join(fullAppPath, "app.manifest");
      const manifestContent = await fs.readFile(manifestPath, "utf-8");

      expect(manifestContent).toContain('<assembly manifestVersion="1.0"');
      expect(manifestContent).toContain("dpiAwareness");
    });
  });

  describe("WinForms Project Scaffolding", () => {
    it("should scaffold a complete WinForms project", async () => {
      const projectName = "MyWinFormsApp";
      const fullAppPath = path.join(tempDir, projectName);

      const result = await dotNetRuntimeProvider.scaffold({
        projectName,
        fullAppPath,
        templateId: "winforms",
      });

      expect(result.success).toBe(true);
      expect(result.entryPoint).toBe(`${projectName}.csproj`);

      // Verify all required files exist
      expect(
        await fs.pathExists(path.join(fullAppPath, `${projectName}.csproj`)),
      ).toBe(true);
      expect(await fs.pathExists(path.join(fullAppPath, "Program.cs"))).toBe(
        true,
      );
      expect(await fs.pathExists(path.join(fullAppPath, "Form1.cs"))).toBe(
        true,
      );
    });

    it("should create valid WinForms Program.cs with entry point", async () => {
      const projectName = "MyWinFormsApp";
      const fullAppPath = path.join(tempDir, projectName);

      await dotNetRuntimeProvider.scaffold({
        projectName,
        fullAppPath,
        templateId: "winforms",
      });

      const programCsPath = path.join(fullAppPath, "Program.cs");
      const programCsContent = await fs.readFile(programCsPath, "utf-8");

      expect(programCsContent).toContain("[STAThread]");
      expect(programCsContent).toContain("static void Main()");
      expect(programCsContent).toContain("Application.Run");
    });

    it("should create valid WinForms .csproj with UseWindowsForms", async () => {
      const projectName = "MyWinFormsApp";
      const fullAppPath = path.join(tempDir, projectName);

      await dotNetRuntimeProvider.scaffold({
        projectName,
        fullAppPath,
        templateId: "winforms",
      });

      const csprojPath = path.join(fullAppPath, `${projectName}.csproj`);
      const csprojContent = await fs.readFile(csprojPath, "utf-8");

      expect(csprojContent).toContain(
        "<UseWindowsForms>true</UseWindowsForms>",
      );
      expect(csprojContent).toContain("<OutputType>WinExe</OutputType>");
    });
  });

  describe("Console Project Scaffolding", () => {
    it("should scaffold a complete Console project", async () => {
      const projectName = "MyConsoleApp";
      const fullAppPath = path.join(tempDir, projectName);

      const result = await dotNetRuntimeProvider.scaffold({
        projectName,
        fullAppPath,
        templateId: "console",
      });

      expect(result.success).toBe(true);

      expect(
        await fs.pathExists(path.join(fullAppPath, `${projectName}.csproj`)),
      ).toBe(true);
      expect(await fs.pathExists(path.join(fullAppPath, "Program.cs"))).toBe(
        true,
      );
    });

    it("should create Console .csproj with Exe output type", async () => {
      const projectName = "MyConsoleApp";
      const fullAppPath = path.join(tempDir, projectName);

      await dotNetRuntimeProvider.scaffold({
        projectName,
        fullAppPath,
        templateId: "console",
      });

      const csprojPath = path.join(fullAppPath, `${projectName}.csproj`);
      const csprojContent = await fs.readFile(csprojPath, "utf-8");

      expect(csprojContent).toContain("<OutputType>Exe</OutputType>");
      expect(csprojContent).not.toContain("<UseWPF>true</UseWPF>");
      expect(csprojContent).not.toContain(
        "<UseWindowsForms>true</UseWindowsForms>",
      );
    });
  });

  describe("Error Handling", () => {
    it("should fail with error for invalid framework type", async () => {
      const projectName = "MyApp";
      const fullAppPath = path.join(tempDir, projectName);

      const result = await dotNetRuntimeProvider.scaffold({
        projectName,
        fullAppPath,
        templateId: "invalid-framework",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unknown framework type");
      expect(result.error).toContain("invalid-framework");
    });

    it("should handle special characters in project name", async () => {
      const projectName = "My-App_123";
      const fullAppPath = path.join(tempDir, projectName);

      const result = await dotNetRuntimeProvider.scaffold({
        projectName,
        fullAppPath,
        templateId: "wpf",
      });

      expect(result.success).toBe(true);

      // Verify files were created
      expect(await fs.pathExists(fullAppPath)).toBe(true);
    });

    it("should default to WPF when templateId is not specified", async () => {
      const projectName = "MyDefaultApp";
      const fullAppPath = path.join(tempDir, projectName);

      const result = await dotNetRuntimeProvider.scaffold({
        projectName,
        fullAppPath,
        // No templateId specified
      });

      expect(result.success).toBe(true);

      // Verify it's a WPF project (has XAML files)
      expect(await fs.pathExists(path.join(fullAppPath, "App.xaml"))).toBe(
        true,
      );
      expect(
        await fs.pathExists(path.join(fullAppPath, "MainWindow.xaml")),
      ).toBe(true);
    });
  });

  describe("Project Structure Completeness", () => {
    it("should create projects with no unreplaced placeholders", async () => {
      const frameworks = ["wpf", "winui3", "winforms", "console"];

      for (const framework of frameworks) {
        const projectName = `Test${framework}`;
        const fullAppPath = path.join(tempDir, projectName);

        await dotNetRuntimeProvider.scaffold({
          projectName,
          fullAppPath,
          templateId: framework,
        });

        // Read all files and check for placeholders
        const files = await fs.readdir(fullAppPath, { recursive: true });
        for (const file of files) {
          const filePath = path.join(fullAppPath, file as string);
          const stat = await fs.stat(filePath);

          if (stat.isFile()) {
            const content = await fs.readFile(filePath, "utf-8");
            expect(content).not.toContain("{{ProjectName}}");
            expect(content).not.toContain("{{Namespace}}");
            expect(content).not.toContain("{{TargetFramework}}");
          }
        }
      }
    });

    it("should create valid XML in XAML files for WPF", async () => {
      const projectName = "MyWpfApp";
      const fullAppPath = path.join(tempDir, projectName);

      await dotNetRuntimeProvider.scaffold({
        projectName,
        fullAppPath,
        templateId: "wpf",
      });

      const xamlFiles = ["App.xaml", "MainWindow.xaml"];

      for (const xamlFile of xamlFiles) {
        const xamlPath = path.join(fullAppPath, xamlFile);
        const content = await fs.readFile(xamlPath, "utf-8");

        // Basic XML validation
        expect(content.trim().startsWith("<")).toBe(true);
        expect(content).toContain(
          'xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"',
        );
      }
    });

    it("should create valid XML in .csproj files", async () => {
      const frameworks = ["wpf", "winui3", "winforms", "console"];

      for (const framework of frameworks) {
        const projectName = `Test${framework}`;
        const fullAppPath = path.join(tempDir, projectName);

        await dotNetRuntimeProvider.scaffold({
          projectName,
          fullAppPath,
          templateId: framework,
        });

        const csprojPath = path.join(fullAppPath, `${projectName}.csproj`);
        const content = await fs.readFile(csprojPath, "utf-8");

        // Basic XML validation
        expect(content.trim().startsWith("<Project")).toBe(true);
        expect(content).toContain("</Project>");
      }
    });
  });
});
