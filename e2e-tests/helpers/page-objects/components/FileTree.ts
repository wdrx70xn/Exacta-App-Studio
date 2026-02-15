import { Page, expect } from "@playwright/test";
import { Timeout } from "../../constants";

export class FileTree {
  constructor(public page: Page) {}

  async openFile(fileName: string) {
    // Wait for the code view to finish loading files
    await expect(
      this.page.getByText("Loading files...", { exact: false }),
    ).toBeHidden({
      timeout: Timeout.LONG,
    });

    const fileItem = this.page.getByText(fileName).first();
    await expect(fileItem).toBeVisible({ timeout: Timeout.MEDIUM });

    // Find the file name container (the clickable div that toggles expansion)
    const fileContainer = fileItem
      .locator("xpath=ancestor::div[contains(@class, 'cursor-pointer')]")
      .first();
    await expect(fileContainer).toBeVisible({ timeout: Timeout.MEDIUM });

    // Click on the file name to open it in the editor
    await fileContainer.click();

    // Verify that the file is now visible in the code editor
    await expect(this.page.locator(".monaco-editor")).toBeVisible();
    await expect(this.page.getByText(fileName, { exact: false })).toBeVisible();
  }
}
