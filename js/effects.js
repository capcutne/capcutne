/* ============================================================
   EFFECTS ENGINE v1.0
   Effect Library + Stack Engine for CapCut Clone
   ============================================================ */
'use strict';

/* ----------------------------------------------------------
   EFFECT STACK FUNCTIONS
   (EFFECT_LIBRARY defined in capcut.html)
   ---------------------------------------------------------- */

function composeEffectStack(clip){
  if(!clip.effects||!clip.effects.length) return '';
  return clip.effects.map(eff=>{
    if(typeof EFFECT_LIBRARY==='undefined') return '';
    const def=EFFECT_LIBRARY.find(e=>e.id===eff.id);
    if(!def||!def.apply) return '';
    const t=(eff.intensity!==undefined?eff.intensity:60)/100;
    try{ return def.apply(eff.params||{},t); }catch(e){ return ''; }
  }).filter(Boolean).join(' ');
}

function getEffectById(id){
  if(typeof EFFECT_LIBRARY==='undefined') return null;
  return EFFECT_LIBRARY.find(e=>e.id===id)||null;
}

function addEffectToClip(clipId,effectId){
  if(typeof findClip!=='function') return;
  const found=findClip(clipId);
  if(!found) return;
  const {clip}=found;
  const def=getEffectById(effectId);
  if(!def){ toast&&toast('Hiệu ứng không tồn tại'); return; }
  if(!clip.effects) clip.effects=[];
  /* default params from library definition */
  const params={};
  Object.entries(def.params||{}).forEach(([k,v])=>{ params[k]=v.default||0; });
  saveState&&saveState();
  clip.effects.push({id:effectId,name:def.name,intensity:60,params});
  renderAll&&renderAll();
  updateRightInfo&&updateRightInfo();
  toast&&toast('Đã thêm "'+def.name+'" → clip (stack: '+clip.effects.length+')');
}

function removeEffectFromClip(clipId,idx){
  if(typeof findClip!=='function') return;
  const found=findClip(clipId);
  if(!found) return;
  const {clip}=found;
  if(!clip.effects) return;
  saveState&&saveState();
  clip.effects.splice(idx,1);
  renderAll&&renderAll();
  updateRightInfo&&updateRightInfo();
}

function moveEffectInStack(clipId,fromIdx,toIdx){
  if(typeof findClip!=='function') return;
  const found=findClip(clipId);
  if(!found) return;
  const {clip}=found;
  if(!clip.effects) return;
  const arr=clip.effects;
  if(fromIdx<0||fromIdx>=arr.length||toIdx<0||toIdx>=arr.length) return;
  saveState&&saveState();
  const [item]=arr.splice(fromIdx,1);
  arr.splice(toIdx,0,item);
  renderAll&&renderAll();
  updateRightInfo&&updateRightInfo();
}

function setEffectIntensity(clipId,idx,val){
  if(typeof findClip!=='function') return;
  const found=findClip(clipId);
  if(!found) return;
  const {clip}=found;
  if(!clip.effects||!clip.effects[idx]) return;
  clip.effects[idx].intensity=parseInt(val);
  if(typeof _applyClipFilter==='function') _applyClipFilter(clip);
}

function setEffectParam(clipId,idx,paramKey,val){
  if(typeof findClip!=='function') return;
  const found=findClip(clipId);
  if(!found) return;
  const {clip}=found;
  if(!clip.effects||!clip.effects[idx]) return;
  clip.effects[idx].params=clip.effects[idx].params||{};
  clip.effects[idx].params[paramKey]=parseFloat(val);
  if(typeof _applyClipFilter==='function') _applyClipFilter(clip);
}

/* ----------------------------------------------------------
   DRAG & DROP — Effect Library → Timeline Clip
   ---------------------------------------------------------- */
function onEffectDragStart(event,effectId){
  event.dataTransfer.setData('application/x-effect-id',effectId);
  event.dataTransfer.effectAllowed='copy';
  /* visual ghost */
  const ghost=document.createElement('div');
  ghost.textContent='+ '+effectId;
  ghost.style.cssText='position:fixed;top:-100px;left:0;background:var(--accent,#e8c840);color:#000;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;pointer-events:none';
  document.body.appendChild(ghost);
  event.dataTransfer.setDragImage(ghost,40,15);
  setTimeout(()=>ghost.remove(),0);
}

function dropEffectOnClip(event,clipId){
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.classList.remove('drag-over');
  const effectId=event.dataTransfer.getData('application/x-effect-id');
  if(effectId){
    addEffectToClip(clipId,effectId);
  }
}

/* ----------------------------------------------------------
   EFFECT STACK INSPECTOR — renders into right panel
   ---------------------------------------------------------- */
function renderEffectStackInspector(clip){
  const effects=clip.effects||[];
  if(!effects.length){
    return `<div class="ps-empty">
      <div style="font-size:20px;margin-bottom:6px">✨</div>
      Chưa có hiệu ứng nào.<br>
      Kéo hiệu ứng từ thư viện<br>vào clip trên timeline.
    </div>`;
  }
  return effects.map((eff,idx)=>{
    const def=getEffectById(eff.id);
    const intensity=eff.intensity!==undefined?eff.intensity:60;
    const params=eff.params||{};
    const paramRows=def?Object.entries(def.params||{}).map(([k,v])=>`
      <div class="prop-row" style="margin-top:2px">
        <span class="prop-lbl" style="font-size:10px;color:var(--t3)">${v.label||k}</span>
        <input type="range" class="prop-sl" min="${v.min||0}" max="${v.max||100}" step="1"
          value="${params[k]!==undefined?params[k]:v.default||0}"
          oninput="setEffectParam('${clip.id}',${idx},'${k}',this.value);this.nextElementSibling.textContent=parseFloat(this.value).toFixed(0)">
        <span class="prop-val" style="font-size:10px">${parseFloat(params[k]!==undefined?params[k]:v.default||0).toFixed(0)}</span>
      </div>`).join(''):'';
    return `<div class="fx-stack-item">
      <div class="fx-stack-header">
        <span class="fx-stack-icon">${def?def.icon:'✨'}</span>
        <span class="fx-stack-name">${eff.name||eff.id}</span>
        <div class="fx-stack-order">
          <button title="Lên" onclick="moveEffectInStack('${clip.id}',${idx},${idx-1})" ${idx===0?'disabled':''}>▲</button>
          <button title="Xuống" onclick="moveEffectInStack('${clip.id}',${idx},${idx+1})" ${idx===effects.length-1?'disabled':''}>▼</button>
        </div>
        <button class="fx-stack-del" onclick="removeEffectFromClip('${clip.id}',${idx})" title="Xóa">✕</button>
      </div>
      <div class="prop-row" style="margin-top:5px">
        <span class="prop-lbl">Cường độ</span>
        <input type="range" class="prop-sl" min="0" max="100" value="${intensity}"
          oninput="setEffectIntensity('${clip.id}',${idx},this.value);this.nextElementSibling.textContent=this.value+'%'">
        <span class="prop-val">${intensity}%</span>
      </div>
      ${paramRows}
    </div>`;
  }).join('<div class="fx-stack-sep"></div>');
}

console.log('[EffectsEngine] v1.0 loaded — Effect Library + Stack Engine ready');
