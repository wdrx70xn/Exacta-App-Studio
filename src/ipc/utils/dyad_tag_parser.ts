import { normalizePath } from "../../../shared/normalizePath";
import { unescapeXmlAttr, unescapeXmlContent } from "../../../shared/xmlEscape";
import log from "electron-log";
import { SqlQuery } from "../../lib/schemas";

const logger = log.scope("dyad_tag_parser");

export function getDyadWriteTags(fullResponse: string): {
  path: string;
  content: string;
  description?: string;
}[] {
  const writeRegex = /<dyad-write([^>]*)>([\s\S]*?)<\/dyad-write>/gi;
  const pathRegex = /path="([^"]+)"/;
  const descriptionRegex = /description="([^"]+)"/;

  let match;
  const tags: { path: string; content: string; description?: string }[] = [];

  while ((match = writeRegex.exec(fullResponse)) !== null) {
    const attributesString = match[1];
    let content = unescapeXmlContent(match[2].trim());

    const pathMatch = pathRegex.exec(attributesString);
    const descriptionMatch = descriptionRegex.exec(attributesString);

    if (pathMatch && pathMatch[1]) {
      const path = unescapeXmlAttr(pathMatch[1]);
      const description = descriptionMatch?.[1]
        ? unescapeXmlAttr(descriptionMatch[1])
        : undefined;

      const contentLines = content.split("\n");
      if (contentLines[0]?.startsWith("```")) {
        contentLines.shift();
      }
      if (contentLines[contentLines.length - 1]?.startsWith("```")) {
        contentLines.pop();
      }
      content = contentLines.join("\n");

      tags.push({ path: normalizePath(path), content, description });
    } else {
      logger.warn(
        "Found write tag without a valid 'path' attribute:",
        match[0],
      );
    }
  }
  return tags;
}

export const getExactaWriteTags = getDyadWriteTags;

export function getDyadRenameTags(fullResponse: string): {
  from: string;
  to: string;
}[] {
  const renameRegex =
    /<dyad-rename from="([^"]+)" to="([^"]+)"[^>]*>([\s\S]*?)<\/dyad-rename>/g;
  let match;
  const tags: { from: string; to: string }[] = [];
  while ((match = renameRegex.exec(fullResponse)) !== null) {
    tags.push({
      from: normalizePath(unescapeXmlAttr(match[1])),
      to: normalizePath(unescapeXmlAttr(match[2])),
    });
  }
  return tags;
}

export const getExactaRenameTags = getDyadRenameTags;

export function getDyadDeleteTags(fullResponse: string): string[] {
  const deleteRegex =
    /<dyad-delete path="([^"]+)"[^>]*>([\s\S]*?)<\/dyad-delete>/g;
  let match;
  const paths: string[] = [];
  while ((match = deleteRegex.exec(fullResponse)) !== null) {
    paths.push(normalizePath(unescapeXmlAttr(match[1])));
  }
  return paths;
}

export const getExactaDeleteTags = getDyadDeleteTags;

export function getDyadAddDependencyTags(fullResponse: string): string[] {
  const addDependencyRegex =
    /<dyad-add-dependency packages="([^"]+)">[^<]*<\/dyad-add-dependency>/g;
  let match;
  const packages: string[] = [];
  while ((match = addDependencyRegex.exec(fullResponse)) !== null) {
    packages.push(...unescapeXmlAttr(match[1]).split(" "));
  }
  return packages;
}

export const getExactaAddDependencyTags = getDyadAddDependencyTags;

export function getDyadChatSummaryTag(fullResponse: string): string | null {
  const chatSummaryRegex =
    /<dyad-chat-summary>([\s\S]*?)<\/dyad-chat-summary>/g;
  const match = chatSummaryRegex.exec(fullResponse);
  if (match && match[1]) {
    return unescapeXmlContent(match[1].trim());
  }
  return null;
}

export const getExactaChatSummaryTag = getDyadChatSummaryTag;

export function getDyadExecuteSqlTags(fullResponse: string): SqlQuery[] {
  const executeSqlRegex =
    /<dyad-execute-sql([^>]*)>([\s\S]*?)<\/dyad-execute-sql>/g;
  const descriptionRegex = /description="([^"]+)"/;
  let match;
  const queries: { content: string; description?: string }[] = [];

  while ((match = executeSqlRegex.exec(fullResponse)) !== null) {
    const attributesString = match[1] || "";
    let content = unescapeXmlContent(match[2].trim());
    const descriptionMatch = descriptionRegex.exec(attributesString);
    const description = descriptionMatch?.[1]
      ? unescapeXmlAttr(descriptionMatch[1])
      : undefined;

    // Handle markdown code blocks if present
    const contentLines = content.split("\n");
    if (contentLines[0]?.startsWith("```")) {
      contentLines.shift();
    }
    if (contentLines[contentLines.length - 1]?.startsWith("```")) {
      contentLines.pop();
    }
    content = contentLines.join("\n");

    queries.push({ content, description });
  }

  return queries;
}

export const getExactaExecuteSqlTags = getDyadExecuteSqlTags;

export function getDyadCommandTags(fullResponse: string): string[] {
  const commandRegex = /<dyad-command type="([^"]+)"[^>]*><\/dyad-command>/g;
  let match;
  const commands: string[] = [];

  while ((match = commandRegex.exec(fullResponse)) !== null) {
    commands.push(unescapeXmlAttr(match[1]));
  }

  return commands;
}

export const getExactaCommandTags = getDyadCommandTags;

export function getDyadSearchReplaceTags(fullResponse: string): {
  path: string;
  content: string;
  description?: string;
}[] {
  const searchReplaceRegex =
    /<dyad-search-replace([^>]*)>([\s\S]*?)<\/dyad-search-replace>/gi;
  const pathRegex = /path="([^"]+)"/;
  const descriptionRegex = /description="([^"]+)"/;

  let match;
  const tags: { path: string; content: string; description?: string }[] = [];

  while ((match = searchReplaceRegex.exec(fullResponse)) !== null) {
    const attributesString = match[1] || "";
    let content = unescapeXmlContent(match[2].trim());

    const pathMatch = pathRegex.exec(attributesString);
    const descriptionMatch = descriptionRegex.exec(attributesString);

    if (pathMatch && pathMatch[1]) {
      const path = unescapeXmlAttr(pathMatch[1]);
      const description = descriptionMatch?.[1]
        ? unescapeXmlAttr(descriptionMatch[1])
        : undefined;

      // Handle markdown code fences if present
      const contentLines = content.split("\n");
      if (contentLines[0]?.startsWith("```")) {
        contentLines.shift();
      }
      if (contentLines[contentLines.length - 1]?.startsWith("```")) {
        contentLines.pop();
      }
      content = contentLines.join("\n");

      tags.push({ path: normalizePath(path), content, description });
    } else {
      logger.warn(
        "Found search-replace tag without a valid 'path' attribute:",
        match[0],
      );
    }
  }
  return tags;
}

export const getExactaSearchReplaceTags = getDyadSearchReplaceTags;

/**
 * Parse <dyad-add-nuget packages="..."> tags for NuGet package installation.
 * Used by Windows-only app builder for .NET projects.
 */
export function getDyadAddNugetTags(fullResponse: string): string[] {
  const addNugetRegex =
    /<dyad-add-nuget packages="([^"]+)">[^<]*<\/dyad-add-nuget>/g;
  let match;
  const packages: string[] = [];
  while ((match = addNugetRegex.exec(fullResponse)) !== null) {
    packages.push(...unescapeXmlAttr(match[1]).split(" "));
  }
  return packages;
}

export const getExactaAddNugetTags = getDyadAddNugetTags;

/**
 * Parse <dyad-dotnet-command cmd="..." args="..."> tags for .NET CLI commands.
 * Used by Windows-only app builder for executing dotnet commands.
 */
export function getDyadDotnetCommandTags(
  fullResponse: string,
): { cmd: string; args?: string }[] {
  const dotnetCommandRegex =
    /<dyad-dotnet-command cmd="([^"]+)"(?: args="([^"]*)")?[^>]*>([\s\S]*?)<\/dyad-dotnet-command>/g;
  let match;
  const commands: { cmd: string; args?: string }[] = [];
  while ((match = dotnetCommandRegex.exec(fullResponse)) !== null) {
    commands.push({
      cmd: unescapeXmlAttr(match[1]),
      args: match[2] ? unescapeXmlAttr(match[2]) : undefined,
    });
  }
  return commands;
}

export const getExactaDotnetCommandTags = getDyadDotnetCommandTags;
