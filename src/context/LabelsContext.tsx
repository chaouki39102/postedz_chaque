import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { getRepository } from '../data';
import type { Language, LabelBundle } from '../types';
import {
  buildFallbackMap,
  CODE_FALLBACK,
  LabelsContext,
  type LabelsApi,
} from '../context/labelsCore';

/**
 * مزوّد التسميات.
 *
 * تحميل واحد عند الإقلاع، ثم تبديل اللغة دون أي طلب إضافي: كل النصوص
 * محمّلة في الذاكرة.
 *
 * القيم الاحتياطية في الكود ليست زينة: هي ما يعرضه التطبيق قبل اكتمال
 * القراءة، وما يعرضه إن فشل محرك التخزين. غيابها يعني واجهة فارغة.
 */

/** يستبدل {name} بالقيمة */
const interpolate = (template: string, vars?: Record<string, string | number>): string => {
  if (vars) {
    return template.replace(/\{(\w+)\}/g, (match, name: string) => {
      const value = vars[name];
      return value === undefined ? match : String(value);
    });
  }
  return template;
};

export const LabelsProvider: React.FC<{ children: ReactNode; readyKey?: unknown }> = ({
  children,
  readyKey,
}) => {
  const [language, setLanguage] = useState<Language>('ar');
  const [bundles, setBundles] = useState<readonly LabelBundle[]>(CODE_FALLBACK);
  const [isEditable, setIsEditable] = useState(false);

  const refresh = useCallback(async () => {
    /*
     * نلتقط الاستثناء حول getRepository تحديداً: قد تُقرأ التسميات قبل
     * اكتمال الإقلاع (شاشة الانتظار نفسها)، و getRepository يفشل عمداً
     * عندها. البذرة في الكود تعني أننا لا نحتاج الانتظار.
     */
    let repository: ReturnType<typeof getRepository> | null = null;
    try {
      repository = getRepository();
    } catch {
      repository = null;
    }

    if (repository === null || !repository.listLabels) {
      setBundles(CODE_FALLBACK);
      setIsEditable(false);
      return;
    }

    try {
      const loaded = await repository.listLabels();
      setBundles(loaded.length > 0 ? loaded : CODE_FALLBACK);
      setIsEditable(true);
    } catch (error) {
      console.error('[labels] load failed, using code defaults', error);
      setBundles(CODE_FALLBACK);
      setIsEditable(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /*
   * التحديث الثاني بعد الإقلاع.
   *
   * هذا المزوّد يُركَّب قبل اكتمال الإقلاع (لأن شاشتَي الانتظار
   * والخطأ تحتاجان تسميات أيضاً)، فالقراءة الأولى تقع على محرك لم
   * يُقلع بعد فتعود بالبذرة في الكود. بلا هذا التEffect الثاني تبقى
   * الواجهة على البذرة إلى الأبد، ويبقى isEditable=false فلا يمكن
   * تحرير أي تسمية ولا تظهر لوحة الإدارة كأنها فارغة.
   *
   * المفتاح هو نتيجة الإقلاع نفسها: يتغيّر بتغيّرها، ويبقى ثابتاً
   * عند أي إعادة رسم عادية.
   */
  useEffect(() => {
    if (readyKey === undefined) return;
    void refresh();
  }, [readyKey, refresh]);

  const map = useMemo(() => buildFallbackMap(bundles, language), [bundles, language]);
  const fallback = useMemo(() => buildFallbackMap(CODE_FALLBACK, language), [language]);

  const api = useMemo<LabelsApi>(() => {
    const t = (key: string, vars?: Record<string, string | number>): string => {
      const template = map[key] ?? fallback[key] ?? key;
      return interpolate(template, vars);
    };

    const tn = (target: Language, key: string): string => {
      if (target === language) return map[key] ?? fallback[key] ?? key;
      const bundle = bundles.find((item) => item.key === key);
      const seed = CODE_FALLBACK.find((item) => item.key === key);
      return bundle?.[target] ?? seed?.[target] ?? key;
    };

    return { language, setLanguage, t, tn, all: bundles, refresh, isEditable };
  }, [language, map, fallback, bundles, refresh, isEditable]);

  return <LabelsContext.Provider value={api}>{children}</LabelsContext.Provider>;
};
