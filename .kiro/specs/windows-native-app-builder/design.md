# Design Document: Windows Native App Builder

## Overview

The Windows Native App Builder extends Dyad's AI-powered application generation capabilities to support complete Windows native applications. This feature implements a full end-to-end workflow where users can describe a Windows application in natural language and receive a working WPF, WinUI3, or WinForms application that can be iteratively refined through conversation.

The design follows Dyad's existing RuntimeProvider pattern, implementing a complete DotNetRuntimeProvider that handles the full lifecycle: project scaffolding, dependency resolution, compilation, and execution. The AI agent is enhanced with comprehensive Windows framework knowledge through expanded system prompts and templates.

### Key Design Principles

1. **Consistency with Web Apps**: Mirror the successful web application workflow - simple prompt to working application
2. **Framework Flexibility**: Support multiple Windows UI frameworks (WPF, WinUI3, WinForms) with framework-specific guidance
3. **Iterative Development**: Enable continuous refinement through natural language edits
4. **Security**: Maintain secure command execution through ExecutionKernel
5. **Error Transparency**: Provide clear, actionable error messages at each stage

## Architecture

### High-Level Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         User Interface                       │
│                    (Natural Language Input)                  │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                         AI Agent                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Enhanced System Prompts                  │  │
│  │  • WPF Patterns    • WinUI3 Patterns                 │  │
│  │  • WinForms Patterns • XAML Examples                 │  │
│  │  • C# Best Practices • MVVM Architecture             │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    Tool Layer                                │
│  • write_file        • edit_file                            │
│  • run_dotnet_command • read_file                           │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                  DotNetRuntimeProvider                       │
│  ┌──────────────┬──────────────┬──────────────┬─────────┐  │
│  │  scaffold()  │ resolve()    │   build()    │  run()  │  │
│  │              │ Dependencies │              │         │  │
│  └──────────────┴──────────────┴──────────────┴─────────┘  │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    ExecutionKernel                           │
│              (Secure Command Execution)                      │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    .NET CLI / Runtime                        │
│  • dotnet new    • dotnet restore                           │
│  • dotnet build  • dotnet run                               │
└─────────────────────────────────────────────────────────────┘
```

### Workflow Sequence

```
User Prompt → AI Agent → scaffold() → write files → resolveDependencies()
→ build() → run() → Display in Native Window

User Edit Request → AI Agent → edit files → build() → run()
→ Display Updated App
```

## Components and Interfaces

### 1. DotNetRuntimeProvider

The core component implementing the RuntimeProvider interface for .NET-based Windows applications.

**Interface Implementation:**

```typescript
interface RuntimeProvider {
  scaffold(projectType: string, projectName: string): Promise<ScaffoldResult>;
  resolveDependencies(projectPath: string): Promise<DependencyResult>;
  build(projectPath: string): Promise<BuildResult>;
  run(projectPath: string, executablePath: string): Promise<RunResult>;
}

class DotNetRuntimeProvider implements RuntimeProvider {
  private executionKernel: ExecutionKernel;
  private templateManager: TemplateManager;
  private projectState: ProjectState;

  async scaffold(
    projectType: string,
    projectName: string,
  ): Promise<ScaffoldResult> {
    // 1. Determine framework (WPF, WinUI3, WinForms) from projectType
    // 2. Load appropriate template
    // 3. Create project directory structure
    // 4. Generate .csproj file with correct target framework
    // 5. Create initial XAML and C# files
    // 6. Return project path and file list
  }

  async resolveDependencies(projectPath: string): Promise<DependencyResult> {
    // 1. Execute 'dotnet restore' via ExecutionKernel
    // 2. Parse output for errors
    // 3. Verify packages.lock.json or obj/ folder created
    // 4. Return success/failure with error details
  }

  async build(projectPath: string): Promise<BuildResult> {
    // 1. Execute 'dotnet build' via ExecutionKernel
    // 2. Parse compiler output for errors/warnings
    // 3. Locate output executable in bin/ directory
    // 4. Return build status and executable path
  }

  async run(projectPath: string, executablePath: string): Promise<RunResult> {
    // 1. Start process for executable
    // 2. Monitor process for crashes
    // 3. Capture stdout/stderr
    // 4. Return process handle and output streams
  }
}
```

**State Management:**

```typescript
interface ProjectState {
  projectPath: string;
  projectName: string;
  framework: "WPF" | "WinUI3" | "WinForms";
  targetFramework: string; // e.g., 'net8.0-windows'
  executablePath?: string;
  processHandle?: ProcessHandle;
  files: Map<string, FileMetadata>;
}
```

### 2. TemplateManager

Manages framework-specific templates for project scaffolding.

**Structure:**

```typescript
interface Template {
  framework: "WPF" | "WinUI3" | "WinForms";
  files: TemplateFile[];
  packageReferences: PackageReference[];
  targetFramework: string;
}

interface TemplateFile {
  path: string; // Relative path in project
  content: string; // Template content with placeholders
  type: "xaml" | "csharp" | "project" | "config";
}

class TemplateManager {
  private templates: Map<string, Template>;

  getTemplate(framework: string): Template {
    // Return appropriate template for framework
  }

  instantiateTemplate(
    template: Template,
    projectName: string,
  ): InstantiatedTemplate {
    // Replace placeholders ({{ProjectName}}, {{Namespace}})
    // Return ready-to-write files
  }
}
```

**Template Examples:**

WPF Template includes:

- `App.xaml` and `App.xaml.cs`
- `MainWindow.xaml` and `MainWindow.xaml.cs`
- `ProjectName.csproj` with WPF SDK reference
- `AssemblyInfo.cs` (if needed)

WinUI3 Template includes:

- `App.xaml` and `App.xaml.cs`
- `MainWindow.xaml` and `MainWindow.xaml.cs`
- `ProjectName.csproj` with WinUI3 SDK reference
- `app.manifest` for Windows 10/11 compatibility

WinForms Template includes:

- `Program.cs` with application entry point
- `Form1.cs` and `Form1.Designer.cs`
- `ProjectName.csproj` with WinForms SDK reference

### 3. Enhanced System Prompts

System prompts guide the AI agent in generating correct Windows application code.

**Prompt Structure:**

```typescript
interface SystemPrompt {
  framework: string;
  xamlPatterns: XamlPattern[];
  csharpPatterns: CSharpPattern[];
  commonControls: ControlReference[];
  architectureGuidance: string;
  examples: CodeExample[];
}

interface XamlPattern {
  name: string;
  description: string;
  code: string;
  framework: string[]; // Which frameworks support this
}

interface CSharpPattern {
  name: string;
  description: string;
  code: string;
  useCase: string;
}
```

**Key Prompt Content:**

1. **XAML Fundamentals:**
   - Layout containers (Grid, StackPanel, DockPanel)
   - Common controls (Button, TextBox, ListBox, ComboBox)
   - Data binding syntax (`{Binding PropertyName}`)
   - Event handler syntax (`Click="Button_Click"`)
   - Resource dictionaries and styles

2. **C# Code-Behind Patterns:**
   - Event handler signatures
   - Property change notification (INotifyPropertyChanged)
   - Command pattern implementation
   - Async/await for UI operations

3. **MVVM Architecture:**
   - ViewModel structure
   - RelayCommand/DelegateCommand implementation
   - ObservableCollection usage
   - View-ViewModel binding

4. **Framework-Specific Guidance:**
   - WPF: Use of DependencyProperty, Routed Events
   - WinUI3: Modern control names (NavigationView, InfoBar)
   - WinForms: Designer-generated code patterns

### 4. AI Agent Tool Integration

The AI agent uses specific tools to interact with the file system and .NET CLI.

**Tool Definitions:**

```typescript
interface Tool {
  name: string;
  description: string;
  parameters: ToolParameter[];
  execute: (params: any) => Promise<ToolResult>;
}

// write_file tool
{
  name: "write_file",
  description: "Create a new file with specified content",
  parameters: [
    { name: "path", type: "string", description: "Relative path from project root" },
    { name: "content", type: "string", description: "File content" }
  ]
}

// edit_file tool
{
  name: "edit_file",
  description: "Modify existing file content",
  parameters: [
    { name: "path", type: "string" },
    { name: "edits", type: "Edit[]", description: "List of edits to apply" }
  ]
}

// run_dotnet_command tool
{
  name: "run_dotnet_command",
  description: "Execute dotnet CLI command",
  parameters: [
    { name: "command", type: "string", description: "dotnet subcommand" },
    { name: "args", type: "string[]", description: "Command arguments" },
    { name: "workingDirectory", type: "string" }
  ]
}
```

**Tool Usage Sequence:**

1. **Scaffolding Phase:**
   - AI calls `run_dotnet_command` with `new` command (optional, or use templates)
   - AI calls `write_file` for each project file
   - AI ensures .csproj includes all necessary files

2. **Dependency Phase:**
   - AI calls `run_dotnet_command` with `restore` command
   - AI checks output for errors

3. **Build Phase:**
   - AI calls `run_dotnet_command` with `build` command
   - AI parses compiler errors if build fails

4. **Edit Phase:**
   - AI calls `edit_file` to modify XAML or C# files
   - AI triggers rebuild automatically

### 5. ExecutionKernel Security

The ExecutionKernel ensures secure execution of dotnet commands.

**Security Constraints:**

```typescript
interface ExecutionConstraints {
  allowedCommands: string[]; // ['new', 'restore', 'build', 'run']
  workingDirectoryRestriction: string; // Must be within project directory
  timeoutMs: number; // Command timeout
  environmentVariables: Record<string, string>;
}

class ExecutionKernel {
  async executeCommand(
    command: string,
    args: string[],
    constraints: ExecutionConstraints,
  ): Promise<ExecutionResult> {
    // 1. Validate command is in allowedCommands
    // 2. Validate working directory is within allowed path
    // 3. Execute with timeout
    // 4. Capture stdout, stderr, exit code
    // 5. Return structured result
  }
}
```

### 6. Preview and Process Management

Manages the running Windows application process.

**Process Management:**

```typescript
interface ProcessManager {
  startProcess(executablePath: string): Promise<ProcessHandle>;
  stopProcess(handle: ProcessHandle): Promise<void>;
  getProcessOutput(handle: ProcessHandle): ProcessOutput;
  isProcessRunning(handle: ProcessHandle): boolean;
}

interface ProcessHandle {
  pid: number;
  startTime: Date;
  executablePath: string;
}

interface ProcessOutput {
  stdout: string[];
  stderr: string[];
  exitCode?: number;
}
```

**Window Display:**

The application runs in a separate native Windows process, not embedded in Dyad. The preview UI shows:

- Process status (running/stopped)
- Console output (if any)
- Error messages
- Controls to stop/restart the application

## Data Models

### Project Configuration

```typescript
interface ProjectConfiguration {
  name: string;
  framework: "WPF" | "WinUI3" | "WinForms";
  targetFramework: string; // 'net8.0-windows', 'net7.0-windows'
  outputType: "WinExe" | "Exe";
  useWPF?: boolean; // For .csproj
  useWindowsForms?: boolean; // For .csproj
  useWinUI?: boolean; // For .csproj
  packageReferences: PackageReference[];
  files: ProjectFile[];
}

interface PackageReference {
  name: string;
  version: string;
}

interface ProjectFile {
  path: string;
  type: "xaml" | "csharp" | "resource" | "config";
  dependentUpon?: string; // For code-behind files
}
```

### Build Result

```typescript
interface BuildResult {
  success: boolean;
  executablePath?: string;
  errors: CompilerError[];
  warnings: CompilerWarning[];
  buildTime: number;
}

interface CompilerError {
  code: string; // e.g., 'CS0103'
  message: string;
  file: string;
  line: number;
  column: number;
  severity: "error" | "warning";
}
```

### Template Data Model

```typescript
interface TemplateData {
  framework: "WPF" | "WinUI3" | "WinForms";
  files: {
    "App.xaml"?: string;
    "App.xaml.cs"?: string;
    "MainWindow.xaml"?: string;
    "MainWindow.xaml.cs"?: string;
    "Form1.cs"?: string;
    "Form1.Designer.cs"?: string;
    "Program.cs"?: string;
    "project.csproj": string;
  };
  replacements: {
    projectName: string;
    namespace: string;
    targetFramework: string;
  };
}
```

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

### Property 1: Scaffold Creates Complete Valid Projects

_For any_ supported framework type (WPF, WinUI3, WinForms) and any valid project name, scaffolding should create a complete project structure containing a valid .csproj file, all required XAML files with corresponding C# code-behind files, and all necessary configuration files for that framework.

**Validates: Requirements 1.1, 1.3, 1.5, 7.4**

### Property 2: Framework-Specific Templates

_For any_ framework type, the scaffolded project should include framework-specific package references, appropriate using statements, and framework-specific file structures (e.g., WinUI3 projects include app.manifest, WPF projects include App.xaml).

**Validates: Requirements 1.2, 3.4, 9.5**

### Property 3: Template Placeholder Replacement

_For any_ template and any valid project name and namespace, instantiating the template should replace all placeholders ({{ProjectName}}, {{Namespace}}) with the provided values, and the resulting files should contain no unreplaced placeholders.

**Validates: Requirements 9.4**

### Property 4: XAML Validity

_For any_ generated XAML file, the content should be valid XML with proper XAML namespace declarations, and all event handlers referenced in the XAML should exist in the corresponding code-behind file.

**Validates: Requirements 2.1, 2.3**

### Property 5: Event Handler Signatures

_For any_ generated event handler method in C# code-behind, the method signature should match the expected pattern (void MethodName(object sender, EventArgs e) or framework-specific variants).

**Validates: Requirements 2.5**

### Property 6: Dependency Resolution Success Validation

_For any_ project with valid package references, calling resolveDependencies() should execute dotnet restore, and should return success only when all packages are successfully restored.

**Validates: Requirements 3.1, 3.3**

### Property 7: Descriptive Error Messages

_For any_ operation that fails (scaffold, restore, build, run), the returned error should contain a descriptive message indicating the failure reason, and for build errors specifically, should include file path, line number, and column number.

**Validates: Requirements 3.2, 8.1, 8.2, 8.4**

### Property 8: Error Type Categorization

_For any_ error from different lifecycle phases, the error object should have a type field that distinguishes between scaffold errors, dependency errors, build errors, and runtime errors.

**Validates: Requirements 8.5**

### Property 9: Build Execution and Validation

_For any_ project with resolved dependencies and valid code, calling build() should execute dotnet build, and on success should return an executable path that points to an existing file in the bin/ directory.

**Validates: Requirements 4.1, 4.3**

### Property 10: Build Error Parsing

_For any_ project with syntax errors, calling build() should return failure with compiler errors that include error code, message, file path, line number, and column number.

**Validates: Requirements 4.2**

### Property 11: Security Command Validation

_For any_ command passed to ExecutionKernel, if the command is not in the allowed list (new, restore, build, run), the execution should be rejected with a security error.

**Validates: Requirements 4.4, 12.4**

### Property 12: Process Lifecycle Round-Trip

_For any_ successfully built application, calling run() should start a new process that can be verified as running, and calling stop() on that process should terminate it such that it no longer appears in the process list.

**Validates: Requirements 5.1, 5.3, 5.5**

### Property 13: Console Output Capture

_For any_ application that writes to stdout or stderr, the ProcessManager should capture that output and make it available through getProcessOutput().

**Validates: Requirements 5.4, 8.3**

### Property 14: XAML Structure Preservation

_For any_ valid XAML file and any edit operation, if the edit maintains valid XAML syntax, the resulting file should still be valid XML with proper XAML namespace declarations.

**Validates: Requirements 6.2**

### Property 15: Surgical Code Edits

_For any_ C# file and any edit operation targeting a specific method, code outside the targeted method should remain byte-for-byte identical after the edit.

**Validates: Requirements 6.3**

### Property 16: Edit-Rebuild-Run Workflow

_For any_ project that is currently running, making a file edit should trigger a rebuild, and if the rebuild succeeds, should restart the application with the new changes.

**Validates: Requirements 6.4, 6.5**

### Property 17: File Extension Correctness

_For any_ file created by the system, the file extension should match the file type: .xaml for XAML files, .cs for C# files, .csproj for project files.

**Validates: Requirements 7.1**

### Property 18: Project File Synchronization

_For any_ new XAML or C# file added to the project, if the file type requires explicit inclusion in the .csproj (framework-dependent), the .csproj should be updated to include the new file.

**Validates: Requirements 7.2**

### Property 19: Project Organization Consistency

_For any_ scaffolded project, the directory structure should follow .NET conventions, and all C# file namespaces should match the project name (or project name + subdirectory path).

**Validates: Requirements 7.3, 7.5**

### Property 20: RuntimeProvider State Persistence

_For any_ sequence of lifecycle method calls (scaffold → resolveDependencies → build → run), each method should have access to the state from previous methods (e.g., build() should know the project path from scaffold()).

**Validates: Requirements 11.6**

### Property 21: Tool Operation Feedback

_For any_ tool operation (write_file, edit_file, run_dotnet_command), the tool should return a result object indicating success or failure with relevant details.

**Validates: Requirements 12.5**

## Error Handling

### Error Categories

The system defines four primary error categories, each with specific handling:

1. **Scaffold Errors**
   - Invalid framework type specified
   - Invalid project name (contains illegal characters)
   - File system permission errors
   - Template not found

2. **Dependency Errors**
   - Package not found in NuGet registry
   - Network connectivity issues
   - Package version conflicts
   - Corrupted package cache

3. **Build Errors**
   - Compiler syntax errors
   - Type errors
   - Missing references
   - XAML parsing errors

4. **Runtime Errors**
   - Application crashes on startup
   - Unhandled exceptions during execution
   - Process termination errors
   - Missing runtime dependencies

### Error Response Structure

All errors follow a consistent structure:

```typescript
interface ErrorResponse {
  category: "scaffold" | "dependency" | "build" | "runtime";
  code: string; // e.g., 'SCAFFOLD_001', 'CS0103'
  message: string; // Human-readable description
  details: ErrorDetails;
  timestamp: Date;
}

interface ErrorDetails {
  file?: string; // For build/runtime errors
  line?: number; // For build errors
  column?: number; // For build errors
  stackTrace?: string; // For runtime errors
  innerError?: ErrorResponse; // For nested errors
}
```

### Error Recovery Strategies

1. **Scaffold Errors**: Provide clear guidance on valid inputs, suggest corrections
2. **Dependency Errors**: Suggest alternative package versions, check network connectivity
3. **Build Errors**: Parse compiler output, highlight specific code issues, suggest fixes
4. **Runtime Errors**: Capture stack traces, identify common patterns (missing DLLs, etc.)

### User-Facing Error Messages

Errors are translated into actionable messages for users:

- **Technical Details**: Full error information for debugging
- **Plain Language**: Simple explanation of what went wrong
- **Suggested Actions**: What the user can do to fix the issue
- **Related Documentation**: Links to relevant framework documentation

## Testing Strategy

### Dual Testing Approach

This feature requires both unit testing and property-based testing for comprehensive coverage:

**Unit Tests** focus on:

- Specific examples of each framework (WPF, WinUI3, WinForms)
- Edge cases (empty project names, special characters)
- Error conditions (invalid commands, missing files)
- Integration points between components
- Template content verification

**Property-Based Tests** focus on:

- Universal properties that hold for all inputs
- Comprehensive input coverage through randomization
- Invariants that must be maintained across operations
- Round-trip properties (scaffold → build → run)

### Property-Based Testing Configuration

**Framework**: Use fast-check for TypeScript/JavaScript property-based testing

**Configuration**:

- Minimum 100 iterations per property test
- Each test tagged with: **Feature: windows-native-app-builder, Property {N}: {property_text}**
- Custom generators for:
  - Valid project names
  - Framework types (WPF, WinUI3, WinForms)
  - Valid XAML content
  - Valid C# code snippets

**Example Property Test Structure**:

```typescript
import fc from "fast-check";

// Feature: windows-native-app-builder, Property 1: Scaffold Creates Complete Valid Projects
test("scaffold creates complete valid projects", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.constantFrom("WPF", "WinUI3", "WinForms"),
      fc.string({ minLength: 1, maxLength: 50 }).filter(isValidProjectName),
      async (framework, projectName) => {
        const provider = new DotNetRuntimeProvider();
        const result = await provider.scaffold(framework, projectName);

        expect(result.success).toBe(true);
        expect(result.files).toContain(`${projectName}.csproj`);
        expect(result.files.some((f) => f.endsWith(".xaml"))).toBe(true);
        expect(result.files.some((f) => f.endsWith(".cs"))).toBe(true);

        // Verify .csproj is valid XML
        const csprojContent = await readFile(
          result.projectPath,
          `${projectName}.csproj`,
        );
        expect(() => parseXml(csprojContent)).not.toThrow();
      },
    ),
    { numRuns: 100 },
  );
});
```

### Unit Testing Strategy

**Test Organization**:

- `DotNetRuntimeProvider.test.ts`: Core provider functionality
- `TemplateManager.test.ts`: Template loading and instantiation
- `ExecutionKernel.test.ts`: Command execution and security
- `ProcessManager.test.ts`: Process lifecycle management
- `ErrorHandling.test.ts`: Error categorization and formatting

**Key Unit Test Cases**:

1. **Scaffold Tests**:
   - Scaffold WPF project with default template
   - Scaffold WinUI3 project with custom name
   - Scaffold WinForms project
   - Scaffold with invalid framework type (should fail)
   - Scaffold with invalid project name (should fail)

2. **Dependency Tests**:
   - Restore dependencies for valid project
   - Restore with missing package (should fail with descriptive error)
   - Restore with network error (should fail gracefully)

3. **Build Tests**:
   - Build valid WPF project
   - Build project with syntax error (should return compiler errors)
   - Build project with missing reference (should return error)

4. **Run Tests**:
   - Run successfully built application
   - Stop running application
   - Capture console output from application

5. **Edit Tests**:
   - Edit XAML file and verify structure preserved
   - Edit C# file and verify unrelated code unchanged
   - Edit triggers rebuild and restart

6. **Template Tests**:
   - Load WPF template
   - Load WinUI3 template
   - Load WinForms template
   - Instantiate template with custom values
   - Verify all placeholders replaced

7. **Security Tests**:
   - Execute allowed command (should succeed)
   - Execute disallowed command (should fail)
   - Execute command outside project directory (should fail)

### Integration Testing

**End-to-End Scenarios**:

1. **Complete WPF Application Flow**:
   - User prompt: "Create a WPF calculator"
   - Verify scaffold → restore → build → run succeeds
   - Verify application window appears
   - User prompt: "Make buttons bigger"
   - Verify edit → rebuild → restart succeeds

2. **Complete WinUI3 Application Flow**:
   - User prompt: "Create a WinUI3 todo app"
   - Verify full lifecycle
   - Test iterative edits

3. **Complete WinForms Application Flow**:
   - User prompt: "Create a WinForms data entry form"
   - Verify full lifecycle
   - Test iterative edits

### Test Data Generators

**Custom Generators for Property Tests**:

```typescript
// Valid project name generator
const projectNameArb = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter((name) => /^[a-zA-Z][a-zA-Z0-9_]*$/.test(name));

// Framework type generator
const frameworkArb = fc.constantFrom("WPF", "WinUI3", "WinForms");

// Valid XAML content generator
const xamlContentArb = fc
  .record({
    rootElement: fc.constantFrom("Window", "Page", "UserControl"),
    children: fc.array(
      fc.constantFrom("Button", "TextBox", "Grid", "StackPanel"),
    ),
  })
  .map(generateXamlFromStructure);

// Valid C# code generator
const csharpCodeArb = fc
  .record({
    className: projectNameArb,
    methods: fc.array(
      fc.record({
        name: fc.string({ minLength: 1, maxLength: 30 }),
        returnType: fc.constantFrom("void", "string", "int", "bool"),
      }),
    ),
  })
  .map(generateCSharpFromStructure);
```

### Mocking Strategy

**Mock External Dependencies**:

- Mock ExecutionKernel for tests that don't need real dotnet CLI
- Mock file system for template tests
- Mock process manager for tests that don't need real processes

**Real Integration Tests**:

- Use real dotnet CLI for integration tests
- Use real file system for end-to-end tests
- Use real processes for application execution tests

### Continuous Testing

**Pre-commit Hooks**:

- Run unit tests
- Run fast property tests (10 iterations for speed)

**CI Pipeline**:

- Run full unit test suite
- Run full property test suite (100+ iterations)
- Run integration tests
- Test on Windows 10 and Windows 11
- Test with .NET 7 and .NET 8

### Performance Testing

**Benchmarks**:

- Scaffold time: < 2 seconds
- Restore time: < 10 seconds (network dependent)
- Build time: < 5 seconds for small projects
- Application startup: < 3 seconds

**Load Testing**:

- Multiple concurrent projects
- Large projects (100+ files)
- Rapid edit-rebuild cycles
