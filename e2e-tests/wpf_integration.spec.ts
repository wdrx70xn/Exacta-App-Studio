import { test, expect } from "./helpers/test_helper";

test("WPF application lifecycle", async ({ po }) => {
  // 1. Setup Dyad with auto-approve enabled for seamless flow
  await po.setUp({ autoApprove: true });

  // 2. Request a new WPF application
  // We use the [dump] tag to capture the server-side tool calls
  await po.sendPrompt(
    "Create a simple WPF application called 'WpfTestApp' with a 'Start' button.",
  );

  // 3. Verify that the app was created and is selected
  const appName = await po.appManagement.getCurrentAppName();
  expect(appName).toBe("wpftestapp");

  // 4. Verify that the project files exist
  // We expect a .csproj file and App.xaml/MainWindow.xaml
  await po.snapshotAppFiles({
    name: "wpf-scaffold-files",
    files: [
      "wpftestapp.csproj",
      "App.xaml",
      "MainWindow.xaml",
      "MainWindow.xaml.cs",
    ],
  });

  // 5. Navigate to the Preview Panel and start the app
  await po.navigation.goToPreviewTab();

  // Wait for the preview panel to be ready
  await expect(po.page.getByTestId("native-app-preview")).toBeVisible();

  // 6. Launch the application
  await po.page.getByRole("button", { name: "Launch" }).click();

  // 7. Verify the status changes to 'running'
  await expect(po.page.getByTestId("preview-status-badge")).toContainText(
    "running",
  );

  // 8. Stop the application
  await po.page.getByRole("button", { name: "Stop" }).click();

  // 9. Verify the status changes to 'stopped' or 'idle'
  await expect(po.page.getByTestId("preview-status-badge")).toContainText(
    "stopped",
    { timeout: 10000 },
  );
});
