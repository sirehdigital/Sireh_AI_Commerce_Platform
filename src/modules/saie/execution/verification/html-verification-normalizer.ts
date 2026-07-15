import { createHash } from "node:crypto";

import {
  UnsafeHtmlVerificationError,
  type HtmlVerificationResult,
} from "./html-verification.types.js";

const WHITESPACE_SENSITIVE_ELEMENTS = new Set([
  "pre",
  "code",
  "textarea",
  "script",
  "style",
]);
const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

interface CanonicalHtml {
  readonly serialized: string;
  readonly hash: string;
}

interface HtmlAttributeToken {
  readonly name: string;
  readonly value: string | null;
}

type HtmlToken =
  | { readonly type: "start"; readonly name: string; readonly attributes: readonly HtmlAttributeToken[] }
  | { readonly type: "end"; readonly name: string }
  | { readonly type: "void"; readonly name: string; readonly attributes: readonly HtmlAttributeToken[] }
  | { readonly type: "text"; readonly value: string }
  | { readonly type: "sensitive-text"; readonly value: string }
  | { readonly type: "comment"; readonly value: string }
  | { readonly type: "declaration"; readonly value: string };

interface ParsedTag {
  readonly kind: "start" | "end" | "void";
  readonly name: string;
  readonly attributes: readonly HtmlAttributeToken[];
}

export class HtmlVerificationNormalizer {
  public compare(expected: string, actual: string): HtmlVerificationResult {
    const rawStringsEqual = expected === actual;

    try {
      const expectedCanonical = this.canonicalize(expected);
      const actualCanonical = this.canonicalize(actual);
      const canonicalStringsEqual = expectedCanonical.serialized === actualCanonical.serialized;

      return {
        equivalent: rawStringsEqual || canonicalStringsEqual,
        expectedCanonicalHash: expectedCanonical.hash,
        actualCanonicalHash: actualCanonical.hash,
        ...(rawStringsEqual || canonicalStringsEqual
          ? {}
          : { differenceReason: "Canonical semantic HTML representations differ." }),
        rawStringsEqual,
        canonicalStringsEqual,
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : "HTML could not be parsed safely.";
      return {
        equivalent: false,
        expectedCanonicalHash: this.hash(`unsafe-expected:${this.normalizeLineEndings(expected)}`),
        actualCanonicalHash: this.hash(`unsafe-actual:${this.normalizeLineEndings(actual)}`),
        differenceReason: `Fail-closed HTML verification: ${reason}`,
        rawStringsEqual,
        canonicalStringsEqual: false,
      };
    }
  }

  public canonicalize(html: string): CanonicalHtml {
    const tokens = this.tokenize(this.normalizeLineEndings(html));
    const serialized = JSON.stringify(tokens);
    return { serialized, hash: this.hash(serialized) };
  }

  private tokenize(source: string): readonly HtmlToken[] {
    const tokens: HtmlToken[] = [];
    const openElements: string[] = [];
    let cursor = 0;

    while (cursor < source.length) {
      const sensitiveElement = openElements.at(-1);
      if (sensitiveElement !== undefined && WHITESPACE_SENSITIVE_ELEMENTS.has(sensitiveElement)) {
        const closingStart = this.findSensitiveClosingTag(source, cursor, sensitiveElement);
        if (closingStart < 0) {
          throw new UnsafeHtmlVerificationError(`Unclosed whitespace-sensitive element: ${sensitiveElement}.`);
        }
        if (closingStart > cursor) {
          tokens.push({ type: "sensitive-text", value: source.slice(cursor, closingStart) });
          cursor = closingStart;
          continue;
        }
      }

      if (source[cursor] !== "<") {
        const nextTag = source.indexOf("<", cursor);
        const end = nextTag < 0 ? source.length : nextTag;
        this.appendNormalizedText(tokens, source.slice(cursor, end));
        cursor = end;
        continue;
      }

      if (source.startsWith("<!--", cursor)) {
        const commentEnd = source.indexOf("-->", cursor + 4);
        if (commentEnd < 0) {
          throw new UnsafeHtmlVerificationError("Unclosed HTML comment.");
        }
        tokens.push({ type: "comment", value: source.slice(cursor + 4, commentEnd) });
        cursor = commentEnd + 3;
        continue;
      }

      if (source.startsWith("<!", cursor)) {
        const declarationEnd = this.findTagEnd(source, cursor + 2);
        tokens.push({
          type: "declaration",
          value: source.slice(cursor + 2, declarationEnd).trim(),
        });
        cursor = declarationEnd + 1;
        continue;
      }

      if (source.startsWith("<?", cursor)) {
        throw new UnsafeHtmlVerificationError("Processing instructions are not supported.");
      }

      const tagEnd = this.findTagEnd(source, cursor + 1);
      const parsed = this.parseTag(source.slice(cursor + 1, tagEnd));

      if (parsed.kind === "end") {
        const expectedName = openElements.pop();
        if (expectedName !== parsed.name) {
          throw new UnsafeHtmlVerificationError(
            `Mismatched closing tag: expected ${expectedName ?? "none"}, received ${parsed.name}.`,
          );
        }
        tokens.push({ type: "end", name: parsed.name });
      } else if (parsed.kind === "void") {
        tokens.push({ type: "void", name: parsed.name, attributes: parsed.attributes });
      } else {
        tokens.push({ type: "start", name: parsed.name, attributes: parsed.attributes });
        openElements.push(parsed.name);
      }

      cursor = tagEnd + 1;
    }

    if (openElements.length > 0) {
      throw new UnsafeHtmlVerificationError(`Unclosed HTML element: ${openElements.at(-1)}.`);
    }

    return tokens;
  }

  private parseTag(markup: string): ParsedTag {
    let cursor = 0;
    cursor = this.skipWhitespace(markup, cursor);
    const closing = markup[cursor] === "/";
    if (closing) {
      cursor += 1;
      cursor = this.skipWhitespace(markup, cursor);
    }

    const nameStart = cursor;
    while (cursor < markup.length && this.isNameCharacter(markup[cursor]!)) {
      cursor += 1;
    }
    if (nameStart === cursor) {
      throw new UnsafeHtmlVerificationError("HTML tag is missing a valid name.");
    }

    const name = markup.slice(nameStart, cursor).toLowerCase();
    if (closing) {
      if (markup.slice(cursor).trim().length > 0) {
        throw new UnsafeHtmlVerificationError(`Closing tag ${name} contains unexpected content.`);
      }
      return { kind: "end", name, attributes: [] };
    }

    const attributes: HtmlAttributeToken[] = [];
    const attributeNames = new Set<string>();
    let selfClosing = false;

    while (cursor < markup.length) {
      cursor = this.skipWhitespace(markup, cursor);
      if (cursor >= markup.length) {
        break;
      }
      if (markup[cursor] === "/") {
        selfClosing = true;
        cursor += 1;
        cursor = this.skipWhitespace(markup, cursor);
        if (cursor !== markup.length) {
          throw new UnsafeHtmlVerificationError(`Self-closing tag ${name} contains trailing content.`);
        }
        break;
      }

      const attributeStart = cursor;
      while (
        cursor < markup.length &&
        !this.isWhitespace(markup[cursor]!) &&
        markup[cursor] !== "=" &&
        markup[cursor] !== "/"
      ) {
        cursor += 1;
      }
      if (attributeStart === cursor) {
        throw new UnsafeHtmlVerificationError(`Tag ${name} contains a malformed attribute.`);
      }

      const attributeName = markup.slice(attributeStart, cursor).toLowerCase();
      if (attributeNames.has(attributeName)) {
        throw new UnsafeHtmlVerificationError(`Tag ${name} contains duplicate attribute ${attributeName}.`);
      }
      attributeNames.add(attributeName);
      cursor = this.skipWhitespace(markup, cursor);

      let value: string | null = null;
      if (markup[cursor] === "=") {
        cursor += 1;
        cursor = this.skipWhitespace(markup, cursor);
        if (cursor >= markup.length) {
          throw new UnsafeHtmlVerificationError(`Attribute ${attributeName} is missing a value.`);
        }
        const quote = markup[cursor];
        if (quote === '"' || quote === "'") {
          cursor += 1;
          const valueStart = cursor;
          const valueEnd = markup.indexOf(quote, cursor);
          if (valueEnd < 0) {
            throw new UnsafeHtmlVerificationError(`Attribute ${attributeName} has an unclosed quote.`);
          }
          value = markup.slice(valueStart, valueEnd);
          cursor = valueEnd + 1;
        } else {
          const valueStart = cursor;
          while (
            cursor < markup.length &&
            !this.isWhitespace(markup[cursor]!) &&
            markup[cursor] !== "/"
          ) {
            cursor += 1;
          }
          if (valueStart === cursor) {
            throw new UnsafeHtmlVerificationError(`Attribute ${attributeName} is missing a value.`);
          }
          value = markup.slice(valueStart, cursor);
        }
      }

      attributes.push({ name: attributeName, value });
    }

    attributes.sort((left, right) =>
      left.name === right.name
        ? (left.value ?? "").localeCompare(right.value ?? "")
        : left.name.localeCompare(right.name),
    );
    const kind = selfClosing || VOID_ELEMENTS.has(name) ? "void" : "start";
    return { kind, name, attributes };
  }

  private appendNormalizedText(tokens: HtmlToken[], text: string): void {
    if (/^[\t\n\f ]*$/u.test(text)) {
      return;
    }
    tokens.push({ type: "text", value: text.replace(/[\t\n\f ]+/gu, " ") });
  }

  private findSensitiveClosingTag(source: string, cursor: number, name: string): number {
    const lowerSource = source.toLowerCase();
    const needle = `</${name}`;
    let candidate = lowerSource.indexOf(needle, cursor);

    while (candidate >= 0) {
      const tagEnd = this.findTagEnd(source, candidate + 2);
      const parsed = this.parseTag(source.slice(candidate + 1, tagEnd));
      if (parsed.kind === "end" && parsed.name === name) {
        return candidate;
      }
      candidate = lowerSource.indexOf(needle, candidate + needle.length);
    }

    return -1;
  }

  private findTagEnd(source: string, cursor: number): number {
    let quote: '"' | "'" | null = null;
    for (let index = cursor; index < source.length; index += 1) {
      const character = source[index]!;
      if (quote !== null) {
        if (character === quote) {
          quote = null;
        }
        continue;
      }
      if (character === '"' || character === "'") {
        quote = character;
      } else if (character === ">") {
        return index;
      } else if (character === "<") {
        throw new UnsafeHtmlVerificationError("Nested tag opener encountered before tag closure.");
      }
    }
    throw new UnsafeHtmlVerificationError("Unclosed HTML tag.");
  }

  private skipWhitespace(value: string, cursor: number): number {
    let next = cursor;
    while (next < value.length && this.isWhitespace(value[next]!)) {
      next += 1;
    }
    return next;
  }

  private isWhitespace(value: string): boolean {
    return value === " " || value === "\t" || value === "\n" || value === "\f";
  }

  private isNameCharacter(value: string): boolean {
    const code = value.codePointAt(0);
    return (
      code !== undefined &&
      ((code >= 48 && code <= 57) ||
        (code >= 65 && code <= 90) ||
        (code >= 97 && code <= 122) ||
        value === ":" ||
        value === "-" ||
        value === "_")
    );
  }

  private normalizeLineEndings(value: string): string {
    return value.replace(/\r\n?/gu, "\n");
  }

  private hash(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }
}
