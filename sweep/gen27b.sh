# 27b — R27 Widgets / UI (VERIFIED), перекомпоновка --decorate: pure/данные подрядом под потребителем, knot'ы переноса.
# Пересборка после R30-вердикта (knot A = правый край + 16). Класс виджета WBP_Test — заглушка (в движке выбрать свой).
node tools/make-node.mjs --chain --wrap 4 --decorate --title "SWEEP 27 (перекомпоновка --decorate): Widgets / UI — Create Widget, Add to Viewport/Player Screen, Visibility, Input Mode, Show Mouse Cursor" -o sweep/27b-widgets-ui-decorated.txt \
 "event ShowUI" \
 "fn GetPlayerController" \
 "widget /Game/UI/WBP_Test" \
 "fn AddToViewport" \
 "fn SetVisibility InVisibility=Visible" \
 "fn SetInputModeGameAndUI" \
 "set PlayerController.bShowMouseCursor bool true" \
 "fn SetInputModeUIOnly" \
 "fn AddToPlayerScreen ZOrder=1" \
 "fn RemoveFromParent" \
 "fn SetInputModeGameOnly" \
 "fn IsInViewport" \
 "get PlayerController.bShowMouseCursor bool" \
 "link 2.ReturnValue 3.OwningPlayer" "link 2.ReturnValue 6.PlayerController" "link 2.ReturnValue 7.self" "link 2.ReturnValue 8.PlayerController" "link 2.ReturnValue 11.PlayerController" "link 2.ReturnValue 13.self" \
 "link 3.ReturnValue 4.self" "link 3.ReturnValue 5.self" "link 3.ReturnValue 6.InWidgetToFocus" "link 3.ReturnValue 8.InWidgetToFocus" "link 3.ReturnValue 9.self" "link 3.ReturnValue 10.self" "link 3.ReturnValue 12.self"
