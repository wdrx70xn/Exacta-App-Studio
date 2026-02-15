import { describe, it, expect, vi, beforeEach } from "vitest";
import { projectFileSystem } from "../providers/dotnet/ProjectFileSystem";
import fs from "fs-extra";

vi.mock("fs-extra");

describe("ProjectFileSystem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateNamespace", () => {
    it("should generate root namespace for top-level files", () => {
      const ns = projectFileSystem.generateNamespace(
        "MyApp",
        "MainWindow.xaml",
      );
      expect(ns).toBe("MyApp");
    });

    it("should generate nested namespace for files in subfolders", () => {
      const ns = projectFileSystem.generateNamespace(
        "MyApp",
        "Views/Main/Home.xaml",
      );
      expect(ns).toBe("MyApp.Views.Main");
    });

    it("should sanitize identifiers", () => {
      const ns = projectFileSystem.generateNamespace(
        "My-App",
        "My View/Page-1.xaml",
      );
      expect(ns).toBe("My_App.My_View");
    });
  });

  describe("syncCsproj", () => {
    it("should add missing file references to .csproj", async () => {
      const csprojPath = "test.csproj";
      const initialContent = `<Project Sdk="Microsoft.NET.Sdk.WindowsDesktop">\n  <PropertyGroup>\n    <OutputType>WinExe</OutputType>\n  </PropertyGroup>\n</Project>`;

      vi.mocked(fs.pathExists).mockResolvedValue(true as never);
      vi.mocked(fs.readFile).mockResolvedValue(initialContent as never);
      const writeFileSpy = vi
        .mocked(fs.writeFile)
        .mockResolvedValue(undefined as never);

      await projectFileSystem.syncCsproj(csprojPath, [
        { path: "Models/User.cs", type: "csharp" },
        { path: "Views/Main.xaml", type: "xaml" },
      ]);

      expect(writeFileSpy).toHaveBeenCalled();
      const calledContent = writeFileSpy.mock.calls[0][1] as string;
      expect(calledContent).toContain('<Compile Include="Models\\User.cs" />');
      expect(calledContent).toContain('<Page Include="Views\\Main.xaml" />');
    });

    it("should not duplicate existing references", async () => {
      const csprojPath = "test.csproj";
      const initialContent = `<Project Sdk="Microsoft.NET.Sdk.WindowsDesktop">\n  <ItemGroup>\n    <Compile Include="Models\\User.cs" />\n  </ItemGroup>\n</Project>`;

      vi.mocked(fs.pathExists).mockResolvedValue(true as never);
      vi.mocked(fs.readFile).mockResolvedValue(initialContent as never);
      const writeFileSpy = vi.mocked(fs.writeFile);

      await projectFileSystem.syncCsproj(csprojPath, [
        { path: "Models/User.cs", type: "csharp" },
      ]);

      expect(writeFileSpy).not.toHaveBeenCalled();
    });
  });

  describe("pairXaml", () => {
    it("should update x:Class attribute if it doesn't match expected namespace", async () => {
      const xamlPath = "Views/Main.xaml";
      const content = `<Window x:Class="OldNamespace.OldClass" xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation">\n</Window>`;

      vi.mocked(fs.pathExists).mockResolvedValue(true as never);
      vi.mocked(fs.readFile).mockResolvedValue(content as never);
      const writeFileSpy = vi
        .mocked(fs.writeFile)
        .mockResolvedValue(undefined as never);

      await projectFileSystem.pairXaml(xamlPath, "MyApp");

      expect(writeFileSpy).toHaveBeenCalledWith(
        xamlPath,
        expect.stringContaining('x:Class="MyApp.Views.Main"'),
        "utf-8",
      );
    });

    it("should insert x:Class attribute if missing", async () => {
      const xamlPath = "Views/Main.xaml";
      const content = `<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation">\n</Window>`;

      vi.mocked(fs.pathExists).mockResolvedValue(true as never);
      vi.mocked(fs.readFile).mockResolvedValue(content as never);
      const writeFileSpy = vi
        .mocked(fs.writeFile)
        .mockResolvedValue(undefined as never);

      await projectFileSystem.pairXaml(xamlPath, "MyApp");

      expect(writeFileSpy).toHaveBeenCalledWith(
        xamlPath,
        expect.stringContaining('x:Class="MyApp.Views.Main"'),
        "utf-8",
      );
    });
  });
});
