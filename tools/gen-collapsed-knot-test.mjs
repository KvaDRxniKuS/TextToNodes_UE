#!/usr/bin/env node
// Reproducible 3-in/3-out collapsed Blueprint node plus loose reroute geometry probes.
// Port row step = 16 px. Per port row: one side knot, one midpoint knot, one opposite-side knot.
import fs from 'node:fs';
import { createKnot, createComment, estNodeWidth, pinCenterY, KNOT_X_STEP, PIN_ROW_H } from '../src/generator.js';
import { generateUEText, guid32 } from '../src/parser.js';

const OBJ = `"/Script/CoreUObject.Class'/Script/EnhancedInput.EnhancedInputSubsystemInterface'"`;
const ZERO = '00000000000000000000000000000000';
const pinLine = ({id=guid32(), name, direction='Input', cat='interface', subObj=cat==='interface'?OBJ:'None'}) =>
  `         CustomProperties Pin (PinId=${id},PinName="${name}",${direction==='Output'?'Direction="EGPD_Output",':''}PinType.PinCategory="${cat}",PinType.PinSubCategory="",PinType.PinSubCategoryObject=${subObj},PinType.PinSubCategoryMemberReference=(),PinType.PinValueType=(),PinType.ContainerType=None,PinType.bIsReference=False,PinType.bIsConst=False,PinType.bIsWeakPointer=False,PinType.bIsUObjectWrapper=False,PinType.bSerializeAsSinglePrecisionFloat=False,PersistentGuid=${ZERO},bHidden=False,bNotConnectable=False,bDefaultValueIsReadOnly=False,bDefaultValueIsIgnored=False,bAdvancedView=False,bOrphanedPin=False,)`;
const udPin = (name, direction, cat) =>
  `         CustomProperties UserDefinedPin (PinName="${name}",PinType=(PinCategory="${cat}"${cat==='interface'?`,PinSubCategoryObject=${OBJ}`:''}),DesiredPinDirection=${direction})`;
const specs = [
  {name:'InputPin', dir:'EGPD_Output', cat:'exec'},
  {name:'InputPin2', dir:'EGPD_Output', cat:'interface'},
  {name:'InputPin3', dir:'EGPD_Output', cat:'interface'},
];
const outs = [
  {name:'OutputPin', dir:'EGPD_Input', cat:'exec'},
  {name:'OutputPin2', dir:'EGPD_Input', cat:'interface'},
  {name:'OutputPin3', dir:'EGPD_Input', cat:'interface'},
];
const ids = Object.fromEntries([...specs,...outs].map(p=>[p.name,guid32()]));
const externalInputs = specs.map(p=>pinLine({id:ids[p.name],name:p.name,cat:p.cat})).join('\n');
const externalOutputs = outs.map(p=>pinLine({id:ids[p.name],name:p.name,direction:'Output',cat:p.cat})).join('\n');
const tunnel0Pins = specs.map(p=>pinLine({id:guid32(),name:p.name,direction:'Output',cat:p.cat})).join('\n');
const tunnel1Pins = outs.map(p=>pinLine({id:guid32(),name:p.name,cat:p.cat})).join('\n');
const userInputs = specs.map(p=>udPin(p.name,p.dir,p.cat)).join('\n');
const userOutputs = outs.map(p=>udPin(p.name,p.dir,p.cat)).join('\n');
const comp = `Begin Object Class=/Script/BlueprintGraph.K2Node_Composite Name="K2Node_Composite_9000"
   Begin Object Class=/Script/Engine.EdGraph Name="CollapsedGraph"
      Begin Object Class=/Script/BlueprintGraph.K2Node_Tunnel Name="K2Node_Tunnel_0"
      End Object
      Begin Object Class=/Script/BlueprintGraph.K2Node_Tunnel Name="K2Node_Tunnel_1"
      End Object
   End Object
   Begin Object Name="CollapsedGraph"
      Begin Object Name="K2Node_Tunnel_0"
         bCanHaveOutputs=True
         NodePosX=160
         NodePosY=0
         NodeGuid=${guid32()}
${tunnel0Pins}
${userInputs}
      End Object
      Begin Object Name="K2Node_Tunnel_1"
         bCanHaveInputs=True
         NodePosX=640
         NodePosY=0
         NodeGuid=${guid32()}
${tunnel1Pins}
${userOutputs}
      End Object
      Schema="/Script/BlueprintGraph.EdGraphSchema_K2"
      Nodes(0)="/Script/BlueprintGraph.K2Node_Tunnel'K2Node_Tunnel_0'"
      Nodes(1)="/Script/BlueprintGraph.K2Node_Tunnel'K2Node_Tunnel_1'"
      GraphGuid=${guid32()}
   End Object
   BoundGraph="/Script/Engine.EdGraph'CollapsedGraph'"
   OutputSourceNode="/Script/BlueprintGraph.K2Node_Tunnel'CollapsedGraph.K2Node_Tunnel_1'"
   InputSinkNode="/Script/BlueprintGraph.K2Node_Tunnel'CollapsedGraph.K2Node_Tunnel_0'"
   NodePosX=0
   NodePosY=0
   bCanRenameNode=True
   NodeGuid=${guid32()}
${externalInputs}
${externalOutputs}
End Object`;

// Requested pattern: for every corresponding input/output row, place 3 loose knots:
// one 16px left of the input edge, one midway between ports, one 16px right of output edge.
const compositeModel={className:'BlueprintGraph.K2Node_Composite',title:'Collapsed Graph',pos:{x:0,y:0},pins:[
  ...specs.map(p=>({name:p.name,direction:'Input',category:p.cat,hidden:false})),
  ...outs.map(p=>({name:p.name,direction:'Output',category:p.cat,hidden:false})),
]};
const rightEdge=estNodeWidth(compositeModel), midX=rightEdge/2;
const probes=[];
for(let i=0;i<3;i++){
  const cat=specs[i].cat, sub=cat==='interface'?OBJ:undefined;
  const rowPin=compositeModel.pins[i];
  const y=pinCenterY(compositeModel,rowPin)-8; // Knot center exactly matches the calculated pin center
  for(const [kind,x] of [['input-side',-KNOT_X_STEP],['middle',midX],['output-side',rightEdge+KNOT_X_STEP]]){
    const k=createKnot({x,y},cat);
    k.id=`K2Node_Knot_${9100+i*3+['input-side','middle','output-side'].indexOf(kind)}`;
    k.guid=guid32();
    if(sub) for(const p of k.pins) p.subCategoryObject=sub;
    probes.push(k);
  }
}
const comment=createComment(`COLLAPSED 3×3 PIN-ROW TEST — 9 loose Knot probes; side offset ±${KNOT_X_STEP}px; vertical pin pitch ${PIN_ROW_H}px`, {x:-96,y:-160}, rightEdge+192, 300);
const text=[generateUEText([comment]),comp,...probes.map(k=>generateUEText([k]))].join('\n\n')+'\n';
const out='sweep/collapsed-knot-3x3-test.txt';
fs.writeFileSync(out,text);
console.log(`wrote ${out} (${text.length} bytes), composite pins=3 in/3 out, loose knots=${probes.length}`);
