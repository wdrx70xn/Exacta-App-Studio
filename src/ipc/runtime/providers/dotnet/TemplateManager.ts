/**
 * TemplateManager - Manages framework-specific templates for .NET project scaffolding
 *
 * This class handles loading, instantiation, and placeholder replacement for
 * WPF, WinUI3, and WinForms project templates.
 */

import type { PackageReference } from "./types";

export interface Template {
  framework: "WPF" | "WinUI3" | "WinForms" | "Console" | "MAUI";
  files: TemplateFile[];
  packageReferences: PackageReference[];
  targetFramework: string;
  outputType: "WinExe" | "Exe";
}

export interface TemplateFile {
  path: string;
  content: string;
  type: "xaml" | "csharp" | "project" | "config" | "manifest";
}

export interface InstantiatedTemplate {
  framework: string;
  files: InstantiatedFile[];
  packageReferences: PackageReference[];
  targetFramework: string;
  outputType: "WinExe" | "Exe";
}

export interface InstantiatedFile {
  path: string;
  content: string;
  type: "xaml" | "csharp" | "project" | "config" | "manifest";
}

export class TemplateManager {
  private templates: Map<string, Template> = new Map();

  constructor() {
    this.registerDefaultTemplates();
  }

  /**
   * Get a template for the specified framework
   */
  getTemplate(framework: string): Template | undefined {
    const normalizedFramework = framework.toLowerCase();
    return this.templates.get(normalizedFramework);
  }

  /**
   * Check if a template exists for the given framework
   */
  hasTemplate(framework: string): boolean {
    const normalizedFramework = framework.toLowerCase();
    return this.templates.has(normalizedFramework);
  }

  /**
   * Instantiate a template with the given project name and namespace
   */
  instantiateTemplate(
    template: Template,
    projectName: string,
    namespace?: string,
  ): InstantiatedTemplate {
    const ns = namespace || projectName;
    const safeProjectName = this.sanitizeProjectName(projectName);

    const instantiatedFiles: InstantiatedFile[] = template.files.map(
      (file) => ({
        path: this.replacePlaceholders(file.path, safeProjectName, ns),
        content: this.replacePlaceholders(file.content, safeProjectName, ns),
        type: file.type,
      }),
    );

    return {
      framework: template.framework,
      files: instantiatedFiles,
      packageReferences: template.packageReferences,
      targetFramework: template.targetFramework,
      outputType: template.outputType,
    };
  }

  /**
   * Replace placeholders in template content
   * Supported placeholders:
   *   - {{ProjectName}}: The sanitized project name
   *   - {{Namespace}}: The project namespace
   *   - {{TargetFramework}}: The target .NET framework version
   */
  private replacePlaceholders(
    content: string,
    projectName: string,
    namespace: string,
  ): string {
    return content
      .replace(/\{\{ProjectName\}\}/g, projectName)
      .replace(/\{\{Namespace\}\}/g, namespace)
      .replace(/\{\{TargetFramework\}\}/g, "net8.0-windows");
  }

  /**
   * Sanitize project name for use in identifiers
   */
  private sanitizeProjectName(name: string): string {
    // Remove invalid characters and ensure it starts with a letter
    let sanitized = name.replace(/[^a-zA-Z0-9_]/g, "");
    if (!/^[a-zA-Z]/.test(sanitized)) {
      sanitized = "App" + sanitized;
    }
    return sanitized;
  }

  /**
   * Get list of available template frameworks
   */
  getAvailableFrameworks(): string[] {
    return Array.from(this.templates.keys());
  }

  /**
   * Register all default templates
   */
  private registerDefaultTemplates(): void {
    this.registerWpfTemplate();
    this.registerWinUI3Template();
    this.registerWinFormsTemplate();
    this.registerConsoleTemplate();
    this.registerMauiTemplate();
  }

  /**
   * Register WPF template
   */
  private registerWpfTemplate(): void {
    const wpfTemplate: Template = {
      framework: "WPF",
      targetFramework: "net8.0-windows",
      outputType: "WinExe",
      packageReferences: [],
      files: [
        {
          path: "{{ProjectName}}.csproj",
          type: "project",
          content: `<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <OutputType>WinExe</OutputType>
    <TargetFramework>{{TargetFramework}}</TargetFramework>
    <UseWPF>true</UseWPF>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>

</Project>`,
        },
        {
          path: "App.xaml",
          type: "xaml",
          content: `<Application x:Class="{{Namespace}}.App"
             xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
             StartupUri="MainWindow.xaml">
    <Application.Resources>
         
    </Application.Resources>
</Application>`,
        },
        {
          path: "App.xaml.cs",
          type: "csharp",
          content: `using System.Windows;

namespace {{Namespace}};

public partial class App : Application
{
}`,
        },
        {
          path: "MainWindow.xaml",
          type: "xaml",
          content: `<Window x:Class="{{Namespace}}.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:d="http://schemas.microsoft.com/expression/blend/2008"
        xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
        mc:Ignorable="d"
        Title="{{ProjectName}}" Height="450" Width="800">
    <Grid>
        <TextBlock Text="Welcome to {{ProjectName}}!" 
                   HorizontalAlignment="Center" 
                   VerticalAlignment="Center"
                   FontSize="24"/>
    </Grid>
</Window>`,
        },
        {
          path: "MainWindow.xaml.cs",
          type: "csharp",
          content: `using System.Windows;

namespace {{Namespace}};

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
    }
}`,
        },
      ],
    };

    this.templates.set("wpf", wpfTemplate);
  }

  /**
   * Register WinUI 3 template
   */
  private registerWinUI3Template(): void {
    const winUI3Template: Template = {
      framework: "WinUI3",
      targetFramework: "net8.0-windows10.0.19041.0",
      outputType: "WinExe",
      packageReferences: [
        { name: "Microsoft.WindowsAppSDK", version: "1.5.240627000" },
        {
          name: "Microsoft.Windows.SDK.BuildTools",
          version: "10.0.22621.3233",
        },
      ],
      files: [
        {
          path: "{{ProjectName}}.csproj",
          type: "project",
          content: `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>WinExe</OutputType>
    <TargetFramework>{{TargetFramework}}</TargetFramework>
    <TargetPlatformMinVersion>10.0.17763.0</TargetPlatformMinVersion>
    <RootNamespace>{{Namespace}}</RootNamespace>
    <Platforms>x86;x64;ARM64</Platforms>
    <RuntimeIdentifiers>win-x86;win-x64;win-arm64</RuntimeIdentifiers>
    <PublishProfile>win-$(Platform).pubxml</PublishProfile>
    <UseWinUI>true</UseWinUI>
    <EnableMsixTooling>true</EnableMsixTooling>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Microsoft.WindowsAppSDK" Version="1.5.240627000" />
    <PackageReference Include="Microsoft.Windows.SDK.BuildTools" Version="10.0.22621.3233" />
  </ItemGroup>
</Project>`,
        },
        {
          path: "app.manifest",
          type: "manifest",
          content: `<?xml version="1.0" encoding="utf-8"?>
<assembly manifestVersion="1.0" xmlns="urn:schemas-microsoft-com:asm.v1">
  <assemblyIdentity version="1.0.0.0" name="{{ProjectName}}.app"/>
  <application xmlns="urn:schemas-microsoft-com:asm.v3">
    <windowsSettings>
      <dpiAwareness xmlns="http://schemas.microsoft.com/SMI/2016/WindowsSettings">PerMonitorV2</dpiAwareness>
      <longPathAware xmlns="http://schemas.microsoft.com/SMI/2016/WindowsSettings">true</longPathAware>
    </windowsSettings>
  </application>
</assembly>`,
        },
        {
          path: "App.xaml",
          type: "xaml",
          content: `<Application
    x:Class="{{Namespace}}.App"
    xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
    xmlns:local="using:{{Namespace}}">
    <Application.Resources>
        <ResourceDictionary>
            <ResourceDictionary.MergedDictionaries>
                <XamlControlsResources xmlns="using:Microsoft.UI.Xaml.Controls" />
            </ResourceDictionary.MergedDictionaries>
        </ResourceDictionary>
    </Application.Resources>
</Application>`,
        },
        {
          path: "App.xaml.cs",
          type: "csharp",
          content: `using Microsoft.UI.Xaml;

namespace {{Namespace}};

public partial class App : Application
{
    private Window? m_window;

    public App()
    {
        InitializeComponent();
    }

    protected override void OnLaunched(LaunchActivatedEventArgs args)
    {
        m_window = new MainWindow();
        m_window.Activate();
    }
}`,
        },
        {
          path: "MainWindow.xaml",
          type: "xaml",
          content: `<Window
    x:Class="{{Namespace}}.MainWindow"
    xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
    xmlns:local="using:{{Namespace}}"
    xmlns:d="http://schemas.microsoft.com/expression/blend/2008"
    xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
    mc:Ignorable="d">

    <StackPanel Orientation="Vertical" HorizontalAlignment="Center" VerticalAlignment="Center">
        <TextBlock Text="Welcome to {{ProjectName}}!" FontSize="24" />
        <Button x:Name="myButton" Click="myButton_Click">Click Me</Button>
    </StackPanel>
</Window>`,
        },
        {
          path: "MainWindow.xaml.cs",
          type: "csharp",
          content: `using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace {{Namespace}};

public sealed partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
    }

    private void myButton_Click(object sender, RoutedEventArgs e)
    {
        myButton.Content = "Clicked!";
    }
}`,
        },
      ],
    };

    this.templates.set("winui3", winUI3Template);
  }

  /**
   * Register WinForms template
   */
  private registerWinFormsTemplate(): void {
    const winFormsTemplate: Template = {
      framework: "WinForms",
      targetFramework: "net8.0-windows",
      outputType: "WinExe",
      packageReferences: [],
      files: [
        {
          path: "{{ProjectName}}.csproj",
          type: "project",
          content: `<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <OutputType>WinExe</OutputType>
    <TargetFramework>{{TargetFramework}}</TargetFramework>
    <UseWindowsForms>true</UseWindowsForms>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>

</Project>`,
        },
        {
          path: "Program.cs",
          type: "csharp",
          content: `using {{Namespace}};

namespace {{Namespace}};

static class Program
{
    [STAThread]
    static void Main()
    {
        ApplicationConfiguration.Initialize();
        Application.Run(new Form1());
    }
}`,
        },
        {
          path: "Form1.cs",
          type: "csharp",
          content: `namespace {{Namespace}};

public partial class Form1 : Form
{
    public Form1()
    {
        InitializeComponent();
    }

    private void InitializeComponent()
    {
        Text = "{{ProjectName}}";
        Size = new System.Drawing.Size(800, 450);

        var label = new Label
        {
            Text = "Welcome to {{ProjectName}}!",
            Font = new System.Drawing.Font("Segoe UI", 16F),
            AutoSize = true,
            Location = new System.Drawing.Point(250, 180)
        };

        Controls.Add(label);
    }
}`,
        },
      ],
    };

    this.templates.set("winforms", winFormsTemplate);
  }

  /**
   * Register Console template
   */
  private registerConsoleTemplate(): void {
    const consoleTemplate: Template = {
      framework: "Console",
      targetFramework: "net8.0",
      outputType: "Exe",
      packageReferences: [],
      files: [
        {
          path: "{{ProjectName}}.csproj",
          type: "project",
          content: `<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>{{TargetFramework}}</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>

</Project>`,
        },
        {
          path: "Program.cs",
          type: "csharp",
          content: `Console.WriteLine("Hello, World!");
Console.WriteLine("Welcome to {{ProjectName}}!");`,
        },
      ],
    };

    this.templates.set("console", consoleTemplate);
  }

  /**
   * Register MAUI template (Multi-platform App UI)
   * Note: MAUI requires additional SDK setup and is Windows-only in this implementation
   */
  private registerMauiTemplate(): void {
    const mauiTemplate: Template = {
      framework: "MAUI",
      targetFramework: "net8.0-windows",
      outputType: "WinExe",
      packageReferences: [
        { name: "Microsoft.Maui", version: "8.0.0" },
        { name: "Microsoft.Maui.Controls", version: "8.0.0" },
        { name: "Microsoft.Maui.Essentials", version: "8.0.0" },
      ],
      files: [
        {
          path: "{{ProjectName}}.csproj",
          type: "project",
          content: `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>WinExe</OutputType>
    <TargetFramework>{{TargetFramework}}</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <UseMaui>true</UseMaui>
    <SingleProject>true</SingleProject>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Microsoft.Maui" Version="8.0.0" />
    <PackageReference Include="Microsoft.Maui.Controls" Version="8.0.0" />
    <PackageReference Include="Microsoft.Maui.Essentials" Version="8.0.0" />
  </ItemGroup>
</Project>`,
        },
        {
          path: "App.xaml",
          type: "xaml",
          content: `<?xml version="1.0" encoding="utf-8" ?>
<Application xmlns="http://schemas.microsoft.com/winfx/2009/xaml"
             xmlns:x="http://schemas.microsoft.com/winfx/2009/xaml"
             x:Class="{{Namespace}}.App">
    <Application.Resources>
        <ResourceDictionary>
            <ResourceDictionary.MergedDictionaries>
                <ResourceDictionary Source="Resources/Styles/DefaultTheme.xaml" />
            </ResourceDictionary.MergedDictionaries>
        </ResourceDictionary>
    </Application.Resources>
</Application>`,
        },
        {
          path: "App.xaml.cs",
          type: "csharp",
          content: `using Microsoft.Maui;
using Microsoft.Maui.Controls;

namespace {{Namespace}};

public partial class App : Application
{
    public App()
    {
        InitializeComponent();
        MainPage = new MainPage();
    }
}`,
        },
        {
          path: "MainPage.xaml",
          type: "xaml",
          content: `<?xml version="1.0" encoding="utf-8" ?>
<ContentPage xmlns="http://schemas.microsoft.com/winfx/2009/xaml"
             xmlns:x="http://schemas.microsoft.com/winfx/2009/xaml"
             x:Class="{{Namespace}}.MainPage"
             BackgroundColor="White">
    <VerticalStackLayout VerticalOptions="Center" HorizontalOptions="Center">
        <Label Text="Welcome to {{ProjectName}}!"
               FontSize="24"
               HorizontalOptions="Center" />
        <Button Text="Click Me"
                Clicked="OnButtonClicked"
                HorizontalOptions="Center"
                Margin="0,20,0,0" />
    </VerticalStackLayout>
</ContentPage>`,
        },
        {
          path: "MainPage.xaml.cs",
          type: "csharp",
          content: `using Microsoft.Maui.Controls;

namespace {{Namespace}};

public partial class MainPage : ContentPage
{
    public MainPage()
    {
        InitializeComponent();
    }

    private void OnButtonClicked(object sender, EventArgs e)
    {
        (sender as Button).Text = "Clicked!";
    }
}`,
        },
        {
          path: "Platforms/Windows/App.xaml",
          type: "xaml",
          content: `<?xml version="1.0" encoding="utf-8" ?>
<Application xmlns="http://schemas.microsoft.com/winfx/2009/xaml"
             xmlns:x="http://schemas.microsoft.com/winfx/2009/xaml"
             x:Class="{{Namespace}}.Platforms.Windows.App">
</Application>`,
        },
        {
          path: "Platforms/Windows/App.xaml.cs",
          type: "csharp",
          content: `using Microsoft.Maui;
using Microsoft.Maui.Controls;

namespace {{Namespace}}.Platforms.Windows;

public class App : Application
{
    protected override void OnLaunched(LaunchActivatedEventArgs args)
    {
        base.OnLaunched(args);
        Microsoft.Maui.Controls.PlatformConfiguration.WindowsSpecific.Application
            .SetWindowTitleBar(this, null);
    }
}`,
        },
        {
          path: "Resources/Styles/DefaultTheme.xaml",
          type: "xaml",
          content: `<?xml version="1.0" encoding="utf-8" ?>
<ResourceDictionary xmlns="http://schemas.microsoft.com/winfx/2009/xaml"
             xmlns:x="http://schemas.microsoft.com/winfx/2009/xaml">
    <Style TargetType="Label">
        <Setter Property="TextColor" Value="Black" />
    </Style>
</ResourceDictionary>`,
        },
      ],
    };

    this.templates.set("maui", mauiTemplate);
  }
}

// Export singleton instance
export const templateManager = new TemplateManager();
