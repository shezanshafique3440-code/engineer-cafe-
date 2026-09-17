/**
 * Engineer Cafe — the cafe's actual printed menu.
 *
 * Prices are transcribed exactly from the menu board; nothing here is invented.
 * Where the board showed two prices on one line (e.g. "170/220") the item is
 * split into two orderable products so both prices stay editable from the
 * admin panel.
 *
 * Not included, because the price was not readable on the menu photo:
 *   کولڈ ڈرنکس (Cold Drinks), سٹنگ ڈرنکس (Sting), منرل واٹر (Mineral Water),
 *   اسپیشل لسی گلاس (Special Lassi Glass)
 * Add these from Admin → Products once their prices are confirmed.
 */

export type SeedProduct = {
  name: string;
  /** Name exactly as printed on the menu board. */
  urduName: string;
  description: string;
  longDescription?: string;
  price: number;
  discountPrice?: number;
  image: string;
  isPopular?: boolean;
  isFeatured?: boolean;
  isVegetarian?: boolean;
  spiceLevel?: "NONE" | "MILD" | "MEDIUM" | "HOT";
  prepTimeMinutes?: number;
  ingredients: string[];
  calories?: number;
  addonGroups?: string[];
};

/**
 * Menu art lives in /public/menu as hand-drawn SVG, one per dish, so no image
 * ever 404s and nothing depends on an outside host. Replace any of these with
 * a real photograph from Admin → Products whenever the cafe has one.
 */
const IMG = {
  chaiDoodh: "/menu/chai-doodh.svg",
  chaiGur: "/menu/chai-gur.svg",
  chaiBadam: "/menu/chai-badam.svg",
  chaiKashmiri: "/menu/chai-kashmiri.svg",
  chaiKettle: "/menu/chai-kettle.svg",
  qehwaBlack: "/menu/qehwa-black.svg",
  qehwaGreen: "/menu/qehwa-green.svg",
  qehwaMilk: "/menu/qehwa-milk.svg",
  coffee: "/menu/coffee.svg",
  parathaPlain: "/menu/paratha-plain.svg",
  parathaAloo: "/menu/paratha-aloo.svg",
  parathaCheese: "/menu/paratha-cheese.svg",
  parathaChicken: "/menu/paratha-chicken.svg",
  parathaChickenCheese: "/menu/paratha-chicken-cheese.svg",
  parathaEgg: "/menu/paratha-egg.svg",
  parathaSweet: "/menu/paratha-sweet.svg",
  parathaMalai: "/menu/paratha-malai.svg",
  rollChicken: "/menu/roll-chicken.svg",
  rollKabab: "/menu/roll-kabab.svg",
  eggHalf: "/menu/egg-half.svg",
  eggFull: "/menu/egg-full.svg",
  omelette: "/menu/omelette.svg",
  omeletteTamatar: "/menu/omelette-tamatar.svg",
  omeletteCheese: "/menu/omelette-cheese.svg",
  chanay: "/menu/chanay.svg",
  malai: "/menu/malai.svg",
  packaging: "/menu/packaging.svg",
};

export const CATEGORIES = [
  {
    name: "Chai",
    slug: "chai",
    icon: "☕",
    description: "چائے — gur wali, sada, kashmiri, qehwa aur kafi. Har cup order par bante hai.",
    image: IMG.chaiDoodh,
    sortOrder: 1,
  },
  {
    name: "Parathas",
    slug: "parathas",
    icon: "🥘",
    description: "پراٹھے — lachha, aloo, cheese, chicken aur roll parathay, tawe se seedha.",
    image: IMG.parathaAloo,
    sortOrder: 2,
  },
  {
    name: "Anday",
    slug: "anday",
    icon: "🍳",
    description: "انڈے — full fry, half fry aur omelette, paratha ke saath perfect.",
    image: IMG.omelette,
    sortOrder: 3,
  },
  {
    name: "Sides & Extras",
    slug: "sides-extras",
    icon: "🍲",
    description: "شکیل لاہوری چنے, ملائی پلیٹ aur baqi sab jo naashte ko mukammal karta hai.",
    image: IMG.chanay,
    sortOrder: 4,
  },
];

/**
 * Add-on groups. Every option here is priced at zero: the menu board does not
 * charge for sugar, milk or strength, and no price may be invented. Sizes that
 * the board does price are modelled as separate products instead.
 */
export const ADDON_GROUPS = [
  {
    name: "Sugar Level",
    slug: "sugar-level",
    type: "SINGLE" as const,
    isRequired: true,
    minSelect: 1,
    maxSelect: 1,
    sortOrder: 1,
    addons: [
      { name: "No Sugar (Pheeki)", price: 0 },
      { name: "Less Sugar", price: 0 },
      { name: "Normal Sugar", price: 0, isDefault: true },
      { name: "Extra Sugar", price: 0 },
    ],
  },
  {
    name: "Strength",
    slug: "strength",
    type: "SINGLE" as const,
    isRequired: false,
    minSelect: 0,
    maxSelect: 1,
    sortOrder: 2,
    addons: [
      { name: "Normal", price: 0, isDefault: true },
      { name: "Strong (Karak)", price: 0 },
    ],
  },
  {
    name: "Egg Style",
    slug: "egg-style",
    type: "SINGLE" as const,
    isRequired: false,
    minSelect: 0,
    maxSelect: 1,
    sortOrder: 1,
    addons: [
      { name: "Normal", price: 0, isDefault: true },
      { name: "Extra Karara (crispy)", price: 0 },
      { name: "Less Oil", price: 0 },
    ],
  },
  {
    name: "Paratha Style",
    slug: "paratha-style",
    type: "SINGLE" as const,
    isRequired: false,
    minSelect: 0,
    maxSelect: 1,
    sortOrder: 1,
    addons: [
      { name: "Normal", price: 0, isDefault: true },
      { name: "Extra Karara (crispy)", price: 0 },
      { name: "Less Oil", price: 0 },
      { name: "Cut in Pieces", price: 0 },
    ],
  },
];

const CHAI_GROUPS = ["sugar-level", "strength"];
const PARATHA_GROUPS = ["paratha-style"];
const EGG_GROUPS = ["egg-style"];

export const PRODUCTS: Record<string, SeedProduct[]> = {
  chai: [
    { name: "Sada Chai", urduName: "سادہ چائے", description: "Roz wali doodh patti — sab se zyada orders isi ke.", longDescription: "سادہ چائے — the everyday cup. Milk and loose leaf tea boiled together until it turns that deep caramel colour, served hot.", price: 90, image: IMG.chaiDoodh, isPopular: true, isFeatured: true, isVegetarian: true, prepTimeMinutes: 7, ingredients: ["Milk", "Tea leaves", "Sugar"], calories: 160, addonGroups: CHAI_GROUPS },
    { name: "Gur Wali Chai", urduName: "گڑ والی چائے", description: "Cheeni ki jagah gur — halki mithas, gehra zaiqa.", longDescription: "گڑ والی چائے — sweetened with jaggery instead of sugar, which gives it a deeper, earthier finish. A winter favourite.", price: 110, image: IMG.chaiGur, isPopular: true, isVegetarian: true, prepTimeMinutes: 8, ingredients: ["Milk", "Tea leaves", "Gur (jaggery)"], calories: 175, addonGroups: CHAI_GROUPS },
    { name: "Chai Kettli", urduName: "چائے کیتلی", description: "Poori kettli — dost ya study group ke liye.", longDescription: "چائے کیتلی — a full kettle rather than a single cup, meant to be shared across the table.", price: 150, image: IMG.chaiKettle, isPopular: true, isFeatured: true, isVegetarian: true, prepTimeMinutes: 12, ingredients: ["Milk", "Tea leaves", "Sugar"], calories: 480, addonGroups: CHAI_GROUPS },
    { name: "Badam Wali Chai", urduName: "بادام والی چائے", description: "Pisay hue badam ke saath — rich aur creamy.", longDescription: "بادام والی چائے — brewed with ground almonds for a richer, creamier cup.", price: 130, image: IMG.chaiBadam, isVegetarian: true, prepTimeMinutes: 10, ingredients: ["Milk", "Tea leaves", "Almonds", "Sugar"], calories: 230, addonGroups: CHAI_GROUPS },
    { name: "Kashmiri Chai", urduName: "کشمیری چائے", description: "Gulabi chai, upar se pistay aur badam.", longDescription: "کشمیری چائے — slow-churned pink chai finished with crushed pistachio and almond. Takes longer to make, worth the wait.", price: 170, image: IMG.chaiKashmiri, isPopular: true, isFeatured: true, isVegetarian: true, prepTimeMinutes: 14, ingredients: ["Kashmiri tea leaves", "Milk", "Pistachio", "Almond", "Salt"], calories: 250, addonGroups: CHAI_GROUPS },
    { name: "Sulemani Qehwa", urduName: "سلیمانی قہوہ", description: "Bina doodh ke kaali chai — halki aur saaf.", longDescription: "سلیمانی قہوہ — black tea with no milk, brewed light. The cup you order after a heavy paratha.", price: 80, image: IMG.qehwaBlack, isVegetarian: true, prepTimeMinutes: 5, ingredients: ["Tea leaves", "Water", "Sugar"], calories: 35, addonGroups: ["sugar-level"] },
    { name: "Sabz Qehwa", urduName: "سبز قہوہ", description: "Green tea — halka aur caffeine-friendly.", longDescription: "سبز قہوہ — green tea leaves steeped in hot water. Clean, light and easy on the stomach.", price: 80, image: IMG.qehwaGreen, isVegetarian: true, prepTimeMinutes: 5, ingredients: ["Green tea leaves", "Water"], calories: 5, addonGroups: ["sugar-level"] },
    { name: "Doodh Qehwa", urduName: "دودھ قہوہ", description: "Qehwa doodh ke saath — beech ka raasta.", longDescription: "دودھ قہوہ — qehwa finished with milk. Lighter than a full doodh patti, warmer than a plain qehwa.", price: 100, image: IMG.qehwaMilk, isVegetarian: true, prepTimeMinutes: 7, ingredients: ["Tea leaves", "Milk", "Sugar"], calories: 120, addonGroups: CHAI_GROUPS },
    { name: "Coffee", urduName: "کافی", description: "Garam coffee — jab chai se kaam na chale.", longDescription: "کافی — hot coffee, for the nights when chai alone is not getting the work finished.", price: 200, image: IMG.coffee, isVegetarian: true, prepTimeMinutes: 6, ingredients: ["Coffee", "Milk", "Sugar"], calories: 190, addonGroups: ["sugar-level"] },
  ],

  parathas: [
    { name: "Lachha Dar Paratha", urduName: "لچھا دار پراٹھا", description: "Layer dar, crispy — chai ka pehla saathi.", longDescription: "لچھا دار پراٹھا — rolled into fine layers so it pulls apart in strands. Crisp outside, soft inside.", price: 80, image: IMG.parathaPlain, isPopular: true, isVegetarian: true, prepTimeMinutes: 8, ingredients: ["Wheat flour", "Oil", "Salt"], calories: 300, addonGroups: PARATHA_GROUPS },
    { name: "Khushk Paratha", urduName: "خشک پراٹھا", description: "Bina ghee ke — halka aur simple.", longDescription: "خشک پراٹھا — cooked dry on the tawa with no added oil. The lightest paratha on the board.", price: 80, image: IMG.parathaPlain, isVegetarian: true, prepTimeMinutes: 7, ingredients: ["Wheat flour", "Salt"], calories: 220, addonGroups: PARATHA_GROUPS },
    { name: "Aloo Paratha", urduName: "آلو پراٹھا", description: "Masala aloo ki bharwan filling.", longDescription: "آلو پراٹھا — stuffed with spiced potato, green chilli and coriander, then pressed on the tawa till golden.", price: 160, image: IMG.parathaAloo, isPopular: true, isVegetarian: true, spiceLevel: "MILD", prepTimeMinutes: 12, ingredients: ["Wheat flour", "Potato", "Green chilli", "Coriander"], calories: 400, addonGroups: PARATHA_GROUPS },
    { name: "Desi Ghee Paratha", urduName: "دیسی گھی پراٹھا", description: "Khalis desi ghee mein taiyar.", longDescription: "دیسی گھی پراٹھا — made with pure desi ghee. Heavier, richer, and exactly what it sounds like.", price: 160, image: IMG.parathaPlain, isVegetarian: true, prepTimeMinutes: 9, ingredients: ["Wheat flour", "Desi ghee", "Salt"], calories: 420, addonGroups: PARATHA_GROUPS },
    { name: "Cheese Paratha", urduName: "چیز پراٹھا", description: "Pighalta hua cheese, kinare tak.", longDescription: "چیز پراٹھا — mozzarella melted right through to the edges. Regular size.", price: 170, image: IMG.parathaCheese, isPopular: true, isVegetarian: true, prepTimeMinutes: 12, ingredients: ["Wheat flour", "Mozzarella", "Butter"], calories: 480, addonGroups: PARATHA_GROUPS },
    { name: "Cheese Paratha (Large)", urduName: "چیز پراٹھا (بڑا)", description: "Wohi cheese paratha, bara size.", longDescription: "چیز پراٹھا — the larger portion, for when one regular is not going to be enough.", price: 220, image: IMG.parathaCheese, isVegetarian: true, prepTimeMinutes: 13, ingredients: ["Wheat flour", "Mozzarella", "Butter"], calories: 620, addonGroups: PARATHA_GROUPS },
    { name: "Anda Pizza Paratha", urduName: "انڈہ پیزا پراٹھا", description: "Anda, sauce aur cheese — pizza wali shakl mein.", longDescription: "انڈہ پیزا پراٹھا — egg, pizza sauce and cheese layered over the paratha and folded like a pizza.", price: 170, image: IMG.parathaEgg, isPopular: true, prepTimeMinutes: 13, ingredients: ["Wheat flour", "Egg", "Pizza sauce", "Mozzarella"], calories: 520, addonGroups: PARATHA_GROUPS },
    { name: "Omelette Cheese Paratha", urduName: "آملیٹ چیز پراٹھا", description: "Omelette aur cheese, ek hi fold mein.", longDescription: "آملیٹ چیز پراٹھا — a full omelette and melted cheese folded into the paratha.", price: 210, image: IMG.parathaEgg, prepTimeMinutes: 13, ingredients: ["Wheat flour", "Egg", "Mozzarella", "Onion"], calories: 560, addonGroups: PARATHA_GROUPS },
    { name: "Aloo Cheese Paratha", urduName: "آلو چیز پراٹھا", description: "Masala aloo ke upar pighla cheese.", longDescription: "آلو چیز پراٹھا — the aloo paratha with mozzarella added on top of the potato filling.", price: 220, image: IMG.parathaCheese, isVegetarian: true, spiceLevel: "MILD", prepTimeMinutes: 13, ingredients: ["Wheat flour", "Potato", "Mozzarella", "Green chilli"], calories: 560, addonGroups: PARATHA_GROUPS },
    { name: "Chocolate Paratha", urduName: "چاکلیٹ پراٹھا", description: "Meetha paratha — chocolate se bhara.", longDescription: "چاکلیٹ پراٹھا — chocolate melted into the layers and served warm. The dessert of the menu.", price: 220, image: IMG.parathaSweet, isVegetarian: true, prepTimeMinutes: 11, ingredients: ["Wheat flour", "Chocolate", "Butter"], calories: 580, addonGroups: PARATHA_GROUPS },
    { name: "Malai Paratha", urduName: "ملائی پراٹھا", description: "Taazi malai aur cheeni ke saath.", longDescription: "ملائی پراٹھا — fresh cream and sugar folded in. Simple and very rich.", price: 230, image: IMG.parathaMalai, isVegetarian: true, prepTimeMinutes: 11, ingredients: ["Wheat flour", "Fresh malai", "Sugar"], calories: 540, addonGroups: PARATHA_GROUPS },
    { name: "Kabab Roll Paratha", urduName: "کباب رول پراٹھا", description: "Kabab, chutney aur pyaz — roll kar ke.", longDescription: "کباب رول پراٹھا — seekh kabab with onion and chutney, rolled tight inside a paratha.", price: 200, image: IMG.rollKabab, spiceLevel: "MEDIUM", prepTimeMinutes: 13, ingredients: ["Paratha", "Seekh kabab", "Onion", "Chutney"], calories: 560, addonGroups: PARATHA_GROUPS },
    { name: "Chicken Roll Paratha", urduName: "چکن رول پراٹھا", description: "Chicken, pyaz aur sauce — roll mein.", longDescription: "چکن رول پراٹھا — spiced chicken, onion and sauce rolled into a paratha. Easy to eat one-handed.", price: 220, image: IMG.rollChicken, isPopular: true, spiceLevel: "MEDIUM", prepTimeMinutes: 13, ingredients: ["Paratha", "Chicken", "Onion", "Sauce"], calories: 580, addonGroups: PARATHA_GROUPS },
    { name: "Chicken Paratha", urduName: "چکن پراٹھا", description: "Masala chicken ki bharpoor filling.", longDescription: "چکن پراٹھا — shredded masala chicken packed into the paratha and sealed on the tawa.", price: 280, image: IMG.parathaChicken, isPopular: true, spiceLevel: "MEDIUM", prepTimeMinutes: 15, ingredients: ["Wheat flour", "Chicken", "Onion", "Tomato", "Spices"], calories: 620, addonGroups: PARATHA_GROUPS },
    { name: "Chicken Cheese Paratha", urduName: "چکن چیز پراٹھا", description: "Chicken aur cheese — sab se zyada order hone wala.", longDescription: "چکن چیز پراٹھا — masala chicken and mozzarella together. Needs both hands.", price: 350, image: IMG.parathaChickenCheese, isPopular: true, isFeatured: true, spiceLevel: "MEDIUM", prepTimeMinutes: 16, ingredients: ["Wheat flour", "Chicken", "Mozzarella", "Spices"], calories: 720, addonGroups: PARATHA_GROUPS },
    { name: "Chicken Cheese Pizza Paratha", urduName: "چکن چیز پیزا پراٹھا", description: "Chicken, cheese aur pizza sauce — sab kuch.", longDescription: "چکن چیز پیزا پراٹھا — the heaviest build on the board: chicken, mozzarella, pizza sauce and oregano.", price: 360, image: IMG.parathaChickenCheese, isFeatured: true, spiceLevel: "MEDIUM", prepTimeMinutes: 17, ingredients: ["Wheat flour", "Chicken", "Mozzarella", "Pizza sauce", "Oregano"], calories: 780, addonGroups: PARATHA_GROUPS },
  ],

  anday: [
    { name: "Half Fry", urduName: "ہاف فرائی", description: "Zarda narm — paratha ke saath best.", longDescription: "ہاف فرائی — sunny side up, yolk left runny.", price: 80, image: IMG.eggHalf, isPopular: true, prepTimeMinutes: 5, ingredients: ["Egg", "Oil", "Salt"], calories: 95, addonGroups: EGG_GROUPS },
    { name: "Full Fry", urduName: "فل فرائی", description: "Dono taraf se — zarda poora pakka hua.", longDescription: "فل فرائی — fried through on both sides, yolk fully set.", price: 80, image: IMG.eggFull, prepTimeMinutes: 5, ingredients: ["Egg", "Oil", "Salt"], calories: 100, addonGroups: EGG_GROUPS },
    { name: "Omelette", urduName: "آملیٹ", description: "Pyaz, mirch aur hara dhania ke saath.", longDescription: "آملیٹ — whisked egg with onion, green chilli and coriander.", price: 80, image: IMG.omelette, isPopular: true, spiceLevel: "MILD", prepTimeMinutes: 6, ingredients: ["Egg", "Onion", "Green chilli", "Coriander"], calories: 140, addonGroups: EGG_GROUPS },
    { name: "Tamatar Omelette", urduName: "ٹماٹر آملیٹ", description: "Taaze tamatar ke saath omelette.", longDescription: "ٹماٹر آملیٹ — omelette with fresh tomato folded through.", price: 90, image: IMG.omeletteTamatar, spiceLevel: "MILD", prepTimeMinutes: 7, ingredients: ["Egg", "Tomato", "Onion", "Green chilli"], calories: 155, addonGroups: EGG_GROUPS },
    { name: "Cheese Omelette", urduName: "چیز آملیٹ", description: "Pighalta cheese, andar tak.", longDescription: "چیز آملیٹ — omelette with mozzarella melted into the fold.", price: 130, image: IMG.omeletteCheese, isFeatured: true, prepTimeMinutes: 8, ingredients: ["Egg", "Mozzarella", "Onion"], calories: 260, addonGroups: EGG_GROUPS },
  ],

  "sides-extras": [
    { name: "Shakeel Lahori Chanay (Half)", urduName: "شکیل لاہوری چنے (ہاف)", description: "Lahori style chanay — half plate.", longDescription: "شکیل لاہوری چنے — proper Lahori chanay, slow-cooked and spiced. Half plate.", price: 180, image: IMG.chanay, isPopular: true, isVegetarian: true, spiceLevel: "MEDIUM", prepTimeMinutes: 6, ingredients: ["Chickpeas", "Onion", "Tomato", "Lahori masala"], calories: 320, addonGroups: [] },
    { name: "Shakeel Lahori Chanay (Full)", urduName: "شکیل لاہوری چنے (فل)", description: "Poori plate — do logon ke liye kaafi.", longDescription: "شکیل لاہوری چنے — the full plate, enough to share with a paratha or two.", price: 300, image: IMG.chanay, isVegetarian: true, spiceLevel: "MEDIUM", prepTimeMinutes: 7, ingredients: ["Chickpeas", "Onion", "Tomato", "Lahori masala"], calories: 560, addonGroups: [] },
    { name: "Malai Plate (Half)", urduName: "ملائی پلیٹ (ہاف)", description: "Taazi malai — half plate.", longDescription: "ملائی پلیٹ — a plate of fresh malai to go with a hot paratha. Half portion.", price: 100, image: IMG.malai, isVegetarian: true, prepTimeMinutes: 3, ingredients: ["Fresh malai"], calories: 220, addonGroups: [] },
    { name: "Malai Plate (Full)", urduName: "ملائی پلیٹ (فل)", description: "Poori plate malai.", longDescription: "ملائی پلیٹ — the full plate of fresh malai.", price: 200, image: IMG.malai, isVegetarian: true, prepTimeMinutes: 3, ingredients: ["Fresh malai"], calories: 440, addonGroups: [] },
    { name: "Disposable Charges", urduName: "ڈسپوزیبل چارجز", description: "Packing charges — sirf home delivery par.", longDescription: "ڈسپوزیبل چارجز — packaging charge for takeaway and home delivery orders, exactly as listed on the menu board.", price: 10, image: IMG.packaging, isVegetarian: true, prepTimeMinutes: 1, ingredients: ["Packaging"], addonGroups: [] },
  ],
};

/**
 * Promotional codes are the owner's call, not the menu's — these are starting
 * points that can be edited or switched off from Admin → Coupons.
 */
export const COUPONS = [
  { code: "ENGINEER10", description: "10% off — Engineer Cafe ka apna code.", discountType: "PERCENTAGE" as const, discountValue: 10, minOrderAmount: 500, maxDiscount: 150, isActive: true },
  { code: "STUDENT15", description: "Students ke liye flat Rs. 50 off. Ek account, ek baar.", discountType: "FIXED" as const, discountValue: 50, minOrderAmount: 400, perUserLimit: 1, isActive: true },
  { code: "FIRSTBREW", description: "Pehle order par Rs. 50 off.", discountType: "FIXED" as const, discountValue: 50, minOrderAmount: 300, perUserLimit: 1, isActive: true },
];
