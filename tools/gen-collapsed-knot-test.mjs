#!/usr/bin/env node
// Reproducible 4-input / 5-output K2Node_Composite pin-height + lateral-Knot geometry probe.
// Each port has one unconnected Knot two grid cells outside the node; between adjacent port knots,
// one additional loose Knot is placed another 16px outward. There is no center column.
import fs from 'node:fs';
import { createKnot, createComment, estNodeWidth, pinCenterY, KNOT_X_STEP, KNOT_SIDE_OFFSET, PIN_ROW_H } from '../src/generator.js';
import { generateUEText, guid32 } from '../src/parser.js';

const OBJ = `"/Script/CoreUObject.Class'/Script/EnhancedInput.EnhancedInputSubsystemInterface'"`;
const ZERO = '00000000000000000000000000000000';
const pinLine = ({id=guid32(), name, direction='Input', cat='interface', subObj=cat==='interface'?OBJ:'None'}) =>
  `         CustomProperties Pin (PinId=${id},PinName="${name}",${direction==='Output'?'Direction="EGPD_Output",':''}PinType.PinCategory="${cat}",PinType.PinSubCategory="",PinType.PinSubCategoryObject=${subObj},PinType.PinSubCategoryMemberReference=(),PinType.PinValueType=(),PinType.ContainerType=None,PinType.bIsReference=False,PinType.bIsConst=False,PinType.bIsWeakPointer=False,PinType.bIsUObjectWrapper=False,PinType.bSerializeAsSinglePrecisionFloat=False,PersistentGuid=${ZERO},bHidden=False,bNotConnectable=False,bDefaultValueIsReadOnly=False,bDefaultValueIsIgnored=False,bAdvancedView=False,bOrphanedPin=False,)`;
const udPin = (name, direction, cat) =>
  `         CustomProperties UserDefinedPin (PinName="${name}",PinType=(PinCategory="${cat}"${cat==='interface'?`,PinSubCategoryObject=${OBJ}`:''}),DesiredPinDirection=${direction})`;
const inputs = [
  {name:'InputPin', dir:'EGPD_Output', cat:'exec'},
  {name:'InputPin2', dir:'EGPD_Output', cat:'interface'},
  {name:'InputPin3', dir:'EGPD_Output', cat:'interface'},
  {name:'InputPin4', dir:'EGPD_Output', cat:'interface'},
];
const outputs = [
  {name:'OutputPin', dir:'EGPD_Input', cat:'exec'},
  {name:'OutputPin2', dir:'EGPD_Input', cat:'interface'},
  {name:'OutputPin3', dir:'EGPD_Input', cat:'interface'},
  {name:'OutputPin4', dir:'EGPD_Input', cat:'interface'},
  {name:'OutputPin5', dir:'EGPD_Input', cat:'interface'},
];
const ids = Object.fromEntries([...inputs,...outputs].map(p=>[p.name,guid32()]));
const outerInputs = inputs.map(p=>pinLine({id:ids[p.name],name:p.name,cat:p.cat})).join('\n');
const outerOutputs = outputs.map(p=>pinLine({id:ids[p.name],name:p.name,direction:'Output',cat:p.cat})).join('\n');
const tunnel0Pins = inputs.map(p=>pinLine({id:guid32(),name:p.name,direction:'Output',cat:p.cat})).join('\n');
const tunnel1Pins = outputs.map(p=>pinLine({id:guid32(),name:p.name,cat:p.cat})).join('\n');
const userInputs = inputs.map(p=>udPin(p.name,p.dir,p.cat)).join('\n');
const userOutputs = outputs.map(p=>udPin(p.name,p.dir,p.cat)).join('\n');
const comp = `Begin Object Class=/Script/BlueprintGraph.K2Node_Composite Name="K2Node_Composite_9200"
   Begin Object Class=/Script/Engine.EdGraph Name="CollapsedGraph_4x5"
      Begin Object Class=/Script/BlueprintGraph.K2Node_Tunnel Name="K2Node_Tunnel_0"
      End Object
      Begin Object Class=/Script/BlueprintGraph.K2Node_Tunnel Name="K2Node_Tunnel_1"
      End Object
   End Object
   Begin Object Name="CollapsedGraph_4x5"
      Begin Object Name="K2Node_Tunnel_0"
         OutputSourceNode="/Script/BlueprintGraph.K2Node_Composite'K2Node_Composite_9200'"
         bCanHaveOutputs=True
         NodePosX=160
         NodePosY=0
         NodeGuid=${guid32()}
${tunnel0Pins}
${userInputs}
      End Object
      Begin Object Name="K2Node_Tunnel_1"
         InputSinkNode="/Script/BlueprintGraph.K2Node_Composite'K2Node_Composite_9200'"
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
   BoundGraph="/Script/Engine.EdGraph'CollapsedGraph_4x5'"
   OutputSourceNode="/Script/BlueprintGraph.K2Node_Tunnel'CollapsedGraph_4x5.K2Node_Tunnel_1'"
   InputSinkNode="/Script/BlueprintGraph.K2Node_Tunnel'CollapsedGraph_4x5.K2Node_Tunnel_0'"
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
// Port knots: one per incoming/outgoing pin, two grid cells outward.
inputs.forEach((p,i)=>addKnot(9300+i,p.cat,leftEdge-KNOT_SIDE_OFFSET,pinCenterY(model,model.pins[i])-8));
outputs.forEach((p,i)=>addKnot(9400+i,p.cat,rightEdge+KNOT_SIDE_OFFSET,pinCenterY(model,model.pins[inputs.length+i])-8));
// Between-port knots: one per adjacent pair, shifted one more 16px outward.
for(let i=0;i<inputs.length-1;i++){
  const y=(pinCenterY(model,model.pins[i])+pinCenterY(model,model.pins[i+1]))/2-8;
  addKnot(9500+i,'wildcard',leftEdge-KNOT_SIDE_OFFSET-KNOT_X_STEP,y);
}
for(let i=0;i<outputs.length-1;i++){
  const a=model.pins[inputs.length+i], b=model.pins[inputs.length+i+1];
  const y=(pinCenterY(model,a)+pinCenterY(model,b))/2-8;
  addKnot(9600+i,'wildcard',rightEdge+KNOT_SIDE_OFFSET+KNOT_X_STEP,y);
}
const comment=createComment(`COLLAPSED PIN TEST: 4 inputs / 5 outputs; port Knot offset ${KNOT_SIDE_OFFSET}px; inter-port Knot +${KNOT_X_STEP}px outward; vertical pin pitch ${PIN_ROW_H}px`, {x:-96,y:-160}, width+320, 420);
const text=[generateUEText([comment]),comp,...knots.map(k=>generateUEText([k]))].join('\n\n')+'\n';
const out='sweep/collapsed-knot-4x5-test.txt';
fs.writeFileSync(out,text);
console.log(`wrote ${out} (${text.length} bytes); inputs=${inputs.length}, outputs=${outputs.length}, looseKnots=${knots.length}, width=${width}`);
