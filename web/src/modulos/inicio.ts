// Tarjetas del inicio. Cada módulo aporta su dato principal cuando tiene datos reales del pipeline.
export interface Tarjeta {
  href: string;
  titulo: string;
  resumen: string;
  color: string;
  dato?: string;
  detalle?: string;
  fuente?: string;
}

export async function tarjetasInicio(): Promise<Tarjeta[]> {
  return [
    {
      href: '/311',
      titulo: 'Mapa del 311',
      resumen: 'Qué problemas reporta la gente al 311 en cada corregimiento del distrito de Panamá.',
      color: 'var(--terracota)',
    },
    {
      href: '/empleo',
      titulo: 'Observatorio de empleo',
      resumen: 'Qué habilidades, herramientas e idiomas piden las empresas en Panamá, por sector.',
      color: 'var(--azulejo)',
    },
    {
      href: '/rutas',
      titulo: 'Rutas de transporte',
      resumen: 'Rutas internas de busitos y chivas con sus paradas, tarifas y horarios.',
      color: 'var(--persiana)',
    },
  ];
}
