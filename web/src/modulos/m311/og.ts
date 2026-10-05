import type { DatosOg } from '../../og/render';

export async function paginasOgModulo(): Promise<DatosOg[]> {
  return [{ slug: '311', titulo: 'Mapa del 311: próximamente' }];
}
