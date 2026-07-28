import { describe, expect, it } from 'vitest';
import { DICT, initLang, setLang, t } from '../src/app/i18n';
import { MAT } from '../src/model/materials';
import { TEMPLATES } from '../src/app/templates';

describe('i18n', () => {
  it('todas las claves tienen español e inglés no vacíos', () => {
    for (const [key, entry] of Object.entries(DICT)) {
      expect(entry, key).toHaveLength(2);
      expect(entry[0].length, `${key} (es)`).toBeGreaterThan(0);
      expect(entry[1].length, `${key} (en)`).toBeGreaterThan(0);
    }
  });

  it('las variables {x} coinciden entre idiomas', () => {
    const vars = (s: string) => (s.match(/\{[a-z]+\}/g) ?? []).sort().join(',');
    for (const [key, [es, en]] of Object.entries(DICT)) {
      expect(vars(en), `${key}: variables distintas entre es/en`).toBe(vars(es));
    }
  });

  it('t() traduce e interpola en ambos idiomas', () => {
    initLang();
    setLang('es');
    expect(t('btn.save')).toBe('Guardar');
    expect(t('toast.series', { n: 5 })).toBe('Serie de 5 generada');
    setLang('en');
    expect(t('btn.save')).toBe('Save');
    expect(t('toast.series', { n: 5 })).toBe('Array of 5 generated');
    setLang('es');
  });

  it('una clave inexistente devuelve la clave (no revienta)', () => {
    expect(t('no.existe')).toBe('no.existe');
  });

  it('el catálogo de materiales referencia claves existentes', () => {
    for (const def of Object.values(MAT)) {
      expect(DICT[def.label], def.label).toBeDefined();
      expect(DICT[def.hint], def.hint).toBeDefined();
      for (const f of def.fields) {
        expect(DICT[f.label], f.label).toBeDefined();
      }
    }
  });

  it('las plantillas referencian claves existentes', () => {
    for (const tpl of Object.values(TEMPLATES)) {
      expect(DICT[tpl.title], tpl.title).toBeDefined();
      for (const f of tpl.fields) {
        expect(DICT[f.label], f.label).toBeDefined();
      }
    }
  });
});
