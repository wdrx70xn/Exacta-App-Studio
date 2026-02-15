/**
 * Page object for the inline code editor.
 * Handles editing, saving, and canceling file edits.
 */

import { Page } from "@playwright/test";

export class CodeEditor {
  constructor(public page: Page) {}

  async clickEditButton() {
    await this.page.locator('button:has-text("Edit")').first().click();
  }

  async editFileContent(content: string) {
    const editor = this.page.locator(".monaco-editor textarea").first();
    await editor.focus();
    await editor.press("Home");
    await editor.type(content);
  }

  async replaceFileContent(oldString: string, newString: string) {
    await this.page.evaluate(
      ({ oldString, newString }) => {
        // Find the Monaco editor instance
        const editorElement = document.querySelector(".monaco-editor");
        if (!editorElement) {
          throw new Error("Monaco editor not found.");
        }

        // Access Monaco editor via the window object
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const monaco = (window as any).monaco;
        if (!monaco) {
          throw new Error("Monaco API not found.");
        }

        // Get all editor instances
        const editors = monaco.editor.getEditors();
        if (editors.length === 0) {
          throw new Error("No Monaco editor instances found.");
        }

        // Find the active editor instance (assuming it's the one with a model)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const editor = editors.find((e: any) => e.getModel()) || editors[0];
        if (!editor) {
          throw new Error("No active Monaco editor found.");
        }

        const model = editor.getModel();
        if (!model) {
          throw new Error("Monaco editor model not found.");
        }

        const currentValue = model.getValue();
        const newValue = currentValue.replace(oldString, newString);
        model.setValue(newValue);
      },
      { oldString, newString },
    );
  }

  async saveFile() {
    await this.page.locator('[data-testid="save-file-button"]').click();
  }

  async cancelEdit() {
    await this.page.locator('button:has-text("Cancel")').first().click();
  }
}
