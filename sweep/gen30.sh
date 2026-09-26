# R30 декор (knot'ы переноса) — узлы R26 (VERIFIED), make-node --chain --wrap 3 --decorate.
# Пересборка после R30-вердикта: knot A = правый край + 16 (estNodeWidth по геометрии), второе событие — своя цепочка.
node tools/make-node.mjs --chain --wrap 3 --decorate --title "SWEEP 30: декор — перенос рядов + exec-knot'ы (узлы R26, уже VERIFIED)" -o sweep/30-decorate.txt \
 "event TimerDemo" \
 "fn SetTimerByEvent Time=1.0 bLooping=true" \
 "fn PauseTimerHandle" \
 "fn Delay Duration=0.5" \
 "fn UnPauseTimerHandle" \
 "fn PrintString InString=Resumed" \
 "fn ClearAndInvalidateTimerHandle" \
 "fn DelayUntilNextTick" \
 "fn PrintString InString=Done" \
 "event OnTimerTick" \
 "fn PrintString InString=Tick" \
 "link 2.ReturnValue 3.Handle" "link 2.ReturnValue 5.Handle" "link 2.ReturnValue 7.Handle" "link 10.OutputDelegate 2.Delegate"
