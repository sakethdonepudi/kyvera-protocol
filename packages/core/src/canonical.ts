/**
 * KYVERA canonical JSON (KCJ-1).
 *
 * Deterministic, byte-level serialization used for every signed payload.
 * Rules (documented in docs/PROTOCOL.md):
 *  - UTF-8, no whitespace, keys sorted by UTF-16 code unit order.
 *  - Only null, booleans, integers (|n| <= 2^53-1), strings, arrays and plain objects.
 *  - Strings are Unicode NFC normalized before serialization.
 *  - Floating point numbers, undefined, bigint, symbols, functions and class
 *    instances are rejected. This removes serializer ambiguity entirely.
 *
 * The output must be byte-identical across JavaScript runtimes, so callers MUST
 * reject any record whose published text is not exactly `canonicalize(parsed)`.
 */

const MAX_SAFE = Number.MAX_SAFE_INTEGER;

export class CanonicalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CanonicalizationError";
  }
}

export function canonicalize(value: unknown): string {
  return encode(value, 0);
}

function encode(value: unknown, depth: number): string {
  if (depth > 32) throw new CanonicalizationError("nesting too deep");

  if (value === null) return "null";

  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";
    case "number":
      if (!Number.isInteger(value) || !Number.isSafeInteger(value) || Math.abs(value) > MAX_SAFE) {
        throw new CanonicalizationError("only safe integers are allowed");
      }
      // Avoid -0 serializing as "0" ambiguity: normalize -0 to 0.
      return Object.is(value, -0) ? "0" : String(value);
    case "string":
      return JSON.stringify(value.normalize("NFC"));
    case "object":
      break;
    default:
      throw new CanonicalizationError(`unsupported type: ${typeof value}`);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => encode(item, depth + 1)).join(",")}]`;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new CanonicalizationError("only plain objects are allowed");
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const parts: string[] = [];
  for (const key of keys) {
    const child = record[key];
    if (child === undefined) throw new CanonicalizationError(`undefined value at key "${key}"`);
    parts.push(`${JSON.stringify(key)}:${encode(child, depth + 1)}`);
  }
  return `{${parts.join(",")}}`;
}

/**
 * Returns true when `text` is exactly the canonical encoding of the value it
 * parses to. Used to reject non-canonical (malleable) published records.
 */
export function isCanonicalJson(text: string): boolean {
  try {
    return canonicalize(JSON.parse(text)) === text;
  } catch {
    return false;
  }
}

export function hasExactKeys(value: unknown, expected: readonly string[]): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  const want = [...expected].sort();
  return keys.length === want.length && keys.every((key, index) => key === want[index]);
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
  );
}
