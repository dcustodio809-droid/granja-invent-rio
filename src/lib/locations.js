// Locais da granja — usados na Localização do Inventário e no destino das saídas do Estoque
export const LOCATIONS = ['Almoxarifado', 'Escritório', 'Gerência', 'Núcleo 1', 'Núcleo 2', 'Núcleo 3']

// Opções do campo de seleção: a lista padrão e, se o item tiver um valor antigo fora dela, ele também
export function locationOptions(current) {
  const value = (current || '').trim()
  return value && !LOCATIONS.includes(value) ? [...LOCATIONS, value] : LOCATIONS
}
