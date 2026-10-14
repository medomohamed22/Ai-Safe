# Live Sketch-to-UI Engine (MVP v1.0)

محرك تفاعلي لتحويل الرسومات اليدوية والملاحظات السهمية (Annotations) إلى واجهات **React + Tailwind CSS** تفاعلية لحظياً في المتصفح.

## المميزات الأساسية
1. **لوحة رسم تفاعلية (Drawing Canvas):** تدعم الرسم الحر، المربعات، الدوائر، الأسهم، النصوص والملاحظات، ورفع صور الرسومات وتصديرها بصيغة `Base64 PNG`.
2. **مزامنة تلقائية (2s Debounce) أو توليد فوري:** إرسال تلقائي للرسمة بعد التوقف عن الرسم بثانيتين أو عبر زر التحويل المباشر.
3. **إعدادات متعددة المزودين (`localStorage`):**
   - **Meta Llama API** (`Llama-4-Maverick`, `Llama-3.2-90B-Vision-Instruct`, إلخ)
   - **OpenRouter API** (`meta-llama/llama-3.2-90b-vision-instruct`, `google/gemini-2.5-flash`, `anthropic/claude-3.5-sonnet`, `openai/gpt-4o`)
   - **Google Gemini API** (`gemini-2.5-flash`, `gemini-2.5-pro`)
   - إمكانية **إضافة أي مزود مخصص (Custom Provider)** متوافق مع OpenAI أو Gemini.
   - **زر جلب النماذج (Fetch Models):** يجلب قائمة النماذج الحية من الـ API مباشرة ويحفظها في المتصفح.
   - **فلتر بحث باسم النموذج + فلتر نماذج الرؤية (Vision Only).**
4. **قوالب جاهزة بضغطة زر للتحكيم (1-Click Demo Presets):** لوحة تحكم مبيعات تفاعلية، صفحة هبوط للشركات الناشئة، وتطبيق محفظة موبايل.
5. **تعديل هجين (Sketch + Prompt Iteration):** شريط أوامر نصية سفلي لتحديث الواجهة الحالية (مثل تحويلها للوضع الليلي أو تعديل الأزرار أو الفلاتر).

## طريقة الرفع على Vercel
1. ارفع محتويات هذا المجلد (`index.html`, `vercel.json`, `package.json`) إلى مستودع GitHub أو اسحبه مباشرة إلى لوحة تحكم **Vercel**.
2. لا يحتاج المشروع إلى أي خادم خلفي (Zero-Backend)؛ جميع الإعدادات ومفاتيح الـ API تُحفظ محلياً في متصفح المستخدم (`localStorage`).
