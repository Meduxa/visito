import { describe, expect, it } from "vitest";
import { shortUrl, slugFromHost } from "./site";

describe("short addresses", () => {
  it("finds the business from the host", () => {
    expect(slugFromHost("teka.visito.ge", "visito.ge")).toBe("teka");
    expect(slugFromHost("Salon-Nino.Visito.ge", "visito.ge")).toBe("salon-nino");
    expect(slugFromHost("demo-salon.localhost:3000", "localhost:3000")).toBe("demo-salon");
  });
  it("ignores the main site, our own names, deeper hosts and other domains", () => {
    expect(slugFromHost("visito.ge", "visito.ge")).toBeNull();
    expect(slugFromHost("www.visito.ge", "visito.ge")).toBeNull();
    expect(slugFromHost("admin.visito.ge", "visito.ge")).toBeNull();
    expect(slugFromHost("a.b.visito.ge", "visito.ge")).toBeNull();
    expect(slugFromHost("teka.evil-visito.ge", "visito.ge")).toBeNull();
    expect(slugFromHost("teka.visito.ge", "")).toBeNull();
    expect(slugFromHost(null, "visito.ge")).toBeNull();
  });
  it("builds the short address only when switched on", () => {
    expect(shortUrl("teka", "visito.ge", true)).toBe("https://teka.visito.ge");
    expect(shortUrl("teka", "localhost:3000", false)).toBe("http://teka.localhost:3000");
    expect(shortUrl("teka", "", true)).toBeNull();
  });
});
