import { test, expect } from "./helpers/test_helper";

test("WinForms application lifecycle", async ({ po }) => {
  // 1. Setup Dyad with auto-approve enabled for seamless flow
  await po.setUp({ autoApprove: true });

  // 2. Request a new WinForms application
  await po.sendPrompt(
    "Create a simple WinForms application called 'WinFormsTestApp' with a 'Click Me' button.",
  );

  // 3. Verify that the app was created and is selected
  const appName = await po.appManagement.getCurrentAppName();
  expect(appName).toBe("winformstestapp");

  // 4. Verify that the project files exist
  // We expect a .csproj file and Program.cs/Form1.cs
  await po.snapshotAppFiles({
    name: "winforms-scaffold-files",
    files: ["WinFormsTestApp.csproj", "Program.cs", "Form1.cs"],
  });

  // 5. Verify the .csproj contains WinForms references
  const csprojContent = await po.fileTree.readFile("WinFormsTestApp.csproj");
  expect(csprojContent).toContain("UseWindowsForms");

  // 6. Navigate to the Preview Panel and start the app
  await po.navigation.goToPreviewTab();

  // Wait for the preview panel to be ready
  await expect(po.page.getByTestId("native-app-preview")).toBeVisible();

  // 7. Launch the application
  await po.page.getByRole("button", { name: "Launch" }).click();

  // 8. Verify the status changes to 'running'
  await expect(po.page.getByTestId("preview-status-badge")).toContainText(
    "running",
  );

  // 9. Stop the application
  await po.page.getByRole("button", { name: "Stop" }).click();

  // 10. Verify the status changes to 'stopped' or 'idle'
  await expect(po.page.getByTestId("preview-status-badge")).toContainText(
    "stopped",
    { timeout: 10000 },
  );
});
