import { test, expect } from "./helpers/test_helper";

test("WinUI3 application lifecycle", async ({ po }) => {
    // 1. Setup Dyad with auto-approve enabled for seamless flow
    await po.setUp({ autoApprove: true });

    // 2. Request a new WinUI3 application
    await po.sendPrompt("Create a simple WinUI3 application called 'WinUI3TestApp' with a 'Click Me' button.");

    // 3. Verify that the app was created and is selected
    const appName = await po.appManagement.getCurrentAppName();
    expect(appName).toBe("winui3testapp");

    // 4. Verify that the project files exist
    // We expect a .csproj file and App.xaml/MainWindow.xaml with WinUI3 namespaces
    await po.snapshotAppFiles({
        name: "winui3-scaffold-files",
        files: ["WinUI3TestApp.csproj", "App.xaml", "MainWindow.xaml", "MainWindow.xaml.cs", "app.manifest"]
    });

    // 5. Verify the .csproj contains WinUI3 references
    const csprojContent = await po.fileTree.readFile("WinUI3TestApp.csproj");
    expect(csprojContent).toContain("UseWinUI");
    expect(csprojContent).toContain("Microsoft.WindowsAppSDK");

    // 6. Edit the MainWindow.xaml to change the button content
    await po.editFile(
      "MainWindow.xaml",
      'Content="Click Me"',
      'Content="Edited Click Me"',
    );

    // 7. Navigate to the Preview Panel and start the app
    await po.navigation.goToPreviewTab();

    // Wait for the preview panel to be ready
    await expect(po.page.getByTestId("native-app-preview")).toBeVisible();

    // 8. Launch the application
    await po.page.getByRole("button", { name: "Launch" }).click();

    // 9. Verify the status changes to 'running'
    await expect(po.page.getByTestId("preview-status-badge")).toContainText("running");

    // 10. Verify the button content changed
    await po.page.waitForTimeout(5000); // Give some time for hot reload to apply
    await expect(po.page.getByRole("button", { name: "Edited Click Me" })).toBeVisible();

    // 11. Stop the application
    await po.page.getByRole("button", { name: "Stop" }).click();

    // 12. Verify the status changes to 'stopped' or 'idle'
    await expect(po.page.getByTestId("preview-status-badge")).toContainText("stopped", { timeout: 10000 });
});
