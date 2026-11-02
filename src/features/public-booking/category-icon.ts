// A small icon for each service category, picked from the category's name
// (Georgian, English or Russian) — businesses type their own categories, so the
// icon follows the words. The first matching rule wins; more specific rules
// come first ("აპარატული მასაჟი" is a massage, "კოსმეტოლოგია / ინექციები" injections).

export const CATEGORY_ICONS = [
  "lymph",
  "pedicure",
  "nails",
  "laser",
  "wax",
  "injection",
  "massage",
  "device",
  "color",
  "hair",
  "lashes",
  "makeup",
  "face",
  "body",
  "tan",
  "spa",
  "dentalCare",
  "dental",
  "consult",
  "tattoo",
  "kids",
  "gift",
  "care",
  "other",
] as const;
export type CategoryIconKey = (typeof CATEGORY_ICONS)[number];

const RULES: [CategoryIconKey, RegExp][] = [
  ["lymph", /ლიმფო|lymph|лимфо/],
  ["pedicure", /პედიკ|pedic|педик|ფეხ|foot|feet|стоп/],
  ["nails", /ფრჩხილ|მანიკ|nail|manic|ногт|маник/],
  ["laser", /ეპილაც|ლაზერ|დიოდ|epil|laser|hair ?removal|эпиляц|лазер|диод/],
  ["wax", /ცვილ|შუგარ|დეპილაც|wax|sugar|depil|воск|шугар|депиляц/],
  ["injection", /ინექც|ბოტოქს|ფილერ|მეზო|inject|botox|filler|meso|инъек|ботокс|филлер|мезо/],
  ["massage", /მასაჟ|massag|массаж/],
  ["device", /აპარატ|hardware|device|аппарат/],
  ["color", /შეღებ|ღებვ|მელირ|ბალაიაჟ|colou?r|dye|balayage|highlight|окраш|колор|мелир/],
  ["hair", /თმ|ვარცხნ|ბარბერ|წვერ|hair|barber|beard|cut|волос|стриж|барбер|бород|причес/],
  ["lashes", /წარბ|წამწამ|brow|lash|бров|ресниц/],
  ["makeup", /მაკიაჟ|ვიზაჟ|make-?up|визаж|макияж/],
  ["face", /კოსმეტ|სახ|კან|ფილინგ|პილინგ|cosmet|facial|face|skin|peel|космет|лиц|кож|пилинг/],
  ["body", /ცხიმ|სხეულ|წონ|ცელულიტ|body|fat|slim|cellulite|тел|похуд|целлюлит|жир/],
  ["tan", /სოლარ|რუჯ|tan|solar|загар|солярий/],
  ["spa", /სპა|აბაზან|საუნ|spa|sauna|bath|сауна|спа/],
  ["dentalCare", /ჰიგიენ|გათეთრ|hygien|whiten|clean|гигиен|отбел|чистк/],
  ["dental", /სტომ|კბილ|ორთოდ|იმპლანტ|dent|tooth|teeth|ortho|implant|стомат|зуб|ортод|имплант/],
  ["consult", /კონსულტ|დიაგნ|შემოწმ|consult|diagn|check|консульт|диагн|осмотр/],
  ["tattoo", /ტატუ|პირსინგ|ტატუაჟ|tattoo|pierc|тату|пирсинг/],
  ["kids", /ბავშ|საბავშვ|kid|child|детск|ребен/],
  ["gift", /პაკეტ|სასაჩუქრ|ვაუჩერ|package|gift|voucher|пакет|подар|сертификат/],
  ["care", /მოვლ|care|уход/],
];

export function categoryIconKey(name: string): CategoryIconKey {
  const n = name.toLowerCase();
  return RULES.find(([, re]) => re.test(n))?.[0] ?? "other";
}
