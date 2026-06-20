/* ============================================================
   TRANSITIONS ENGINE v1.0
   Transition Library + Inspector for CapCut Clone
   ============================================================ */
'use strict';

/* Currently selected transition node (stores clip.id of LEFT clip) */
var selectedTransition=null;

/* ----------------------------------------------------------
   LIBRARY HELPERS
   (TRANSITION_LIBRARY defined in capcut.html)
   ---------------------------------------------------------- */
function getTransitionById(id){
  if(typeof TRANSITION_LIBRARY==='undefined') return {id:'none',name:'Không',icon:'✖️',directions:[]};
  return TRANSITION_LIBRARY.find(t=>t.id===id)||TRANSITION_LIBRARY[0];
}

/* ----------------------------------------------------------
   SELECT — click a transition diamond node in timeline
   ---------------------------------------------------------- */
function selectTransitionNode(clipId,event){
  if(event){event.preventDefault();event.stopPropagation();}
  selectedTransition=clipId;
  if(typeof selected!=='undefined') selected.clear();
  if(typeof renderAll==='function') renderAll();
  _showTransitionInspector(clipId);
}

/* ----------------------------------------------------------
   APPLY — set/update/remove a transition on a clip
   ---------------------------------------------------------- */
function applyTransitionToClip(clipId,transId,dur,direction){
  if(typeof findClip!=='function') return;
  const found=findClip(clipId);
  if(!found) return;
  const {clip}=found;
  saveState&&saveState();
  if(!transId||transId==='none'){
    delete clip.transition;
  } else {
    clip.transition={
      name:transId,
      dur:Math.max(0.1,parseFloat(dur)||0.5),
      direction:direction||''
    };
  }
  if(typeof renderAll==='function') renderAll();
  _showTransitionInspector(clipId);
}

/* ----------------------------------------------------------
   INSPECTOR — renders transition controls into right panel
   ---------------------------------------------------------- */
function _showTransitionInspector(clipId){
  if(typeof findClip!=='function') return;
  const found=findClip(clipId);
  if(!found){selectedTransition=null;return;}
  const {clip}=found;
  const t=clip.transition||{name:'none',dur:0.5,direction:''};
  const def=getTransitionById(t.name);

  /* update right-panel header */
  const nameEl=document.getElementById('ic-name');
  const durEl=document.getElementById('ic-dur');
  const typeEl=document.getElementById('ic-type');
  if(nameEl) nameEl.textContent='Chuyển cảnh';
  if(durEl)  durEl.textContent=(t.dur||0.5).toFixed(1)+'s';
  if(typeEl) typeEl.innerHTML='<span class="badge-v" style="background:rgba(99,180,255,.15);color:#63b4ff;border:1px solid rgba(99,180,255,.25)">Transition</span>';

  const body=document.getElementById('rp-body');
  if(!body) return;

  const TL=typeof TRANSITION_LIBRARY!=='undefined'?TRANSITION_LIBRARY:[];

  /* direction buttons */
  const dirButtons=(def.directions&&def.directions.length)?`
    <div class="prop-row" style="margin-top:8px;align-items:flex-start">
      <span class="prop-lbl">Hướng</span>
      <div style="display:flex;gap:4px;flex-wrap:wrap" id="tn-dir-row">
        ${def.directions.map(d=>`
          <button class="sp-o${(t.direction||'')===(d)?' on':''}"
            style="padding:4px 8px;font-size:11px"
            onclick="this.closest('#tn-dir-row,div').querySelectorAll('.sp-o').forEach(x=>x.classList.remove('on'));this.classList.add('on');applyTransitionToClip('${clipId}','${t.name}',document.getElementById('tn-dur-sl').value/10,'${d}')">
            ${_dirLabel(d)}
          </button>`).join('')}
      </div>
    </div>`:'';

  body.innerHTML=`
  <div class="ps">
    <div class="ps-title">Loại chuyển cảnh</div>
    <div class="eff-grid" style="grid-template-columns:repeat(4,1fr);gap:4px" id="tn-type-grid">
      ${TL.map(tr=>`
        <div class="eff-item${tr.id===(t.name||'none')?' on':''}"
          style="padding:6px 2px 4px;font-size:10px;cursor:pointer"
          onclick="document.querySelectorAll('#tn-type-grid .eff-item').forEach(x=>x.classList.remove('on'));this.classList.add('on');applyTransitionToClip('${clipId}','${tr.id}',document.getElementById('tn-dur-sl').value/10,'${(tr.directions&&tr.directions[0])||''}')">
          <span class="eff-icon" style="font-size:14px">${tr.icon}</span>${tr.name}
        </div>`).join('')}
    </div>
  </div>
  <div class="ps-div"></div>
  <div class="ps">
    <div class="ps-title">Tùy chỉnh</div>
    <div class="prop-row">
      <span class="prop-lbl">Thời lượng</span>
      <input type="range" class="prop-sl" id="tn-dur-sl"
        min="1" max="50" value="${Math.round((t.dur||0.5)*10)}"
        oninput="document.getElementById('tn-dur-v').textContent=(this.value/10).toFixed(1)+'s';applyTransitionToClip('${clipId}','${t.name||'none'}',this.value/10,'${t.direction||''}')">
      <span class="prop-val" id="tn-dur-v">${(t.dur||0.5).toFixed(1)}s</span>
    </div>
    ${dirButtons}
  </div>
  <div class="ps-div"></div>
  <div class="ps">
    <div class="info-card" style="font-size:11px;color:var(--t3);line-height:1.5;margin-bottom:8px">
      💡 Chuyển cảnh xuất hiện giữa hai clip liền kề. Thời lượng tính từ điểm kết thúc clip trái.
    </div>
    <button class="add-ov-btn" style="width:100%;background:rgba(255,80,80,.12);color:#ff7070;border:1px solid rgba(255,80,80,.25)"
      onclick="applyTransitionToClip('${clipId}','none',0.5,'');selectedTransition=null;renderAll()">
      🗑 Xóa chuyển cảnh
    </button>
  </div>`;
}

/* ----------------------------------------------------------
   HELPERS
   ---------------------------------------------------------- */
function _dirLabel(d){
  const map={
    left:'◀ Trái',right:'▶ Phải',
    up:'▲ Lên',down:'▼ Xuống',
    'in':'⊕ Phóng to','out':'⊖ Thu nhỏ',
    cw:'↻ Xuôi',ccw:'↺ Ngược'
  };
  return map[d]||d;
}

console.log('[TransitionsEngine] v1.0 loaded — Transition Library + Inspector ready');
