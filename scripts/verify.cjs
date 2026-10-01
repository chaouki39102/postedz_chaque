/**
 * فحوص تفاعلية بعد الإقلاع: الاستمرارية، تبديل البنك، الالتفاف.
 *
 * يكمل smoke.cjs: الأول يثبت أن التطبيق يقلع، وهذا يثبت أن ما كتبه
 * المستخدم يبقى، وأن ما يعرضه يطابق ما يُطبع.
 *
 * الاستخدام: node scripts/verify.cjs <url> <profileDir>
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9334;

const url = process.argv[2] ?? 'http://localhost:4173/';
/*
 * ملف تعريف مؤقت خاص بكل تشغيل.
 * الملف الثابت كان سبباً للمشاكل: نسخة Chrome السابقة تحتجز القفل،
 * وقاعدة بيانات من تشغيل سابق تجعل الفحوص تمر والفعل لا يقع.
 */
const profile =
  process.argv[3] ?? path.join(process.env.TEMP, 'chrome-verify-' + process.pid);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.problems = [];
    /** أسباب الرفض تُقرأ من الصفحة لحظة الاستثناء، لا في نهاية التشغيل */
    this.rejectionReads = [];
    this.sawPromiseRejection = false;
    ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== undefined) {
        const resolver = this.pending.get(message.id);
        if (resolver) {
          this.pending.delete(message.id);
          if (message.error) resolver.reject(new Error(JSON.stringify(message.error)));
          else resolver.resolve(message.result);
        }
        return;
      }
      if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
        this.problems.push(
          'console.error: ' + message.params.args.map((a) => a.value ?? a.description ?? '').join(' ')
        );
      }
      if (message.method === 'Runtime.exceptionThrown') {
        const details = message.params.exceptionDetails;
        this.problems.push('exception: ' + (details.exception?.description ?? details.text));
        if (/in promise/.test(details.text ?? '')) {
          this.sawPromiseRejection = true;
          /*
           * السبب يُقرأ فوراً: النافذة تُستبدل عند كل تنقّل، فقراءة
           * window.__lastRejection في نهاية التشغيل تعطي "not captured"
           * وتخفي السبب الوحيد المفيد.
           */
          this.rejectionReads.push(
            this.send('Runtime.evaluate', { expression: 'window.__lastRejection ?? null' })
              .then((result) => result?.result?.value ?? null)
              .catch(() => null)
          );
        }
      }
      if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
        this.problems.push(`log: ${message.params.entry.text} ${message.params.entry.url ?? ''}`);
      }
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) {
      throw new Error(
        `evaluate failed: ${result.exceptionDetails.text} ${
          result.exceptionDetails.exception?.description ?? ''
        }`
      );
    }
    return result.result.value;
  }
}

const failures = [];
const check = (name, condition, detail) => {
  if (condition) {
    console.log(`  ok   ${name}${detail === undefined ? '' : ' -> ' + detail}`);
  } else {
    console.log(`  FAIL ${name}${detail === undefined ? '' : ' -> ' + detail}`);
    failures.push(name);
  }
};

const waitForApp = async (cdp, timeoutMs = 40000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(500);
    const ready = await cdp.evaluate(`(() => {
      const select = document.querySelector('#bank-select');
      return select !== null && !select.disabled && select.options.length > 1;
    })()`);
    if (ready) return true;
  }
  return false;
};

const readState = (cdp) =>
  cdp.evaluate(`(() => {
    const select = document.querySelector('#bank-select');
    const check = document.querySelector('#check-preview');
    const width = document.querySelector('#amount-words-width');
    const words = Array.from(
      document.querySelectorAll('#check-preview > div')
    )
      .filter((el) => el.className.includes('py-1') && !el.className.includes('px-3'))
      .pop();
    const amountInput = document.querySelector('#check-amount');
    return {
      bankCount: select ? select.options.length : 0,
      bankId: select ? select.value : '',
      bankName: select ? select.options[select.selectedIndex].text : '',
      // الصورة عنصر <img> لا خلفية CSS: الخلفية لا تُطبع إلا بخيار
      // "طباعة الرسومات الخلفية" في حوار الطباعة، أي ورقة بلا شيك.
      imageUrl: (() => {
        if (!check) return '';
        const img = check.querySelector('img');
        return img ? img.src : 'none';
      })(),
      widthValue: width ? width.value : null,
      amountWordsText: words ? words.innerText : '',
      amountWordsHeight: words ? Math.round(words.getBoundingClientRect().height) : null,
      previewWidth: check ? Math.round(check.getBoundingClientRect().width) : null,
      amount: amountInput ? amountInput.value : null,
      date: (document.querySelector('#check-date') || {}).value || null,
      place: (document.querySelector('#check-place') || {}).value || null,
      beneficiary: (document.querySelector('#check-beneficiary') || {}).value || null,      indexHtmlLang: document.documentElement.lang,
      externalResources: performance
        .getEntriesByType('resource')
        .map((r) => r.name)
        .filter((n) => !n.startsWith(location.origin)),
    };
  })()`);

/*
 * يقرأ ملف قاعدة البيانات نفسه من IndexedDB ويفحص محتواه.
 *
 * نقرأ البايتات لا الشجرة: هذا يثبت أن القيم مخزَّنة فعلاً في الملف
 * المحفوظ، لا محسوبة في الذاكرة. ملف SQLite يخزّن النصوص كما هي،
 * فيكفي البحث عنها في البايتات المشفَّرة UTF-8.
 */
const readFieldDefaults = async (cdp) => {
  const raw = await cdp.evaluate(`(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('cheque-generator');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const bytes = await new Promise((resolve, reject) => {
      const store = db.transaction('files', 'readonly').objectStore('files');
      const request = store.get('main.sqlite3');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    if (!bytes) return { base64: '' };

    let binary = '';
    const view = new Uint8Array(bytes);
    const step = 0x8000;
    for (let i = 0; i < view.length; i += step) {
      binary += String.fromCharCode.apply(null, view.subarray(i, i + step));
    }
    return { base64: btoa(binary) };
  })()`);

  const buffer = Buffer.from(raw.base64, 'base64');
  return {
    bytes: buffer.length,
    text: buffer.toString('latin1'),
    sql: buffer.toString('utf8'),
  };
};

/*
 * يزرع بيانات إصدار قديم في localStorage كما لو أوقف المستخدم التطبيق
 * قبل التحديث: مواضع بالبكسل (v1)، ومواضع محفوظة (v2)، وبيانات شيك،
 * وتفضيلات، وقالب محفوظ.
 */
const seedLegacyStorage = (cdp) =>
  cdp.evaluate(`(() => {
    localStorage.clear();
    // v1: عرض بالبكسل على معاينة 896px، بلا تسمية اللغة
    localStorage.setItem('bank_positions_bna_dz_ar', JSON.stringify({ amount: { x: 0.1, y: 0.2, width: 400 } }));
    // v2: عرض محفوظ كنسبة مئوية
    localStorage.setItem('v2:positions:cnep_dz:fr', JSON.stringify({ amountWords: { x: 0.42, y: 0.55, widthPercent: 35 } }));
    localStorage.setItem('v2:check_data', JSON.stringify({ date: '2026-01-15', place: 'LEGACY-PLACE', beneficiary: 'LEGACY-BENEFICIARY', amount: '123.45', dateIsAuto: false }));
    localStorage.setItem('v2:ui_prefs', JSON.stringify({ locked: true, showPositionControls: false }));
    localStorage.setItem('selected_bank_id', 'bna_dz');
    localStorage.setItem('language', 'fr');
    localStorage.setItem('v2:presets', JSON.stringify([{ id: 'legacy-preset', name: 'Legacy', bankId: 'bna_dz', language: 'ar', data: {}, positions: {}, createdAt: 1, updatedAt: 1 }]));
    return Object.keys(localStorage).length;
  })()`);
const countLines = (text) => (text === '' ? 0 : text.trimEnd().split('\n').length);

(async () => {
  fs.mkdirSync(profile, { recursive: true });

  const chrome = spawn(CHROME, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1440,1200',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    url,
  ]);

  let target = null;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await sleep(500);
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await res.json();
      target = list.find((item) => item.type === 'page' && item.url.startsWith('http'));
      if (target) break;
    } catch {
      /* لم يبدأ بعد */
    }
  }
  if (!target) {
    console.error('FAILED: no Chrome target');
    chrome.kill();
    process.exit(1);
  }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', reject);
  });
  const cdp = new Cdp(ws);
  await cdp.send('Runtime.enable');
  await cdp.send('Log.enable');
  await cdp.send('Page.enable');

  /*
   * يلتقط أسباب الرفض قبل تحميل التطبيق، في كل تنقّل لا في أول مرة
   * فقط: التنقل بين تبويبات اللوحة والصفحة إعادة تحميل كاملة.
   */
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `
      addEventListener('unhandledrejection', (event) => {
        const reason = event.reason;
        window.__lastRejection =
          (reason && (reason.stack || reason.message)) || String(reason);
      });
    `,
  });
  await cdp.evaluate(`
    addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      window.__lastRejection = (reason && (reason.stack || reason.message)) || String(reason);
    });
    true;
  `);

  console.log('\n[1] first run: seeding');
  const booted = await waitForApp(cdp);
  check('app ready', booted);
  const first = await readState(cdp);
  check('banks seeded once', first.bankCount === 19, `${first.bankCount} banks`);
  check('bank image loaded', first.imageUrl.includes('blob:') || first.imageUrl.includes('/banks/'), first.imageUrl.slice(0, 40));
  check('no external resources', first.externalResources.length === 0, JSON.stringify(first.externalResources));

  console.log('\n[1b] field defaults live in the SQLite file');
  const fieldDefaults = await readFieldDefaults(cdp);
  const now = new Date();
  const isoToday = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
  check('database file read from IndexedDB', fieldDefaults.bytes > 0, `${fieldDefaults.bytes} bytes`);
  check('field_defaults table exists', fieldDefaults.sql.includes('field_defaults'));
  check('date is stored in the database', fieldDefaults.text.includes('__today__'), 'marker __today__');
  check('arabic place default stored', fieldDefaults.sql.includes('الوادي'), 'الوادي');
  check(
    'french beneficiary default stored',
    fieldDefaults.text.includes('SARL ELHADJ ALI BAYOUDH COMMERCE'),
    'SARL ELHADJ ALI BAYOUDH COMMERCE'
  );
  check('amount default stored', fieldDefaults.text.includes('500000.00'), '500000.00');
  check('form date is today from the database', first.date === isoToday, `${first.date} vs ${isoToday}`);

  console.log('\n[2] data survives reload (IndexedDB)');
  const setWidth = async (value) => {
    await cdp.evaluate(`(() => {
      const input = document.querySelector('#amount-words-width');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, '${value}');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return input.value;
    })()`);
    await sleep(700);
  };

  await setWidth(30);
  const beforeReload = await readState(cdp);
  check('width applied', beforeReload.widthValue === '30', beforeReload.widthValue);

  await cdp.send('Page.reload', { ignoreCache: false });
  await sleep(1500);
  const reloaded = await waitForApp(cdp);
  check('app ready after reload', reloaded);
  const afterReload = await readState(cdp);
  check('banks not duplicated', afterReload.bankCount === 19, `${afterReload.bankCount} banks`);
  check('width persisted in SQLite', afterReload.widthValue === '30', afterReload.widthValue);

  console.log('\n[3] amount words wrapping at three widths');
  const wrapResults = [];
  for (const width of ['50', '30', '20']) {
    await setWidth(width);
    const state = await readState(cdp);
    const lines = countLines(state.amountWordsText);
    wrapResults.push({ width, lines, height: state.amountWordsHeight });
    console.log(`  width ${width}% -> ${lines} line(s), box height ${state.amountWordsHeight}px`);
  }
  const monotonic =
    wrapResults[0].lines <= wrapResults[1].lines && wrapResults[1].lines <= wrapResults[2].lines;
  check('narrower width wraps into more lines', monotonic, JSON.stringify(wrapResults.map((r) => r.lines)));

  console.log('\n[4] switching bank swaps the image');
  const firstImage = afterReload.imageUrl;
  /*
   * بنك واحد (poste_dz) بلا صورة عمداً، فننتقل إلى أول بنك له صورة
   * بدل افتراض أن الفهرس 2 يملكها. الاختبار هو تبديل الصورة نفسها.
   */
  let switched = null;
  let afterSwitch = null;
  for (let index = 1; index < 19; index += 1) {
    const bankId = await cdp.evaluate(`(() => {
      const select = document.querySelector('#bank-select');
      select.selectedIndex = ${index};
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return select.value;
    })()`);
    await sleep(900);
    const state = await readState(cdp);
    if (state.bankId !== bankId) continue;
    if (state.imageUrl !== 'none') {
      switched = bankId;
      afterSwitch = state;
      break;
    }
  }
  check('a bank with a cheque image was selected', switched !== null, switched ?? 'none found');
  if (afterSwitch) {
    check('selected bank changed', afterSwitch.bankId !== afterReload.bankId, afterSwitch.bankId);
    check('image differs after switch', afterSwitch.imageUrl !== firstImage, afterSwitch.imageUrl.slice(0, 40));
    check('new image loaded', afterSwitch.imageUrl.includes('blob:') || afterSwitch.imageUrl.includes('/banks/'), afterSwitch.imageUrl.slice(0, 40));
  }

  console.log('\n[5] language switch');
  const frLabel = await cdp.evaluate(`(() => {
    const button = Array.from(document.querySelectorAll('button')).find((b) => b.innerText.includes('Français'));
    if (!button) return null;
    button.click();
    return true;
  })()`);
  await sleep(900);
  const frState = await readState(cdp);
  check('language toggled', frLabel === true && frState.bankName.length > 0, frState.bankName);
  check('labels came from database', !/(form|preview|app|guide|nav|manage|boot)\.[a-zA-Z]/.test(frState.bankName), frState.bankName);

  console.log('\n[6] viewport regressions');
  for (const [width, height] of [
    [1440, 1000],
    [1100, 900],
    [820, 900],
  ]) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await sleep(700);
    const state = await readState(cdp);
    const overflow = await cdp.evaluate(
      'document.documentElement.scrollWidth - document.documentElement.clientWidth'
    );
    check(`no horizontal overflow at ${width}px`, overflow <= 1, `overflow ${overflow}px, preview ${state.previewWidth}px`);
  }

  console.log('\n[7] print: popup document + Ctrl+P fallback');
  /*
   * مساران للطباعة:
   * 1) النافذة المستقلة (زر الطباعة): نفحص المستند الذي يُكتب فيها.
   * 2) الاحتياطي عبر `window.print()`: نحاكي وسائط الطباعة ونقيس
   *    نفس الحقول على الصفحة نفسها. القاعدة: تخطيط الطباعة مطابق
   *    للمعاينة (نفس العرض، نفس حجم الخط، نفس عدد الأسطر) بمقاس
   *    210×99mm الحقيقي.
   */
  const longAmount = '9876543.21';
  await cdp.evaluate(`(() => {
    const input = document.querySelector('#check-amount');
    if (!input) return 'no amount input';
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, '${longAmount}');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return input.value;
  })()`);
  await sleep(600);

  const measureWords = `(() => {
    const box = document.querySelector('#check-preview');
    if (!box) return { error: 'no preview' };
    const words = Array.from(box.querySelectorAll('.print-text'))
      .find((el) => getComputedStyle(el).whiteSpace === 'normal');
    if (!words) return { error: 'no amount words' };
    const cs = getComputedStyle(words);
    const line = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.15;
    const rect = box.getBoundingClientRect();
    return {
      layoutWidth: box.clientWidth,
      boxWidth: Math.round(rect.width),
      boxHeight: Math.round(rect.height),
      transform: getComputedStyle(box).transform,
      fontSize: Math.round(parseFloat(cs.fontSize) * 1000) / 1000,
      wordsHeight: words.clientHeight,
      lines: Math.round(words.clientHeight / line),
      hasImage: box.querySelector('img') !== null,
      visible: getComputedStyle(box).display !== 'none',
      pageBackground: getComputedStyle(document.body).backgroundColor,
    };
  })()`;

  const printComparison = [];
  for (const width of ['50', '30', '20']) {
    await setWidth(width);
    const preview = await cdp.evaluate(measureWords);

    await cdp.send('Emulation.setEmulatedMedia', { media: 'print' });
    await sleep(600);
    const printState = await cdp.evaluate(measureWords);
    await cdp.send('Emulation.setEmulatedMedia', { media: '' });
    await sleep(400);

    printComparison.push({ width, preview, print: printState });
    console.log(
      `  width ${width}% -> preview ${preview.lines} line(s) @${preview.fontSize}px (layout ${preview.layoutWidth}px), print ${printState.lines} line(s) @${printState.fontSize}px (layout ${printState.layoutWidth}px) -> ${printState.boxWidth}x${printState.boxHeight}px`
    );
  }

  const trueSize = (210 * 96) / 25.4; // 793.7px
  check(
    'print layout is identical to the preview (width, font, wrap)',
    printComparison.every(
      (row) =>
        !row.preview.error &&
        !row.print.error &&
        row.print.layoutWidth === row.preview.layoutWidth &&
        row.print.fontSize === row.preview.fontSize &&
        row.print.wordsHeight === row.preview.wordsHeight &&
        row.print.lines === row.preview.lines
    ),
    JSON.stringify(printComparison.map((r) => ({ w: r.width, p: r.preview, q: r.print })))
  );
  check(
    'print is scaled visually to 210mm, not re-laid-out',
    printComparison.every((row) => (row.print.transform ?? 'none') !== 'none'),
    JSON.stringify(printComparison.map((r) => r.print.transform))
  );
  check(
    'printed cheque is 210mm x 99mm (true physical size)',
    printComparison.every(
      (row) =>
        Math.abs((row.print.boxWidth ?? 0) - trueSize) <= 1 &&
        Math.abs((row.print.boxHeight ?? 0) - (trueSize * 99) / 210) <= 1
    ),
    JSON.stringify(printComparison.map((r) => `${r.print.boxWidth}x${r.print.boxHeight}`))
  );
  check(
    'cheque image is an element that always prints (not a CSS background)',
    printComparison.every((row) => row.print.hasImage && row.print.visible),
    JSON.stringify(printComparison.map((r) => r.print.hasImage))
  );
  check(
    'printed page is white (no app background)',
    printComparison.every((row) => /255, 255, 255/.test(row.print.pageBackground ?? '')),
    JSON.stringify(printComparison.map((r) => r.print.pageBackground))
  );

  /*
   * زر الطباعة: يفتح نافذة مستقلة ويكتب فيها صفحة الشيك ثم يطبع منها.
   * نحاكي `window.open` ونلتقط ما كُتب، فنتحقق من المحتوى ومن استدعاء
   * الطباعة داخل النافذة لا من `window.print` في الصفحة (الاحتياطي).
   */
  const printCalled = await cdp.evaluate(`(async () => {
    const nativeOpen = window.open;
    let written = '';
    let printed = false;
    let closedByApp = false;
    const fakeWindow = {
      closed: false,
      document: {
        images: [],
        fonts: { ready: Promise.resolve() },
        open() {},
        write(html) { written = html; },
        close() {},
      },
      addEventListener() {},
      focus() {},
      print() { printed = true; },
      close() { closedByApp = true; this.closed = true; },
    };
    window.open = () => fakeWindow;
    const button = Array.from(document.querySelectorAll('button')).find(
      (b) => b.innerText.trim() === 'طباعة' || b.innerText.trim() === 'Imprimer'
    );
    if (!button) { window.open = nativeOpen; return { error: 'print button not found' }; }
    button.click();
    // CLOSE_DELAY_MS = 1000ms: نقبل أن إغلاق النافذة بعد حوار الطباعة
    await new Promise((r) => setTimeout(r, 1600));
    window.open = nativeOpen;
    return { printed, hasWrite: written.length > 0, html: written, closedByApp };
  })()`);

  check(
    'print button opens a separate window and prints inside it',
    printCalled.printed === true && printCalled.hasWrite === true,
    JSON.stringify({ printed: printCalled.printed, hasWrite: printCalled.hasWrite })
  );
  check(
    'printed document is the cheque alone at 210mm x 99mm (A4 landscape)',
    /@page\s*\{[^}]*size:\s*A4 landscape/.test(printCalled.html ?? '') &&
      /width:\s*210mm/.test(printCalled.html ?? '') &&
      /height:\s*99mm/.test(printCalled.html ?? ''),
    JSON.stringify(printCalled.error ?? 'document written')
  );
  check(
    'print page has no margins and no clipping (content box = whole sheet)',
    // هوامش @page كانت تصغّر المساحة إلى 197×70mm فيُقصّ يمين الشيك.
    // نُسقط تعليقات CSS أولاً: نصوصها تذكر القيم فتضلّ المطابقة.
    (() => {
      const css = (printCalled.html ?? '').replace(/\/\*[\s\S]*?\*\//g, '');
      return (
        /@page\s*\{[^}]*size:\s*A4 landscape/.test(css) &&
        /@page\s*\{[^}]*margin:\s*0/.test(css) &&
        !/body\s*\{[^}]*overflow/.test(css)
      );
    })(),
    JSON.stringify(printCalled.error ?? 'margin 0, nothing clipped')
  );
  check(
    'printed document carries the values at absolute positions',
    // المبلغ يُطبع مفصولاً بآلاف، فنُسقط الفواصل قبل المطابقة
    /9876543/.test((printCalled.html ?? '').replace(/[\s\u00a0\u202f,]/g, '')) &&
      /left:\s*[\d.]+%/.test(printCalled.html ?? ''),
    JSON.stringify(printCalled.error ?? 'values present')
  );

  check(
    'printed cheque image is an <img>, not a CSS background',
    /<img[^>]+src=/.test(printCalled.html ?? ''),
    JSON.stringify(printCalled.error ?? 'image element present')
  );
  check(
    'printed window closes itself after the dialog',
    printCalled.closedByApp === true,
    JSON.stringify({ closedByApp: printCalled.closedByApp })
  );

  /*
   * هندسة الورقة: نكتب مستند الطباعة في الصفحة نفسها ونقيس الشيك
   * بورقة A4 أفقية (297×210mm عند 96dpi) في وضع الطباعة. القاعدة:
   * الشيك داخل الورقة كلِّها وموسّط فيها، فلا يُقصّ منه شيء.
   *
   * نُعيد تحميل الصفحة بعدها (القسم [8] ينتقل من جديد).
   */
  const sheetWidth = Math.round((297 / 25.4) * 96);
  const sheetHeight = Math.round((210 / 25.4) * 96);
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: sheetWidth,
    height: sheetHeight,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await cdp.send('Emulation.setEmulatedMedia', { media: 'print' });
  const sheet = await cdp.evaluate(`(() => {
    document.open();
    document.write(${JSON.stringify(printCalled.html ?? '')});
    document.close();
    const box = document.querySelector('.cheque');
    if (!box) return { error: 'no cheque box' };
    const r = box.getBoundingClientRect();
    return {
      x: Math.round(r.x),
      y: Math.round(r.y),
      w: Math.round(r.width),
      h: Math.round(r.height),
      sheetW: document.documentElement.clientWidth,
      sheetH: document.documentElement.clientHeight,
    };
  })()`);
  await cdp.send('Emulation.setEmulatedMedia', { media: '' });
  await cdp.send('Emulation.clearDeviceMetricsOverride');

  const inside =
    !sheet.error &&
    sheet.w > 0 &&
    sheet.x >= 0 &&
    sheet.y >= 0 &&
    sheet.x + sheet.w <= sheet.sheetW + 1 &&
    sheet.y + sheet.h <= sheet.sheetH + 1;
  const centred =
    !sheet.error &&
    Math.abs(sheet.x - (sheet.sheetW - sheet.w) / 2) <= 2 &&
    Math.abs(sheet.y - (sheet.sheetH - sheet.h) / 2) <= 2;

  check(
    'cheque fits inside the A4 sheet (nothing clipped)',
    inside && Math.abs(sheet.w - 794) <= 2 && Math.abs(sheet.h - 374) <= 2,
    JSON.stringify(sheet)
  );
  check(
    'cheque is centred on the sheet',
    centred,
    JSON.stringify(sheet)
  );
  console.log(
    `  sheet ${sheet.sheetW}x${sheet.sheetH}px -> cheque ${sheet.x},${sheet.y} ${sheet.w}x${sheet.h}px`
  );

  console.log('\n[8] legacy localStorage data migrated into SQLite');
  await cdp.send('Page.navigate', { url });
  await sleep(1500);
  const planted = await seedLegacyStorage(cdp);
  check('legacy keys planted', planted === 7, `${planted} keys`);

  // نحذف ملف القاعدة: نحاكي أول إقلاع بعد التحديث لدى مستخدم قديم
  const dropped = await cdp.evaluate(`(async () => {
    await new Promise((resolve) => {
      const request = indexedDB.deleteDatabase('cheque-generator');
      request.onsuccess = resolve;
      request.onerror = resolve;
      request.onblocked = resolve;
    });
    return true;
  })()`);
  check('database file deleted', dropped === true);

  await cdp.send('Page.navigate', { url });
  await sleep(2200);
  const migratedBoot = await waitForApp(cdp);
  check('app ready after migration boot', migratedBoot);

  const migratedState = await readState(cdp);
  check('legacy place migrated', migratedState.place === 'LEGACY-PLACE', migratedState.place);
  check('legacy beneficiary migrated', migratedState.beneficiary === 'LEGACY-BENEFICIARY', migratedState.beneficiary);
  check('legacy amount migrated', migratedState.amount === '123.45', migratedState.amount);
  check('legacy manual date kept', migratedState.date === '2026-01-15', migratedState.date);
  check('preferred bank restored', migratedState.bankId === 'bna_dz', migratedState.bankId);
  check('banks still seeded once', migratedState.bankCount === 19, `${migratedState.bankCount} banks`);

  // المواضع المهاجرة: ننتقل إلى البنك/اللغة المخزَّنين ونقرأ العرض المحفوظ
  const migratedPosition = await cdp.evaluate(`(async () => {
    const select = document.querySelector('#bank-select');
    const option = Array.from(select.options).find((o) => o.value === 'cnep_dz');
    if (!option) return { error: "cnep_dz missing" };
    select.value = 'cnep_dz';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 1200));
    const button = Array.from(document.querySelectorAll('button')).find((b) => b.innerText.includes('Français'));
    if (button) button.click();
    await new Promise((r) => setTimeout(r, 1200));
    const input = document.querySelector('#amount-words-width');
    return { width: input ? input.value : null, lang: document.documentElement.lang };
  })()`);
  check('legacy position width migrated', migratedPosition.width === '35', JSON.stringify(migratedPosition));

  const legacyLeft = await cdp.evaluate('(() => Object.keys(localStorage))()');
  // dark_mode يكتبه useDarkMode مباشرة قبل الإقلاع (طلاء أول إطار)،
  // فليس من مفاتيح الإصدار القديم
  const leftovers = legacyLeft.filter((key) => key !== 'dark_mode');
  check('legacy keys cleared after success', leftovers.length === 0, JSON.stringify(leftovers));

  const migrationMarkers = await readFieldDefaults(cdp);
  check('migration recorded in the database', migrationMarkers.text.includes('legacy-localstorage'));

  console.log('\n[9] management panel: banks, presets, defaults, labels, data');
  await cdp.send('Page.navigate', { url });
  await sleep(1500);
  check('app ready for management checks', await waitForApp(cdp));

  // نستعمل العربية صراحة: الأرقام وحقول التاريخ تُقرأ من الواجهة
  const toArabic = await cdp.evaluate(`(() => {
    const button = Array.from(document.querySelectorAll('button')).find((b) => b.innerText.includes('العربية'));
    if (button) button.click();
    return document.documentElement.lang;
  })()`);
  await sleep(600);
  check('switched back to arabic', toArabic === 'ar', toArabic);

  const panel = await cdp.evaluate(`(async () => {
    const open = document.querySelector('#manage-open');
    if (!open) return { error: 'manage-open button missing' };

    const beforeBank = document.querySelector('#bank-select').value;
    open.click();
    await new Promise((r) => setTimeout(r, 700));

    const panelEl = document.querySelector('#management-panel');
    const bankRows = panelEl ? panelEl.querySelectorAll('[data-bank-id]').length : 0;
    const bankOptions = Array.from(document.querySelectorAll('[data-bank-id] button, [data-bank-id] input'));
    return {
      open: panelEl !== null,
      bankRows,
      hasImagePicker: panelEl ? panelEl.querySelector('input[type="file"]') !== null : false,
      beforeBank,
    };
  })()`);
  check('management panel opens', panel.open === true, JSON.stringify(panel));
  check('bank list rendered', panel.bankRows > 0, `${panel.bankRows} rows`);
  check('bank image picker present', panel.hasImagePicker === true);

  // إنشاء قالب عبر لوحة النموذج، ثم إعادة تسميته من تبويب القوالب
  const preset = await cdp.evaluate(`(async () => {
    const close = Array.from(document.querySelectorAll('#management-panel button'))
      .find((b) => b.getAttribute('aria-label') === 'close');
    if (close) close.click();
    await new Promise((r) => setTimeout(r, 400));

    const input = document.querySelector('#preset-name');
    if (!input) return { error: 'preset-name input missing' };

    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'قالب-للاختبار');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 200));

    const saveBtn = Array.from(document.querySelectorAll('button'))
      .find((b) => b.innerText.includes('حفظ كقالب جديد'));
    if (!saveBtn) return { error: 'save-preset button missing' };
    saveBtn.click();
    await new Promise((r) => setTimeout(r, 900));

    const chips = Array.from(document.querySelectorAll('li button[title]'))
      .map((b) => b.getAttribute('title'));
    return { chips };
  })()`);
  check(
    'preset created and listed',
    Array.isArray(preset.chips) && preset.chips.includes('قالب-للاختبار'),
    JSON.stringify(preset)
  );

  const renamed = await cdp.evaluate(`(async () => {
    const open = document.querySelector('#manage-open');
    open.click();
    await new Promise((r) => setTimeout(r, 600));

    const tab = document.querySelector('.sp-rail__item[data-tab="presets"]');
    if (!tab) return { error: 'presets tab missing' };
    tab.click();
    await new Promise((r) => setTimeout(r, 700));

    const row = Array.from(document.querySelectorAll('#manage-preset-list > li'))
      .find((li) => li.innerText.includes('قالب-للاختبار'));
    if (!row) return { error: 'preset row missing' };

    const renameBtn = Array.from(row.querySelectorAll('button'))
      .find((b) => b.innerText.trim() === 'إعادة تسمية');
    if (!renameBtn) return { error: 'rename button missing' };
    renameBtn.click();
    await new Promise((r) => setTimeout(r, 300));

    const field = row.querySelector('input');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(field, 'قالب-معدَّل');
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await new Promise((r) => setTimeout(r, 900));

    return {
      rows: Array.from(document.querySelectorAll('#manage-preset-list > li')).map((li) =>
        li.innerText.split('\\n')[0].trim()
      ),
    };
  })()`);
  check(
    'preset renamed from the management tab',
    Array.isArray(renamed.rows) && renamed.rows.some((row) => row.includes('قالب-معدَّل')),
    JSON.stringify(renamed)
  );

  const deleted = await cdp.evaluate(`(async () => {
    const row = Array.from(document.querySelectorAll('#manage-preset-list > li'))
      .find((li) => li.innerText.includes('قالب-معدَّل'));
    if (!row) return { error: 'renamed row missing' };

    const delBtn = Array.from(row.querySelectorAll('button'))
      .find((b) => (b.getAttribute('aria-label') || '').startsWith('حذف القالب'));
    if (!delBtn) return { error: 'delete button missing' };

    const nativeConfirm = window.confirm;
    window.confirm = () => true;
    delBtn.click();
    await new Promise((r) => setTimeout(r, 900));
    window.confirm = nativeConfirm;

    return {
      rows: Array.from(document.querySelectorAll('#manage-preset-list > li')).length,
      inline: Array.from(document.querySelectorAll('li button[title]')).map((b) =>
        b.getAttribute('title')
      ),
    };
  })()`);
  check('preset deleted everywhere', deleted.rows === 0 && deleted.inline.length === 0, JSON.stringify(deleted));

  // القيم الافتراضية: نعدّلها ونتأكد أنها وصلت القاعدة
  const defaults = await cdp.evaluate(`(async () => {
    const tab = document.querySelector('.sp-rail__item[data-tab="defaults"]');
    if (!tab) return { error: 'defaults tab missing' };
    tab.click();
    await new Promise((r) => setTimeout(r, 700));

    const field = document.querySelector('#manage-default-place');
    if (!field) return { error: 'place input missing' };

    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(field, 'وهران-مُختبَر');
    field.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 200));

    const save = document.querySelector('#manage-defaults-save');
    if (!save) return { error: 'save button missing' };
    save.click();
    await new Promise((r) => setTimeout(r, 900));

    return { place: field.value };
  })()`);
  check('defaults tab saves the place', defaults.place === 'وهران-مُختبَر', JSON.stringify(defaults));

  const storedDefaults = await readFieldDefaults(cdp);
  check(
    'defaults value is in the SQLite file',
    storedDefaults.sql.includes('وهران-مُختبَر'),
    storedDefaults.sql.slice(0, 200)
  );

  // الترجمة: تحرير تسمية وقراءتها من القاعدة
  const labels = await cdp.evaluate(`(async () => {
    const tab = document.querySelector('.sp-rail__item[data-tab="labels"]');
    if (!tab) return { error: 'labels tab missing' };
    tab.click();
    await new Promise((r) => setTimeout(r, 900));

    const row = Array.from(document.querySelectorAll('li'))
      .find((li) => li.innerText.includes('app.title'));
    if (!row) return { error: 'app.title row missing', count: document.querySelectorAll('li').length };

    const frInput = row.querySelector('input[dir="ltr"]');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(frInput, 'Titre-de-test');
    frInput.dispatchEvent(new Event('input', { bubbles: true }));
    /*
     * React يربط onBlur بالحدث focusout لا بـ blur: حدث blur لا
     * يصعد، فلا يصل إلى المكوّن أصلاً. بلا focusout لا يُحفظ شيء
     * في SQLite ويبدو التطبيق معطّلاً وهو سليم.
     */
    frInput.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    frInput.dispatchEvent(new Event('blur', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 1500));

    return { value: frInput.value };
  })()`);
  check('label edit accepted', labels.value === 'Titre-de-test', JSON.stringify(labels));

  const storedLabels = await readFieldDefaults(cdp);
  check(
    'label is in the SQLite file',
    storedLabels.sql.includes('Titre-de-test'),
    storedLabels.sql.slice(0, 200)
  );

  const history = await cdp.evaluate(`(async () => {
    const close = Array.from(document.querySelectorAll('#management-panel button'))
      .find((b) => b.getAttribute('aria-label') === 'close');
    if (close) close.click();
    await new Promise((r) => setTimeout(r, 500));

    const printBtn = Array.from(document.querySelectorAll('button'))
      .find((b) => b.innerText.includes('طباعة'));
    if (!printBtn) return { error: 'print button missing' };

    const nativeOpen = window.open;
    window.open = () => ({
      closed: false,
      document: { images: [], fonts: { ready: Promise.resolve() }, open() {}, write() {}, close() {} },
      addEventListener() {},
      focus() {},
      print() {},
      close() { this.closed = true; },
    });
    printBtn.click();
    await new Promise((r) => setTimeout(r, 300));
    window.open = nativeOpen;
    await new Promise((r) => setTimeout(r, 900));

    document.querySelector('#manage-open').click();
    await new Promise((r) => setTimeout(r, 700));
    const tab = document.querySelector('.sp-rail__item[data-tab="data"]');
    if (!tab) return { error: 'data tab missing' };
    tab.click();
    await new Promise((r) => setTimeout(r, 800));

    const rows = Array.from(document.querySelectorAll('#management-panel li'))
      .map((li) => li.innerText.replace(/\\s+/g, ' ').trim());
    return { rows, hasExport: document.querySelector('#manage-export') !== null };
  })()`);
  check('export button present', history.hasExport === true, JSON.stringify(history).slice(0, 200));
  check(
    'print is recorded in the history tab',
    Array.isArray(history.rows) && history.rows.length > 0 && !history.rows[0].includes('السجل فارغ'),
    JSON.stringify(history.rows)
  );

  const persisted = await cdp.evaluate(`(async () => {
    const select = document.querySelector('#bank-select');
    const option = Array.from(select.options).find((o) => o.value === 'bna_dz');
    select.value = 'bna_dz';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 900));
    return select.value;
  })()`);
  check('bank switched for the preference test', persisted === 'bna_dz', persisted);

  console.log('\n[10] settings modal: fixed size, print margins under user control');
  /*
   * شرطان خرجا من طلب المستخدم:
   * 1) اللوحة لا تتبدّل أبعادها بين التبويبات (كانت تقفز مع كل تبديل).
   * 2) الهامش الأيمن للشيك على الورقة قابل للضبط، ويصل إلى الطباعة.
   */
  const modal = await cdp.evaluate(`(async () => {
    document.querySelector('#manage-open').click();
    await new Promise((r) => setTimeout(r, 700));

    const panel = document.querySelector('#management-panel');
    if (!panel) return { error: 'panel missing' };

    const tabs = Array.from(panel.querySelectorAll('.sp-rail__item'));
    const boxes = [];
    for (const tab of tabs) {
      tab.click();
      await new Promise((r) => setTimeout(r, 450));
      const r = panel.getBoundingClientRect();
      boxes.push({
        tab: tab.getAttribute('data-tab'),
        w: Math.round(r.width),
        h: Math.round(r.height),
      });
    }
    return { count: tabs.length, boxes };
  })()`);

  check(
    'settings modal has every tab (fonts and print included)',
    modal.count === 7,
    JSON.stringify(modal).slice(0, 200)
  );
  check(
    'modal keeps the exact same size in every tab',
    Array.isArray(modal.boxes) &&
      modal.boxes.length > 1 &&
      modal.boxes.every((box) => box.w === modal.boxes[0].w && box.h === modal.boxes[0].h),
    JSON.stringify(modal.boxes)
  );

  const margins = await cdp.evaluate(`(async () => {
    const panel = document.querySelector('#management-panel');
    const tab = panel && panel.querySelector('.sp-rail__item[data-tab="print"]');
    if (!tab) return { error: 'print tab missing' };
    tab.click();
    await new Promise((r) => setTimeout(r, 500));

    const setNumber = (id, value) => {
      const input = document.getElementById(id);
      if (!input) return 'missing';
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      // React يربط onBlur على focusout لا على blur
      input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      return input.value;
    };

    const right = setNumber('print-margin-right', '12');
    setNumber('print-margin-top', '40');
    await new Promise((r) => setTimeout(r, 900));

    return {
      right,
      diagram: panel.querySelectorAll('.sp-diagram__cheque').length,
      amountField: document.getElementById('print-amount-right') !== null,
    };
  })()`);

  check(
    'print tab exposes the sheet margins and the amount position',
    margins.right === '12' && margins.diagram === 1 && margins.amountField === true,
    JSON.stringify(margins)
  );

  /*
   * حجم الخط لكل حقل: نضبط المستفيد على 15 نقطة ثم نقيس نموذج الخطوط
   * ومعاينة الشيك المرئية، ثم نتأكد أن المستند المطبوع يحمل الرقم نفسه.
   *
   * القياس بنسبة الحاوية لا بالبكسل: المعاينة والنموذج بعرضين مختلفين
   * (210mm وسعة البطاقة)، فالبكسل وحده ليس مقارنة عادلة. والهامش
   * مسموح بنصف بكسل: المتصفح يُقرّب حجم الخط إلى بكسل صحيح، فالنسبة
   * تُقارن بهامش يساوي 0.5px على عرض الحاوية.
   */
  const fonts = await cdp.evaluate(`(async () => {
    const panel = document.querySelector('#management-panel');
    const tab = panel && panel.querySelector('.sp-rail__item[data-tab="fonts"]');
    if (!tab) return { error: 'fonts tab missing' };
    tab.click();
    await new Promise((r) => setTimeout(r, 500));

    const controls = Array.from(document.querySelectorAll('#management-panel input[type="number"]'))
      .map((input) => input.id)
      .filter((id) => id.startsWith('font-'));
    const specimenFields = panel.querySelectorAll('.sp-specimen__field[data-field]').length;

    const input = document.getElementById('font-beneficiary');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, '15');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 700));

    const measure = (element, container) => {
      if (!element || !container) return null;
      const width = container.getBoundingClientRect().width;
      if (width <= 0) return null;
      return { px: parseFloat(getComputedStyle(element).fontSize), width };
    };

    const paper = panel.querySelector('.sp-specimen__paper');
    const specimen = measure(paper && paper.querySelector('[data-field="beneficiary"]'), paper);

    /*
     * الحقل المضبوط هو الذي خرج عن الأحجام الافتراضية، فنحدّده بالرقم
     * لا بالترتيب: الترتيب في DOM ليس ترتيب الحقول في البيانات.
     */
    const cheque = document.getElementById('check-preview');
    const changed = Array.from(cheque.querySelectorAll('div[style*="font-size"]'))
      .filter((el) => /^2\\.5/.test(el.style.fontSize));
    const preview = changed.length === 1 ? measure(changed[0], cheque) : null;

    return {
      controls,
      specimenFields,
      specimen,
      preview,
      changedCount: changed.length,
      amountWords: document.getElementById('font-amountWords')?.value ?? null,
      date: document.getElementById('font-date')?.value ?? null,
    };
  })()`);

  const specimenRatio = fonts.specimen ? fonts.specimen.px / fonts.specimen.width : null;
  const previewRatio = fonts.preview ? fonts.preview.px / fonts.preview.width : null;
  // نصف بكسل على عرض الحاوية: تقريب المتصفح لحجم الخط
  const slack = Math.max(
    0.5 / (fonts.specimen?.width ?? 1),
    0.5 / (fonts.preview?.width ?? 1)
  );
  const expectedRatio = 0.025206; // 15 نقطة من عرض 210مم

  check(
    'fonts tab exposes one control per cheque field with a live specimen',
    Array.isArray(fonts.controls) &&
      fonts.controls.length === 5 &&
      fonts.specimenFields === 5 &&
      fonts.date !== null,
    JSON.stringify(fonts)
  );

  check(
    'a font size change reaches the specimen and the preview at the same ratio',
    fonts.changedCount === 1 &&
      specimenRatio !== null &&
      previewRatio !== null &&
      Math.abs(specimenRatio - expectedRatio) < slack &&
      Math.abs(specimenRatio - previewRatio) < slack,
    JSON.stringify({
      specimenRatio,
      previewRatio,
      expectedRatio,
      slack,
      changed: fonts.changedCount,
    })
  );

  // الهامش يجب أن يصل إلى مستند الطباعة: 87mm - 12mm = 75mm من اليسار
  const printed = await cdp.evaluate(`(async () => {
    const close = Array.from(document.querySelectorAll('#management-panel button'))
      .find((b) => b.getAttribute('aria-label') === 'close');
    if (close) close.click();
    await new Promise((r) => setTimeout(r, 400));

    let html = '';
    const nativeOpen = window.open;
    window.open = () => ({
      closed: false,
      document: {
        images: [],
        fonts: { ready: Promise.resolve() },
        open() {},
        write(doc) { html = doc; },
        close() {},
      },
      addEventListener() {},
      focus() {},
      print() {},
      close() { this.closed = true; },
    });
    const button = Array.from(document.querySelectorAll('button'))
      .find((b) => b.innerText.trim() === 'طباعة' || b.innerText.trim() === 'Imprimer');
    if (!button) { window.open = nativeOpen; return { error: 'print button missing' }; }
    button.click();
    await new Promise((r) => setTimeout(r, 1600));
    window.open = nativeOpen;
    return { html };
  })()`);

  check(
    'the right margin reaches the printed document (297-210-12 = 75mm)',
    /left:\s*75mm/.test(printed.html ?? '') && /top:\s*40mm/.test(printed.html ?? ''),
    JSON.stringify({
      left: (printed.html ?? '').match(/left:\s*[-\d.]+mm/)?.[0] ?? 'none',
      top: (printed.html ?? '').match(/top:\s*[-\d.]+mm/)?.[0] ?? 'none',
    })
  );

  check(
    'the chosen font size reaches the printed document (15pt = 2.5198cqw)',
    /font-size:2\.519\d+cqw/.test(printed.html ?? ''),
    JSON.stringify({
      sizes: Array.from((printed.html ?? '').matchAll(/font-size:[\d.]+cqw/g)).map((m) => m[0]),
    })
  );

  // البقاء بعد إعادة التحميل: الهامش في جدول التفضيلات لا في حالة مؤقتة
  await cdp.send('Page.navigate', { url });
  await sleep(2200);
  const layoutRestored = await cdp.evaluate(`(async () => {
    document.querySelector('#manage-open').click();
    await new Promise((r) => setTimeout(r, 700));
    const tab = document.querySelector('.sp-rail__item[data-tab="print"]');
    if (!tab) return { error: 'print tab missing' };
    tab.click();
    await new Promise((r) => setTimeout(r, 500));
    return {
      right: document.getElementById('print-margin-right')?.value ?? null,
      top: document.getElementById('print-margin-top')?.value ?? null,
    };
  })()`);
  check(
    'sheet margins survive a reload (stored in the database)',
    layoutRestored.right === '12' && layoutRestored.top === '40',
    JSON.stringify(layoutRestored)
  );

  const fontsRestored = await cdp.evaluate(`(async () => {
    document.querySelector('#manage-open').click();
    await new Promise((r) => setTimeout(r, 700));
    const tab = document.querySelector('.sp-rail__item[data-tab="fonts"]');
    if (!tab) return { error: 'fonts tab missing' };
    tab.click();
    await new Promise((r) => setTimeout(r, 500));
    return {
      beneficiary: document.getElementById('font-beneficiary')?.value ?? null,
      date: document.getElementById('font-date')?.value ?? null,
    };
  })()`);
  check(
    'font sizes survive a reload (stored with the bank positions)',
    fontsRestored.beneficiary === '15' && fontsRestored.date === '11.3',
    JSON.stringify(fontsRestored)
  );

  /*
   * السبب للمرّة الأولى: الترقية لا يكفي أن تنجح في الذاكرة، يجب أن
   * يظهر العمود في ملف القاعدة المحفوظ. جدول SQLite يخزّن أسماء
   * أعمونه كنص في صفحة المخطط، فنبحث عنه في بايتات الملف نفسها.
   */
  const storedFonts = await readFieldDefaults(cdp);
  check(
    'the font_cqw column exists in the saved database file',
    storedFonts.text.includes('font_cqw'),
    `${storedFonts.bytes} bytes`
  );

  /*
   * القيمة نفسها في الملف لا في الصفحة: عمود REAL يُخزَّن مزدوجاً
   * بثمانية بايتات، فنبحث عن البايتات نفسها. هذا يكشف الفشل الصامت
   * الذي رأيناه: التعديل في الذاكرة والمستند يخرجان صحيحين بينما
   * ترفض المعاملة الحفظ فلا يجد شيء في الملف.
   *
   * الترتيب big-endian لا little: بناء SQLite هنا مخوَّل بـ IEEE byte
   * swap، وقد تأكّد ذلك من الملف نفسه (النمط موجود بترتيب big فقط).
   * ونقتصر على أول أربعة بايتات: قد تتغيّر الأجزاء الأخرى بصيغة
   * التخزين المعيارية المزاحة بلا أن يتغيّر الرقم المقروء.
   */
  const fifteenPtBytes = Buffer.alloc(8);
  fifteenPtBytes.writeDoubleBE(2.5198412698412698);
  check(
    'the font size is written to the database file as a real number',
    storedFonts.text.includes(fifteenPtBytes.toString('latin1')),
    `looking for ${fifteenPtBytes.toString('hex')}`
  );

  await cdp.send('Page.navigate', { url });
  await sleep(2200);
  check('app ready after settings reload', await waitForApp(cdp));
  const restoredBank = await cdp.evaluate(
    `document.querySelector('#bank-select').value`
  );
  check('selected bank restored from the database', restoredBank === 'bna_dz', restoredBank);

  /*
   * سبب الرفض: CDP يعطي الاستثناء نصاً واحداً بلا سبب، والسبب وحده
   * هو الذي يحدّد هل الخطأ في الاستعلام أم في الحفظ.
   */
  if (cdp.sawPromiseRejection) {
    const reasons = (await Promise.all(cdp.rejectionReads)).filter(Boolean);
    cdp.problems.push(
      'rejection reason: ' +
        (reasons.length === 0
          ? 'not captured'
          : reasons.map((reason) => String(reason).slice(0, 400)).join(' | '))
    );
  }

  console.log(
    '\nconsole: ' + (cdp.problems.length === 0 ? 'clean' : 'PROBLEMS\n' + cdp.problems.join('\n'))
  );
  if (cdp.problems.length > 0) failures.push('console problems');

  ws.close();
  chrome.kill();
  // نحذف ملف التعريف حتى لا يبقى على حاله في التشغيل التالي
  try {
    fs.rmSync(profile, { recursive: true, force: true });
  } catch {
    /* لا يهم: ملف مؤقت */
  }
  console.log(failures.length === 0 ? '\nALL CHECKS PASSED' : `\nFAILED: ${failures.join(', ')}`);
  process.exit(failures.length === 0 ? 0 : 2);
})();
