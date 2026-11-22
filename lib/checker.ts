// Real syntax checks for the files agents produce.
import ts from "typescript";

export function checkCode(path: string, code: string): { ok: boolean; skipped?: boolean; error?: string } {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  try {
    if (ext === "json") {
      JSON.parse(code);
      return { ok: true };
    }
    if (["js", "jsx", "mjs", "cjs", "ts", "tsx"].includes(ext)) {
      const out = ts.transpileModule(code, {
        fileName: path,
        reportDiagnostics: true,
        compilerOptions: { jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
      });
      const diags = (out.diagnostics || []).filter((d) => d.category === ts.DiagnosticCategory.Error);
      if (diags.length) {
        const d = diags[0];
        const pos = d.file && d.start !== undefined ? d.file.getLineAndCharacterOfPosition(d.start) : null;
        return { ok: false, error: `${pos ? `line ${pos.line + 1}: ` : ""}${ts.flattenDiagnosticMessageText(d.messageText, " ")}` };
      }
      return { ok: true };
    }
    if (ext === "py") return pyCheck(code);
    return { ok: true, skipped: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// Light Python 3 checks: catches Python 2 leftovers and bracket mistakes.
function pyCheck(code: string) {
  const lines = code.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].replace(/#.*$/, "");
    if (/^\s*print\s+[^(=\s]/.test(l)) return { ok: false, error: `line ${i + 1}: Python 2 print statement` };
    if (/except\s+\w+\s*,\s*\w+\s*:/.test(l)) return { ok: false, error: `line ${i + 1}: Python 2 except syntax` };
    if (/\burllib2\b|\.has_key\(|\bxrange\(|\braw_input\(/.test(l)) return { ok: false, error: `line ${i + 1}: Python 2 API` };
  }
  const stripped = code.replace(/("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|#.*)/g, "");
  const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  const stack: string[] = [];
  for (const ch of stripped) {
    if ("([{".includes(ch)) stack.push(ch);
    else if (pairs[ch]) {
      if (stack.pop() !== pairs[ch]) return { ok: false, error: `unbalanced ${ch}` };
    }
  }
  if (stack.length) return { ok: false, error: "unclosed bracket" };
  return { ok: true };
}
