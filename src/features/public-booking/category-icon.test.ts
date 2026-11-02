import { describe, expect, it } from "vitest";
import { categoryIconKey } from "./category-icon";

describe("categoryIconKey", () => {
  // category names seen on real Georgian salon pages
  it.each([
    ["ცხიმის წვა", "body"],
    ["აპარატული მასაჟი", "massage"],
    ["კოსმეტოლოგია/სახის მოვლა", "face"],
    ["ხელის მასაჟი", "massage"],
    ["თმის სტილისტი", "hair"],
    ["დიოდური ეპილაცია", "laser"],
    ["ლიმფოდრენაჟი", "lymph"],
    ["აპარატული კოსმეტოლოგია", "device"],
    ["კოსმეტოლოგია / ინექციები", "injection"],
    ["თმის მოვლა", "hair"],
    ["თმა", "hair"],
    ["ფრჩხილები", "nails"],
    ["მანიკური", "nails"],
    ["პედიკური", "pedicure"],
    ["წარბები და წამწამები", "lashes"],
    ["მაკიაჟი", "makeup"],
    ["შეღებვა", "color"],
    ["ბარბერი", "hair"],
    ["სტომატოლოგია", "dental"],
    ["ჰიგიენა", "dentalCare"],
    ["კბილის გათეთრება", "dentalCare"],
    ["კონსულტაცია", "consult"],
    ["სასაჩუქრე პაკეტები", "gift"],
  ])("%s → %s", (name, icon) => {
    expect(categoryIconKey(name)).toBe(icon);
  });

  it("English and Russian", () => {
    expect(categoryIconKey("Hair")).toBe("hair");
    expect(categoryIconKey("Nails")).toBe("nails");
    expect(categoryIconKey("Laser hair removal")).toBe("laser");
    expect(categoryIconKey("Массаж")).toBe("massage");
    expect(categoryIconKey("Брови и ресницы")).toBe("lashes");
    expect(categoryIconKey("Стоматология")).toBe("dental");
  });

  it("anything unknown gets the general icon", () => {
    expect(categoryIconKey("სხვა")).toBe("other");
    expect(categoryIconKey("")).toBe("other");
  });
});
