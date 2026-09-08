/**
 * Realistic Engineer Cafe menu data with Pakistani pricing.
 * Everything here is inserted into the database — the frontend never
 * hardcodes menu items.
 */

export type SeedProduct = {
  name: string;
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
  combo?: { name: string; quantity: number }[];
};

const IMG = {
  chai: "https://images.unsplash.com/photo-1571934811356-5cc061b6821f?auto=format&fit=crop&w=800&q=70",
  chaiCup: "https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a2?auto=format&fit=crop&w=800&q=70",
  masala: "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=800&q=70",
  kashmiri: "https://images.unsplash.com/photo-1610970881699-44a5587cabec?auto=format&fit=crop&w=800&q=70",
  greenTea: "https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&w=800&q=70",
  lemonTea: "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=800&q=70",
  coffee: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=800&q=70",
  paratha: "https://images.unsplash.com/photo-1626132647523-66f5bf380027?auto=format&fit=crop&w=800&q=70",
  alooParatha: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=70",
  cheeseParatha: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=800&q=70",
  eggParatha: "https://images.unsplash.com/photo-1482049016688-2d3e1b311543?auto=format&fit=crop&w=800&q=70",
  chickenParatha: "https://images.unsplash.com/photo-1600891964092-4316c288032e?auto=format&fit=crop&w=800&q=70",
  sweetParatha: "https://images.unsplash.com/photo-1587241321921-91a834d6d191?auto=format&fit=crop&w=800&q=70",
  fries: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=800&q=70",
  burger: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=70",
  sandwich: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=800&q=70",
  samosa: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=70",
  nuggets: "https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=800&q=70",
  drink: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=800&q=70",
  water: "https://images.unsplash.com/photo-1560023907-5f339617ea30?auto=format&fit=crop&w=800&q=70",
  lassi: "https://images.unsplash.com/photo-1626196340104-2ba1ff43dbd7?auto=format&fit=crop&w=800&q=70",
  shake: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=800&q=70",
  combo: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=800&q=70",
  dessert: "https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=800&q=70",
};

export const CATEGORIES = [
  { name: "Chai", slug: "chai", icon: "☕", description: "Doodh patti, karak, kashmiri — brewed the way Pakistan likes it.", image: IMG.chai, sortOrder: 1 },
  { name: "Parathas", slug: "parathas", icon: "🥘", description: "Hand-rolled, tawa-fresh, stuffed till the edges give up.", image: IMG.paratha, sortOrder: 2 },
  { name: "Snacks", slug: "snacks", icon: "🍟", description: "Fries, samosas, rolls and everything you eat between commits.", image: IMG.fries, sortOrder: 3 },
  { name: "Burgers & Sandwiches", slug: "burgers-sandwiches", icon: "🍔", description: "Grilled, stacked and student-budget friendly.", image: IMG.burger, sortOrder: 4 },
  { name: "Cold Drinks", slug: "cold-drinks", icon: "🥤", description: "Chilled bottles, shakes, lassi and mineral water.", image: IMG.drink, sortOrder: 5 },
  { name: "Combos", slug: "combos", icon: "🎯", description: "Engineer's Deals — chai plus paratha at a price that compiles.", image: IMG.combo, sortOrder: 6 },
  { name: "Desserts", slug: "desserts", icon: "🍮", description: "Sweet endings for a long debugging session.", image: IMG.dessert, sortOrder: 7 },
];

export const ADDON_GROUPS = [
  {
    name: "Sugar Level", slug: "sugar-level", type: "SINGLE" as const, isRequired: true, minSelect: 1, maxSelect: 1, sortOrder: 1,
    addons: [
      { name: "No Sugar", price: 0 },
      { name: "Less Sugar", price: 0 },
      { name: "Normal Sugar", price: 0, isDefault: true },
      { name: "Extra Sugar", price: 10 },
    ],
  },
  {
    name: "Milk", slug: "milk", type: "SINGLE" as const, isRequired: false, minSelect: 0, maxSelect: 1, sortOrder: 2,
    addons: [
      { name: "Normal Milk", price: 0, isDefault: true },
      { name: "Extra Milk", price: 30 },
    ],
  },
  {
    name: "Strength", slug: "strength", type: "SINGLE" as const, isRequired: false, minSelect: 0, maxSelect: 1, sortOrder: 3,
    addons: [
      { name: "Normal", price: 0, isDefault: true },
      { name: "Strong", price: 20 },
      { name: "Extra Strong (Karak)", price: 40 },
    ],
  },
  {
    name: "Paratha Size", slug: "paratha-size", type: "SINGLE" as const, isRequired: true, minSelect: 1, maxSelect: 1, sortOrder: 1,
    addons: [
      { name: "Regular", price: 0, isDefault: true },
      { name: "Large", price: 90 },
    ],
  },
  {
    name: "Paratha Add-ons", slug: "paratha-addons", type: "MULTIPLE" as const, isRequired: false, minSelect: 0, maxSelect: 6, sortOrder: 2,
    addons: [
      { name: "Extra Cheese", price: 120 },
      { name: "Extra Egg", price: 70 },
      { name: "Extra Chicken", price: 180 },
      { name: "Extra Sauce", price: 30 },
      { name: "Mayo", price: 40 },
      { name: "BBQ Sauce", price: 50 },
    ],
  },
  {
    name: "Snack Dips", slug: "snack-dips", type: "MULTIPLE" as const, isRequired: false, minSelect: 0, maxSelect: 4, sortOrder: 1,
    addons: [
      { name: "Garlic Mayo", price: 40 },
      { name: "Cheese Dip", price: 90 },
      { name: "Chilli Garlic", price: 30 },
      { name: "Ketchup", price: 0, isDefault: true },
    ],
  },
];

const CHAI_GROUPS = ["sugar-level", "milk", "strength"];
const PARATHA_GROUPS = ["paratha-size", "paratha-addons"];
const SNACK_GROUPS = ["snack-dips"];

export const PRODUCTS: Record<string, SeedProduct[]> = {
  chai: [
    { name: "Doodh Patti", description: "Full-cream milk tea, boiled slow the desi way.", longDescription: "No water, no shortcuts — pure milk simmered with loose leaf tea until it turns that deep caramel colour every chai lover recognises.", price: 130, image: IMG.chai, isPopular: true, isVegetarian: true, prepTimeMinutes: 7, ingredients: ["Full cream milk", "Loose leaf tea", "Sugar"], calories: 180, addonGroups: CHAI_GROUPS },
    { name: "Karak Chai", description: "Extra strong, extra thick. The 3 AM deadline fuel.", longDescription: "Double the tea leaves, half the patience. Karak chai is what gets the last module shipped.", price: 150, image: IMG.chaiCup, isPopular: true, isFeatured: true, isVegetarian: true, prepTimeMinutes: 8, ingredients: ["Milk", "Tea leaves", "Cardamom", "Sugar"], calories: 200, addonGroups: CHAI_GROUPS },
    { name: "Special Engineer Chai", description: "Strong karak chai with elaichi & ginger.", longDescription: "Our signature cup. Karak base, crushed green cardamom, fresh ginger and a slow boil. Ordered more than anything else on this menu.", price: 220, discountPrice: 190, image: IMG.masala, isPopular: true, isFeatured: true, isVegetarian: true, prepTimeMinutes: 10, ingredients: ["Milk", "Premium tea leaves", "Green cardamom", "Fresh ginger", "Sugar"], calories: 230, addonGroups: CHAI_GROUPS },
    { name: "Masala Chai", description: "Cinnamon, clove, cardamom and black pepper.", price: 180, image: IMG.masala, isPopular: true, isVegetarian: true, spiceLevel: "MILD", prepTimeMinutes: 9, ingredients: ["Milk", "Tea leaves", "Cinnamon", "Clove", "Cardamom", "Black pepper"], calories: 195, addonGroups: CHAI_GROUPS },
    { name: "Kashmiri Chai", description: "Pink, creamy, topped with pistachio & almond.", longDescription: "Slow-churned Kashmiri gulabi chai with a pinch of salt, finished with crushed pistachios and almonds.", price: 260, image: IMG.kashmiri, isPopular: true, isFeatured: true, isVegetarian: true, prepTimeMinutes: 14, ingredients: ["Kashmiri tea leaves", "Milk", "Pistachio", "Almond", "Baking soda", "Salt"], calories: 260, addonGroups: CHAI_GROUPS },
    { name: "Elaichi Chai", description: "Green cardamom brewed right into the milk.", price: 170, image: IMG.chai, isVegetarian: true, prepTimeMinutes: 8, ingredients: ["Milk", "Tea leaves", "Green cardamom", "Sugar"], calories: 185, addonGroups: CHAI_GROUPS },
    { name: "Ginger Chai (Adrak Wali)", description: "Fresh crushed ginger — winter in a cup.", price: 170, image: IMG.chai, isVegetarian: true, spiceLevel: "MILD", prepTimeMinutes: 8, ingredients: ["Milk", "Tea leaves", "Fresh ginger", "Sugar"], calories: 180, addonGroups: CHAI_GROUPS },
    { name: "Honey Chai", description: "Sweetened with raw honey instead of sugar.", price: 200, image: IMG.chaiCup, isVegetarian: true, prepTimeMinutes: 9, ingredients: ["Milk", "Tea leaves", "Raw honey"], calories: 190, addonGroups: CHAI_GROUPS },
    { name: "Chocolate Chai", description: "Cocoa-swirled chai for the sweet-tooth debuggers.", price: 240, image: IMG.coffee, isVegetarian: true, prepTimeMinutes: 10, ingredients: ["Milk", "Tea leaves", "Cocoa", "Chocolate syrup", "Sugar"], calories: 320, addonGroups: CHAI_GROUPS },
    { name: "Cutting Chai", description: "Half cup, full punch. For quick standups.", price: 90, image: IMG.chaiCup, isVegetarian: true, prepTimeMinutes: 5, ingredients: ["Milk", "Tea leaves", "Sugar"], calories: 95, addonGroups: CHAI_GROUPS },
    { name: "Green Tea", description: "Light, clean and caffeine-friendly.", price: 120, image: IMG.greenTea, isVegetarian: true, prepTimeMinutes: 5, ingredients: ["Green tea leaves", "Hot water"], calories: 5, addonGroups: ["sugar-level"] },
    { name: "Lemon Tea", description: "Black tea, fresh lemon, a spoon of honey.", price: 140, image: IMG.lemonTea, isVegetarian: true, prepTimeMinutes: 6, ingredients: ["Black tea", "Lemon", "Honey"], calories: 45, addonGroups: ["sugar-level"] },
    { name: "Mint Green Tea", description: "Green tea steeped with fresh pudina.", price: 150, image: IMG.greenTea, isVegetarian: true, prepTimeMinutes: 6, ingredients: ["Green tea", "Fresh mint"], calories: 8, addonGroups: ["sugar-level"] },
    { name: "Saunf Wali Chai", description: "Fennel-infused chai — the after-dinner classic.", price: 175, image: IMG.chai, isVegetarian: true, prepTimeMinutes: 9, ingredients: ["Milk", "Tea leaves", "Fennel seeds", "Sugar"], calories: 185, addonGroups: CHAI_GROUPS },
    { name: "Peshawari Qehwa", description: "Cardamom qehwa with saffron strands.", price: 190, image: IMG.lemonTea, isVegetarian: true, prepTimeMinutes: 7, ingredients: ["Green tea", "Cardamom", "Saffron", "Sugar"], calories: 30, addonGroups: ["sugar-level"] },
    { name: "Cold Coffee Chai Fusion", description: "Iced chai base with a shot of espresso.", price: 290, image: IMG.coffee, isVegetarian: true, prepTimeMinutes: 8, ingredients: ["Chai concentrate", "Espresso", "Milk", "Ice"], calories: 240, addonGroups: ["sugar-level", "milk"] },
    { name: "Malai Chai", description: "Topped with a thick layer of fresh malai.", price: 230, image: IMG.chaiCup, isVegetarian: true, prepTimeMinutes: 11, ingredients: ["Milk", "Tea leaves", "Fresh malai", "Sugar"], calories: 310, addonGroups: CHAI_GROUPS },
    { name: "Kahwa Zafran", description: "Saffron-heavy kahwa served in a glass cup.", price: 210, image: IMG.lemonTea, isVegetarian: true, prepTimeMinutes: 7, ingredients: ["Green tea", "Saffron", "Almond flakes", "Honey"], calories: 40, addonGroups: ["sugar-level"] },
    { name: "Chai Latte", description: "Steamed milk, spiced chai, café finish.", price: 270, image: IMG.coffee, isVegetarian: true, prepTimeMinutes: 8, ingredients: ["Chai concentrate", "Steamed milk", "Cinnamon"], calories: 250, addonGroups: ["sugar-level", "milk"] },
    { name: "Family Chai Kettle (4 Cups)", description: "A full kettle for the whole study group.", price: 450, discountPrice: 399, image: IMG.chai, isFeatured: true, isVegetarian: true, prepTimeMinutes: 15, ingredients: ["Milk", "Tea leaves", "Cardamom", "Sugar"], calories: 720, addonGroups: CHAI_GROUPS },
  ],
  parathas: [
    { name: "Plain Paratha", description: "Crisp, flaky, straight off the tawa.", price: 90, image: IMG.paratha, isVegetarian: true, prepTimeMinutes: 8, ingredients: ["Wheat flour", "Ghee", "Salt"], calories: 290, addonGroups: PARATHA_GROUPS },
    { name: "Aloo Paratha", description: "Spiced potato filling with green chillies.", price: 180, image: IMG.alooParatha, isPopular: true, isVegetarian: true, spiceLevel: "MILD", prepTimeMinutes: 12, ingredients: ["Wheat flour", "Potato", "Green chilli", "Coriander", "Ghee"], calories: 420, addonGroups: PARATHA_GROUPS },
    { name: "Cheese Paratha", description: "Molten mozzarella pulled edge to edge.", price: 320, image: IMG.cheeseParatha, isPopular: true, isVegetarian: true, prepTimeMinutes: 13, ingredients: ["Wheat flour", "Mozzarella", "Butter"], calories: 540, addonGroups: PARATHA_GROUPS },
    { name: "Egg Paratha", description: "Whisked egg cooked into the dough.", price: 240, image: IMG.eggParatha, isPopular: true, prepTimeMinutes: 11, ingredients: ["Wheat flour", "Egg", "Onion", "Green chilli", "Ghee"], calories: 460, addonGroups: PARATHA_GROUPS },
    { name: "Chicken Paratha", description: "Shredded masala chicken, generously packed.", price: 380, image: IMG.chickenParatha, isPopular: true, spiceLevel: "MEDIUM", prepTimeMinutes: 15, ingredients: ["Wheat flour", "Chicken", "Onion", "Tomato", "Spices"], calories: 610, addonGroups: PARATHA_GROUPS },
    { name: "Chicken Cheese Paratha", description: "Chicken and mozzarella in one fold.", price: 450, discountPrice: 420, image: IMG.chickenParatha, isPopular: true, isFeatured: true, spiceLevel: "MEDIUM", prepTimeMinutes: 16, ingredients: ["Wheat flour", "Chicken", "Mozzarella", "Spices"], calories: 720, addonGroups: PARATHA_GROUPS },
    { name: "Loaded Engineer Paratha", description: "Chicken, cheese, egg, BBQ sauce. All of it.", longDescription: "Our heaviest build: chicken tikka, mozzarella, a fried egg, BBQ drizzle and crushed chilli — folded into one paratha that needs both hands.", price: 550, discountPrice: 499, image: IMG.chickenParatha, isPopular: true, isFeatured: true, spiceLevel: "HOT", prepTimeMinutes: 18, ingredients: ["Wheat flour", "Chicken tikka", "Mozzarella", "Egg", "BBQ sauce", "Crushed chilli"], calories: 890, addonGroups: PARATHA_GROUPS },
    { name: "BBQ Paratha", description: "Smoky BBQ chicken with onion rings.", price: 420, image: IMG.chickenParatha, spiceLevel: "MEDIUM", prepTimeMinutes: 15, ingredients: ["Wheat flour", "BBQ chicken", "Onion", "BBQ sauce"], calories: 660, addonGroups: PARATHA_GROUPS },
    { name: "Pizza Paratha", description: "Pizza sauce, mozzarella, olives, oregano.", price: 400, image: IMG.cheeseParatha, isVegetarian: true, prepTimeMinutes: 14, ingredients: ["Wheat flour", "Pizza sauce", "Mozzarella", "Olives", "Oregano"], calories: 640, addonGroups: PARATHA_GROUPS },
    { name: "Qeema Paratha", description: "Minced beef masala, slow-cooked.", price: 430, image: IMG.chickenParatha, spiceLevel: "MEDIUM", prepTimeMinutes: 16, ingredients: ["Wheat flour", "Beef qeema", "Onion", "Garam masala"], calories: 700, addonGroups: PARATHA_GROUPS },
    { name: "Mix Veg Paratha", description: "Carrot, peas, capsicum and spring onion.", price: 220, image: IMG.alooParatha, isVegetarian: true, spiceLevel: "MILD", prepTimeMinutes: 12, ingredients: ["Wheat flour", "Carrot", "Peas", "Capsicum", "Spring onion"], calories: 400, addonGroups: PARATHA_GROUPS },
    { name: "Methi Paratha", description: "Fresh fenugreek leaves kneaded into the dough.", price: 200, image: IMG.paratha, isVegetarian: true, prepTimeMinutes: 11, ingredients: ["Wheat flour", "Fenugreek leaves", "Ajwain", "Ghee"], calories: 360, addonGroups: PARATHA_GROUPS },
    { name: "Lachha Paratha", description: "Layered, buttery and impossibly flaky.", price: 130, image: IMG.paratha, isPopular: true, isVegetarian: true, prepTimeMinutes: 10, ingredients: ["Wheat flour", "Butter", "Ghee"], calories: 380, addonGroups: PARATHA_GROUPS },
    { name: "Garlic Butter Paratha", description: "Brushed with roasted garlic butter.", price: 190, image: IMG.paratha, isVegetarian: true, prepTimeMinutes: 10, ingredients: ["Wheat flour", "Garlic", "Butter", "Parsley"], calories: 400, addonGroups: PARATHA_GROUPS },
    { name: "Nutella Paratha", description: "Warm paratha, thick Nutella, crushed hazelnut.", price: 380, image: IMG.sweetParatha, isPopular: true, isVegetarian: true, prepTimeMinutes: 12, ingredients: ["Wheat flour", "Nutella", "Hazelnut", "Butter"], calories: 680, addonGroups: PARATHA_GROUPS },
    { name: "Banana Paratha", description: "Caramelised banana with honey drizzle.", price: 280, image: IMG.sweetParatha, isVegetarian: true, prepTimeMinutes: 12, ingredients: ["Wheat flour", "Banana", "Honey", "Butter"], calories: 520, addonGroups: PARATHA_GROUPS },
    { name: "Chocolate Paratha", description: "Dark chocolate melted into every layer.", price: 340, image: IMG.sweetParatha, isVegetarian: true, prepTimeMinutes: 12, ingredients: ["Wheat flour", "Dark chocolate", "Butter", "Sugar"], calories: 640, addonGroups: PARATHA_GROUPS },
    { name: "Sugar Ghee Paratha", description: "The childhood one — sugar, desi ghee, done.", price: 150, image: IMG.sweetParatha, isVegetarian: true, prepTimeMinutes: 9, ingredients: ["Wheat flour", "Desi ghee", "Sugar"], calories: 450, addonGroups: PARATHA_GROUPS },
    { name: "Malai Paratha", description: "Fresh cream and sugar folded in.", price: 260, image: IMG.sweetParatha, isVegetarian: true, prepTimeMinutes: 11, ingredients: ["Wheat flour", "Fresh cream", "Sugar", "Ghee"], calories: 560, addonGroups: PARATHA_GROUPS },
    { name: "Chicken Tikka Paratha Roll", description: "Tikka, chutney and onions rolled tight.", price: 390, image: IMG.chickenParatha, isPopular: true, spiceLevel: "MEDIUM", prepTimeMinutes: 14, ingredients: ["Paratha", "Chicken tikka", "Onion", "Mint chutney"], calories: 620, addonGroups: PARATHA_GROUPS },
  ],
  snacks: [
    { name: "Plain Fries", description: "Crisp golden fries with a pinch of salt.", price: 220, image: IMG.fries, isPopular: true, isVegetarian: true, prepTimeMinutes: 8, ingredients: ["Potato", "Salt", "Oil"], calories: 380, addonGroups: SNACK_GROUPS },
    { name: "Masala Fries", description: "Tossed in our house chaat masala.", price: 260, image: IMG.fries, isPopular: true, isVegetarian: true, spiceLevel: "MILD", prepTimeMinutes: 9, ingredients: ["Potato", "Chaat masala", "Chilli powder"], calories: 400, addonGroups: SNACK_GROUPS },
    { name: "Loaded Cheese Fries", description: "Cheese sauce, jalapeños and herbs.", price: 390, image: IMG.fries, isFeatured: true, isVegetarian: true, spiceLevel: "MILD", prepTimeMinutes: 11, ingredients: ["Potato", "Cheese sauce", "Jalapeño", "Oregano"], calories: 620, addonGroups: SNACK_GROUPS },
    { name: "Chicken Nuggets (6 pcs)", description: "Crunchy outside, juicy inside.", price: 340, image: IMG.nuggets, prepTimeMinutes: 10, ingredients: ["Chicken", "Breadcrumbs", "Spices"], calories: 450, addonGroups: SNACK_GROUPS },
    { name: "Chicken Samosa (2 pcs)", description: "Flaky pastry, spiced chicken filling.", price: 160, image: IMG.samosa, isPopular: true, spiceLevel: "MEDIUM", prepTimeMinutes: 7, ingredients: ["Flour pastry", "Chicken", "Onion", "Spices"], calories: 300, addonGroups: SNACK_GROUPS },
    { name: "Aloo Samosa (2 pcs)", description: "The evening chai's oldest companion.", price: 100, image: IMG.samosa, isVegetarian: true, spiceLevel: "MILD", prepTimeMinutes: 6, ingredients: ["Flour pastry", "Potato", "Peas", "Spices"], calories: 280, addonGroups: SNACK_GROUPS },
    { name: "Spring Rolls (4 pcs)", description: "Vegetable rolls with sweet chilli dip.", price: 240, image: IMG.samosa, isVegetarian: true, prepTimeMinutes: 9, ingredients: ["Cabbage", "Carrot", "Spring roll sheet"], calories: 320, addonGroups: SNACK_GROUPS },
    { name: "Chicken Wings (6 pcs)", description: "BBQ or hot — tossed to order.", price: 450, image: IMG.nuggets, isPopular: true, spiceLevel: "HOT", prepTimeMinutes: 14, ingredients: ["Chicken wings", "BBQ sauce", "Chilli"], calories: 580, addonGroups: SNACK_GROUPS },
    { name: "Pakora Plate", description: "Mixed pakoras with imli chutney.", price: 180, image: IMG.samosa, isVegetarian: true, spiceLevel: "MEDIUM", prepTimeMinutes: 10, ingredients: ["Gram flour", "Onion", "Potato", "Spinach"], calories: 340, addonGroups: SNACK_GROUPS },
    { name: "Cheese Garlic Bread", description: "Toasted, buttery and fully loaded.", price: 300, image: IMG.sandwich, isVegetarian: true, prepTimeMinutes: 10, ingredients: ["Bread", "Garlic butter", "Mozzarella", "Oregano"], calories: 480, addonGroups: SNACK_GROUPS },
  ],
  "burgers-sandwiches": [
    { name: "Zinger Burger", description: "Crispy fillet, lettuce, mayo, sesame bun.", price: 450, image: IMG.burger, isPopular: true, spiceLevel: "MILD", prepTimeMinutes: 13, ingredients: ["Chicken fillet", "Bun", "Lettuce", "Mayo"], calories: 620, addonGroups: SNACK_GROUPS },
    { name: "Beef Burger", description: "Grilled beef patty with cheddar.", price: 520, image: IMG.burger, prepTimeMinutes: 14, ingredients: ["Beef patty", "Cheddar", "Bun", "Onion", "Sauce"], calories: 700, addonGroups: SNACK_GROUPS },
    { name: "Chicken Cheese Sandwich", description: "Grilled, pressed and cut on the diagonal.", price: 380, image: IMG.sandwich, prepTimeMinutes: 11, ingredients: ["Bread", "Chicken", "Cheddar", "Mayo"], calories: 540, addonGroups: SNACK_GROUPS },
    { name: "Club Sandwich", description: "Triple decker with fries on the side.", price: 480, image: IMG.sandwich, isFeatured: true, prepTimeMinutes: 14, ingredients: ["Bread", "Chicken", "Egg", "Lettuce", "Tomato"], calories: 680, addonGroups: SNACK_GROUPS },
    { name: "Grilled Veg Sandwich", description: "Capsicum, corn, cheese and herbs.", price: 300, image: IMG.sandwich, isVegetarian: true, prepTimeMinutes: 10, ingredients: ["Bread", "Capsicum", "Corn", "Cheese"], calories: 420, addonGroups: SNACK_GROUPS },
  ],
  "cold-drinks": [
    { name: "Mineral Water 500ml", description: "Chilled bottled water.", price: 60, image: IMG.water, isVegetarian: true, prepTimeMinutes: 1, ingredients: ["Mineral water"], calories: 0 },
    { name: "Mineral Water 1.5L", description: "Family size, straight from the fridge.", price: 120, image: IMG.water, isVegetarian: true, prepTimeMinutes: 1, ingredients: ["Mineral water"], calories: 0 },
    { name: "Soft Drink Regular", description: "Coke, Sprite or Fanta — 345ml can.", price: 110, image: IMG.drink, isPopular: true, isVegetarian: true, prepTimeMinutes: 1, ingredients: ["Carbonated drink"], calories: 140 },
    { name: "Soft Drink 1.5L", description: "Share-size bottle for the table.", price: 220, image: IMG.drink, isVegetarian: true, prepTimeMinutes: 1, ingredients: ["Carbonated drink"], calories: 600 },
    { name: "Fresh Lime Soda", description: "Lemon, soda, mint and a little salt.", price: 180, image: IMG.lemonTea, isPopular: true, isVegetarian: true, prepTimeMinutes: 5, ingredients: ["Lemon", "Soda", "Mint", "Salt"], calories: 90 },
    { name: "Sweet Lassi", description: "Thick, cold, blended dahi lassi.", price: 220, image: IMG.lassi, isVegetarian: true, prepTimeMinutes: 6, ingredients: ["Yogurt", "Sugar", "Ice"], calories: 260 },
    { name: "Mango Shake", description: "Seasonal mangoes, milk and ice.", price: 300, image: IMG.shake, isFeatured: true, isVegetarian: true, prepTimeMinutes: 7, ingredients: ["Mango", "Milk", "Sugar", "Ice"], calories: 340 },
    { name: "Chocolate Shake", description: "Cocoa-heavy, topped with whipped cream.", price: 320, image: IMG.shake, isPopular: true, isVegetarian: true, prepTimeMinutes: 7, ingredients: ["Milk", "Chocolate", "Ice cream"], calories: 480 },
    { name: "Cold Coffee", description: "Iced coffee blended smooth.", price: 290, image: IMG.coffee, isVegetarian: true, prepTimeMinutes: 6, ingredients: ["Coffee", "Milk", "Sugar", "Ice"], calories: 260 },
    { name: "Doodh Soda", description: "The Pakistani classic — milk and 7Up.", price: 200, image: IMG.drink, isVegetarian: true, prepTimeMinutes: 4, ingredients: ["Milk", "Soda", "Sugar"], calories: 240 },
  ],
  desserts: [
    { name: "Gulab Jamun (2 pcs)", description: "Warm, syrup-soaked and soft.", price: 160, image: IMG.dessert, isVegetarian: true, prepTimeMinutes: 4, ingredients: ["Khoya", "Sugar syrup", "Cardamom"], calories: 320 },
    { name: "Kheer Bowl", description: "Slow-cooked rice pudding with pistachio.", price: 180, image: IMG.dessert, isVegetarian: true, prepTimeMinutes: 4, ingredients: ["Rice", "Milk", "Sugar", "Pistachio"], calories: 290 },
    { name: "Chocolate Lava Cake", description: "Molten centre, served warm.", price: 350, image: IMG.dessert, isPopular: true, isVegetarian: true, prepTimeMinutes: 9, ingredients: ["Chocolate", "Butter", "Egg", "Flour"], calories: 520 },
    { name: "Rasmalai (2 pcs)", description: "Chilled, saffron-scented and creamy.", price: 220, image: IMG.dessert, isVegetarian: true, prepTimeMinutes: 4, ingredients: ["Milk", "Saffron", "Pistachio", "Sugar"], calories: 340 },
  ],
  combos: [
    { name: "Student Deal", description: "Chai + Aloo Paratha. Built for tight budgets.", longDescription: "Doodh patti and a hot aloo paratha — the most ordered combination in every Pakistani campus canteen, priced so you can have it daily.", price: 340, discountPrice: 299, image: IMG.combo, isPopular: true, isFeatured: true, isVegetarian: true, prepTimeMinutes: 14, ingredients: ["Doodh Patti", "Aloo Paratha"], combo: [{ name: "Doodh Patti", quantity: 1 }, { name: "Aloo Paratha", quantity: 1 }] },
    { name: "Engineer Combo", description: "Chai + Egg Paratha. The daily standup special.", price: 440, discountPrice: 399, image: IMG.combo, isPopular: true, isFeatured: true, prepTimeMinutes: 15, ingredients: ["Special Engineer Chai", "Egg Paratha"], combo: [{ name: "Special Engineer Chai", quantity: 1 }, { name: "Egg Paratha", quantity: 1 }] },
    { name: "Late Night Debugging Deal", description: "Karak Chai + Chicken Cheese Paratha.", longDescription: "For the 2 AM stack traces. Extra strong karak chai with our loaded chicken cheese paratha.", price: 660, discountPrice: 599, image: IMG.combo, isPopular: true, isFeatured: true, spiceLevel: "MEDIUM", prepTimeMinutes: 18, ingredients: ["Karak Chai", "Chicken Cheese Paratha"], combo: [{ name: "Karak Chai", quantity: 1 }, { name: "Chicken Cheese Paratha", quantity: 1 }] },
    { name: "Group Study Platter", description: "4 Chai + 2 Parathas + Masala Fries.", price: 1450, discountPrice: 1249, image: IMG.combo, isFeatured: true, prepTimeMinutes: 22, ingredients: ["Family Chai Kettle", "Aloo Paratha", "Cheese Paratha", "Masala Fries"], combo: [{ name: "Family Chai Kettle (4 Cups)", quantity: 1 }, { name: "Aloo Paratha", quantity: 1 }, { name: "Cheese Paratha", quantity: 1 }, { name: "Masala Fries", quantity: 1 }] },
    { name: "Chai & Samosa Break", description: "2 Chai + 2 Chicken Samosas.", price: 420, discountPrice: 379, image: IMG.combo, isPopular: true, spiceLevel: "MILD", prepTimeMinutes: 12, ingredients: ["Doodh Patti", "Chicken Samosa"], combo: [{ name: "Doodh Patti", quantity: 2 }, { name: "Chicken Samosa (2 pcs)", quantity: 1 }] },
  ],
};

export const COUPONS = [
  { code: "ENGINEER10", description: "10% off your order — for the whole engineering department.", discountType: "PERCENTAGE" as const, discountValue: 10, minOrderAmount: 500, maxDiscount: 200, maxUsage: 1000, isActive: true },
  { code: "CHAI20", description: "20% off orders above Rs. 800.", discountType: "PERCENTAGE" as const, discountValue: 20, minOrderAmount: 800, maxDiscount: 350, maxUsage: 500, isActive: true },
  { code: "STUDENT15", description: "Flat Rs. 150 off for students. One per account.", discountType: "FIXED" as const, discountValue: 150, minOrderAmount: 600, maxUsage: 2000, perUserLimit: 1, isActive: true },
  { code: "FIRSTBREW", description: "Rs. 100 off your very first chai break.", discountType: "FIXED" as const, discountValue: 100, minOrderAmount: 400, perUserLimit: 1, isActive: true },
  { code: "LATENIGHT", description: "15% off — for orders placed while everyone else sleeps.", discountType: "PERCENTAGE" as const, discountValue: 15, minOrderAmount: 700, maxDiscount: 250, isActive: true },
];

export const SAMPLE_REVIEWS: { productName: string; rating: number; comment: string; author: string }[] = [
  { productName: "Special Engineer Chai", rating: 5, comment: "Genuinely the best karak in Gulberg. I finish my whole assignment on one cup.", author: "Ali Raza" },
  { productName: "Special Engineer Chai", rating: 5, comment: "Ginger and elaichi balance is perfect. Ordered it three days straight.", author: "Hina Tariq" },
  { productName: "Loaded Engineer Paratha", rating: 5, comment: "Needs two hands and a nap afterwards. Worth every rupee.", author: "Bilal Ahmed" },
  { productName: "Loaded Engineer Paratha", rating: 4, comment: "Very filling, slightly spicy for me but the cheese saves it.", author: "Sana Khalid" },
  { productName: "Kashmiri Chai", rating: 5, comment: "Proper pink chai with real pistachios, not the powdered stuff.", author: "Hina Tariq" },
  { productName: "Cheese Paratha", rating: 4, comment: "Cheese pull is real. Ask for extra sauce.", author: "Bilal Ahmed" },
  { productName: "Student Deal", rating: 5, comment: "Rs. 299 for chai and aloo paratha — nothing else comes close near campus.", author: "Ali Raza" },
  { productName: "Late Night Debugging Deal", rating: 5, comment: "Ordered at 1:40 AM, arrived hot at 2:05. Legends.", author: "Sana Khalid" },
  { productName: "Masala Fries", rating: 4, comment: "Good masala, keep the garlic mayo coming.", author: "Ali Raza" },
  { productName: "Karak Chai", rating: 5, comment: "Strong enough to fix a production bug.", author: "Bilal Ahmed" },
  { productName: "Nutella Paratha", rating: 5, comment: "My little sister now refuses every other dessert.", author: "Hina Tariq" },
  { productName: "Zinger Burger", rating: 4, comment: "Crispy and juicy, bun could be a touch fresher.", author: "Sana Khalid" },
];
