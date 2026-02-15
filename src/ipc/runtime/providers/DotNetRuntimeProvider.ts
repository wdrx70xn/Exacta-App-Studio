// src/ipc/runtime/providers/DotNetRuntimeProvider.ts
// .NET runtime implementation for Windows desktop apps
// Supports: WPF, WinUI 3, WinForms, Console, MAUI (Windows-only)

import path from "node:path";
import fs from "fs-extra";
import {
  type ExecutionResult,
  executionKernel,
} from "../../security/execution_kernel";
import type {
  BuildOptions,
  BuildResult,
  PackageOptions,
  PreviewOptions,
  RiskProfile,
  RunOptions,
  RunResult,
  RuntimeProvider,
  ScaffoldOptions,
  ScaffoldResult,
} from "../RuntimeProvider";
import { templateManager } from "./dotnet/TemplateManager";
import { projectFileSystem } from "./dotnet/ProjectFileSystem";
import { editValidator } from "./dotnet/EditValidator";
import type {
  CompilerError,
  ErrorResponse,
  ProjectState,
} from "./dotnet/types";

// Type for event handlers
type ExecutionEventHandler = (event: {
  type: "stdout" | "stderr";
  message: string;
  timestamp: number;
}) => void;

// Project state management
class DotNetRuntimeProviderImpl implements RuntimeProvider {
  private projectStates: Map<number, ProjectState> = new Map();

  readonly runtimeId = "dotnet";
  readonly runtimeName = ".NET";
  readonly supportedStackTypes = [
    "wpf",
    "winui3",
    "winforms",
    "console",
    "maui",
  ];
  readonly previewStrategy = "external-window" as const;
  readonly diskQuotaBytes = 5 * 1024 * 1024 * 1024; // 5GB for .NET (larger builds)

  // .NET project templates
  private readonly DOTNET_TEMPLATES: Record<string, string> = {
    wpf: "wpf",
    winui3: "winui3",
    winforms: "winforms",
    console: "console",
    maui: "maui",
  };

  private getProjectState(appId: number): ProjectState | undefined {
    return this.projectStates.get(appId);
  }

  private setProjectState(appId: number, state: ProjectState): void {
    this.projectStates.set(appId, state);
  }

  private parseCompilerErrors(stderr: string): CompilerError[] {
    const errors: CompilerError[] = [];
    const lines = stderr.split("\n");

    for (const line of lines) {
      // Try MSBuild error format first: path(line,col): error CODE: message
      let match = line.match(
        /^(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+([A-Z]+\d+):\s+(.+)$/,
      );

      if (match) {
        errors.push({
          file: match[1],
          line: Number.parseInt(match[2]),
          column: Number.parseInt(match[3]),
          severity: match[4] as "error" | "warning",
          code: match[5],
          message: match[6],
        });
        continue;
      }

      // Try simple format: error CODE: message (without file info)
      match = line.match(/^(error|warning)\s+([A-Z]+\d+):\s+(.+)$/);
      if (match) {
        errors.push({
          file: "",
          line: 0,
          column: 0,
          severity: match[1] as "error" | "warning",
          code: match[2],
          message: match[3],
        });
      }
    }

    return errors;
  }

  private createErrorResponse(
    category: ErrorResponse["category"],
    code: string,
    message: string,
    details?: Partial<ErrorResponse["details"]>,
  ): ErrorResponse {
    return {
      category,
      code,
      message,
      details: {
        file: details?.file,
        line: details?.line,
        column: details?.column,
        stackTrace: details?.stackTrace,
        innerError: details?.innerError,
      },
      timestamp: new Date(),
    };
  }

  // Helper function to determine entry point
  private getEntryPointForTemplate(
    templateId: string,
    projectName: string,
  ): string {
    const extensionMap: Record<string, string> = {
      wpf: ".csproj",
      winui3: ".csproj",
      winforms: ".csproj",
      console: ".csproj",
      maui: ".csproj",
    };

    const ext = extensionMap[templateId] || ".csproj";
    return `${projectName}${ext}`;
  }

  async checkPrerequisites(): Promise<{
    installed: boolean;
    missing: string[];
  }> {
    const missing: string[] = [];

    try {
      await executionKernel.execute(
        { command: "dotnet", args: ["--version"] },
        { appId: 0, cwd: process.cwd() },
        "dotnet",
      );
    } catch {
      missing.push(".NET SDK");
    }

    // Check for Windows SDK (required for native apps)
    try {
      await executionKernel.execute(
        { command: "where", args: ["msbuild"] },
        { appId: 0, cwd: process.cwd() },
        "dotnet",
      );
    } catch {
      missing.push("MSBuild (Windows SDK)");
    }

    return { installed: missing.length === 0, missing };
  }

  getRiskProfile(command: string, args: string[]): RiskProfile {
    const fullCmd = `${command} ${args.join(" ")}`.toLowerCase();

    // High risk: Network operations, package restore with external sources
    if (
      fullCmd.includes("restore") ||
      fullCmd.includes("add package") ||
      fullCmd.includes("nuget")
    ) {
      return "high";
    }

    // Medium risk: Build/publish (high CPU/Mem, disk writes)
    if (
      fullCmd.includes("build") ||
      fullCmd.includes("publish") ||
      fullCmd.includes("pack")
    ) {
      return "medium";
    }

    // Low risk: Version checks, clean, list
    return "low";
  }

  async scaffold(options: ScaffoldOptions): Promise<ScaffoldResult> {
    try {
      const stackType = options.templateId || "wpf";

      // Get template from TemplateManager
      const template = templateManager.getTemplate(stackType);
      if (!template) {
        return {
          success: false,
          error: `Unknown framework type: ${stackType}. Supported types: ${templateManager.getAvailableFrameworks().join(", ")}`,
        };
      }

      // Instantiate template with project name
      const instantiated = templateManager.instantiateTemplate(
        template,
        options.projectName,
      );

      // Create project directory
      await fs.ensureDir(options.fullAppPath);

      // Write all template files to disk
      for (const file of instantiated.files) {
        const filePath = path.join(options.fullAppPath, file.path);
        await fs.ensureDir(path.dirname(filePath));
        await fs.writeFile(filePath, file.content, "utf-8");
      }

      // Determine entry point (the .csproj file)
      const entryPoint = this.getEntryPointForTemplate(
        stackType,
        options.projectName,
      );

      // Initialize project state
      const framework = stackType.toUpperCase() as ProjectState["framework"];
      const fileMap = new Map<
        string,
        {
          path: string;
          type: "xaml" | "csharp" | "resource" | "config" | "project";
          lastModified: Date;
        }
      >();

      for (const file of instantiated.files) {
        fileMap.set(file.path, {
          path: file.path,
          type: file.type as
            | "xaml"
            | "csharp"
            | "resource"
            | "config"
            | "project",
          lastModified: new Date(),
        });
      }

      this.setProjectState(0, {
        projectPath: options.fullAppPath,
        projectName: options.projectName,
        framework,
        targetFramework: instantiated.targetFramework,
        files: fileMap,
      });

      return { success: true, entryPoint };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Applies an edit to a project file with validation and synchronization
   */
  async applyEdit(options: {
    appId: number;
    appPath: string;
    filePath: string;
    content: string;
    projectName: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const fullPath = path.isAbsolute(options.filePath)
        ? options.filePath
        : path.join(options.appPath, options.filePath);

      const fileExt = path.extname(fullPath).toLowerCase();
      const relativePath = path.relative(options.appPath, fullPath);

      // 1. Validate based on file type
      if (fileExt === ".xaml") {
        const validation = editValidator.validateXaml(options.content);
        if (!validation.isValid)
          return { success: false, error: validation.error };
      } else if (fileExt === ".cs") {
        const validation = editValidator.validateCSharp(options.content);
        if (!validation.isValid)
          return { success: false, error: validation.error };
      }

      // 2. Write file
      await fs.ensureDir(path.dirname(fullPath));
      await fs.writeFile(fullPath, options.content, "utf-8");

      // 3. Post-write adjustments
      if (fileExt === ".xaml") {
        await projectFileSystem.pairXaml(fullPath, options.projectName);
      }

      // 4. Sync .csproj
      const csprojPath = path.join(
        options.appPath,
        `${options.projectName}.csproj`,
      );
      const fileType =
        fileExt === ".xaml"
          ? "xaml"
          : fileExt === ".cs"
            ? "csharp"
            : "resource";

      await projectFileSystem.syncCsproj(csprojPath, [
        { path: relativePath, type: fileType },
      ]);

      // 5. Update state
      const state = this.getProjectState(options.appId);
      if (state) {
        state.files.set(relativePath, {
          path: relativePath,
          type: fileType as any,
          lastModified: new Date(),
        });
        this.setProjectState(options.appId, state);
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  private parseDependencyErrors(
    stderr: string,
    stdout: string,
  ): ErrorResponse[] {
    const errors: ErrorResponse[] = [];
    const combinedOutput = stderr + "\n" + stdout;
    const lines = combinedOutput.split("\n");

    for (const line of lines) {
      // Look for common NuGet error patterns
      const nugetErrorMatch = line.match(
        /(error|failed).*NU\d+.*(?:package|reference)/i,
      );
      if (nugetErrorMatch) {
        const packageNameMatch = line.match(
          /(?:package|reference)\s+['"]?([^'"\s]+)['"]?/i,
        );
        const errorCodeMatch = line.match(/NU\d+/i);

        errors.push({
          category: "dependency",
          code: errorCodeMatch ? errorCodeMatch[0] : "NU_UNKNOWN",
          message: line.trim(),
          details: {
            file: packageNameMatch ? packageNameMatch[1] : undefined,
          },
          timestamp: new Date(),
        });
        continue;
      }

      // Look for package not found errors
      const packageNotFoundMatch = line.match(
        /(?:could not|unable to|package).*['"]?([^'"\s]+)['"]?.*(?:not found|does not exist)/i,
      );
      if (packageNotFoundMatch) {
        errors.push({
          category: "dependency",
          code: "PACKAGE_NOT_FOUND",
          message: line.trim(),
          details: {
            file: packageNotFoundMatch[1],
          },
          timestamp: new Date(),
        });
        continue;
      }

      // Look for network-related errors
      const networkErrorMatch = line.match(
        /(?:network|connection|http|ssl|certificate|proxy|firewall)/i,
      );
      if (networkErrorMatch) {
        errors.push({
          category: "dependency",
          code: "NETWORK_ERROR",
          message: line.trim(),
          details: {},
          timestamp: new Date(),
        });
        continue;
      }

      // Look for access denied errors
      const accessDeniedMatch = line.match(
        /(?:access is denied|forbidden|authorization|permission denied)/i,
      );
      if (accessDeniedMatch) {
        errors.push({
          category: "dependency",
          code: "ACCESS_DENIED",
          message: line.trim(),
          details: {},
          timestamp: new Date(),
        });
        continue;
      }
    }

    return errors;
  }

  async resolveDependencies(options: {
    appPath: string;
    appId: number;
  }): Promise<ExecutionResult> {
    // Restore NuGet packages
    const result = await executionKernel.execute(
      { command: "dotnet", args: ["restore"] },
      {
        appId: options.appId,
        cwd: options.appPath,
        networkAccess: true,
        memoryLimitMB: 4096, // .NET restore needs more memory
        timeout: 300000,
      },
      "dotnet",
    );

    // Parse dependency errors from the output
    const dependencyErrors = this.parseDependencyErrors(
      result.stderr,
      result.stdout,
    );

    // Log dependency errors for debugging
    if (dependencyErrors.length > 0) {
      console.log(`Dependency errors detected: ${dependencyErrors.length}`);
      dependencyErrors.forEach((error) => {
        console.log(`  - ${error.code}: ${error.message}`);
      });
    }

    // If there are dependency errors, we should modify the exit code to reflect failure
    // Only adjust exit code if it was originally 0 but we found errors
    if (dependencyErrors.length > 0 && result.exitCode === 0) {
      // Even if exit code is 0, if there are significant dependency errors, we should consider it a failure
      result.exitCode = 1;
    }

    return result;
  }

  async build(
    options: BuildOptions,
    _onEvent?: ExecutionEventHandler,
  ): Promise<BuildResult> {
    const config = options.configuration || "Debug";

    const result = await executionKernel.execute(
      {
        command: "dotnet",
        args: ["build", "--configuration", config, "--verbosity", "normal"],
      },
      {
        appId: options.appId,
        cwd: options.appPath,
        networkAccess: false, // Build shouldn't need network
        memoryLimitMB: 4096,
        timeout: 600000, // 10 minutes for large builds
      },
      "dotnet",
    );

    // Parse build output for errors and warnings using the new parser
    const compilerErrors = this.parseCompilerErrors(result.stderr);
    const errors = compilerErrors
      .filter((e) => e.severity === "error")
      .map((e) => `${e.file}(${e.line},${e.column}): ${e.code}: ${e.message}`);
    const warnings = compilerErrors
      .filter((e) => e.severity === "warning")
      .map((e) => `${e.file}(${e.line},${e.column}): ${e.code}: ${e.message}`);

    const outputPath = path.join(options.appPath, "bin", config);

    // Update project state with executable path if build succeeded
    if (result.exitCode === 0) {
      const state = this.getProjectState(options.appId);
      if (state) {
        state.executablePath = outputPath;
        this.setProjectState(options.appId, state);
      }
    }

    return {
      success: result.exitCode === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
      outputPath,
    };
  }

  async run(
    options: RunOptions,
    _onEvent?: ExecutionEventHandler,
  ): Promise<RunResult> {
    // .NET apps don't use ports like Node.js, they run as native processes
    // We'll still generate a job ID for tracking

    const result = await executionKernel.execute(
      { command: "dotnet", args: ["run", "--verbosity", "normal"] },
      {
        appId: options.appId,
        cwd: options.appPath,
        networkAccess: false,
        memoryLimitMB: 4096,
        mode: "session", // Non-blocking, returns Job ID
      },
      "dotnet",
    );

    const jobId =
      result.exitCode === 0
        ? `job_${options.appId}_${Date.now()}_dotnet`
        : undefined;

    // Update project state with process handle
    if (jobId) {
      const state = this.getProjectState(options.appId);
      if (state) {
        state.processHandle = {
          pid: 0, // Will be set by execution kernel
          startTime: new Date(),
          executablePath: state.executablePath || "",
          jobId,
        };
        this.setProjectState(options.appId, state);
      }
    }

    return {
      ready: result.exitCode === 0,
      jobId,
    };
  }

  async stop(appId: number, jobId?: string): Promise<void> {
    if (jobId) {
      await executionKernel.terminateJob(jobId);

      // Clear process handle from state
      const state = this.getProjectState(appId);
      if (state) {
        state.processHandle = undefined;
        this.setProjectState(appId, state);
      }
      return;
    }

    // Fallback: Find and kill dotnet processes for this app
    try {
      await executionKernel.execute(
        { command: "taskkill", args: ["/F", "/IM", "dotnet.exe"] },
        { appId, cwd: process.cwd(), timeout: 10000 },
        "dotnet",
      );
    } catch {
      // Process may already be terminated
    }
  }

  async startPreview(options: PreviewOptions): Promise<void> {
    // For .NET desktop apps, "preview" means running the built executable
    // This is different from Node.js iframe preview

    const buildPath = path.join(options.appPath, "bin", "Debug");

    // Find the .exe file
    const files = await fs.readdir(buildPath);
    const exeFile = files.find((f) => f.endsWith(".exe"));

    if (!exeFile) {
      throw new Error("No executable found. Build the project first.");
    }

    // Launch the executable
    await executionKernel.execute(
      { command: path.join(buildPath, exeFile), args: [] },
      {
        appId: options.appId,
        cwd: buildPath,
        mode: "session",
      },
      "dotnet",
    );
  }

  async stopPreview(appId: number): Promise<void> {
    // Stop any running preview
    await this.stop(appId);
  }

  async package(options: PackageOptions): Promise<ExecutionResult> {
    // Create deployment package using dotnet publish
    const outputPath = path.join(options.appPath, "publish");

    const args = [
      "publish",
      "--configuration",
      "Release",
      "--output",
      outputPath,
      "--self-contained",
      "true",
      "--runtime",
      "win-x64",
    ];

    // Add single-file publishing if requested
    if (options.outputFormat === "single-file") {
      args.push("-p:PublishSingleFile=true");
    }

    return executionKernel.execute(
      { command: "dotnet", args },
      {
        appId: 0,
        cwd: options.appPath,
        networkAccess: false,
        memoryLimitMB: 8192, // Packaging needs lots of memory
        timeout: 900000, // 15 minutes
      },
      "dotnet",
    );
  }

  isReady(message: string): boolean {
    // .NET apps ready when they indicate they're listening or started
    const readyPatterns = [
      /Application started/i,
      /Now listening on/i,
      /Hosting environment/i,
      /Content root path/i,
      /Build succeeded/i,
    ];

    return readyPatterns.some((pattern) => pattern.test(message));
  }
}

// Export singleton instance
export const dotNetRuntimeProvider: RuntimeProvider =
  new DotNetRuntimeProviderImpl();
