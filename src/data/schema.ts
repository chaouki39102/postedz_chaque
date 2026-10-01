import type { Database } from 'sql.js';

/**
 * مخطط قاعدة البيانات وإدارة الترقيات.
 *
 * قواعد إلزامية عند إضافة عمود أو جدول:
 * 1. ارفع SCHEMA_VERSION بمقدار واحد.
 * 2. أضف مدخلاً جديداً في MIGRATIONS (لا تعدّل مدخلاً منشوراً).
 * 3. استخدم UPDATE/INSERT على السجلات القديمة داخل نفس المدخل.
 *
 * سبب ذلك: الترقيات تُنفَّذ مرة واحدة وتُسجَّل في جدول schema_migrations.
 * تعديل مدخل قديم يعني أن الأجهزة التي نفّذته لن تعيد تشغيله، فتبقى
 * على المخطط القديم بينما الأجهزة الجديدة تذهب للمخطط الأحدث.
 */

/** إصدار المخطط الحالي. يراه المحرك ويقارنه بما هو مطبَّق فعلاً. */
export const SCHEMA_VERSION = 3;

export interface Migration {
  version: number;
  /** وصف قصير، يظهر في سجل الترقيات عند التنقيح */
  description: string;
  up: (db: Database) => void;
}

/**
 * قائمة الترقيات، مرتبة تصاعدياً.
 *
 * الترحيل الأول ينشئ الجداول فقط. الترقيات اللاحقة تُضاف هنا بنفس
 * الترتيب وتُطبَّق تلقائياً عند أول إقلاع بعد التحديث.
 */
export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    description: 'إنشاء المخطط الأساسي: بنوك، مواضع، تسميات، قوالب، مسودة، تفضيلات، سجل، تدقيق',
    up: (db) => {
      // ---- بيانات وصفية ----
      db.run(`
        CREATE TABLE IF NOT EXISTS meta (
          key   TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `);

      // ---- التفضيلات النصية (آخر بنك، آخر لغة، الوضع الداكن) ----
      db.run(`
        CREATE TABLE IF NOT EXISTS preferences (
          key   TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `);

      /*
       * البنوك: الشعار نموذجي لكن هوية التطبيق.
       *
       * image_bytes يخزَّن صورة الشيك كـ BLOB وليس رابطاً. هذا هو ما يجعل
       * إضافة بنك أو تغيير صورته عملية على البيانات بلا إعادة بناء للتطبيق.
       * banks.seed_key يحفظ معرّف الصورة الأصلية المضمَّنة في المشروع
       * حتى نستطيع إعادة تعيينها إن أعيدت الصورة الأصلية إلى مستودع الملفات.
       */
      db.run(`
        CREATE TABLE IF NOT EXISTS banks (
          id           TEXT PRIMARY KEY,
          name_ar      TEXT NOT NULL,
          name_fr      TEXT NOT NULL,
          image_mime   TEXT,
          image_bytes  BLOB,
          image_seed   TEXT,
          is_active    INTEGER NOT NULL DEFAULT 1,
          is_builtin   INTEGER NOT NULL DEFAULT 0,
          sort_order   INTEGER NOT NULL DEFAULT 0,
          created_at   INTEGER NOT NULL,
          updated_at   INTEGER NOT NULL
        );
      `);
      db.run('CREATE INDEX IF NOT EXISTS idx_banks_order ON banks (sort_order, name_ar)');

      /*
       * مواضع كل حقل، لكل بنك ولكل لغة.
       *
       * width_percent نسبة مئوية من عرض الشيك وليست بكسل، حتى يبقى الالتفاف
       * متطابقاً بين المعاينة والطباعة (المعاينة والورقة بنفس العرض 210mm).
       */
      db.run(`
        CREATE TABLE IF NOT EXISTS bank_positions (
          bank_id       TEXT NOT NULL REFERENCES banks(id) ON DELETE CASCADE,
          language      TEXT NOT NULL,
          field         TEXT NOT NULL,
          x             REAL NOT NULL,
          y             REAL NOT NULL,
          width_percent REAL,
          PRIMARY KEY (bank_id, language, field)
        );
      `);

      // ---- تسميات الواجهة: كل نص ظاهر للمستخدم وقابل للتحرير ----
      db.run(`
        CREATE TABLE IF NOT EXISTS labels (
          key TEXT PRIMARY KEY,
          ar  TEXT NOT NULL,
          fr  TEXT NOT NULL
        );
      `);

      // ---- القوالب المحفوظة (شيك + مواضعه) ----
      db.run(`
        CREATE TABLE IF NOT EXISTS presets (
          id             TEXT PRIMARY KEY,
          name           TEXT NOT NULL,
          bank_id        TEXT NOT NULL,
          language       TEXT NOT NULL,
          data_json      TEXT NOT NULL,
          positions_json TEXT NOT NULL,
          created_at     INTEGER NOT NULL,
          updated_at     INTEGER NOT NULL
        );
      `);
      db.run('CREATE INDEX IF NOT EXISTS idx_presets_bank ON presets (bank_id, updated_at DESC)');

      // ---- المسودة الجارية (صف واحد) ----
      db.run(`
        CREATE TABLE IF NOT EXISTS check_data (
          id           INTEGER PRIMARY KEY CHECK (id = 1),
          date         TEXT NOT NULL,
          place        TEXT NOT NULL,
          beneficiary  TEXT NOT NULL,
          amount       TEXT NOT NULL,
          date_is_auto INTEGER NOT NULL
        );
      `);

      // ---- إعدادات العرض ----
      db.run(`
        CREATE TABLE IF NOT EXISTS ui_prefs (
          id                     INTEGER PRIMARY KEY CHECK (id = 1),
          locked                 INTEGER NOT NULL,
          show_position_controls INTEGER NOT NULL
        );
      `);

      /*
       * سجل الشيكات المطبوعة.
       *
       * منفصل عن القوالب: القالب نية والتاريخ سطر تاريخ، أما السجل فهو
       * ما طُبع فعلاً ويُحفظ كما طُبع لمتطلبات المحاسبة والتدقيق.
       */
      db.run(`
        CREATE TABLE IF NOT EXISTS history (
          id             INTEGER PRIMARY KEY AUTOINCREMENT,
          bank_id        TEXT NOT NULL,
          bank_name      TEXT NOT NULL,
          language       TEXT NOT NULL,
          data_json      TEXT NOT NULL,
          positions_json TEXT NOT NULL,
          amount_words   TEXT NOT NULL DEFAULT '',
          created_at     INTEGER NOT NULL
        );
      `);
      db.run('CREATE INDEX IF NOT EXISTS idx_history_time ON history (created_at DESC)');

      /*
       * سجل التدقيق.
       *
       * كل تغيير على البنوك والتسميات والقوالب يُسجَّل هنا. الغرض ليس
       * المراقبة بل إمكانية التراجع: الحذف عملية موثّقة يمكن استعادتها،
       * وهذا ما يجعل إعطاء المستخدم حق الحذف آمناً.
       */
      db.run(`
        CREATE TABLE IF NOT EXISTS audit_log (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          action      TEXT NOT NULL,
          entity      TEXT NOT NULL,
          entity_id   TEXT NOT NULL DEFAULT '',
          details_json TEXT NOT NULL DEFAULT '{}',
          at          INTEGER NOT NULL
        );
      `);
      db.run('CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_log (at DESC)');
    },
  },
  {
    version: 2,
    description: 'القيم الافتراضية للحقول: تاريخ، مكان، مستفيد، مبلغ — لكل لغة',
    up: (db) => {
      /*
       * القيم الافتراضية كانت ثابتة داخل App.tsx. نقلها إلى القاعدة يجعلها
       * قابلة للتعديل من واجهة الإدارة دون بناء نسخة جديدة، ويجعل تاريخ
       * الحقل جزءاً من البيانات لا من الكود.
       *
       * صف لكل (لغة، حقل): ثلاثة أعمدة فحسب. لا نضيف أعمدة لكل حقل لأن
       * ذلك يجعل كل حقل جديد يتطلب ترقية مخطط كاملاً.
       */
      db.run(`
        CREATE TABLE IF NOT EXISTS field_defaults (
          language TEXT NOT NULL,
          field    TEXT NOT NULL,
          value    TEXT NOT NULL DEFAULT '',
          PRIMARY KEY (language, field)
        );
      `);
    },
  },
  {
    version: 3,
    description: 'حجم خط كل حقل: عمود font_cqw في مواضع البنك',
    up: (db) => {
      /*
       * العمود جديد على جدول منشور، فلا بد من ترحيل مستقل بدل تعديل
       * إنشاء الجدول في النسخة 1: الأجهزة التي نفّذت تلك النسخة لن
       * تعيد تشغيلها.
       *
       * القيم NULL لا صفر: صفر يعني «لا خط» والحقل يختفي، وNULL يعني
       * «لم يضبطه المستخدم» فيعود إلى الحجم الافتراضي عند القراءة
       * (انظر clampFontCqw). الحقول القائمة بلا صف جديد أصلاً، فتبقى
       * على أحجامها الافتراضية بلا مساس.
       */
      db.run('ALTER TABLE bank_positions ADD COLUMN font_cqw REAL');
    },
  },
];

/** يقرأ الترقيات المنفَّذة فعلاً في قاعدة البيانات الحالية */
export const readAppliedVersions = (db: Database): Set<number> => {
  const applied = new Set<number>();

  /*
   * ننشئ جدول السجل قبل القراءة لا بعدها: أول إقلاع على قاعدة جديدة لا
   * يجد الجدول، فلو عدنا هنا مبكراً لأخفق INSERT الذي يسجّل النسخة 1
   * وتوقّف الإقلاع كله.
   */
  db.run(
    'CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL)'
  );

  const result = db.exec('SELECT version FROM schema_migrations');
  if (result.length === 0) return applied;

  for (const row of result[0].values) {
    applied.add(Number(row[0]));
  }

  return applied;
};

/**
 * يطبّق كل الترقيات غير المنفَّذة.
 *
 * كل ترقية في معاملة مستقلة: إن فشلت واحدة تتراجع وحدها ولا تترك
 * القاعدة في حالة نصف مُرحَّلة.
 */
export const applyMigrations = (db: Database): number => {
  const applied = readAppliedVersions(db);
  let count = 0;

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) continue;

    db.run('BEGIN');
    try {
      migration.up(db);
      db.run('INSERT OR REPLACE INTO schema_migrations (version, applied_at) VALUES (?, ?)', [
        migration.version,
        Date.now(),
      ]);
      db.run('COMMIT');
      count += 1;
    } catch (error) {
      try {
        db.run('ROLLBACK');
      } catch {
        /* إذا فشلت المعاملة أصلاً فلا حاجة لتراجع */
      }
      throw error;
    }
  }

  return count;
};

/** سجل الترقيات، للعرض في واجهة إدارة قاعدة البيانات */
export const listMigrations = (): ReadonlyArray<{ version: number; description: string }> =>
  MIGRATIONS.map(({ version, description }) => ({ version, description }));
