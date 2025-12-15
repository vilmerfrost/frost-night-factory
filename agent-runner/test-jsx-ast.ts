// agent-runner/test-jsx-ast.ts
/**
 * Regression test for AST-based JSX detection and stripping
 * Ensures generics don't trigger false-positives and real JSX is handled correctly
 */

import assert from "assert";
import { containsJsxAst, stripJsxAst } from "./lib/nightFactory/jsxAst";

const FILE = "C:\\fake\\src\\lib\\api.ts";

console.log("🧪 Testing AST-based JSX detection and stripping...\n");

// 1) Generics ska INTE räknas som JSX
console.log("Test 1: TypeScript generics should NOT trigger JSX detection");
const generics = `
export async function fetcher<T>(x: T): Promise<T> {
  return x;
}

export function mapper<T, U>(fn: (x: T) => U): (arr: T[]) => U[] {
  return (arr) => arr.map(fn);
}

export class Container<T> {
  constructor(private value: T) {}
  get(): T {
    return this.value;
  }
}
`;
assert.strictEqual(containsJsxAst(FILE, generics), false, "Generics should NOT be detected as JSX");
console.log("   ✅ Generics correctly ignored\n");

// 2) Riktig JSX ska hittas och stripas bort
console.log("Test 2: Real JSX should be detected and stripped");
const realJsx = `
export function X() {
  return <div className="x">hi</div>;
}

export function Y() {
  return (
    <div>
      <span>Hello</span>
      <button onClick={() => {}}>Click</button>
    </div>
  );
}

export function Z() {
  return <>Fragment</>;
}
`;
assert.strictEqual(containsJsxAst(FILE, realJsx), true, "Real JSX should be detected");
console.log("   ✅ Real JSX detected");

const stripped = stripJsxAst(FILE, realJsx);
assert.strictEqual(containsJsxAst(FILE, stripped), false, "Stripped content should have no JSX");
assert.ok(stripped.includes("null") || stripped.includes("return null") || stripped.includes("return (null)"), "JSX should be replaced with null");
console.log("   ✅ JSX stripped correctly\n");

// 3) Mixed case: generics + JSX
console.log("Test 3: Mixed generics and JSX");
const mixed = `
export function Component<T>(props: { data: T }) {
  return <div>{props.data}</div>;
}
`;
assert.strictEqual(containsJsxAst(FILE, mixed), true, "Mixed content should detect JSX");
const mixedStripped = stripJsxAst(FILE, mixed);
assert.strictEqual(containsJsxAst(FILE, mixedStripped), false, "Stripped mixed content should have no JSX");
console.log("   ✅ Mixed content handled correctly\n");

// 4) Edge case: JSX in comments (should not trigger)
console.log("Test 4: JSX in comments should not trigger");
const jsxInComments = `
// This is not JSX: <div>test</div>
export function test() {
  return "hello";
}
`;
assert.strictEqual(containsJsxAst(FILE, jsxInComments), false, "JSX in comments should NOT trigger");
console.log("   ✅ JSX in comments ignored\n");

// 5) Edge case: String literals with < >
console.log("Test 5: String literals with angle brackets should not trigger");
const stringLiterals = `
export function test() {
  const html = "<div>test</div>";
  const comparison = x < y && y > z;
  return html;
}
`;
assert.strictEqual(containsJsxAst(FILE, stringLiterals), false, "String literals should NOT trigger");
console.log("   ✅ String literals ignored\n");

console.log("✅ All tests passed! AST-based JSX detection/stripping is working correctly.");

