// UE Blueprint Parser — standalone ES module
// Парсит Begin Object ... End Object → графы
// Используется и в браузере (index.html) и в Node для валидации LLM ответов
import { macroGraphRef } from './ue-types.js';

export function guid32(){
  const h='0123456789ABCDEF'; let s=''; for(let i=0;i<32;i++) s+=h[Math.floor(Math.random()*16)]; return s;
}

export function parseToGraphs(text){
  const lines=text.split(/\r?\n/);
  const stack=[], roots=[];
  for(let i=0;i<lines.length;i++){
    const trimmed=lines[i].trim();
    if(trimmed.startsWith('Begin Object')){
      const cls=trimmed.match(/Class=([^\s]+)/)?.[1]||'';
      const name=trimmed.match(/Name="([^"]+)"/)?.[1]||'';
      const obj={rawClass:cls, className:cls.replace(/^\/Script\//,''), name, header:trimmed, lines:[], children:[], parent:stack[stack.length-1]||null, start:i};
      if(stack.length) stack[stack.length-1].children.push(obj); else roots.push(obj);
      stack.push(obj);
    } else if(trimmed.startsWith('End Object')){
      const o=stack.pop(); if(o){ o.end=i; o.rawBlock=lines.slice(o.start,i+1).join('\n'); }
    } else { if(stack.length) stack[stack.length-1].lines.push(lines[i]); }
  }
  const graphs={};
  const rootId='EventGraph';
  graphs[rootId]={id:rootId,name:'EventGraph', nodes:[], parentCompositeId:null, parentGraphId:null};

  function objToNode(obj, isInner=false){
    if(obj.className==='Engine.EdGraph' || obj.className==='BlueprintGraph.EdGraphSchema_K2') return null;
    if(!isInner && obj.className.includes('K2Node_Tunnel')) return null;
    if(obj.className.includes('EdGraph') && !obj.className.includes('EdGraphNode')) return null;
    const node={
      id: obj.name || ('Node_'+guid32().slice(0,6)),
      rawName: obj.name, className: obj.className, rawClass: obj.rawClass,
      header: obj.header, rawLines: obj.lines, rawBlock: obj.rawBlock,
      guid:'', pos:{x:0,y:0}, pins:[], isReroute:false, isComment:false, isComposite:false, isTunnel:false,
      width:180, height:80, title:'', varName:null, funcName:null, operationName:null, commentText:'',
      memberParent:null, opMemberName:null, structType:null, macroGraph:null, macroGuid:null
    };
    node.isReroute=obj.className.includes('K2Node_Knot');
    node.isComment=obj.className.includes('EdGraphNode_Comment');
    node.isComposite=obj.className.includes('K2Node_Composite');
    node.isTunnel=obj.className.includes('K2Node_Tunnel');
    let commentText='';
    for(const l of obj.lines){
      const t=l.trim();
      if(t.startsWith('NodePosX=')) node.pos.x=parseInt(t.match(/NodePosX=(-?\d+)/)?.[1]||'0',10);
      else if(t.startsWith('NodePosY=')) node.pos.y=parseInt(t.match(/NodePosY=(-?\d+)/)?.[1]||'0',10);
      else if(t.startsWith('NodeGuid=')) node.guid=t.match(/NodeGuid=([A-F0-9]+)/)?.[1]||guid32();
      else if(t.startsWith('NodeWidth=')) node.width=parseInt(t.match(/NodeWidth=(\d+)/)?.[1]||'180',10);
      else if(t.startsWith('NodeHeight=')) node.height=parseInt(t.match(/NodeHeight=(\d+)/)?.[1]||'80',10);
      else if(t.startsWith('NodeComment=')) commentText=t.match(/NodeComment="([^"]*)"/)?.[1]||'';
      else if(t.startsWith('CustomProperties Pin')){
        const pinStr=t.substring(t.indexOf('Pin (')+5);
        const pinId=(pinStr.match(/PinId=([A-F0-9]+)/)||[])[1]||guid32();
        const pinName=(pinStr.match(/PinName="([^"]+)"/)||[])[1]||'';
        const dir=pinStr.match(/Direction="([^"]+)"/)?.[1]||'EGPD_Input';
        const cat=(pinStr.match(/PinCategory="([^"]*)"/)||[])[1]||'';
        const sub=(pinStr.match(/PinSubCategory="([^"]*)"/)||[])[1]||'';
        const hidden=/bHidden=True/.test(pinStr);
                                const friendly=(pinStr.match(/PinFriendlyName=Text\("([^"]*)"\)/)||[])[1]||(pinStr.match(/PinFriendlyName=NSLOCTEXT\("[^"]*", *\"[^"]*", *\"([^"]*)"\)/)||[])[1]||pinName;
        const defaultValue=(pinStr.match(/DefaultValue="([^"]*)"/)||[])[1]||(pinStr.match(/DefaultTextValue=NSLOCTEXT\("[^"]*", *"[^"]*", *"([^"]*)"\)/)||[])[1]||(pinStr.match(/DefaultTextValue=INVTEXT\("([^"]*)"\)/)||[])[1]||'';
        const subObj=(pinStr.match(/PinSubCategoryObject=([^,\)]+)/)||[])[1]||'';
        const linkedMatch=pinStr.match(/LinkedTo=\(([^)]*)\)/);
        let linked=[]; if(linkedMatch){
          const inside=linkedMatch[1].trim();
          if(inside) inside.split(',').map(s=>s.trim()).filter(Boolean).forEach(p=>{
            const tok=p.split(/\s+/).filter(Boolean); if(tok.length>=2) linked.push({nodeName:tok[0], pinId:tok[1]});
          });
        }
        const sub2=sub||(cat==='struct'&&subObj&&subObj!=='None'?subObj.split('.').pop().replace(/['"]/g,''):'');const isConst=/bIsConst=True/.test(pinStr);
        const isRef=/PinType\.bIsReference=True/.test(pinStr);const container=(pinStr.match(/PinType\.ContainerType=([A-Za-z]+)/)||[])[1]||'None';const ignored=/bDefaultValueIsIgnored=True/.test(pinStr);const advanced=/bAdvancedView=True/.test(pinStr);
        node.pins.push({id:pinId,name:pinName, friendly, direction:dir.includes('Output')?'Output':'Input', category:cat, subCategory:sub2, subCategoryObject:subObj==='None'?'':subObj, defaultValue, hidden, linkedTo:linked,isConst,isRef,container,ignored,advanced});
      } else if(t.startsWith('VariableReference=')){ const m=t.match(/MemberName="([^"]+)"/); if(m) node.varName=m[1]; }
      else if(t.startsWith('bDefaultsToPureFunc=')){ node.pure=true; }
      else if(t.startsWith('FunctionReference=')){ const m=t.match(/MemberName="([^"]+)"/); if(m) node.funcName=m[1]; const mp=t.match(/MemberParent="([^"]+)"/)||t.match(/MemberParent=([^,\)]+)/); if(mp) node.memberParent=mp[1]; }
      else if(t.startsWith('StructType=')){ const m=t.match(/StructType=([^\s]+)/); if(m) node.structType=m[1]; }
      else if(t.startsWith('IndexPinType=')){ const c=t.match(/PinCategory="([^"]*)"/); const s=t.match(/PinSubCategory="([^"]*)"/); const o=t.match(/PinSubCategoryObject="([^"]+)"/); node.selectIndex={cat:c?c[1]:'',sub:s?s[1]:'',subObj:o?'"'+o[1]+'"':''}; }
      else if(t.startsWith('MacroGraphReference=')){ const m=t.match(/StandardMacros:([^"']+)/); if(m) node.macroGraph=m[1]; const gg=t.match(/GraphGuid=([A-F0-9]+)/); if(gg) node.macroGuid=gg[1]; }
      else if(t.startsWith('OperationName=')) node.operationName=t.match(/OperationName="([^"]+)"/)?.[1]||'';
    }
    if(!node.guid) node.guid=guid32();
    if(node.isComment) node.commentText=commentText||'Comment';
    if(node.isReroute) node.title='Reroute';
    else if(node.isTunnel) node.title=node.name||'Tunnel';
    else if(node.className.includes('K2Node_VariableGet')) node.title='Get '+(node.varName||'Var');
    else if(node.className.includes('K2Node_VariableSet')) node.title='Set '+(node.varName||'Var');
    else if(node.className.includes('K2Node_IfThenElse')) node.title='Branch';
    else if(node.className.includes('K2Node_PromotableOperator')) node.title=node.operationName? node.operationName+' (pure)':'Pure Op';
    else if(node.className.includes('K2Node_CallFunction')) node.title=node.funcName||'Call Function';
    else if(node.isComposite) node.title='Collapsed Graph';
    else node.title=node.className.split('.').pop()||node.className;
    return node;
  }

  function process(objs, graphId, isInner){
    for(const obj of objs){
      if(obj.className==='Engine.EdGraph'){
        if(!isInner) process(obj.children, graphId, false);
        continue;
      }
      const node=objToNode(obj, isInner); if(!node) continue;
      graphs[graphId].nodes.push(node);
      if(node.isComposite){
        const ed=obj.children.find(c=> c.className==='Engine.EdGraph');
        if(ed){
          const innerId=node.guid|| (node.id+'_Graph');
          node.collapseGraphId=innerId;
          graphs[innerId]={id:innerId,name:node.title||'Collapsed Graph', nodes:[], parentCompositeId:node.id, parentGraphId:graphId};
          for(const innerObj of ed.children){
            const innerNode=objToNode(innerObj,true); if(!innerNode) continue;
            if(innerNode.isTunnel){
              const raw=innerObj.lines.join(' ');
              if(raw.includes('bCanHaveInputs=True') && raw.includes('bCanHaveOutputs=True')) innerNode.tunnelType='both';
              else if(raw.includes('bCanHaveInputs=True')) innerNode.tunnelType='input';
              else if(raw.includes('bCanHaveOutputs=True')) innerNode.tunnelType='output';
            }
            graphs[innerId].nodes.push(innerNode);
          }
        }
      }
    }
  }
  process(roots, rootId, false);
  return graphs;
}

export function generateUEText(nodeList, opts={}){
  if(!nodeList.length) return '';
  return nodeList.map(n=>{
    let block=n.rawBlock;
    if(!block){
      block=generateBlock(n,opts);
    } else {
      block=block.replace(/NodePosX=-?\d+/g, `NodePosX=${Math.round(n.pos.x)}`);
      block=block.replace(/NodePosY=-?\d+/g, `NodePosY=${Math.round(n.pos.y)}`);
      if(n.isComment){
        block=block.replace(/NodeWidth=\d+/g, `NodeWidth=${n.width}`);
        block=block.replace(/NodeHeight=\d+/g, `NodeHeight=${n.height}`);
        block=block.replace(/NodeComment="[^"]*"/, `NodeComment="${n.commentText}"`);
      }
    }
    return block;
  }).join('\n\n').trim();
}

// P1 (формат-паритет с живыми дампами UE 5.8, tests/fixtures/*):
//  • DefaultValue+AutogeneratedDefaultValue на входах И выходах; auto — только если значение = автоген-дефолту
//    (тип или объявленный дефолт функции p.autoDefault); пользовательское значение — только DefaultValue.
//    byte-энамы (TraceTypeQuery1, EDrawDebugTrace) в дампах без auto; контейнеры/object/exec — без дефолта.
//  • PersistentGuid=000…0 на каждом пине; порядок полей как у движка.
//  • self → PinFriendlyName=NSLOCTEXT("K2Node", "Target", "Target").
//  • PromotableOperator → PinToolTip="<Имя>\\n<Тип>" (у CallFunction тултипы не пишем).
const ZERO_GUID='00000000000000000000000000000000';
const TARGET_FN='PinFriendlyName=NSLOCTEXT("K2Node", "Target", "Target"),';
export function typeDefault(p){
  if((p.container||'None')!=='None') return '';
  const so=p.subCategoryObject||'';
  switch(p.category){
    case 'real': return '0.0';
    case 'bool': return 'false';
    case 'int': case 'int64': return '0';
    case 'byte': return so&&so!=='None'?'':'0';
    case 'name': return 'None';
    case 'struct':
      if(/CoreUObject\.(Vector|Rotator)'/.test(so)) return '0, 0, 0';
      if(/InputCore\.Key'/.test(so)) return 'None';
      return '';
  }
  return '';
}
function isAutoDefault(p,v,fnFamily){
  if(!v||(p.container||'None')!=='None'||p.category==='text') return false;
  if(p.category==='byte'&&p.subCategoryObject&&p.subCategoryObject!=='None') return false;
  return (fnFamily&&v===typeDefault(p))||(p.autoDefault!==undefined&&p.autoDefault!==''&&v===p.autoDefault);
}
const TYPE_DESC={real:{double:'Float (double-precision)',float:'Float (single-precision)','':'Float (double-precision)'},int:'Integer',int64:'Integer64',bool:'Boolean',byte:'Byte',string:'String',name:'Name',text:'Text'};
function opTooltip(p){
  let d=TYPE_DESC[p.category]; if(d&&typeof d==='object') d=d[p.subCategory||''];
  if(!d&&p.category==='struct'){ const m=/\.(\w+)'"?$/.exec(p.subCategoryObject||''); if(m) d=m[1]; }
  if(!d) return '';
  const disp=p.name==='ReturnValue'?'Return Value':(p.friendly&&p.friendly!==p.name?p.friendly:p.name);
  return `PinToolTip="${disp}\\n${d}",`;
}
// --root: реальный путь графа (/Game/X/BP_X.BP_X:EventGraph, …:MyFunction, композит — полным путём).
// Без него ExportPath не пишем вовсе (фейковый /Game/Generated.Generated больше не выводим).
function exportPathAttr(cls,name,opts){ return opts&&opts.root?` ExportPath="${cls}'${opts.root}.${name}'"`:''; }
// Класс «своего» BP из --root: /Game/X/BP_X.BP_X:Graph → "/Script/Engine.BlueprintGeneratedClass'/Game/X/BP_X.BP_X_C'"
export function bpClassFromRoot(root){
  const m=/^(\/[^.:]+)\.([^.:]+)/.exec(root||''); return m?`"/Script/Engine.BlueprintGeneratedClass'${m[1]}.${m[2]}_C'"`:'';
}

function generateBlock(n,opts={}){
  const guid=n.guid||guid32();
  const shortCls=String(n.rawClass||n.className||'').split('.').pop();
  const fnFamily=/^K2Node_(CallFunction|CallArrayFunction|PromotableOperator|CommutativeAssociativeBinaryOperator|CallMaterialParameterCollectionFunction)$/.test(shortCls);
  const isOp=!!n.operationName&&/PromotableOperator/.test(n.className||n.rawClass||'');
  // своя переменная (bSelfContext, без MemberScope/MemberParent): self = класс BP (из ownerClass или --root)
  const ownCls=n.varName&&!n.varScope?(n.ownerClass||bpClassFromRoot(opts.root)):'';
  const pinLines=n.pins.map(p=>{
    const dir=p.direction==='Output'?`Direction="EGPD_Output",`:'';
    const linked=p.linkedTo.length?`LinkedTo=(${p.linkedTo.map(l=> l.nodeName+' '+l.pinId).join(',')},),`:'';
    // round20: text-пины пишут DefaultTextValue=NSLOCTEXT(ns, key, "...") (copy-back FormatText UE 5.8); ключ — случайный, движок перекеширует.
    let v=p.defaultValue||'';
    // типовой автоген — только у узлов-функций (CallFunction/операторы): у Cast.bSuccess и пр. K2-узлов движок его не пишет (копия R22).
    if(!v&&fnFamily&&p.category!=='text'&&p.category!=='exec'&&p.name!=='self') v=typeDefault(p);
    const dv=v&&p.category!=='text'?`DefaultValue="${v}",${isAutoDefault(p,v,fnFamily)?`AutogeneratedDefaultValue="${v}",`:''}`:'';
    const dtv=p.category==='text'&&p.defaultValue?`DefaultTextValue=NSLOCTEXT("", "${guid32()}", "${p.defaultValue}"),`:'';
    // PinName опускаем при пустом имени (FlipFlop, round1: каноника движка — поля нет вообще).
    const nm=p.name?`PinName="${p.name}",`:'';
    const fn=p.name==='self'?TARGET_FN:'';
    const tt=isOp&&p.category!=='exec'?opTooltip(p):'';
    let subObj=p.subCategoryObject||'None';
    if(p.name==='self'&&ownCls&&(!p.subCategoryObject||p.subCategoryObject==='None')) subObj=ownCls;
    // v6: ссылки quoted-full (UE 5.8, copy-back H1/J5/LineTraceSingle: "..." + полная форма без внутр. кавычек).
    return `   CustomProperties Pin (PinId=${p.id},${nm}${fn}${tt}${dir}PinType.PinCategory="${p.category}",PinType.PinSubCategory="${p.category==='struct'?'':(p.subCategory||'')}",PinType.PinSubCategoryObject=${subObj},PinType.PinSubCategoryMemberReference=(${p.memberRef||''}),PinType.PinValueType=(),PinType.ContainerType=${p.container||'None'},PinType.bIsReference=${p.isRef?'True':'False'},PinType.bIsConst=${p.isConst?'True':'False'},PinType.bIsWeakPointer=False,PinType.bIsUObjectWrapper=False,PinType.bSerializeAsSinglePrecisionFloat=False,${dv}${p.defaultObject?`DefaultObject="${p.defaultObject}",`:''}${dtv}${linked}PersistentGuid=${ZERO_GUID},bHidden=${p.hidden?'True':'False'},bNotConnectable=False,bDefaultValueIsReadOnly=False,bDefaultValueIsIgnored=${p.ignored?'True':'False'},bAdvancedView=${p.advanced?'True':'False'},bOrphanedPin=False,)`;
  });
  // v7: self-пин статического вызова библиотеки (copy-back O1/O2: движок
  // достраивает его сам — пишем сразу для copy-back 1-в-1). FriendlyName не
  // пишем (политика выше), DefaultObject выводим из MemberParent. Дубли не
  // плодим: если self уже есть в пинах (парсинг текста UE) — пропускаем.
  if(n.funcName&&n.memberParent&&!n.pins.some(p=>p.name==='self')){
    const mm=/'(\/Script\/[\w/]+)\.(\w+)'/.exec(n.memberParent);
    if(mm){
      let idx=0; while(n.pins[idx]&&n.pins[idx].category==='exec')idx++;
      pinLines.splice(idx,0,`   CustomProperties Pin (PinId=${guid32()},PinName="self",${TARGET_FN}PinType.PinCategory="object",PinType.PinSubCategory="",PinType.PinSubCategoryObject=${n.memberParent},PinType.PinSubCategoryMemberReference=(),PinType.PinValueType=(),PinType.ContainerType=None,PinType.bIsReference=False,PinType.bIsConst=False,PinType.bIsWeakPointer=False,PinType.bIsUObjectWrapper=False,PinType.bSerializeAsSinglePrecisionFloat=False,DefaultObject="${mm[1]}.Default__${mm[2]}",PersistentGuid=${ZERO_GUID},bHidden=True,bNotConnectable=False,bDefaultValueIsReadOnly=False,bDefaultValueIsIgnored=False,bAdvancedView=False,bOrphanedPin=False,)`);
    }
  }
  // v7.1: NotEqual-автопин свитчей (copy-back round1: движок достраивает сам —
  // пишем сразу для copy-back 1-в-1). Позиция — сразу после Selection.
  const SWNEQ={K2Node_SwitchInteger:['NotEqual_IntInt','KismetMathLibrary'],K2Node_SwitchString:['NotEqual_StriStri','KismetStringLibrary'],K2Node_SwitchEnum:['NotEqual_ByteByte','KismetMathLibrary']};
  const swm=n.className&&SWNEQ[n.className.split('.').pop()];
  if(swm&&!n.pins.some(p=>p.name===swm[0])){
    const libC=`"/Script/CoreUObject.Class'/Script/Engine.${swm[1]}'"`;
    let si=n.pins.findIndex(p=>p.name==='Selection'); if(si<0)si=0;
    pinLines.splice(si+1,0,`   CustomProperties Pin (PinId=${guid32()},PinName="${swm[0]}",PinType.PinCategory="object",PinType.PinSubCategory="",PinType.PinSubCategoryObject=${libC},PinType.PinSubCategoryMemberReference=(),PinType.PinValueType=(),PinType.ContainerType=None,PinType.bIsReference=False,PinType.bIsConst=False,PinType.bIsWeakPointer=False,PinType.bIsUObjectWrapper=False,PinType.bSerializeAsSinglePrecisionFloat=False,DefaultObject="/Script/Engine.Default__${swm[1]}",PersistentGuid=${ZERO_GUID},bHidden=True,bNotConnectable=True,bDefaultValueIsReadOnly=True,bDefaultValueIsIgnored=False,bAdvancedView=False,bOrphanedPin=False,)`);
  }
  const pinsText=pinLines.join('\n');
  let extra='';
  // round8-fix3: Select — IndexPinType (live-рефы round8-fix3; без него движок резолвит Index как int).
  if(n.selectIndex) extra+=`   IndexPinType=(PinCategory="${n.selectIndex.cat}",PinSubCategory="${n.selectIndex.sub||''}"${n.selectIndex.subObj?`,PinSubCategoryObject=${n.selectIndex.subObj}`:''})\n`;
  // P1.9: локал функции — MemberScope, без bSelfContext (и без self-пина — его не создаёт конструктор).
  if(n.varName&&n.varScope) extra+=`   VariableReference=(MemberScope="${n.varScope}",MemberName="${n.varName}",MemberGuid=${n.varGuid||guid32()})\n`;
  else if(n.varName) extra+=`   VariableReference=(MemberName="${n.varName}",MemberGuid=${n.varGuid||guid32()},bSelfContext=True)\n`;
  if(n.funcName && !n.operationName){
    if(n.pure) extra+=`   bDefaultsToPureFunc=True\n`;
    if(n.memberParent) extra+=`   FunctionReference=(MemberParent=${n.memberParent},MemberName="${n.funcName}")\n`;
    else extra+=`   FunctionReference=(MemberName="${n.funcName}",MemberGuid=${n.memberGuid||guid32()},bSelfContext=True)\n`;
  }
  if(n.operationName){
    const member=n.opMemberName||`${n.operationName}_DoubleDouble`;
    extra+=`   OperationName="${n.operationName}"\n   bDefaultsToPureFunc=True\n   FunctionReference=(MemberParent="/Script/CoreUObject.Class'/Script/Engine.KismetMathLibrary'",MemberName="${member}")\n`;
  }
  if(n.rawProps) n.rawProps.forEach(l=>{ extra+=`   ${l}\n`; });
  if(n.structType) extra+=`   StructType=${n.structType}\n`;
  // round1b: SwitchEnum — Enum=/EnumEntries (live-реф; quoted-full как SubCategoryObject).
  if(n.enumRef){ extra+=`   Enum=${n.enumRef}\n`; (n.enumEntries||[]).forEach((en,i)=>{ extra+=`   EnumEntries(${i})="${en==='None'?'':en}"\n`; }); }
  if(n.macroGraph) extra+=`   ${macroGraphRef(n.macroGraph, n.macroGuid||null)}\n`;
  if(n.isComment) return `Begin Object Class=${n.rawClass} Name="${n.id}"${exportPathAttr('/Script/UnrealEd.EdGraphNode_Comment',n.id,opts)}\n   NodePosX=${Math.round(n.pos.x)}\n   NodePosY=${Math.round(n.pos.y)}\n   NodeWidth=${n.width}\n   NodeHeight=${n.height}\n   NodeComment="${n.commentText}"\n   NodeGuid=${guid}\nEnd Object`;
  const cls=n.rawClass||`/Script/BlueprintGraph.${n.className.split('.').pop()}`;
  return `Begin Object Class=${cls} Name="${n.id}"${exportPathAttr(cls,n.id,opts)}\n${extra}   NodePosX=${Math.round(n.pos.x)}\n   NodePosY=${Math.round(n.pos.y)}\n   NodeGuid=${guid}\n${pinsText?pinsText+'\n':''}${(n.tailProps||[]).map(l=>`   ${l}\n`).join('')}End Object`;
}

export function validateUEText(text){
  const begin=(text.match(/Begin Object/g)||[]).length;
  const end=(text.match(/End Object/g)||[]).length;
  const errors=[];
  if(begin===0) errors.push('Нет Begin Object блоков');
  if(begin!==end) errors.push(`Несбаланс: Begin ${begin} vs End ${end}`);
  if(!text.includes('NodeGuid=')) errors.push('Отсутствует NodeGuid');
  return {valid: errors.length===0, errors, count: begin};
}
