# R32 Components lifecycle/queries — make-node (не gen-sweep)
node tools/make-node.mjs --chain --decorate --wrap 4 --title "R32: компоненты — жизненный цикл и запросы" -o sweep/32-components-lifecycle.txt \
 "event R32Components" \
 "fn GetComponentByClass ComponentClass=StaticMeshComponent" \
 "call ActorComponent.Deactivate" \
 "call ActorComponent.Activate bReset:bool=true" \
 "call ActorComponent.SetComponentTickEnabled bEnabled:bool=false" \
 "call ActorComponent.IsComponentTickEnabled pure -> ReturnValue:bool" \
 "call Actor.K2_GetComponentsByClass pure ComponentClass:class:ActorComponent=StaticMeshComponent -> ReturnValue:object:ActorComponent[]" \
 "call Actor.GetComponentsByTag pure ComponentClass:class:ActorComponent=StaticMeshComponent Tag:name=Wheel -> ReturnValue:object:ActorComponent[]" \
 "call WidgetBlueprintLibrary.GetAllWidgetsOfClass static WidgetClass:class:UserWidget TopLevelOnly:bool=true -> FoundWidgets:object:UserWidget[]" \
 "call ActorComponent.K2_DestroyComponent" \
 "link 2.ReturnValue 3.self" "link 2.ReturnValue 4.self" "link 2.ReturnValue 5.self" "link 2.ReturnValue 6.self" "link 2.ReturnValue 10.self"
