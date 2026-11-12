// Ready services per business type (decision 028): picked on /services/templates,
// prices and durations are suggestions the business edits before adding.
// Names in all three languages so the booking page is translated from day one.
// Prices: typical Tbilisi prices in 2026, whole lari.

export type T3 = { ka: string; en: string; ru: string };
export type TemplateService = { name: T3; min: number; gel: number; from?: boolean };
export type TemplateCategory = { name: T3; services: TemplateService[] };
export type BusinessKind = (typeof businessKinds)[number];

export const businessKinds = [
  "hair",
  "barber",
  "nails",
  "brows",
  "cosmetology",
  "massage",
  "dental",
] as const;

const s = (ka: string, en: string, ru: string, min: number, gel: number, from = false): TemplateService => ({
  name: { ka, en, ru },
  min,
  gel,
  ...(from && { from: true }),
});
const c = (ka: string, en: string, ru: string, services: TemplateService[]): TemplateCategory => ({
  name: { ka, en, ru },
  services,
});

export const TEMPLATES: Record<BusinessKind, TemplateCategory[]> = {
  hair: [
    c("თმის შეჭრა", "Haircuts", "Стрижки", [
      s("ქალის შეჭრა", "Women's haircut", "Женская стрижка", 60, 50),
      s("მამაკაცის შეჭრა", "Men's haircut", "Мужская стрижка", 30, 30),
      s("ბავშვის შეჭრა", "Kids' haircut", "Детская стрижка", 30, 25),
      s("ბოლოების მოჭრა", "Trim", "Подравнивание кончиков", 30, 25),
    ]),
    c("თმის შეღებვა", "Colouring", "Окрашивание", [
      s("ძირების შეღებვა", "Root colour", "Окрашивание корней", 90, 80, true),
      s("სრული შეღებვა", "Full colour", "Полное окрашивание", 120, 120, true),
      s("ბალაიაჟი", "Balayage", "Балаяж", 180, 250, true),
      s("მელირება", "Highlights", "Мелирование", 150, 180, true),
      s("ტონირება", "Toning", "Тонирование", 60, 70, true),
    ]),
    c("ვარცხნილობა და მოვლა", "Styling & care", "Укладка и уход", [
      s("დავარცხნა / ფენით გაშრობა", "Blow-dry", "Укладка феном", 45, 35),
      s("სადღესასწაულო ვარცხნილობა", "Updo", "Праздничная причёска", 60, 80, true),
      s("კერატინით გასწორება", "Keratin treatment", "Кератиновое выпрямление", 180, 250, true),
      s("თმის ნიღაბი / მოვლა", "Hair treatment", "Уход за волосами", 30, 40),
    ]),
  ],
  barber: [
    c("შეჭრა", "Haircuts", "Стрижки", [
      s("მამაკაცის შეჭრა", "Men's haircut", "Мужская стрижка", 45, 35),
      s("ფეიდი", "Fade", "Фейд", 45, 40),
      s("საკრეჭით შეჭრა", "Clipper cut", "Стрижка машинкой", 30, 25),
      s("ბავშვის შეჭრა", "Kids' haircut", "Детская стрижка", 30, 25),
    ]),
    c("წვერი", "Beard", "Борода", [
      s("წვერის მოწესრიგება", "Beard trim", "Оформление бороды", 30, 25),
      s("სველი პარსვა", "Hot towel shave", "Бритьё с горячим полотенцем", 30, 30),
      s("შეჭრა + წვერი", "Haircut + beard", "Стрижка + борода", 60, 55),
    ]),
  ],
  nails: [
    c("მანიკური", "Manicure", "Маникюр", [
      s("კლასიკური მანიკური", "Classic manicure", "Классический маникюр", 45, 30),
      s("მანიკური გელ-ლაქით", "Gel polish manicure", "Маникюр с гель-лаком", 75, 50),
      s("ფრენჩი", "French manicure", "Френч", 90, 60),
      s("ფრჩხილის დაგრძელება", "Nail extensions", "Наращивание ногтей", 150, 100, true),
      s("გელ-ლაქის მოხსნა", "Gel polish removal", "Снятие гель-лака", 20, 15),
    ]),
    c("პედიკური", "Pedicure", "Педикюр", [
      s("კლასიკური პედიკური", "Classic pedicure", "Классический педикюр", 60, 45),
      s("პედიკური გელ-ლაქით", "Gel polish pedicure", "Педикюр с гель-лаком", 90, 65),
    ]),
  ],
  brows: [
    c("წარბები", "Brows", "Брови", [
      s("წარბების კორექცია", "Brow shaping", "Коррекция бровей", 30, 20),
      s("წარბების შეღებვა", "Brow tint", "Окрашивание бровей", 30, 20),
      s("წარბების ლამინირება", "Brow lamination", "Ламинирование бровей", 60, 60),
      s("წარბების მიკრობლეიდინგი", "Microblading", "Микроблейдинг", 150, 350, true),
    ]),
    c("წამწამები", "Lashes", "Ресницы", [
      s("წამწამების ლამინირება", "Lash lift", "Ламинирование ресниц", 60, 70),
      s(
        "წამწამების დაგრძელება — კლასიკა",
        "Classic lash extensions",
        "Наращивание ресниц — классика",
        120,
        90,
      ),
      s("წამწამების დაგრძელება — მოცულობა", "Volume lash extensions", "Наращивание ресниц — объём", 150, 120),
      s("წამწამების შეღებვა", "Lash tint", "Окрашивание ресниц", 20, 15),
    ]),
  ],
  cosmetology: [
    c("სახე", "Face", "Лицо", [
      s("სახის წმენდა", "Facial cleansing", "Чистка лица", 60, 80),
      s("ქიმიური პილინგი", "Chemical peel", "Химический пилинг", 45, 100, true),
      s("სახის მასაჟი", "Facial massage", "Массаж лица", 30, 50),
      s("ბიორევიტალიზაცია", "Biorevitalization", "Биоревитализация", 45, 300, true),
    ]),
    c("ინექციები", "Injections", "Инъекции", [
      s("ტუჩების კონტური", "Lip filler", "Контурная пластика губ", 45, 450, true),
      s("ბოტოქსი", "Botox", "Ботокс", 30, 400, true),
      s("კონსულტაცია", "Consultation", "Консультация", 30, 0),
    ]),
    c("ეპილაცია", "Hair removal", "Эпиляция", [
      s(
        "ლაზერული ეპილაცია — მცირე ზონა",
        "Laser hair removal — small area",
        "Лазерная эпиляция — малая зона",
        20,
        40,
        true,
      ),
      s("ცვილით ეპილაცია", "Waxing", "Восковая эпиляция", 30, 30, true),
    ]),
  ],
  massage: [
    c("მასაჟი", "Massage", "Массаж", [
      s("კლასიკური მასაჟი", "Classic massage", "Классический массаж", 60, 70),
      s("რელაქს მასაჟი", "Relaxing massage", "Расслабляющий массаж", 60, 70),
      s("ღრმა ქსოვილის მასაჟი", "Deep tissue massage", "Глубокий массаж тканей", 60, 90),
      s("ცხელი ქვებით მასაჟი", "Hot stone massage", "Массаж горячими камнями", 75, 100),
      s("ანტიცელულიტური მასაჟი", "Anti-cellulite massage", "Антицеллюлитный массаж", 45, 60),
      s("ლიმფოდრენაჟი", "Lymphatic drainage", "Лимфодренаж", 60, 80),
    ]),
    c("სპა", "Spa", "Спа", [
      s("ტანის შეხვევა", "Body wrap", "Обёртывание", 60, 90),
      s("ტანის სკრაბი", "Body scrub", "Скраб для тела", 45, 60),
      s("სპა პაკეტი", "Spa package", "Спа-программа", 120, 180, true),
    ]),
  ],
  dental: [
    c("პროფილაქტიკა", "Prevention", "Профилактика", [
      s("კონსულტაცია და გასინჯვა", "Check-up and consultation", "Осмотр и консультация", 30, 30),
      s("პროფესიონალური წმენდა", "Professional cleaning", "Профессиональная чистка", 60, 120),
      s("კბილების გათეთრება", "Teeth whitening", "Отбеливание зубов", 90, 400, true),
    ]),
    c("მკურნალობა", "Treatment", "Лечение", [
      s("კარიესის მკურნალობა / ბჟენი", "Filling", "Лечение кариеса / пломба", 60, 100, true),
      s("არხის მკურნალობა", "Root canal treatment", "Лечение каналов", 90, 250, true),
      s("კბილის ამოღება", "Tooth extraction", "Удаление зуба", 45, 80, true),
    ]),
    c("ორთოპედია და იმპლანტაცია", "Prosthetics & implants", "Ортопедия и имплантация", [
      s("კერამიკული გვირგვინი", "Ceramic crown", "Керамическая коронка", 60, 600, true),
      s("იმპლანტის კონსულტაცია", "Implant consultation", "Консультация по имплантации", 30, 0),
    ]),
  ],
};

/** The business type that fits a Visito business best, to preselect on the page. */
export const defaultKind = (type: "salon" | "dental"): BusinessKind =>
  type === "dental" ? "dental" : "hair";
