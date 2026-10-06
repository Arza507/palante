import { describe, expect, it } from 'vitest';
import { conBase, dolares, modalidades, ofertas, separar, suficiente, textoCompartirEmpleo, type Celda } from '../../src/lib/empleo';

const vacia: Celda = {
  insuficiente: true, ofertas: null, habilidades: [], herramientas: [], pide_ingles: null,
  ofertas_con_salario: null, salario_mediano: null, modalidad: {},
};
const llena: Celda = {
  insuficiente: false, ofertas: 25, habilidades: [{ nombre: 'Atención al cliente', n: 10, esco: null }],
  herramientas: [], pide_ingles: 5, ofertas_con_salario: 12, salario_mediano: 1250.5,
  modalidad: { remoto: 3, presencial: 20, 'no indicado': 2 },
};

describe('empleo', () => {
  it('solo publica celdas con 10 ofertas o más', () => {
    expect(suficiente(vacia)).toBe(false);
    expect(suficiente(llena)).toBe(true);
    expect(suficiente({ ...llena, ofertas: 9 })).toBe(false);
  });
  it('escribe porcentajes con su base', () => {
    expect(conBase(10, 25)).toBe('40 % (10 de 25 ofertas)');
    expect(ofertas(1)).toBe('1 oferta');
    expect(ofertas(1200)).toBe('1.200 ofertas');
    expect(dolares(1250.5)).toBe('1.251 dólares');
  });
  it('ordena modalidades con nombres legibles', () => {
    if (!suficiente(llena)) throw new Error();
    expect(modalidades(llena).map((m) => m.nombre)).toEqual(['Presencial', 'Remoto', 'No lo dice']);
  });
  it('separa grupos publicados e insuficientes', () => {
    const r = separar([{ id: 'a', nombre: 'A', celda: llena }, { id: 'b', nombre: 'B', celda: vacia }]);
    expect(r.publicados.map((g) => g.id)).toEqual(['a']);
    expect(r.insuficientes).toEqual(['B']);
  });
  it('arma el texto para compartir con datos reales', () => {
    if (!suficiente(llena)) throw new Error();
    expect(textoCompartirEmpleo('Salud', llena, '1 de agosto', '30 de septiembre de 2026')).toBe(
      'En salud, el 40 % de las 25 ofertas publicadas entre 1 de agosto y 30 de septiembre de 2026 pedía atención al cliente. Míralo en Palante.',
    );
  });
});
