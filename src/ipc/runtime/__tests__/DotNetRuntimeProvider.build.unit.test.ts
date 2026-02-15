/**
 * Unit tests for .NET compiler error parsing
 * Validates Requirement 4.2, 8.2: Build error parsing logic
 */

import { describe, it, expect } from "vitest";
import { dotNetRuntimeProvider } from "../providers/DotNetRuntimeProvider";

describe("DotNetRuntimeProvider - Build Error Parsing", () => {
  // Use any to access private method for testing
  const provider = dotNetRuntimeProvider as any;

  it("should parse standard MSBuild errors", () => {
    const stderr =
      "C:\\Projects\\MyApp\\MainWindow.xaml.cs(12,5): error CS1002: ; expected";
    const errors = provider.parseCompilerErrors(stderr);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual({
      file: "C:\\Projects\\MyApp\\MainWindow.xaml.cs",
      line: 12,
      column: 5,
      severity: "error",
      code: "CS1002",
      message: "; expected",
    });
  });

  it("should parse MSBuild warnings", () => {
    const stderr =
      "C:\\Projects\\MyApp\\App.xaml.cs(5,10): warning CS0168: The variable 'ex' is declared but never used";
    const errors = provider.parseCompilerErrors(stderr);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual({
      file: "C:\\Projects\\MyApp\\App.xaml.cs",
      line: 5,
      column: 10,
      severity: "warning",
      code: "CS0168",
      message: "The variable 'ex' is declared but never used",
    });
  });

  it("should parse generic errors without file info", () => {
    const stderr =
      'error MSB4019: The imported project "C:\\Path\\To\\Sdk.props" was not found.';
    const errors = provider.parseCompilerErrors(stderr);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual({
      file: "",
      line: 0,
      column: 0,
      severity: "error",
      code: "MSB4019",
      message: 'The imported project "C:\\Path\\To\\Sdk.props" was not found.',
    });
  });

  it("should handle multi-line error output", () => {
    const stderr = `
C:\\Path\\File1.cs(1,1): error CS0001: Error 1
warning MSB0001: Generic warning
C:\\Path\\File2.cs(10,20): error CS0002: Error 2
    `.trim();

    const errors = provider.parseCompilerErrors(stderr);

    expect(errors).toHaveLength(3);
    expect(errors[0].code).toBe("CS0001");
    expect(errors[1].code).toBe("MSB0001");
    expect(errors[2].code).toBe("CS0002");
  });

  it("should ignore lines that don't match error patterns", () => {
    const stderr =
      "Build FAILED.\nRandom log message\nC:\\File.cs(1,1): error CS0001: Msg";
    const errors = provider.parseCompilerErrors(stderr);

    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe("CS0001");
  });
});
