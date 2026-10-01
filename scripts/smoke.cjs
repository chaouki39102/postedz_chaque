/**
 * فحص دخاني للمتصفح عبر بروتوكول DevTools.
 *
 * لماذا هذا الملف: `chrome --dump-dom` ينهي الصفحة قبل أن تنتهي
 * تحميلات غير متزامنة (WASM + IndexedDB)، فيعطي نتيجة مضلّلة. هنا
 * نتحكّم في التوقيت: ننتظر ظهور عنصر معروف، نجمع أخطاء الطرفية،
 * ثم ننفّذ فحوصاً قابلة للقراءة.
 *
 * الاستخدام:
 *   node scripts/smoke.cjs <url> <profileDir> [screenshotPath]
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9333;

const url = process.argv[2] ?? 'http://localhost:4173/';
const profile = process.argv[3] ?? path.join(process.env.TEMP, 'chrome-smoke-profile');
const screenshot = process.argv[4] ?? null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchJson = async (endpoint) => {
  const res = await fetch(`http://127.0.0.1:${PORT}${endpoint}`);
  return res.json();
};

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.events = [];
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
      this.events.push(message);
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

const collectConsole = (cdp) => {
  const problems = [];
  for (const event of cdp.events) {
    if (event.method === 'Runtime.consoleAPICalled' && event.params.type === 'error') {
      problems.push(
        'console.error: ' + event.params.args.map((a) => a.value ?? a.description ?? '').join(' ')
      );
    }
    if (event.method === 'Runtime.exceptionThrown') {
      const details = event.params.exceptionDetails;
      problems.push('exception: ' + (details.exception?.description ?? details.text));
    }
    if (event.method === 'Log.entryAdded' && event.params.entry.level === 'error') {
      problems.push(`log: ${event.params.entry.text} ${event.params.entry.url ?? ''}`);
    }
  }
  return problems;
};

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
      const list = await fetchJson('/json/list');
      target = list.find((item) => item.type === 'page' && item.url.startsWith('http'));
      if (target) break;
    } catch {
      /* المتصفح لم يبدأ بعد */
    }
  }

  if (!target) {
    console.error('FAILED: could not attach to Chrome');
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
   * ننتظر جاهزية التطبيق: وجود قائمة بنوك يعني أن SQLite فُتح،
   * والبذرة اكتملت، والتسميات قُرئت. أي فشل قبل ذلك يظهر في
   * أخطاء الطرفية بدل أن ينتظر الاختبار إلى ما لا نهاية.
   */
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await sleep(500);
    const state = await cdp.evaluate(`(() => {
      const select = document.querySelector('#bank-select');
      return {
        hasSelect: select !== null,
        disabled: select ? select.disabled : null,
        options: select ? Array.from(select.options).map((o) => o.text) : [],
        hasBoot: document.body.innerText.includes('جارٍ تحضير'),
        hasError: document.body.innerText.includes('تعذّر تشغيل'),
      };
    })()`);
    if (state.hasError) {
      console.log('RESULT: boot error screen shown');
      console.log(JSON.stringify(state, null, 2));
      break;
    }
    if (state.hasSelect && state.options.length > 0 && !state.disabled) {
      ready = true;
      console.log(`RESULT: app ready, ${state.options.length} bank(s) in selector`);
      console.log('banks: ' + JSON.stringify(state.options.slice(0, 5)));
      break;
    }
  }

  if (ready) {
    const checks = await cdp.evaluate(`(() => {
      const text = document.body.innerText;
      const keyPattern = /\\b(form|preview|app|guide|nav|manage|boot)\\.[a-zA-Z][a-zA-Z0-9]*/g;
      const rawKeys = text.match(keyPattern) || [];
      const check = document.querySelector('#check-preview');
      const logo = document.querySelector('header img');
      return {
        rawLabelKeys: rawKeys.slice(0, 8),
        hasCheckPreview: check !== null,
        previewBackground: check ? getComputedStyle(check).backgroundImage.slice(0, 60) : null,
        previewWidth: check ? Math.round(check.getBoundingClientRect().width) : null,
        logoSrc: logo ? new URL(logo.src).pathname : null,
        logoComplete: logo ? logo.complete && logo.naturalWidth > 0 : null,
        footerText: (document.querySelector('footer')?.innerText || '').slice(0, 120),
        amountWordsLines: (() => {
          const el = document.querySelector('#check-preview .text-element:last-of-type');
          return el ? Math.round(el.getBoundingClientRect().height) : null;
        })(),
        hasExternalRequests: performance
          .getEntriesByType('resource')
          .map((r) => r.name)
          .filter((n) => !n.startsWith(location.origin)),
      };
    })()`);

    console.log('CHECKS: ' + JSON.stringify(checks, null, 2));
  }

  if (screenshot) {
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(screenshot, Buffer.from(shot.data, 'base64'));
    console.log('screenshot: ' + screenshot);
  }

  const problems = collectConsole(cdp);
  console.log(problems.length === 0 ? 'CONSOLE: clean' : 'CONSOLE PROBLEMS:\n' + problems.join('\n'));

  ws.close();
  chrome.kill();
  process.exit(ready && problems.length === 0 ? 0 : 2);
})();
