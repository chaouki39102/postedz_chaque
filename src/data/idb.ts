/**
 * غلاف بسيط ومكتوب ذاتياً لـ IndexedDB.
 *
 * لماذا بدون مكتبة (مثل idb أو dexie)؟
 * - نحتاج ثلاث عمليات فقط: قراءة بايت، كتابة بايت، حذف.
 * - ملف قاعدة البيانات كله (عادة أقل من 200 كيلوبايت) يُخزَّن كقيمة
 *   واحدة في Object Store، فلا استعلامات مركّبة ولا فهرسة مطلوبة.
 * - إضافة مكتبة كاملة تزيد حجم حزمة التطبيق بلا فائدة في حالتنا.
 *
 * كل الدوال ترجع Promise وتُنهي상태ً معلومة (pending/ready/failed)
 * لأن IndexedDB غير متاح في وضع التصفح الخاص وبعض أوضاع Incognito
 * الصارمة، وللحالة نحتاج مسار تراجع إلى localStorage.
 */

const DB_NAME = 'cheque-generator';
const DB_VERSION = 1;
const STORE_NAME = 'files';
const DB_FILE_KEY = 'main.sqlite3';

export type IdbAvailability = 'pending' | 'ready' | 'failed';

let availability: IdbAvailability = 'pending';
let dbPromise: Promise<IDBDatabase | null> | null = null;

export const getIdbAvailability = (): IdbAvailability => availability;

/** يستمع لطلب فتح قاعدة البيانات، ويعيد null عند الفشل */
const openDatabase = (): Promise<IDBDatabase | null> =>
  new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      console.warn('[idb] not available in this environment');
      resolve(null);
      return;
    }

    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (error) {
      console.warn('[idb] open() threw', error);
      resolve(null);
      return;
    }

    // نحتاج المعالجات قبل الاتصال، وإلا قد يفشل الطلب قبل استقرار
    // حدث upgradeneeded ويمر دون معالج.
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      // إغلاق الاتصال عند فتح نسخة أحدث في نافذة أخرى، حتى لا يتعطل الترقية
      db.onversionchange = () => db.close();
      availability = 'ready';
      resolve(db);
    };

    request.onerror = () => {
      console.warn('[idb] open failed', request.error);
      resolve(null);
    };

    request.onblocked = () => {
      console.warn('[idb] open blocked by another connection');
    };
  });

const getDatabase = async (): Promise<IDBDatabase | null> => {
  if (dbPromise === null) {
    dbPromise = openDatabase();
  }
  return dbPromise;
};

const withStore = async <T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T | null> => {
  const db = await getDatabase();
  if (db === null) return null;

  return new Promise<T | null>((resolve) => {
    let transaction: IDBTransaction;
    try {
      transaction = db.transaction(STORE_NAME, mode);
    } catch (error) {
      console.warn('[idb] transaction failed', error);
      resolve(null);
      return;
    }

    const request = run(transaction.objectStore(STORE_NAME));

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      console.warn('[idb] request failed', request.error);
      resolve(null);
    };

    // إتمام المعاملة لا يضمن نجاح الطلب، لكنه يعطي خطأً أنظف
    // عند رفض الإنداء (كحصة ممتلئة)
    transaction.onabort = () => {
      console.warn('[idb] transaction aborted', transaction.error);
      resolve(null);
    };
  });
};

/**
 * قراءة محتوى ملف قاعدة البيانات المحفوظ.
 * يعيد null إن لم يوجد ملف بعد (أول تشغيل) أو تعذّرت القراءة.
 */
export const readDatabaseFile = (): Promise<Uint8Array | null> =>
  withStore<ArrayBuffer | Uint8Array>('readonly', (store) =>
    store.get(DB_FILE_KEY) as IDBRequest<ArrayBuffer | Uint8Array>
  ).then((value) => {
    if (value === null) return null;
    if (value instanceof Uint8Array) return value;
    return new Uint8Array(value);
  });

/** كتابة محتوى قاعدة البيانات. الترميز صريح لتجنّب نسخة إضافية من البيانات. */
export const writeDatabaseFile = async (bytes: Uint8Array): Promise<boolean> => {
  const written = await withStore<IDBValidKey>('readwrite', (store) =>
    // نمرّر نسخة مستقلة: بعض المتصفحات تفصل Buffer المخزَّن
    // عن الذاكرة المصدرية، وقد نحتاج كتابة نسخة جديدة لاحقاً.
    store.put(new Uint8Array(bytes), DB_FILE_KEY)
  );

  const ok = written !== null;
  availability = ok ? 'ready' : 'failed';
  return ok;
};

export const deleteDatabaseFile = async (): Promise<void> => {
  await withStore<undefined>('readwrite', (store) => store.delete(DB_FILE_KEY));
};

/** فحص سريع لتوفّر IndexedDB دون فتح قاعدة البيانات */
export const isIdbSupported = (): boolean => typeof indexedDB !== 'undefined';
