# Эталон стилизации: виджет взаимодействия (user reference, 2026-10-02)

Источник: большой UE Blueprint Text, присланный пользователем как «референс выравнивания (стилизации)».
Сырой дамп, пути проекта, GUID и PinId в репозиторий **не сохраняем**. Ниже — только наблюдения для
расстановщика и линтера.

## Общая форма графа

- Граф разделён на несколько «полос» по `CustomEvent`: `Update`, `Select`, `ChangeValue`, `Interaction`.
  Комментариев-секций нет, разделение делается расстоянием по Y и явным левым входом каждой полосы.
- В каждой полосе основной exec-поток идёт слева направо; чистые вычисления и выборки виджетов лежат
  локальными блоками слева/ниже/выше своего потребителя, а не растянуты по всему графу.
- Старт события не обязан иметь одинаковый X во всех полосах: у большой полосы `Update` событие вынесено
  дальше влево, потому что перед основной работой есть сохранение состояния и `ClearChildren`.
- Повторяющиеся дешёвые источники (`Get` переменной, `Self`) дублируются рядом с потребителями; вычисленный
  результат или struct-переменная, которую неудобно дублировать, может идти через короткую локальную линию knot'ов.

## Полоса `Update`: сборка списка кнопок

Принятая форма:

```text
Update → Set Hitres → ClearChildren → Sequence → I_GetInteractButtons → Sequence(capture) → ForEachLoop → CreateWidget → AddChild
```

- Перед `ForEachLoop` стоит локальная «capture»-последовательность: сохранить `Checks`, `EditableChecks`,
  `EditableValues`, затем запустить цикл. Эти Set'ы образуют короткий вертикальный стек рядом с `Sequence`,
  а не отдельные далёкие секции.
- В этом эталоне такой distributor-`Sequence` визуально центрирован относительно короткого стека: первый
  потребитель может оказаться немного выше ноды `Sequence`, если весь стек остаётся компактным и упорядоченным
  сверху вниз. Это **не** отменяет старый запрет на резкие уходы Sequence вверх на сотни пикселей.
- Блок подготовки данных для `CreateWidget` расположен между `ForEachLoop` и `CreateWidget`: `Map_Find` для
  `Checks`/`Values`, `HasTag` для editable-контейнеров, `GetTagNameDesc`. Все эти pure-ноды читаются как один
  локальный блок входов виджета.
- `HitResult` передаётся в интерфейс и в `CreateWidget`. Для интерфейсного входа используется короткая
  горизонтальная линия reroute-knot'ов; `BreakHitResult` стоит рядом с сообщением, которое берёт `HitActor`.
- `ButtonHolder → AddChild` — отдельный короткий data-провод у самого потребителя, без общей шины по всему графу.

## Полоса `Select`: смена выделенной кнопки

- Сначала сохраняется старый индекс (`WasSelected = Selected`), затем новый `Selected` считается как
  `Clamp(Selected + SelectInt(Up ? -1 : 1), 0, GetChildrenCount(ButtonHolder)-1)`.
- После установки индекса стоит `Sequence`: старому элементу отправляется `I_Select(false)`, новому —
  `I_Select(true)`. Оба сообщения лежат рядом, а источником является локальный `GetAllChildren → Array Get`.
- `WasSelected` и `Selected` читаются как индексы прямо около своих `Array Get`, не через длинные провода.

## Полоса `ChangeValue`: редактируемое значение

Принятая форма:

```text
ChangeValue → Cast selected child to Button → Branch(ValueEditable?)
  true  → I_SetValue(hit actor, tag, Upper) → Button.UpdateValue
  false → PrintText("Value Is Not Editable")
```

- Текущая кнопка выбирается локальным pure-блоком `ButtonHolder → GetAllChildren → Array Get(Selected)` слева
  от `Cast`. Cast остаётся impure и запускает дальнейший поток.
- Разрешение на редактирование (`EditableValues.HasTag(Button.Tag)`) лежит рядом с `Branch` и использует tag
  выбранной кнопки; при запрете ставится короткий dev-only `PrintText`, а не длинный обходной поток.
- Target интерфейсного сообщения берётся из `BreakHitResult(Hitres).HitActor`; сам `BreakHitResult` расположен
  рядом с сообщением, которому нужен актор.

## Полоса `Interaction`: действие или переключение check

Принятая форма:

```text
Interaction → Cast selected child to Button → Branch(Checks contains Button.Tag)
  false → I_DoInteract(hit, tag)
  true  → Branch(EditableChecks.HasTag(tag))
            true  → I_GetCheck(actor, tag) → Not → I_SetCheck(actor, tag, !check) → Button.UpdateCheck
            false → PrintText("Check Is Not Editable")
```

- `Map_Find(Checks, Tag).ReturnValue` решает, является ли tag check-действием. Если в карте нет записи —
  обычное `I_DoInteract` находится как короткая `else`-ветка справа от первого Branch.
- Для check-пути есть второй guard по `EditableChecks.HasTag(Tag)`. Запрет опять завершается локальным `PrintText`.
- Актор из `BreakHitResult` используется двумя сообщениями (`I_GetCheck`, `I_SetCheck`) через короткий knot,
  потому что это вычисленный выход, а не дешёвый `Get` переменной.
- Кнопка после `I_SetCheck` обновляется прямым вызовом `UpdateCheck` на уже выбранном `WBP_Button`.

## Выводы для правил

1. **Event-полосы**: для UI/виджет-графов с несколькими custom events допускается раскладывать каждое событие
   отдельной горизонтальной полосой; комментарий полезен, но не обязателен, если расстояние и левый вход читаемы.
2. **Короткий capture-фан-аут Sequence**: Sequence, который только раскладывает несколько Set'ов/подготовительных
   шагов перед одним циклом, может быть визуально центрирован у стека. Линтер должен ругаться не на любой `then_0`
   выше источника, а на резкий уход вверх (сотни пикселей), как в старом «грязном» примере.
3. **Локальные pure-блоки выбора виджета**: `GetAllChildren → Array Get(Selected) → Cast` стоит слева от Cast;
   индексы (`Selected`, `WasSelected`) кладутся рядом с `Array Get`.
4. **Permission guard рядом с Branch**: `HasTag`/`Map_Find.ReturnValue` для прав редактирования лежит около своего
   Branch; false-путь — короткий `PrintText` или обычное действие, а не длинная петля.
5. **Get vs computed bus**: переменные дешевле дублировать у потребителей; вычисленные выходы (`HitActor`, общий
   struct, результат выражения) можно вести короткими reroute-knot'ами внутри локальной группы.

## Что не автоматизируем по одному референсу

- Точные X/Y всей приватной схемы и её asset paths.
- Автоматическую генерацию UI-логики (`I_GetInteractButtons`, `I_SetValue`, `I_SetCheck`) — это семантика проекта,
  не задача расстановщика.
- Полное создание data-knot'ов для всех прямых проводов: фиксируем как стиль, но внедрять нужно отдельной задачей
  вместе с правилом обратных data-проводов и шинами.
