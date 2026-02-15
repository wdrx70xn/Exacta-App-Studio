import { describe, it, expect, vi, beforeEach } from "vitest";
import { projectFileSystem } from "../providers/dotnet/ProjectFileSystem";
import fs from "fs-extra";

vi.mock("fs-extra");

describe("ProjectFileSystem - Property Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should maintain namespace consistency regardless of path depth", async () => {
    // Property 19: Project Organization Consistency
    const testCases = [
      {
        project: "MyApp",
        path: "View/Home/Page.xaml",
        expected: "MyApp.View.Home",
      },
      {
        project: "My_App",
        path: "Data/Models/User.cs",
        expected: "My_App.Data.Models",
      },
      { project: "App", path: "Main.xaml", expected: "App" },
      {
        project: "Deep",
        path: "A/B/C/D/E/file.cs",
        expected: "Deep.A.B.C.D.E",
      },
    ];

    for (const { project, path, expected } of testCases) {
      const ns = projectFileSystem.generateNamespace(project, path);
      expect(ns).toBe(expected);
    }
  });

  it("should successfully synchronize .csproj for a sequence of files", async () => {
    // Property 18: Project File Synchronization
    const csprojPath = "test.csproj";
    const initialContent = `<Project Sdk="Microsoft.NET.Sdk">\n</Project>`;

    vi.mocked(fs.pathExists).mockResolvedValue(true as never);
    vi.mocked(fs.readFile).mockResolvedValue(initialContent as never);
    let currentContent = initialContent;

    vi.mocked(fs.writeFile).mockImplementation(async (path, content) => {
      currentContent = content as string;
      return undefined;
    });

    const files: any[] = [
      { path: "View/Main.xaml", type: "xaml" },
      { path: "Model/User.cs", type: "csharp" },
      { path: "Assets/icon.png", type: "resource" },
    ];

    await projectFileSystem.syncCsproj(csprojPath, files);

    for (const file of files) {
      const normalizedPath = file.path.replace(/\//g, "\\");
      expect(currentContent).toContain(`Include="${normalizedPath}"`);
    }

    expect(currentContent).toContain("</Project>");
  });
});
