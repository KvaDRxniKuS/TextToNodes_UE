# sweep/ — всё, что вставляется в UE

| папка | что это | откуда | сверка |
|---|---|---|---|
| `registry/NN-<категория>.txt` + `MANIFEST.md` | сетка ВСЕХ записей реестра `data/ue-functions.json` по категориям | `node tools/gen-sweep.mjs` | `gen-sweep --check` |
| `chapters/rNN-<тема>.txt` | связные главы раундов (сцены с проводами, декор, make-node) | свои генераторы / `tools/recipes/*.sh`; 5 глав заморожены | `check-sweep` |
| `probes/rNN-probe.txt` | только пробы, ждущие вердикта; после `gen-probe --batch NN --register` файл удаляется (ноды уже в `registry/`, проба воспроизводится `--stdout`) | `node tools/gen-probe.mjs --batch NN` | `check-sweep` (recipe на время ожидания) |
| `layout/*.txt` | тесты раскладки (collapsed-knot, pipeline-smoke) | `tools/gen-collapsed-knot.mjs`, `tools/gen-pipeline-smoke.mjs` | `check-sweep` |
| `copyback/*` | **эталоны**: дословные копии из движка | пользователь | `tests/validate.test.mjs` (STRICT + assert'ы) |

Сгенерированные файлы — не референсы, а наш вывод: их байты фиксируются, чтобы тихий дрейф генератора был виден
(`node tools/check-sweep.mjs`, входит в `npm test`). Референсы — только `copyback/`.

Пересборка глав:

| файл | команда |
|---|---|
| `chapters/r21-enhanced-input-{chain,assets}.txt` | `node tools/gen-r21-enhanced-input.mjs` |
| `chapters/r22-cast-any.txt` | `node tools/gen-cast.mjs --demo` |
| `chapters/r23-actor-ext.txt` | `bash tools/recipes/r23-actor-ext.sh` |
| `chapters/r25-events-delegates.txt`, `r26-timers-latent.txt` | `node tools/gen-r25-events.mjs`, `node tools/gen-r26-timers.mjs` |
| `chapters/r27-widgets-ui-decorated.txt`, `r30-decorate.txt`, `r32-components-lifecycle.txt` | `bash tools/recipes/<имя>.sh` |
| `chapters/enum-select.txt`, `dispatcher-bound.txt` | `node tools/gen-enum-select.mjs`, `node tools/gen-dispatcher-bound.mjs` |
| заморожены: `r25-make-node`, `r27-widgets-ui`, `r28-enhanced-input-full`, `r29-components-physics`, `r31-audio` | генератора нет; правки только по copy-back |

GUID детерминированы: seed-строки генераторов сохранены со старых имён файлов (`--seed=sweep:23b-actor-ext.txt` и т.п.),
поэтому переименование 2026-09-30 не изменило ни одного байта.
