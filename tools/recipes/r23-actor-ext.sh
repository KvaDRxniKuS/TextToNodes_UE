# 23b — Actor/SceneComponent досылка (19 узлов, без связей). Реестр → tools/gen-subset.mjs.
# Recipe восстановлен 2026-09-28 из самой фикстуры (разбор Begin Object → FunctionName/MemberName
# → id реестра) и сверен побайтово: совпадает с committed файлом с точностью до ExportPath
# (его генератор больше не пишет), координат (сетка пережата после R30) и размера комментария
# (fitComment). Двойник K2_AttachToComponent для SceneComponent — id AttachComponentToComponent,
# для Actor — AttachActorToComponent; ошибка в этом id меняет MemberParent у 12-го узла.
# Seed детерминирован именем выхода (gen-subset), повторный запуск = те же байты.
node tools/gen-subset.mjs --seed=sweep:23b-actor-ext.txt sweep/chapters/r23-actor-ext.txt "SWEEP 23b: Actor/SceneComponent — досылка" \
  GetActorRightVector GetActorUpVector GetActorScale3D \
  AddActorWorldRotation AddActorLocalRotation AddActorLocalOffset \
  SetActorScale3D SetActorTransform SetActorLocationAndRotation \
  AttachActorToComponent DetachFromActor AttachComponentToComponent DetachFromComponent \
  GetWorldLocation GetWorldRotation SetWorldLocation \
  SetRelativeLocation SetRelativeRotation AddLocalRotation
