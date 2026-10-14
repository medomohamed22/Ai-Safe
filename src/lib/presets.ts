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

export const PRESETS = {
  dashboard: { label: 'Dashboard', elements: dashboard },
  landing: { label: 'Landing Page', elements: landing },
  mobile: { label: 'Mobile App', elements: mobile },
} as const;

export type PresetKey = keyof typeof PRESETS;
