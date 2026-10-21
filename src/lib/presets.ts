// 1-click demo sketches, described as Excalidraw "element skeletons"
// (converted with convertToExcalidrawElements at runtime).

const INK = '#1e1e1e';
const RED = '#e03131';

type El = Record<string, any>;

const R = (x: number, y: number, w: number, h: number, label?: string, extra: El = {}): El => ({
  type: 'rectangle',
  x,
  y,
  width: w,
  height: h,
  strokeColor: INK,
  strokeWidth: 2,
  roughness: 1,
  roundness: { type: 3 },
  ...(label ? { label: { text: label, fontSize: 18, strokeColor: INK } } : {}),
  ...extra,
});

const E = (x: number, y: number, w: number, h: number, label?: string): El => ({
  type: 'ellipse',
  x,
  y,
  width: w,
  height: h,
  strokeColor: INK,
  strokeWidth: 2,
  roughness: 1,
  ...(label ? { label: { text: label, fontSize: 24, strokeColor: INK } } : {}),
});

const T = (x: number, y: number, text: string, fontSize = 20, color = INK): El => ({
  type: 'text',
  x,
  y,
  text,
  fontSize,
  strokeColor: color,
});

const L = (x: number, y: number, pts: [number, number][], color = INK): El => {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return {
    type: 'line',
    x,
    y,
    points: pts,
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
    strokeColor: color,
    strokeWidth: 2,
    roughness: 1,
  };
};

const A = (x: number, y: number, dx: number, dy: number, color = RED): El => ({
  type: 'arrow',
  x,
  y,
  points: [
    [0, 0],
    [dx, dy],
  ],
  width: Math.abs(dx),
  height: Math.abs(dy),
  strokeColor: color,
  strokeWidth: 2,
  roughness: 1,
});

const imagePlaceholder = (x: number, y: number, w: number, h: number): El[] => [
  R(x, y, w, h, undefined, { roundness: null }),
  L(x, y, [[0, 0], [w, h]]),
  L(x, y + h, [[0, 0], [w, -h]]),
];

const dashboard: El[] = [
  R(0, 0, 1000, 660, undefined, { roundness: null }),
  // sidebar
  R(0, 0, 190, 660, undefined, { roundness: null }),
  T(28, 24, 'LOGO', 26),
  T(28, 100, 'Dashboard'),
  T(28, 145, 'Analytics'),
  T(28, 190, 'Customers'),
  T(28, 235, 'Orders'),
  T(28, 280, 'Settings'),
  // top bar
  R(190, 0, 810, 70, undefined, { roundness: null }),
  R(220, 16, 320, 38, 'Search...'),
  T(860, 24, 'bell', 16),
  E(930, 15, 40, 40),
  // stats
  R(220, 100, 240, 110, 'Revenue\n$48,200'),
  R(480, 100, 240, 110, 'Users\n2,340'),
  R(740, 100, 240, 110, 'Orders\n1,120'),
  // line chart
  R(220, 235, 500, 200, undefined),
  T(240, 248, 'Monthly sales', 18),
  L(250, 410, [[0, 0], [80, -40], [160, -10], [240, -90], [320, -55], [440, -120]]),
  // donut
  R(740, 235, 240, 200, undefined),
  T(758, 248, 'Traffic', 18),
  E(800, 280, 120, 120),
  // table
  R(220, 460, 760, 180, undefined),
  T(240, 472, 'Recent orders', 18),
  L(220, 510, [[0, 0], [760, 0]]),
  L(220, 553, [[0, 0], [760, 0]]),
  L(220, 596, [[0, 0], [760, 0]]),
  // annotations
  T(1070, 300, 'donut chart\nby source', 20, RED),
  A(1060, 320, -70, 0),
  T(1070, 500, 'sales data table\n+ working search filter\n+ status badges', 20, RED),
  A(1060, 530, -70, 0),
];

const landing: El[] = [
  R(0, 0, 1000, 820, undefined, { roundness: null }),
  T(30, 26, 'LOGO', 26),
  T(420, 32, 'Features     Pricing     About', 18),
  R(850, 18, 120, 44, 'Sign up'),
  L(0, 82, [[0, 0], [1000, 0]]),
  // hero
  T(60, 140, 'BIG BOLD HEADLINE', 44),
  T(60, 210, 'short subtitle explaining\nthe product value', 20),
  R(60, 290, 170, 52, 'Get started'),
  R(250, 290, 150, 52, 'Learn more'),
  ...imagePlaceholder(560, 120, 380, 260),
  // features
  R(60, 440, 260, 170, 'Feature 1\nicon + text'),
  R(370, 440, 260, 170, 'Feature 2\nicon + text'),
  R(680, 440, 260, 170, 'Feature 3\nicon + text'),
  // footer
  L(0, 740, [[0, 0], [1000, 0]]),
  T(30, 768, '© 2026        links        social icons', 16),
  // annotations
  T(1060, 150, 'dark theme with\npurple gradient', 20, RED),
  A(1050, 170, -90, 0),
  T(1060, 500, 'cards with icons\n& hover effect', 20, RED),
  A(1050, 520, -100, 0),
];

const taskY = [235, 315, 395, 475];
const tasks = [
  ['Design review', 'Today 10:00'],
  ['Buy groceries', 'Today 17:30'],
  ['Call mom', 'Tomorrow'],
  ['Gym workout', 'Fri 07:00'],
];

const mobile: El[] = [
  R(0, 0, 380, 760, undefined, { roundness: { type: 3 } }),
  T(24, 14, '9:41', 14),
  T(24, 50, 'My Tasks', 32),
  E(306, 50, 46, 46),
  R(24, 112, 332, 46, 'Search tasks...'),
  R(24, 175, 100, 38, 'All'),
  R(134, 175, 100, 38, 'Today'),
  R(244, 175, 112, 38, 'Done'),
  ...taskY.flatMap((y, i) => [
    R(24, y, 332, 66),
    R(42, y + 21, 24, 24, undefined, { roundness: null }),
    T(82, y + 10, tasks[i][0], 18),
    T(82, y + 38, tasks[i][1], 14),
  ]),
  E(292, 590, 64, 64, '+'),
  L(0, 690, [[0, 0], [380, 0]]),
  T(40, 712, 'Home', 16),
  T(162, 712, 'Stats', 16),
  T(282, 712, 'Profile', 16),
  // annotations
  T(430, 180, 'filter tabs work', 20, RED),
  A(420, 194, -55, 0),
  T(430, 262, 'tap checkbox = mark done\n(strike-through + counter)', 20, RED),
  A(420, 268, -340, 0),
  T(430, 606, 'opens "New task" modal\nthat really adds a task', 20, RED),
  A(420, 622, -55, 0),
];

const storeProducts: [string, string][] = [
  ['Wooden chair', '$120'],
  ['Desk lamp', '$45'],
  ['Coffee table', '$230'],
  ['Bookshelf', '$98'],
  ['Fabric sofa', '$750'],
  ['Wall clock', '$32'],
  ['Ceramic vase', '$21'],
  ['Wool rug', '$185'],
];

const store: El[] = [
  R(0, 0, 1000, 800, undefined, { roundness: null }),
  // header
  T(30, 26, 'LOGO', 26),
  R(300, 16, 340, 38, 'Search products...'),
  R(850, 16, 120, 38, 'Cart (0)'),
  L(0, 82, [[0, 0], [1000, 0]]),
  T(30, 96, 'Home     Shop     Categories     Sale', 18),
  // hero
  R(30, 140, 940, 170, undefined),
  T(60, 168, 'SALE — up to 50% off', 40),
  T(60, 228, 'New season collection is here', 20),
  R(60, 262, 140, 44, 'Shop now'),
  // category chips
  R(30, 340, 90, 36, 'All'),
  R(135, 340, 110, 36, 'Furniture'),
  R(260, 340, 100, 36, 'Lighting'),
  R(375, 340, 90, 36, 'Decor'),
  // product grid
  ...[400, 585].flatMap((y, row) =>
    [30, 265, 500, 735].flatMap((x, col) => {
      const p = storeProducts[row * 4 + col];
      return [
        ...imagePlaceholder(x, y, 235, 104),
        T(x + 2, y + 114, `${p[0]}  ${p[1]}`, 16),
        R(x + 143, y + 106, 88, 30, 'Add'),
      ];
    }),
  ),
  // annotations
  T(1070, 30, 'working cart\nwith totals', 20, RED),
  A(1060, 55, -70, 0),
  T(1070, 345, 'category filters work', 20, RED),
  A(1060, 362, -90, 0),
  T(1070, 470, 'product cards with\nreal photos & prices', 20, RED),
  A(1060, 495, -80, 40),
];

// Arabic presets: mirrored (RTL) layouts, Arabic labels, Arabic red
// annotations — they show judges the Arabic-first generation path.
const dashboardAr: El[] = [
  R(0, 0, 1000, 660, undefined, { roundness: null }),
  // sidebar on the right (RTL)
  R(810, 0, 190, 660, undefined, { roundness: null }),
  T(848, 24, 'الشعار', 26),
  T(848, 100, 'لوحة التحكم'),
  T(848, 145, 'التحليلات'),
  T(848, 190, 'العملاء'),
  T(848, 235, 'الطلبات'),
  T(848, 280, 'الإعدادات'),
  // top bar
  R(0, 0, 810, 70, undefined, { roundness: null }),
  R(430, 16, 320, 38, 'بحث...'),
  T(88, 24, 'تنبيهات', 16),
  E(30, 15, 40, 40),
  // stats
  R(540, 100, 240, 110, 'الإيرادات\n$48,200'),
  R(280, 100, 240, 110, 'المستخدمون\n2,340'),
  R(20, 100, 240, 110, 'الطلبات\n1,120'),
  // line chart
  R(280, 235, 500, 200, undefined),
  T(590, 248, 'المبيعات الشهرية', 18),
  L(310, 410, [[0, 0], [80, -40], [160, -10], [240, -90], [320, -55], [440, -120]]),
  // donut
  R(20, 235, 240, 200, undefined),
  T(110, 248, 'مصادر الزيارات', 18),
  E(80, 280, 120, 120),
  // table
  R(20, 460, 760, 180, undefined),
  T(640, 472, 'أحدث الطلبات', 18),
  L(20, 510, [[0, 0], [760, 0]]),
  L(20, 553, [[0, 0], [760, 0]]),
  L(20, 596, [[0, 0], [760, 0]]),
  // annotations on the left (mirrored)
  T(-490, 290, 'رسم دائري\nحسب المصدر', 20, RED),
  A(-45, 318, 55, 0),
  T(-490, 480, 'جدول بيانات المبيعات\n+ بحث شغال + شارات حالة', 20, RED),
  A(-45, 520, 55, 0),
];

const storeProductsAr: [string, string][] = [
  ['كرسي خشبي', '1,200 ج.م'],
  ['مصباح مكتب', '450 ج.م'],
  ['طاولة قهوة', '2,300 ج.م'],
  ['رف كتب', '980 ج.م'],
  ['أريكة قماش', '7,500 ج.م'],
  ['ساعة حائط', '320 ج.م'],
  ['مزهرية سيراميك', '210 ج.م'],
  ['سجادة صوف', '1,850 ج.م'],
];

const storeAr: El[] = [
  R(0, 0, 1000, 800, undefined, { roundness: null }),
  // header (mirrored)
  T(900, 26, 'الشعار', 26),
  R(330, 16, 320, 38, 'ابحث عن منتج...'),
  R(30, 16, 130, 38, 'سلة التسوق'),
  L(0, 82, [[0, 0], [1000, 0]]),
  T(590, 96, 'الرئيسية     المتجر     الأقسام     العروض', 18),
  // hero
  R(30, 140, 940, 170, undefined),
  T(600, 168, 'تخفيضات حتى 50%', 40),
  T(655, 228, 'تشكيلة الموسم الجديد وصلت', 20),
  R(800, 262, 140, 44, 'تسوق الآن'),
  // category chips (right to left)
  R(880, 340, 90, 36, 'الكل'),
  R(755, 340, 110, 36, 'أثاث'),
  R(640, 340, 100, 36, 'إضاءة'),
  R(525, 340, 90, 36, 'ديكور'),
  // product grid
  ...[400, 585].flatMap((y, row) =>
    [30, 265, 500, 735].flatMap((x, col) => {
      const p = storeProductsAr[row * 4 + col];
      return [
        ...imagePlaceholder(x, y, 235, 104),
        T(x + 2, y + 114, `${p[0]} · ${p[1]}`, 16),
        R(x + 128, y + 106, 103, 30, 'أضف للسلة'),
      ];
    }),
  ),
  // annotations on the left (mirrored)
  T(-490, 30, 'سلة تسوق شغالة\nبالإجمالي', 20, RED),
  A(-45, 55, 60, 0),
  T(-490, 345, 'فلترة حسب القسم', 20, RED),
  A(-45, 362, 60, 0),
  T(-490, 470, 'بطاقات منتجات\nبصور حقيقية وأسعار', 20, RED),
  A(-45, 500, 60, 30),
];

const taskYAr = [235, 315, 395, 475];
const tasksAr = [
  ['مراجعة التصميم', 'اليوم 10:00'],
  ['شراء طلبات البيت', 'اليوم 17:30'],
  ['الاتصال بأمي', 'غدًا'],
  ['تمرين الجيم', 'الجمعة 07:00'],
];

const mobileAr: El[] = [
  R(0, 0, 380, 760, undefined, { roundness: { type: 3 } }),
  T(24, 14, '9:41', 14),
  T(258, 50, 'مهامي', 32),
  E(24, 50, 46, 46),
  R(24, 112, 332, 46, 'ابحث في المهام...'),
  R(256, 175, 100, 38, 'الكل'),
  R(146, 175, 100, 38, 'اليوم'),
  R(24, 175, 112, 38, 'تم'),
  ...taskYAr.flatMap((y, i) => [
    R(24, y, 332, 66),
    R(314, y + 21, 24, 24, undefined, { roundness: null }),
    T(120, y + 10, tasksAr[i][0], 18),
    T(196, y + 38, tasksAr[i][1], 14),
  ]),
  E(24, 590, 64, 64, '+'),
  L(0, 690, [[0, 0], [380, 0]]),
  T(292, 712, 'الرئيسية', 16),
  T(150, 712, 'الإحصائيات', 16),
  T(36, 712, 'حسابي', 16),
  // annotations on the left (mirrored)
  T(-420, 168, 'تبويبات الفلترة\nشغالة', 20, RED),
  A(-55, 196, 45, 0),
  T(-420, 250, 'الضغط على المربع =\nإنجاز المهمة (شطب + عدّاد)', 20, RED),
  A(-55, 272, 45, 0),
  T(-420, 596, 'يفتح نافذة «مهمة جديدة»\nتضيف مهمة فعلًا', 20, RED),
  A(-55, 622, 45, 0),
];

export const PRESETS = {
  dashboard: { label: 'Dashboard', elements: dashboard },
  landing: { label: 'Landing Page', elements: landing },
  mobile: { label: 'Mobile App', elements: mobile },
  store: { label: 'Store', elements: store },
  dashboardAr: { label: 'Dashboard (Arabic)', elements: dashboardAr },
  storeAr: { label: 'Store (Arabic)', elements: storeAr },
  mobileAr: { label: 'Mobile (Arabic)', elements: mobileAr },
} as const;

export type PresetKey = keyof typeof PRESETS;
