#!/usr/bin/env node
// Bound custom dispatcher probe after user creates NewEventDispatcher_Probe in BP_AISupportTester.
// Spatial order follows execution: start -> Add -> Call -> Remove -> Clear.
import fs from 'node:fs';
import { mkPin, layoutPinChain } from '../src/generator.js';
import { createCustomEvent } from '../src/modules.js';
import { generateUEText, guid32 } from '../src/parser.js';
import { validateStrict } from '../src/validate.js';

const bp = `"/Script/Engine.BlueprintGeneratedClass'/Game/Blueprints/BP_AISupportTester.BP_AISupportTester_C'"`;
const dispatcher='NewEventDispatcher_Probe';
const dispatcherGuid='073EE614EED927BA45E99D9984BCAF70';
const signatureGuid='901C1E11766DF5CC94200F263776D2F8';
const startName='DispatcherProbeBoundStart';
function make(short,id,x,rawProps=[],pins=[],y=0) {
  return {id,className:`BlueprintGraph.${short}`,rawClass:`/Script/BlueprintGraph.${short}`,title:short,guid:guid32(),pos:{x,y},rawProps,pins};
}
const exec=(name,dir)=>mkPin(name,dir,'exec');
const self=()=>mkPin('self','Input','object',{subObj:bp});
function ref(){return [`DelegateReference=(MemberName="${dispatcher}",MemberGuid=${dispatcherGuid},bSelfContext=True)`];}
function delegatePin(){
  const p=mkPin('Delegate','Input','delegate',{memberRef:`MemberParent=${bp},MemberName="${dispatcher}__DelegateSignature",MemberGuid=${signatureGuid}`,ref:true,const:true});
  p.pinFriendlyName={namespace:'K2Node',key:'PinFriendlyDelegatetName',text:'Event'};
  return p;
}
const start=make('K2Node_CustomEvent','K2Node_CustomEvent_3000',0,[`CustomFunctionName="${startName}"`],[
  mkPin('OutputDelegate','Output','delegate',{memberRef:`MemberName="${startName}"`}),exec('then','Output')
]);
const add=make('K2Node_AddDelegate','K2Node_AddDelegate_3002',0,ref(),[exec('execute','Input'),exec('then','Output'),self(),delegatePin()]);
const call=make('K2Node_CallDelegate','K2Node_CallDelegate_3001',0,ref(),[exec('execute','Input'),exec('then','Output'),self()]);
const remove=make('K2Node_RemoveDelegate','K2Node_RemoveDelegate_3003',0,ref(),[exec('execute','Input'),exec('then','Output'),self(),delegatePin()]);
const clear=make('K2Node_ClearDelegate','K2Node_ClearDelegate_3004',0,ref(),[exec('execute','Input'),exec('then','Output'),self()]);
layoutPinChain([start,add,call,remove,clear],{x0:0,y0:0,gap:120});
const handler=createCustomEvent('DispatcherProbeHandler',[],{x:add.pos.x,y:add.pos.y+160});
const handlerDelegate=handler.pins.find(p=>p.name==='OutputDelegate');
handlerDelegate.memberRef=`MemberParent=${bp},MemberName="DispatcherProbeHandler",MemberGuid=${handler.guid}`;
function link(a,out,b,input){const p=a.pins.find(x=>x.name===out),q=b.pins.find(x=>x.name===input);p.linkedTo.push({nodeName:b.id,pinId:q.id});q.linkedTo.push({nodeName:a.id,pinId:p.id});}
link(start,'then',add,'execute'); link(add,'then',call,'execute'); link(call,'then',remove,'execute'); link(remove,'then',clear,'execute');
link(handler,'OutputDelegate',add,'Delegate'); link(handler,'OutputDelegate',remove,'Delegate');
const text=generateUEText([start,add,call,remove,clear,handler])+'\n';
const v=validateStrict(text);
fs.writeFileSync('sweep/dispatcher-probe-bound.txt',text);
console.log(`wrote sweep/dispatcher-probe-bound.txt (${text.length} bytes); nodes=6; exec links=4; delegate links=2; errors=${v.errors.length}, warnings=${v.warnings.length}`);
v.errors.forEach(e=>console.log('  ERROR:',e));v.warnings.forEach(e=>console.log('  WARNING:',e));
if(v.errors.length)process.exitCode=1;
