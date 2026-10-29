import { describe, expect, it } from "vitest";
import { escapeXml, parseBadgeStyle, renderBadge, type BadgeStyle } from "@/lib/badge";

const STYLES: BadgeStyle[] = ["flat", "flat-square", "for-the-badge"];
const HOSTILE = `<script>alert("x")</script> & 'y'`;

describe("escapeXml", () => {
  it("escapes every XML-significant character", () => {
    expect(escapeXml(`<a href="x" title='y'>&</a>`)).toBe(
      "&lt;a href=&quot;x&quot; title=&apos;y&apos;&gt;&amp;&lt;/a&gt;"
    );
  });

  it("does not double-escape when ampersands come first", () => {
    expect(escapeXml("&lt;")).toBe("&amp;lt;");
  });
});

describe("parseBadgeStyle", () => {
  it("accepts known styles and defaults to flat", () => {
    expect(parseBadgeStyle("flat-square")).toBe("flat-square");
    expect(parseBadgeStyle("for-the-badge")).toBe("for-the-badge");
    expect(parseBadgeStyle(null)).toBe("flat");
    expect(parseBadgeStyle('"><script>')).toBe("flat");
  });
});

describe("renderBadge", () => {
  it.each(STYLES)("escapes label and value in the %s style", (style) => {
    const svg = renderBadge({ style, label: HOSTILE, value: HOSTILE, color: "#22c55e" });
    expect(svg).not.toContain("<script");
    expect(svg).not.toMatch(/"x"/);
    expect(svg).toContain("&lt;");
    expect(svg.startsWith("<svg")).toBe(true);
  });

  it("renders label, value and color", () => {
    const svg = renderBadge({ style: "flat", label: "commit story", value: "12 commits", color: "#22c55e" });
    expect(svg).toContain("<title>commit story: 12 commits</title>");
    expect(svg).toContain('fill="#22c55e"');
  });

  it("uppercases text for the for-the-badge style", () => {
    const svg = renderBadge({ style: "for-the-badge", label: "a", value: "b", color: "#000" });
    expect(svg).toContain(">A</text>");
    expect(svg).toContain(">B</text>");
  });

  it("rejects a color that is not a hex literal", () => {
    expect(() =>
      renderBadge({ style: "flat", label: "a", value: "b", color: '#fff"/><script>' })
    ).toThrow(TypeError);
  });
});
