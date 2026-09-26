# tests/fixtures — живые копии из движка (регресс)

Каждый файл — дословный Ctrl+C из UE (copy-back пользователя). `tests/validate.test.mjs` прогоняет ВСЕ `*.txt`
через `validateStrict(…, { fragment: 'auto' })` — валидатор не должен падать ни на одном настоящем копипасте.

Правило: каждый новый дамп пользователя = новый fixture (`<тема>-copyback.txt` / `<BP>_<функция>_canonical.txt`).
Первым ждёт добавления: `BP_WheelActor_SlipVel_canonical.txt`.
