import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import * as ts from "typescript";
import { describe, expect, it } from "vitest";

const sourceRoot = path.resolve(process.cwd(), "src");
const ignoredSourceFiles = new Set([
  "features/home-feed/company-identity.ts",
  "features/home-feed/mock-community.ts",
  "features/home-feed/mock-post-details.ts",
]);

const forbidden = [
  "가입 여부와 관계없이",
  "이메일 확인으로 계정을 보호하고",
  "해주세요",
  "있어요",
  "보여드려요",
  "해보세요",
  "이어보세요",
  "복구 세션",
  "그래프 응답",
  "운영 DB",
  "브라우저 원본",
  "미분류",
  "구분 안 됨",
  "기술 맵",
  "내 스택",
  "...",
] as const;

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(absolute);
    if (!/\.tsx?$/u.test(entry.name) || /\.(test|spec)\./u.test(entry.name)) {
      return [];
    }
    return [absolute];
  });
}

function visibleStringNodes(fileName: string, sourceText: string) {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const values: Array<{ line: number; value: string }> = [];

  function visit(node: ts.Node) {
    let value = "";
    if (ts.isJsxText(node)) {
      value = node.getText(sourceFile).replace(/\s+/gu, " ").trim();
    } else if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      value = node.text;
    }
    if (/[가-힣]/u.test(value) || value.includes("...")) {
      values.push({
        line:
          sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
            .line + 1,
        value,
      });
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return values;
}

function forbiddenCopyDiagnostics(fileName: string, sourceText: string) {
  const violations: string[] = [];

  for (const item of visibleStringNodes(fileName, sourceText)) {
    for (const phrase of forbidden) {
      if (item.value.includes(phrase)) {
        violations.push(
          `${fileName}:${item.line} contains ${JSON.stringify(phrase)}`,
        );
      }
    }
  }

  return violations;
}

describe("first-party Korean UX copy", () => {
  it("reports pure ASCII ellipses in each supported visible node", () => {
    const sourceText = [
      'const literal = "...";',
      "const jsx = <span>...</span>;",
      'const tail = `count ${count}...`;',
    ].join("\n");

    expect(forbiddenCopyDiagnostics("virtual-copy.tsx", sourceText)).toEqual([
      'virtual-copy.tsx:1 contains "..."',
      'virtual-copy.tsx:2 contains "..."',
      'virtual-copy.tsx:3 contains "..."',
    ]);
  });

  it("allows the Unicode ellipsis in visible strings", () => {
    const sourceText = [
      'const literal = "…";',
      "const jsx = <span>…</span>;",
      'const tail = `count ${count}…`;',
    ].join("\n");

    expect(forbiddenCopyDiagnostics("virtual-copy.tsx", sourceText)).toEqual(
      [],
    );
  });

  it("does not reintroduce rejected or inconsistent phrases", () => {
    const violations: string[] = [];

    for (const fileName of collectSourceFiles(sourceRoot)) {
      const relative = path.relative(sourceRoot, fileName).split(path.sep).join("/");
      if (ignoredSourceFiles.has(relative)) continue;

      violations.push(
        ...forbiddenCopyDiagnostics(relative, readFileSync(fileName, "utf8")),
      );
    }

    expect(violations).toEqual([]);
  });
});
