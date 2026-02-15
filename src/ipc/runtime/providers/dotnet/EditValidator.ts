// XAML and C# validation for iterative editing

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export class EditValidator {
  /**
   * Validates XAML content for basic XML health and required attributes
   */
  validateXaml(content: string): ValidationResult {
    try {
      // Basic check for common XAML root elements and namespaces
      const hasNamespace = /xmlns(?::[a-zA-Z0-9]+)?="[^"]+"/.test(content);
      const isBalanced = this.checkBasicTagBalance(content);

      if (!hasNamespace) {
        return { isValid: false, error: "Missing XML namespaces (xmlns)" };
      }

      if (!isBalanced) {
        return {
          isValid: false,
          error: "XAML tags appear to be unbalanced or malformed",
        };
      }

      return { isValid: true };
    } catch (e) {
      return { isValid: false, error: `Invalid XAML: ${String(e)}` };
    }
  }

  private checkBasicTagBalance(content: string): boolean {
    const tags = content.match(/<[^>]+>/g) || [];
    let balance = 0;
    for (const tag of tags) {
      if (tag.startsWith("<!--")) continue;
      if (tag.endsWith("/>")) continue;
      if (tag.startsWith("</")) balance--;
      else balance++;
    }
    return balance === 0;
  }

  /**
   * Performs structural checks on C# code to prevent corruption
   */
  validateCSharp(content: string): ValidationResult {
    // Basic structural checks via regex
    const hasNamespace = /namespace\s+[a-zA-Z0-9_.]+/i.test(content);
    const hasClass = /class\s+[a-zA-Z0-9_]+/i.test(content);

    // Check for "empty" or clearly truncated files
    if (content.trim().length < 50) {
      return { isValid: false, error: "File content too short or truncated" };
    }

    if (!hasNamespace && !content.includes("using ")) {
      // Might be a simple helper or top-level program, but for WPF/WinUI we usually expect namespaces
      return { isValid: false, error: "Missing namespace or using directives" };
    }

    if (!hasClass) {
      return { isValid: false, error: "Missing class definition" };
    }

    return { isValid: true };
  }

  /**
   * Checks if an edit is likely to be "surgical" vs. complete rewrite
   */
  isSurgicalEdit(oldContent: string, newContent: string): boolean {
    const lineDiff = Math.abs(
      newContent.split("\n").length - oldContent.split("\n").length,
    );
    // If we're changing more than 80% of the lines, it's probably a rewrite
    return lineDiff < oldContent.split("\n").length * 0.8;
  }
}

export const editValidator = new EditValidator();
