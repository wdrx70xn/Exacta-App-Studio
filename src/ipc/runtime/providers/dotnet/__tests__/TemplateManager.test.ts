/**
 * Unit tests for TemplateManager
 *
 * Tests template loading, instantiation, and placeholder replacement
 * for WPF, WinUI3, and WinForms frameworks.
 */

import { describe, expect, it } from "vitest";
import { templateManager } from "../TemplateManager";

describe("TemplateManager", () => {
  describe("Template Loading", () => {
    it("should have templates for all supported frameworks", () => {
      const frameworks = templateManager.getAvailableFrameworks();
      expect(frameworks).toContain("wpf");
      expect(frameworks).toContain("winui3");
      expect(frameworks).toContain("winforms");
      expect(frameworks).toContain("console");
    });

    it("should return template for WPF", () => {
      const template = templateManager.getTemplate("wpf");
      expect(template).toBeDefined();
      expect(template?.framework).toBe("WPF");
      expect(template?.targetFramework).toBe("net8.0-windows");
      expect(template?.outputType).toBe("WinExe");
    });

    it("should return template for WinUI3", () => {
      const template = templateManager.getTemplate("winui3");
      expect(template).toBeDefined();
      expect(template?.framework).toBe("WinUI3");
      expect(template?.targetFramework).toBe("net8.0-windows10.0.19041.0");
      expect(template?.outputType).toBe("WinExe");
    });

    it("should return template for WinForms", () => {
      const template = templateManager.getTemplate("winforms");
      expect(template).toBeDefined();
      expect(template?.framework).toBe("WinForms");
      expect(template?.targetFramework).toBe("net8.0-windows");
      expect(template?.outputType).toBe("WinExe");
    });

    it("should return template for Console", () => {
      const template = templateManager.getTemplate("console");
      expect(template).toBeDefined();
      expect(template?.framework).toBe("Console");
      expect(template?.targetFramework).toBe("net8.0");
      expect(template?.outputType).toBe("Exe");
    });

    it("should return undefined for unknown framework", () => {
      const template = templateManager.getTemplate("unknown");
      expect(template).toBeUndefined();
    });

    it("should handle case-insensitive framework names", () => {
      expect(templateManager.hasTemplate("WPF")).toBe(true);
      expect(templateManager.hasTemplate("wpf")).toBe(true);
      expect(templateManager.hasTemplate("WinUI3")).toBe(true);
      expect(templateManager.hasTemplate("winui3")).toBe(true);
      expect(templateManager.hasTemplate("WinForms")).toBe(true);
      expect(templateManager.hasTemplate("winforms")).toBe(true);
    });
  });

  describe("Template Instantiation", () => {
    it("should instantiate WPF template with project name", () => {
      const template = templateManager.getTemplate("wpf")!;
      const instantiated = templateManager.instantiateTemplate(
        template,
        "MyApp",
      );

      expect(instantiated.framework).toBe("WPF");
      expect(instantiated.files.length).toBeGreaterThan(0);

      // Check that files have correct paths
      const csprojFile = instantiated.files.find((f) =>
        f.path.endsWith(".csproj"),
      );
      expect(csprojFile).toBeDefined();
      expect(csprojFile?.path).toBe("MyApp.csproj");
    });

    it("should replace {{ProjectName}} placeholder", () => {
      const template = templateManager.getTemplate("wpf")!;
      const instantiated = templateManager.instantiateTemplate(
        template,
        "MyApp",
      );

      // Check no unreplaced placeholders
      for (const file of instantiated.files) {
        expect(file.content).not.toContain("{{ProjectName}}");
        expect(file.path).not.toContain("{{ProjectName}}");
      }

      // Check content has the project name
      const mainWindow = instantiated.files.find((f) =>
        f.path.includes("MainWindow.xaml"),
      );
      expect(mainWindow?.content).toContain("MyApp");
    });

    it("should replace {{Namespace}} placeholder with custom namespace", () => {
      const template = templateManager.getTemplate("wpf")!;
      const instantiated = templateManager.instantiateTemplate(
        template,
        "MyApp",
        "MyCompany.MyProduct",
      );

      const appCs = instantiated.files.find((f) => f.path === "App.xaml.cs");
      expect(appCs?.content).toContain("namespace MyCompany.MyProduct");
      expect(appCs?.content).not.toContain("{{Namespace}}");
    });

    it("should use project name as default namespace when not provided", () => {
      const template = templateManager.getTemplate("wpf")!;
      const instantiated = templateManager.instantiateTemplate(
        template,
        "MyApp",
      );

      const appCs = instantiated.files.find((f) => f.path === "App.xaml.cs");
      expect(appCs?.content).toContain("namespace MyApp");
    });

    it("should replace {{TargetFramework}} placeholder", () => {
      const template = templateManager.getTemplate("wpf")!;
      const instantiated = templateManager.instantiateTemplate(
        template,
        "MyApp",
      );

      const csproj = instantiated.files.find((f) => f.path.endsWith(".csproj"));
      expect(csproj?.content).toContain("net8.0-windows");
      expect(csproj?.content).not.toContain("{{TargetFramework}}");
    });

    it("should instantiate WinUI3 template with correct package references", () => {
      const template = templateManager.getTemplate("winui3")!;
      const instantiated = templateManager.instantiateTemplate(
        template,
        "MyApp",
      );

      expect(instantiated.packageReferences.length).toBeGreaterThan(0);
      expect(
        instantiated.packageReferences.some((p) =>
          p.name.includes("WindowsAppSDK"),
        ),
      ).toBe(true);
    });

    it("should include app.manifest for WinUI3", () => {
      const template = templateManager.getTemplate("winui3")!;
      const instantiated = templateManager.instantiateTemplate(
        template,
        "MyApp",
      );

      const manifest = instantiated.files.find((f) =>
        f.path.endsWith(".manifest"),
      );
      expect(manifest).toBeDefined();
      expect(manifest?.type).toBe("manifest");
    });

    it("should instantiate WinForms template with correct structure", () => {
      const template = templateManager.getTemplate("winforms")!;
      const instantiated = templateManager.instantiateTemplate(
        template,
        "MyFormsApp",
      );

      expect(instantiated.files.length).toBe(3); // csproj, Program.cs, Form1.cs

      const programCs = instantiated.files.find((f) => f.path === "Program.cs");
      expect(programCs).toBeDefined();
      expect(programCs?.content).toContain("Application.Run");

      const formCs = instantiated.files.find((f) => f.path === "Form1.cs");
      expect(formCs).toBeDefined();
      expect(formCs?.content).toContain("class Form1");
    });

    it("should instantiate Console template with correct output type", () => {
      const template = templateManager.getTemplate("console")!;
      const instantiated = templateManager.instantiateTemplate(
        template,
        "MyConsoleApp",
      );

      expect(instantiated.outputType).toBe("Exe");
      expect(instantiated.files.length).toBe(2);
    });
  });

  describe("Project Name Sanitization", () => {
    it("should handle valid project names", () => {
      const template = templateManager.getTemplate("wpf")!;

      const validNames = ["MyApp", "App123", "My_App", "A"];
      for (const name of validNames) {
        expect(() => {
          templateManager.instantiateTemplate(template, name);
        }).not.toThrow();
      }
    });

    it("should handle project names with special characters", () => {
      const template = templateManager.getTemplate("wpf")!;

      // Should not throw on special characters
      expect(() => {
        templateManager.instantiateTemplate(template, "My App");
        templateManager.instantiateTemplate(template, "My-App");
        templateManager.instantiateTemplate(template, "My.App");
      }).not.toThrow();
    });

    it("should handle project names starting with numbers", () => {
      const template = templateManager.getTemplate("wpf")!;

      expect(() => {
        templateManager.instantiateTemplate(template, "123App");
      }).not.toThrow();
    });
  });

  describe("Template File Types", () => {
    it("should have correct file types for WPF files", () => {
      const template = templateManager.getTemplate("wpf")!;

      const csproj = template.files.find((f) => f.path.includes(".csproj"));
      expect(csproj?.type).toBe("project");

      const xamlFiles = template.files.filter((f) => f.path.endsWith(".xaml"));
      for (const file of xamlFiles) {
        expect(file.type).toBe("xaml");
      }

      const csFiles = template.files.filter((f) => f.path.endsWith(".cs"));
      for (const file of csFiles) {
        expect(file.type).toBe("csharp");
      }
    });

    it("should have correct file types for WinForms files", () => {
      const template = templateManager.getTemplate("winforms")!;

      const csproj = template.files.find((f) => f.path.includes(".csproj"));
      expect(csproj?.type).toBe("project");

      const csFiles = template.files.filter((f) => f.path.endsWith(".cs"));
      for (const file of csFiles) {
        expect(file.type).toBe("csharp");
      }
    });
  });

  describe("Template Package References", () => {
    it("should have no package references for WPF", () => {
      const template = templateManager.getTemplate("wpf")!;
      expect(template.packageReferences.length).toBe(0);
    });

    it("should have WindowsAppSDK reference for WinUI3", () => {
      const template = templateManager.getTemplate("winui3")!;
      expect(template.packageReferences.length).toBe(2);

      const winAppSdk = template.packageReferences.find((p) =>
        p.name.includes("WindowsAppSDK"),
      );
      expect(winAppSdk).toBeDefined();
      expect(winAppSdk?.version).toBeDefined();
    });

    it("should have no package references for WinForms", () => {
      const template = templateManager.getTemplate("winforms")!;
      expect(template.packageReferences.length).toBe(0);
    });

    it("should have no package references for Console", () => {
      const template = templateManager.getTemplate("console")!;
      expect(template.packageReferences.length).toBe(0);
    });
  });
});
