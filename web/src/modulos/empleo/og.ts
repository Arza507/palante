import type { DatosOg } from '../../og/render';

export async function paginasOgModulo(): Promise<DatosOg[]> {
  return [{ slug: 'empleo', titulo: 'Observatorio de empleo: próximamente' }];
}
