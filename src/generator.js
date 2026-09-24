// Generator helpers for AI
import { guid32 } from './parser.js';

export function createVariableGet(varName, pos={x:0,y:0}){
  return {
    id: `K2Node_VariableGet_${Math.floor(Math.random()*900+100)}`,
    className:'BlueprintGraph.K2Node_VariableGet',
    rawClass:'/Script/BlueprintGraph.K2Node_VariableGet',
    guid:guid32(), pos, varName, title:`Get ${varName}`,
    pins:[
      {id:guid32(), name:varName, direction:'Output', category:'real', subCategory:'double', hidden:false, linkedTo:[]},
      {id:guid32(), name:'self', direction:'Input', category:'object', hidden:true, linkedTo:[]}
    ]
  };
}

export function createBranch(pos){
  return {
    id:`K2Node_IfThenElse_${Math.floor(Math.random()*900+100)}`,
    className:'BlueprintGraph.K2Node_IfThenElse',
    rawClass:'/Script/BlueprintGraph.K2Node_IfThenElse',
    guid:guid32(), pos, title:'Branch',
    pins:[
      {id:guid32(), name:'execute', direction:'Input', category:'exec', hidden:false, linkedTo:[]},
      {id:guid32(), name:'Condition', direction:'Input', category:'bool', hidden:false, linkedTo:[]},
      {id:guid32(), name:'then', direction:'Output', category:'exec', hidden:false, linkedTo:[]},
      {id:guid32(), name:'else', direction:'Output', category:'exec', hidden:false, linkedTo:[]}
    ]
  };
}

export function linkPins(fromNode, fromPinName, toNode, toPinName){
  const fp=fromNode.pins.find(p=> p.name===fromPinName && p.direction==='Output');
  const tp=toNode.pins.find(p=> p.name===toPinName && p.direction==='Input');
  if(!fp || !tp) throw new Error(`Pin not found: ${fromPinName} -> ${toPinName}`);
  fp.linkedTo.push({nodeName: toNode.id, pinId: tp.id});
  tp.linkedTo.push({nodeName: fromNode.id, pinId: fp.id});
}
