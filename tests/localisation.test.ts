import { describe, it, expect } from "vitest";
import { readFile, readdir } from "node:fs/promises";
import ts from "typescript";
import { en } from "../packages/i18n/src/catalogue";
function lookup(key: string) {
  return key.split(".").reduce((value: any, part) => value?.[part], en);
}
async function files(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((e) =>
        e.isDirectory()
          ? files(dir + "/" + e.name)
          : Promise.resolve([dir + "/" + e.name]),
      ),
    )
  ).flat();
}
describe("shared translation contract", () => {
  it("resolves every statically referenced interface key", async () => {
    const missing: string[] = [];
    for (const name of await files("packages/ui/src")) {
      if (!/\.tsx?$/.test(name)) continue;
      const source = ts.createSourceFile(
        name,
        await readFile(name, "utf8"),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );
      function visit(node: ts.Node) {
        if (
          ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === "t" &&
          node.arguments[0] &&
          ts.isStringLiteral(node.arguments[0])
        ) {
          const key = node.arguments[0].text;
          if (!lookup(key) && !lookup(key + "_one"))
            missing.push(name + ":" + key);
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
    expect(missing).toEqual([]);
  });
  it("keeps catalogue values nonempty and interpolation placeholders balanced", () => {
    let count = 0;
    function visit(value: any) {
      for (const child of Object.values(value)) {
        if (typeof child === "object") {
          visit(child);
          continue;
        }
        expect(typeof child).toBe("string");
        expect(String(child).trim().length).toBeGreaterThan(0);
        const stripped = String(child).replace(/{{[A-Za-z_]+}}/g, "");
        expect(stripped).not.toMatch(/{{|}}/);
        count++;
      }
    }
    visit(en);
    expect(count).toBeGreaterThan(250);
  });
});
