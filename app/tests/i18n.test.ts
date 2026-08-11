import { describe, expect, it } from 'vitest';
import { DICT, initLang, plural, setLang, t } from '../src/app/i18n';
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

  /**
   * Regresión: la regla del plural estaba escrita en seis lugares y uno de
   * ellos —el encabezado del PDF de planos— agregaba la «s» siempre, así que
   * un proyecto de una sola pieza imprimía "1 pieces".
   */
  describe('plural', () => {
    it('singular y plural en español', () => {
      setLang('es');
      expect(plural(1, 'w.piece')).toBe('1 pieza');
      expect(plural(2, 'w.piece')).toBe('2 piezas');
      expect(plural(0, 'w.piece')).toBe('0 piezas');
      expect(plural(1, 'w.bar')).toBe('1 barra');
      expect(plural(3, 'w.bar')).toBe('3 barras');
    });

    it('singular y plural en inglés', () => {
      setLang('en');
      expect(plural(1, 'w.piece')).toBe('1 piece');
      expect(plural(2, 'w.piece')).toBe('2 pieces');
      expect(plural(0, 'w.piece')).toBe('0 pieces');
      expect(plural(1, 'w.bar')).toBe('1 bar');
      setLang('es');
    });
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
