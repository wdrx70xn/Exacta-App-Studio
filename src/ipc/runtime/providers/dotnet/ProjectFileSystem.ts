import path from "node:path";
import fs from "fs-extra";

export interface ProjectFileUpdate {
  path: string;
  type: "xaml" | "csharp" | "resource" | "config" | "project";
}

export class ProjectFileSystem {
  /**
   * Generates a C# namespace based on project name and relative path
   */
  generateNamespace(projectName: string, relativePath: string): string {
    const dir = path.dirname(relativePath);
    const sanitizedProject = this.sanitizeIdentifier(projectName);

    if (dir === "." || dir === "") return sanitizedProject;

    const parts = dir
      .split(/[\\/]/)
      .filter((p) => p && p !== ".")
      .map((p) => this.sanitizeIdentifier(p));
    return [sanitizedProject, ...parts].join(".");
  }

  /**
   * Updates the .csproj file to include specific files if necessary.
   * For modern SDK-style projects, most files are auto-included,
   * but explicit Page or Resource entries can be required for specific build actions.
   */
  async syncCsproj(
    csprojPath: string,
    files: ProjectFileUpdate[],
  ): Promise<void> {
    if (!(await fs.pathExists(csprojPath))) {
      throw new Error(`Project file not found: ${csprojPath}`);
    }

    let content = await fs.readFile(csprojPath, "utf-8");
    let modified = false;

    // We use a simple but robust check for existing includes
    for (const file of files) {
      if (file.type === "project") continue;

      const normalizedPath = file.path.replace(/\//g, "\\");
      const includePattern = `Include="${normalizedPath}"`;

      if (!content.includes(includePattern)) {
        const tag = this.getItemGroupTag(file.type);
        content = this.addToFileItemGroup(content, tag, normalizedPath);
        modified = true;
      }
    }

    if (modified) {
      await fs.writeFile(csprojPath, content, "utf-8");
    }
  }

  /**
   * Ensures a XAML file has the correct x:Class attribute matching the namespace
   */
  async pairXaml(xamlPath: string, projectName: string): Promise<void> {
    if (!(await fs.pathExists(xamlPath))) return;

    let content = await fs.readFile(xamlPath, "utf-8");
    
    const namespace = this.generateNamespace(projectName, xamlPath);
    const className = path.basename(xamlPath, ".xaml");
    const expectedClass = `${namespace}.${className}`;

    const xClassMatch = content.match(/x:Class="([^"]+)"/);
    if (xClassMatch && xClassMatch[1] !== expectedClass) {
      content = content.replace(xClassMatch[0], `x:Class="${expectedClass}"`);
      await fs.writeFile(xamlPath, content, "utf-8");
    } else if (!xClassMatch) {
      // Try to insert x:Class into the root element
      content = content.replace(
        /<([a-zA-Z]+)/,
        `<$1 x:Class="${expectedClass}"`,
      );
      await fs.writeFile(xamlPath, content, "utf-8");
    }
  }

  private getItemGroupTag(type: ProjectFileUpdate["type"]): string {
    switch (type) {
      case "xaml":
        return "Page";
      case "resource":
        return "Resource";
      case "config":
        return "None";
      default:
        return "Compile";
    }
  }

  private addToFileItemGroup(
    content: string,
    tag: string,
    include: string,
  ): string {
    const entry = `    <${tag} Include="${include}" />\n`;

    // Try to find an existing ItemGroup for this tag
    const itemGroupRegex = new RegExp(
      `<ItemGroup>\\s*(?:<${tag}\\s+[^>]*>\\s*)*\\s*</ItemGroup>`,
      "g",
    );
    const match = content.match(itemGroupRegex);

    if (match) {
      return content.replace(
        match[0],
        match[0].replace("</ItemGroup>", `${entry}  </ItemGroup>`),
      );
    }

    // Otherwise, find the last ItemGroup or insert before </Project>
    const lastItemGroupMatch = content.lastIndexOf("</ItemGroup>");
    if (lastItemGroupMatch !== -1) {
      const insertPos = lastItemGroupMatch + "</ItemGroup>".length;
      return (
        content.slice(0, insertPos) +
        `\n  <ItemGroup>\n${entry}  </ItemGroup>` +
        content.slice(insertPos)
      );
    }

    return content.replace(
      "</Project>",
      `  <ItemGroup>\n${entry}  </ItemGroup>\n</Project>`,
    );
  }

  private sanitizeIdentifier(name: string): string {
    // Basic C# identifier rules
    return name.replace(/[^a-zA-Z0-9_]/g, "_").replace(/^[0-9]/, "_$0");
  }
}

export const projectFileSystem = new ProjectFileSystem();
