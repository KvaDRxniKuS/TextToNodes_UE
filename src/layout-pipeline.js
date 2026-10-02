// Основной цикл: creator (ступень 1) -> arranger (ступень 2).
// Ступень 1: src/creator.js (на базе src/generator.js и src/modules.js) создаёт ноды/пины и
// закладывает связи, не принимая решений о раскладке.
// Ступень 2: src/arranger.js материализует связи, раскладывает черновик и кладёт knot-стадиумы.
// Ступень 3 (декоратор) — В РАЗРАБОТКЕ, в основной цикл не входит: включается явно,
//positionBlueprint(nodes, { decorate: { … } }).
import { arrangeFlow, arrangeRows } from './arranger.js';
import { decorateLayout } from './decorator.js';

export { arrangeFlow, arrangeRows, decorateLayout };

/**
 * Ступень 2 — расстановщик; `decorate` (в разработке) включается только явным объектом опций.
 * `nodes` — ноды, `rows` — явные ряды (для ветвлений надёжнее вывода по связкам).
 */
export function positionBlueprint(nodes, { rows, arrange = {}, decorate = null } = {}) {
  const arrangement = rows ? arrangeRows(rows, arrange) : arrangeFlow(nodes, arrange);
  if (!decorate) {
    return { nodes: arrangement.nodes, knots: arrangement.knots, arrangement, decorated: false };
  }
  const result = decorateLayout(arrangement.nodes, typeof decorate === 'object' ? decorate : {});
  return {
    nodes: [...arrangement.nodes, ...result.knots],
    knots: [...arrangement.knots, ...result.knots],
    arrangement,
    decorated: true,
  };
}
