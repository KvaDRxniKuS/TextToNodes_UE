#!/usr/bin/env node
// Reproducible collapsed-node probe. Each side starts with one Knot per pin; each successive
// level inserts midpoint Knots between adjacent entries and moves 16px farther outward.
// Generation stops when a level contains only one Knot or the requested depth is reached.
import fs from 'node:fs';
import { createKnot, createComment, estNodeWidth, pinCenterY, KNOT_X_STEP, KNOT_SIDE_OFFSET, PIN_ROW_H } from '../src/generator.js';
import { generateUEText, guid32 } from '../src/parser.js';

const OBJ = `"/Script/CoreUObject.Class'/Script/EnhancedInput.EnhancedInputSubsystemInterface'"`;
const ZERO = '00000000000000000000000000000000';
const pinLine = ({id=guid32(), name, direction='Input', cat='interface', subObj=cat==='interface'?OBJ:'None'}) =>
  `         CustomProperties Pin (PinId=${id},PinName="${name}",${direction==='Output'?'Direction="EGPD_Output",':''}PinType.PinCategory="${cat}",PinType.PinSubCategory="",PinType.PinSubCategoryObject=${subObj},PinType.PinSubCategoryMemberReference=(),PinType.PinValueType=(),PinType.ContainerType=None,PinType.bIsReference=False,PinType.bIsConst=False,PinType.bIsWeakPointer=False,PinType.bIsUObjectWrapper=False,PinType.bSerializeAsSinglePrecisionFloat=False,PersistentGuid=${ZERO},bHidden=False,bNotConnectable=False,bDefaultValueIsReadOnly=False,bDefaultValueIsIgnored=False,bAdvancedView=False,bOrphanedPin=False,)`;
const udPin = (name, direction, cat) =>
  `         CustomProperties UserDefinedPin (PinName="${name}",PinType=(PinCategory="${cat}"${cat==='interface'?`,PinSubCategoryObject=${OBJ}`:''}),DesiredPinDirection=${direction})`;
const [,, ...args] = process.argv;
const option = (name, fallback) => {
  const i = args.indexOf(name);
  return i < 0 ? fallback : Number(args[i + 1]);
};
const inputCount = option('--inputs', 4), outputCount = option('--outputs', 5), maxLevels = option('--levels', 2);
if (![inputCount, outputCount, maxLevels].every(Number.isInteger) || inputCount < 1 || outputCount < 1 || maxLevels < 1) {
  throw new Error('Usage: node tools/gen-collapsed-knot-test.mjs [--inputs N] [--outputs N] [--levels N]');
}
const makePins = (count, prefix) => Array.from({length:count}, (_,i) => ({
  name: `${prefix}${i ? i + 1 : ''}`, dir: prefix === 'InputPin' ? 'EGPD_Output' : 'EGPD_Input',
  cat: i === 0 ? 'exec' : 'interface',
}));
const inputs = makePins(inputCount, 'InputPin');
const outputs = makePins(outputCount, 'OutputPin');
const shape = `${inputCount}x${outputCount}`;
const graphName = `CollapsedGraph_${shape}`;
const compositeName = `K2Node_Composite_9200`;
const ids = Object.fromEntries([...inputs,...outputs].map(p=>[p.name,guid32()]));
const outerInputs = inputs.map(p=>pinLine({id:ids[p.name],name:p.name,cat:p.cat})).join('\n');
const outerOutputs = outputs.map(p=>pinLine({id:ids[p.name],name:p.name,direction:'Output',cat:p.cat})).join('\n');
const tunnel0Pins = inputs.map(p=>pinLine({id:guid32(),name:p.name,direction:'Output',cat:p.cat})).join('\n');
const tunnel1Pins = outputs.map(p=>pinLine({id:guid32(),name:p.name,cat:p.cat})).join('\n');
const userInputs = inputs.map(p=>udPin(p.name,p.dir,p.cat)).join('\n');
const userOutputs = outputs.map(p=>udPin(p.name,p.dir,p.cat)).join('\n');
const comp = `Begin Object Class=/Script/BlueprintGraph.K2Node_Composite Name="${compositeName}"
   Begin Object Class=/Script/Engine.EdGraph Name="${graphName}"
      Begin Object Class=/Script/BlueprintGraph.K2Node_Tunnel Name="K2Node_Tunnel_0"
      End Object
      Begin Object Class=/Script/BlueprintGraph.K2Node_Tunnel Name="K2Node_Tunnel_1"
      End Object
   End Object
   Begin Object Name="${graphName}"
      Begin Object Name="K2Node_Tunnel_0"
         OutputSourceNode="/Script/BlueprintGraph.K2Node_Composite'${compositeName}'"
         bCanHaveOutputs=True
         NodePosX=160
         NodePosY=0
         NodeGuid=${guid32()}
${tunnel0Pins}
${userInputs}
      End Object
      Begin Object Name="K2Node_Tunnel_1"
         InputSinkNode="/Script/BlueprintGraph.K2Node_Composite'${compositeName}'"
         bCanHaveInputs=True
         NodePosX=640
         NodePosY=0
         NodeGuid=${guid32()}
${tunnel1Pins}
${userOutputs}
      End Object
      Schema="/Script/CoreUObject.Class'/Script/BlueprintGraph.EdGraphSchema_K2'"
      Nodes(0)="/Script/BlueprintGraph.K2Node_Tunnel'K2Node_Tunnel_0'"
      Nodes(1)="/Script/BlueprintGraph.K2Node_Tunnel'K2Node_Tunnel_1'"
      GraphGuid=${guid32()}
   End Object
   BoundGraph="/Script/Engine.EdGraph'${graphName}'"
   OutputSourceNode="/Script/BlueprintGraph.K2Node_Tunnel'${graphName}.K2Node_Tunnel_1'"
   InputSinkNode="/Script/BlueprintGraph.K2Node_Tunnel'${graphName}.K2Node_Tunnel_0'"
   NodePosX=0
   NodePosY=0
   bCanRenameNode=True
   NodeGuid=${guid32()}
${outerInputs}
${outerOutputs}
End Object`;

const model={className:'BlueprintGraph.K2Node_Composite',title:'Collapsed Graph',pos:{x:0,y:0},pins:[
  ...inputs.map(p=>({name:p.name,direction:'Input',category:p.cat,hidden:false})),
  ...outputs.map(p=>({name:p.name,direction:'Output',category:p.cat,hidden:false})),
]};
const width=estNodeWidth(model), leftEdge=0, rightEdge=width;
const knots=[];
function addKnot(id,cat,x,y){
  const k=createKnot({x,y},cat);
  k.id=`K2Node_Knot_${id}`; k.guid=guid32();
  if(cat==='interface') for(const p of k.pins) p.subCategoryObject=OBJ;
  knots.push(k);
}
// Recursively bisect each side's pin centers. Every new level is one grid cell farther outward.
function addSideLevels(pins, side, firstId) {
  let ys = pins.map((p,i) => pinCenterY(model, model.pins[side === 'left' ? i : inputs.length+i]));
  let id = firstId;
  for (let level=0; level<maxLevels && ys.length>0; level++) {
    const x = side === 'left'
      ? leftEdge-KNOT_SIDE_OFFSET-level*KNOT_X_STEP
      : rightEdge+KNOT_SIDE_OFFSET+level*KNOT_X_STEP;
    const cats = level === 0 ? pins.map(p=>p.cat) : ys.map(()=> 'wildcard');
    ys.forEach((center,i)=>addKnot(id++,cats[i],x,center-8));
    if (ys.length <= 1) break;
    const next=[];
    for(let i=0;i<ys.length-1;i++) next.push((ys[i]+ys[i+1])/2);
    ys=next;
  }
}
addSideLevels(inputs,'left',9300);
addSideLevels(outputs,'right',9400);
const totalKnots=knots.length;
const comment=createComment(`COLLAPSED PIN TEST: ${inputCount} inputs / ${outputCount} outputs; up to ${maxLevels} recursive Knot levels; port offset ${KNOT_SIDE_OFFSET}px; level step ${KNOT_X_STEP}px; vertical pin pitch ${PIN_ROW_H}px`, {x:-96,y:-160}, width+320, 420);
const text=[generateUEText([comment]),comp,...knots.map(k=>generateUEText([k]))].join('\n\n')+'\n';
const out=inputCount===4 && outputCount===5 && maxLevels===2
  ? 'sweep/collapsed-knot-4x5-test.txt'
  : `sweep/collapsed-knot-${shape}-${maxLevels}levels-test.txt`;
fs.writeFileSync(out,text);
console.log(`wrote ${out} (${text.length} bytes); inputs=${inputs.length}, outputs=${outputs.length}, maxLevels=${maxLevels}, looseKnots=${totalKnots}, width=${width}`);
