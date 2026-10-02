// Категории реестра data/ue-functions.json. Раньше все пробы R36+ уходили в одну «Gameplay Systems».
// Теперь категория выводится из класса (lib) и имени функции. Используется в gen-probe --register
// и в tools/recategorize.mjs. Имена совпадают с исторически существующими категориями, где это возможно.
const BY_LIB = {
  DataTableFunctionLibrary: 'Data / Save', CurveFloat: 'Data / Save', CurveVector: 'Data / Save', CurveLinearColor: 'Data / Save',
  AIBlueprintHelperLibrary: 'AI / Navigation', AIController: 'AI / Navigation', BlackboardComponent: 'AI / Navigation',
  NavigationSystemV1: 'AI / Navigation', NavigationPath: 'AI / Navigation',
  Character: 'Pawn / Character', Pawn: 'Pawn / Character', MovementComponent: 'Pawn / Character', CharacterMovementComponent: 'Pawn / Character',
  SkeletalMeshComponent: 'Animation', AnimInstance: 'Animation', SkinnedMeshComponent: 'Animation',
  MaterialInstanceDynamic: 'Materials / FX', KismetMaterialLibrary: 'Materials / FX', NiagaraFunctionLibrary: 'Materials / FX',
  NiagaraComponent: 'Materials / FX', MeshComponent: 'Materials / FX', DecalComponent: 'Materials / FX',
  LightComponent: 'Lights', LocalLightComponent: 'Lights', PointLightComponent: 'Lights', SpotLightComponent: 'Lights', LightComponentBase: 'Lights',
  PlayerCameraManager: 'Camera', CameraComponent: 'Camera', SpringArmComponent: 'Camera',
  PlayerController: 'Player / Controller', Controller: 'Player / Controller', PlayerState: 'Player / Controller', KismetInputLibrary: 'Input',
  BlueprintGameplayTagLibrary: 'Gameplay Tags',
  PrimitiveComponent: 'Components / Physics', StaticMeshComponent: 'Components / Physics', CapsuleComponent: 'Components / Physics',
  RadialForceComponent: 'Components / Physics', PhysicsConstraintComponent: 'Components / Physics', PhysicsHandleComponent: 'Components / Physics',
  ActorComponent: 'Components / Scene', SceneComponent: 'Components / Scene', SplineComponent: 'Components / Scene',
  AudioComponent: 'Audio',
  TextBlock: 'Widgets / UI', ProgressBar: 'Widgets / UI', WidgetBlueprintLibrary: 'Widgets / UI', UserWidget: 'Widgets / UI', Widget: 'Widgets / UI',
  Image: 'Widgets / UI', Slider: 'Widgets / UI', CheckBox: 'Widgets / UI', ComboBoxString: 'Widgets / UI', ScrollBox: 'Widgets / UI',
  PanelWidget: 'Widgets / UI', WidgetLayoutLibrary: 'Widgets / UI', CanvasPanelSlot: 'Widgets / UI', TextLayoutWidget: 'Widgets / UI',
  EditableTextBox: 'Widgets / UI', Button: 'Widgets / UI',
  KismetTextLibrary: 'Text', KismetStringLibrary: 'String',
  BlueprintMapLibrary: 'Containers', BlueprintSetLibrary: 'Containers',
  GameModeBase: 'Game Framework', GameStateBase: 'Game Framework', HUD: 'Game Framework',
  Actor: 'Actor',
};

function mathCategory(f) {
  if (/DateTime|Timespan|^Now$|^UtcNow$|^Today$|TotalSeconds|FromSeconds/.test(f)) return 'Math / Time';
  if (/Random|Stream|Perlin/.test(f)) return 'Math / Random';
  if (/Color|HSV|RGB|^CInterpTo$/.test(f)) return 'Math / Color';
  if (/Vector2D|Normal2D$/.test(f)) return 'Math / Vector2D';
  if (/Rotator|RInterp|NormalizeAxis|GetAxes|AxisAndAngle/.test(f)) return 'Math / Rotator';
  if (/Vector|Direction|Reflection|RotateAngleAxis|BoundingBox/.test(f)) return 'Math / Vector';
  if (/Int/.test(f)) return 'Math / Integer';
  if (/Interp|Ease/.test(f)) return 'Math / Interpolation';
  return 'Math / Float';
}
function systemCategory(f) {
  if (/^DrawDebug|FlushPersistentDebug/.test(f)) return 'Debug';
  if (/Overlap/.test(f)) return 'Collision';
  if (/Timer/.test(f)) return 'Timers / Latent';
  if (/IsServer|IsStandalone|IsDedicatedServer/.test(f)) return 'Networking';
  if (/Interface/.test(f)) return 'Casting';
  return 'Utilities';
}
function staticsCategory(f) {
  if (/Damage/.test(f)) return 'Damage';
  if (/Sound|Mix/.test(f)) return 'Audio';
  if (/Decal|Emitter/.test(f)) return 'Materials / FX';
  if (/Camera/.test(f)) return 'Camera';
  if (/Player|Create|Remove/.test(f)) return 'Player / Controller';
  if (/Streaming/.test(f)) return 'Level Streaming';
  if (/Game(In|)Slot|Save/.test(f)) return 'Data / Save';
  if (/Actor/.test(f)) return 'Actor';
  return 'Game Framework';
}
function actorCategory(f) {
  if (/Role|Replicat|NetUpdate|Dormancy|HasAuthority|SetOwner/.test(f)) return 'Networking';
  if (/Input/.test(f)) return 'Input';
  return 'Actor';
}

export function categoryFor(e) {
  const f = e.func || '';
  if (e.lib === 'KismetMathLibrary') return mathCategory(f);
  if (e.lib === 'KismetSystemLibrary') return systemCategory(f);
  if (e.lib === 'GameplayStatics') return staticsCategory(f);
  if (e.lib === 'Actor') return actorCategory(f);
  return BY_LIB[e.lib] || 'Utilities';
}
