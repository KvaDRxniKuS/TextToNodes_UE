// UE Blueprint Parser — standalone ES module
// Парсит Begin Object ... End Object → графы
// Используется и в браузере (index.html) и в Node для валидации LLM ответов

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
      width:180, height:80, title:'', varName:null, funcName:null, operationName:null, commentText:''
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
        const linkedMatch=pinStr.match(/LinkedTo=\(([^)]*)\)/);
        let linked=[]; if(linkedMatch){
          const inside=linkedMatch[1].trim();
          if(inside) inside.split(',').map(s=>s.trim()).filter(Boolean).forEach(p=>{
            const tok=p.split(/\s+/).filter(Boolean); if(tok.length>=2) linked.push({nodeName:tok[0], pinId:tok[1]});
          });
        }
        node.pins.push({id:pinId,name:pinName, friendly:pinName, direction:dir.includes('Output')?'Output':'Input', category:cat, subCategory:sub, hidden, linkedTo:linked});
      } else if(t.startsWith('VariableReference=')){ const m=t.match(/MemberName="([^"]+)"/); if(m) node.varName=m[1]; }
      else if(t.startsWith('FunctionReference=')){ const m=t.match(/MemberName="([^"]+)"/); if(m) node.funcName=m[1]; }
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

export function generateUEText(nodeList){
  if(!nodeList.length) return '';
  return nodeList.map(n=>{
    let block=n.rawBlock;
    if(!block){
      block=generateBlock(n);
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

function generateBlock(n){
  const guid=n.guid||guid32();
  const pinsText=n.pins.map(p=>{
    const dir=p.direction==='Output'?`Direction="EGPD_Output",`:'';
    const linked=p.linkedTo.length?`LinkedTo=(${p.linkedTo.map(l=> l.nodeName+' '+l.pinId).join(',')},)`:'';
    return `   CustomProperties Pin (PinId=${p.id},PinName="${p.name}",${dir}PinType.PinCategory="${p.category}",PinType.PinSubCategory="${p.subCategory||''}",PinType.PinSubCategoryObject=None,PinType.PinSubCategoryMemberReference=(),PinType.PinValueType=(),PinType.ContainerType=None,PinType.bIsReference=False,PinType.bIsConst=False,PinType.bIsWeakPointer=False,PinType.bIsUObjectWrapper=False,PinType.bSerializeAsSinglePrecisionFloat=False,PersistentGuid=00000000000000000000000000000000,bHidden=${p.hidden?'True':'False'},bNotConnectable=False,bDefaultValueIsReadOnly=False,bDefaultValueIsIgnored=False,bAdvancedView=False,bOrphanedPin=False,${linked})`;
  }).join('\n');
  let extra='';
  if(n.varName) extra+=`   VariableReference=(MemberName="${n.varName}",MemberGuid=${guid.slice(0,8)}${guid.slice(8,12)}${guid.slice(12,16)}${guid.slice(16,20)}${guid.slice(20,32)},bSelfContext=True)\n`;
  if(n.funcName) extra+=`   FunctionReference=(MemberName="${n.funcName}",MemberGuid=${guid.slice(0,8)}${guid.slice(8,12)}${guid.slice(12,16)}${guid.slice(16,20)}${guid.slice(20,32)},bSelfContext=True)\n`;
  if(n.operationName) extra+=`   OperationName="${n.operationName}"\n   bDefaultsToPureFunc=True\n   FunctionReference=(MemberParent="/Script/CoreUObject.Class'/Script/Engine.KismetMathLibrary'",MemberName="${n.operationName}_DoubleDouble")\n`;
  if(n.isComment) return `Begin Object Class=${n.rawClass} Name="${n.id}" ExportPath="/Script/UnrealEd.EdGraphNode_Comment'/Game/Generated.Generated:EventGraph.${n.id}'"\n   NodePosX=${Math.round(n.pos.x)}\n   NodePosY=${Math.round(n.pos.y)}\n   NodeWidth=${n.width}\n   NodeHeight=${n.height}\n   NodeComment="${n.commentText}"\n   NodeGuid=${guid}\nEnd Object`;
  const cls=n.rawClass||`/Script/BlueprintGraph.${n.className.split('.').pop()}`;
  return `Begin Object Class=${cls} Name="${n.id}" ExportPath="/Script/BlueprintGraph.${n.className.split('.').pop()}'/Game/Generated.Generated:EventGraph.${n.id}'"\n${extra}   NodePosX=${Math.round(n.pos.x)}\n   NodePosY=${Math.round(n.pos.y)}\n   NodeGuid=${guid}\n${pinsText}\nEnd Object`;
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
