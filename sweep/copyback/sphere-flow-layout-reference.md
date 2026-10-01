# Эталон раскладки: «линейный поток + шина компонента» (ручная раскладка пользователя, 2026-10-02)

Источник: Ctrl+C из UE 5.8 (BP_AISupportTester, EventGraph). Логического смысла у графа нет — это **образец форматирования**.
Полный T3D в репозиторий не кладём (ниже — все координаты и связи; коды нод — стандартные, уже в реестре).
Координаты сдвинуты: X' = X + 19232, Y' = Y + 24752 (Event BeginPlay → x=0, верх exec-ряда → y=0).

## Ноды

| нода | X' | Y' | роль |
|---|---|---|---|
| Event BeginPlay | 0 | 16 | exec-ряд |
| Add Sphere Collision (K2Node_AddComponent) | 384 | 0 | exec-ряд |
| AttachComponentToComponent (K2_AttachToComponent) | 752 | 0 | exec-ряд |
| Branch | 1184 | 16 | exec-ряд |
| SetHiddenInGame | 1424 | 0 | exec-ряд (then) |
| SetCollisionProfileName | 1728 | 0 | exec-ряд |
| DrawDebugSphere | 2080 | 16 | exec-ряд |
| SetSimulatePhysics | 2432 | 0 | exec-ряд |
| AddImpulse | 2720 | 0 | exec-ряд |
| DestroyActor | 1424 | 208 | ветка else — под then-нодой, тот же X |
| MakeTransform (pure) | 16 | 128 | → AddComponent.RelativeTransform; под источником exec-ряда |
| Get Box (var) | 528 | 192 | → Attach.Parent; в промежутке перед потребителем |
| GetComponentLocation (pure) | 1744 | 224 | → DrawDebugSphere.Center + обратный провод к VSize |
| GetUnscaledSphereRadius (pure) | 1744 | 432 | → DrawDebugSphere.Radius; столбец под предыдущей |
| VSize | 1120 | 525 | цепочка чистых: VSize → Divide → FClamp → LinearColorLerp |
| Divide (PromotableOperator) | 1328 | 548 | |
| FClamp | 1520 | 528 | |
| LinearColorLerp | 1760 | 528 | → DrawDebugSphere.LineColor |

## Knot'ы

| knot | X' | Y' | провод |
|---|---|---|---|
| K0 | 736 | −48 | шина Sphere (AddComponent.ReturnValue); вход Attach.self тоже прямой |
| K1 | 1328 | −48 | шина → SetHiddenInGame.self (−96 от ноды) |
| K2 | 1616 | −48 | шина → SetCollision.self (−112), GetComponentLocation.self, GetUnscaledSphereRadius.self |
| K9 | 2336 | −48 | шина → SetSimulatePhysics.self (−96) |
| K10 | 2608 | −48 | шина → AddImpulse.self (−112) |
| K6 | 1920 | 368 | обратный data-провод GetComponentLocation → VSize: у правого края источника |
| K7 | 1120 | 368 | … над входом VSize (X = X ноды VSize) |

## Правила, которые из этого следуют

1. **Exec-пины соосны, а не верх нод.** Ноды с подзаголовком «Target is …» (member-вызовы, AddComponent) стоят на 16 выше,
   чем Event / Branch / библиотечные вызовы (DrawDebugSphere) — так exec-провода прямые.
2. **Шина объектной ссылки идёт НАД рядом** (Y = верх ряда − 48), от выхода ноды (AddComponent.ReturnValue). Knot ставится
   на 96–112 левее потребителя; с одного knot'а можно уйти и вниз к чистым нодам (K2).
3. **Чистые входы — под потребителем / в промежутке перед ним.** Несколько чистых для одной ноды — столбцом (шаг ≈ 208).
   Длинная чистая цепочка — отдельным рядом ниже (Y ≈ +528), справа налево к потребителю.
4. **Обратный data-провод — 2 knot'а** на полосе между чистыми нодами: K у правого края источника, K над входом приёмника.
5. **Branch:** then — продолжение ряда, else — под then-нодой (тот же X, +208).
6. Шаг exec-ряда неровный (240–432): ширина ноды + промежуток, в котором помещаются её чистые входы.
