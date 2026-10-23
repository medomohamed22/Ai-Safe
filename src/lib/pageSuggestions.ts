import type { Brand } from './brand';
import type { BrandAsset } from './brandAssets';
import { majorityDocLanguage } from './designBuild';

/**
 * Page suggestions (design-system expansion, phase 4): ready page types
 * drawn as wireframes. Picking one generates the page AND its use-case
 * states as linked screens in a single run — the click-through flow from
 * the Claude Design video, on the user's own design system and language.
 */
export interface PageCase {
  id: string;
  titleEn: string;
  titleAr: string;
  briefEn: string;
  briefAr: string;
}

export interface PageSuggestion {
  id: string;
  art: 'login' | 'home' | 'dashboard' | 'pricing' | 'profile' | 'checkout';
  titleEn: string;
  titleAr: string;
  cases: PageCase[];
}

export const PAGE_SUGGESTIONS: PageSuggestion[] = [
  {
    id: 'login', art: 'login', titleEn: 'Log in page', titleAr: 'صفحة تسجيل الدخول',
    cases: [
      { id: 'error', titleEn: 'Error state', titleAr: 'حالة الخطأ', briefEn: 'the form was submitted with wrong credentials: show a clear inline error, keep the typed email, and mark the password field', briefAr: 'أُرسل النموذج ببيانات خاطئة: أظهر خطأً واضحًا داخل النموذج، واحتفظ بالبريد المكتوب، وعلّم حقل كلمة المرور' },
      { id: 'forgot', titleEn: 'Forgot password', titleAr: 'نسيت كلمة المرور', briefEn: 'the forgot-password view of the same page: email field, send-reset-link action, and a back-to-login link', briefAr: 'عرض «نسيت كلمة المرور» من نفس الصفحة: حقل البريد، وزر إرسال رابط الاستعادة، ورابط للعودة لتسجيل الدخول' },
      { id: 'success', titleEn: 'Success state', titleAr: 'حالة النجاح', briefEn: 'the just-signed-in success moment: a confirmation with the user\'s name and a clear continue action into the app', briefAr: 'لحظة النجاح بعد الدخول: تأكيد باسم المستخدم وزر متابعة واضح للدخول إلى التطبيق' },
    ],
  },
  {
    id: 'home', art: 'home', titleEn: 'Home page', titleAr: 'الصفحة الرئيسية',
    cases: [
      { id: 'empty', titleEn: 'Empty state', titleAr: 'الحالة الفارغة', briefEn: 'the first-run empty state: no content yet, a friendly explanation and one clear call to action to create the first item', briefAr: 'حالة أول استخدام فارغة: لا محتوى بعد، مع شرح ودود وزر إجراء واحد واضح لإنشاء أول عنصر' },
      { id: 'loading', titleEn: 'Loading state', titleAr: 'حالة التحميل', briefEn: 'the loading skeleton of the same layout: gray placeholder blocks pulsing where the hero and cards will appear', briefAr: 'هيكل التحميل لنفس التخطيط: كتل رمادية نابضة مكان البطل والبطاقات حين تظهر' },
    ],
  },
  {
    id: 'dashboard', art: 'dashboard', titleEn: 'Dashboard', titleAr: 'لوحة التحكم',
    cases: [
      { id: 'empty', titleEn: 'Empty state', titleAr: 'الحالة الفارغة', briefEn: 'the dashboard before any data exists: zeroed stats, an empty chart area with guidance, and a call to action to add the first data', briefAr: 'اللوحة قبل وجود أي بيانات: إحصاءات صفرية، ومنطقة رسم فارغة مع إرشاد، وزر لإضافة أول بيانات' },
      { id: 'detail', titleEn: 'Detail state', titleAr: 'حالة التفاصيل', briefEn: 'a drill-down detail view opened from the dashboard: one item expanded with its full metrics and a back action', briefAr: 'عرض تفاصيل مثقوب من اللوحة: عنصر واحد مفتوح بكل مقاييسه وزر للعودة' },
    ],
  },
  {
    id: 'pricing', art: 'pricing', titleEn: 'Pricing page', titleAr: 'صفحة الأسعار',
    cases: [
      { id: 'annual', titleEn: 'Annual billing', titleAr: 'الفوترة السنوية', briefEn: 'the same pricing with annual billing selected: prices switch to the yearly amounts with the savings highlighted', briefAr: 'نفس الأسعار مع اختيار الفوترة السنوية: تتبدل الأسعار للمبالغ السنوية مع إبراز التوفير' },
      { id: 'faq', titleEn: 'FAQ open', titleAr: 'الأسئلة مفتوحة', briefEn: 'the pricing page with its FAQ section expanded: the first two questions open with full answers', briefAr: 'صفحة الأسعار وقسم الأسئلة الشائعة مفتوح: أول سؤالين مفتوحان بإجابات كاملة' },
    ],
  },
  {
    id: 'profile', art: 'profile', titleEn: 'Profile page', titleAr: 'صفحة الملف الشخصي',
    cases: [
      { id: 'edit', titleEn: 'Edit profile', titleAr: 'تعديل الملف', briefEn: 'the edit-profile form of the same page: fields prefilled, avatar change control, save and cancel actions', briefAr: 'نموذج تعديل الملف من نفس الصفحة: الحقول معبأة، وزر تغيير الصورة، وحفظ وإلغاء' },
      { id: 'security', titleEn: 'Security state', titleAr: 'حالة الأمان', briefEn: 'the security section: change-password form and an active-sessions list with a sign-out-others action', briefAr: 'قسم الأمان: نموذج تغيير كلمة المرور وقائمة الجلسات النشطة مع زر تسجيل خروج الباقي' },
    ],
  },
  {
    id: 'checkout', art: 'checkout', titleEn: 'Checkout page', titleAr: 'صفحة الدفع',
    cases: [
      { id: 'error', titleEn: 'Payment error', titleAr: 'خطأ الدفع', briefEn: 'the payment was declined: a clear error banner, the card field marked, totals unchanged, and a retry action', briefAr: 'رُفض الدفع: شريط خطأ واضح، وحقل البطاقة معلّم، والمجاميع كما هي، وزر إعادة المحاولة' },
      { id: 'success', titleEn: 'Order success', titleAr: 'نجاح الطلب', briefEn: 'the order-confirmation state: success mark, order number, summary of what was bought, and a continue-shopping action', briefAr: 'حالة تأكيد الطلب: علامة نجاح، ورقم الطلب، وملخص ما اشتُري، وزر متابعة التسوق' },
    ],
  },
];

/** The language generated content should use: the system's explicit choice, else its documents, else the UI language. */
export function resolveContentLanguage(brand: Brand, assets: BrandAsset[], uiLanguage: string): 'ar' | 'en' {
  if (brand.language === 'ar' || brand.language === 'en') return brand.language;
  if (assets.some((a) => a.kind === 'doc')) return majorityDocLanguage(assets);
  return uiLanguage === 'ar' ? 'ar' : 'en';
}

export function pageBrief(s: PageSuggestion, c: PageCase | null, lang: 'ar' | 'en', brandName: string): string {
  if (lang === 'ar') {
    return c
      ? `ابنِ ${s.titleAr} في «${c.titleAr}»: ${c.briefAr}. حافظ على نفس التخطيط والهوية البصرية ولغة المحتوى في الصفحة الرئيسية، وغيّر فقط ما تتطلبه هذه الحالة.`
      : `ابنِ ${s.titleAr} كاملة واحترافية${brandName ? ` لصالح «${brandName}»` : ''}، ملتزمة بنظام التصميم والهوية المحفوظة ولغة المحتوى. محتوى واقعي وتفاعلات شغالة لهذه الصفحة.`;
  }
  return c
    ? `Build the ${s.titleEn} in its "${c.titleEn}" state: ${c.briefEn}. Keep the same layout, brand identity and content language as the main ${s.titleEn}, changing only what this state requires.`
    : `Build a complete, polished ${s.titleEn}${brandName ? ` for "${brandName}"` : ''}, following the saved brand identity and content language. Realistic content and working interactions for this page.`;
}
