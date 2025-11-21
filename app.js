// app.js — enhanced client-side prototype
const STATE = {
  mode: 'driver',
  driverStops: [],
  riderPoints: [],
  ridesKey: 'ride_demo_rides_v3',
  theme: localStorage.getItem('theme') || 'light'
};

document.documentElement.setAttribute('data-theme', STATE.theme);

// Map init
const map = L.map('map').setView([20.59,78.96],5);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);

// UI refs
const modeEl = document.getElementById('mode');
const stopsList = document.getElementById('stopsList');
const publishBtn = document.getElementById('publish');
const clearBtn = document.getElementById('clear');
const searchBtn = document.getElementById('search');
const outputEl = document.getElementById('output');
const bottomSheet = document.getElementById('bottomSheet');
const sheetContent = document.getElementById('sheetContent');
const closeSheet = document.getElementById('closeSheet');
const toggleTheme = document.getElementById('toggleTheme');
const dateEl = document.getElementById('date');

// helpers
const toFixed = (n,d=4)=>Number(n.toFixed(d));
function loadRides(){ try{ return JSON.parse(localStorage.getItem(STATE.ridesKey)||'[]') }catch(e){return []} }
function saveRides(r){ localStorage.setItem(STATE.ridesKey, JSON.stringify(r)) }

// draw helpers
let driverMarkers = [], driverLine=null, riderMarkers=[];

function renderDriver(){
  driverMarkers.forEach(m=>map.removeLayer(m)); driverMarkers=[];
  if(driverLine){ map.removeLayer(driverLine); driverLine=null; }
  STATE.driverStops.forEach((s,i)=>{ driverMarkers.push(L.circleMarker(s,{radius:6,color:'#007bff'}).addTo(map).bindTooltip('Stop '+(i+1))) });
  if(STATE.driverStops.length>1){ driverLine = L.polyline(STATE.driverStops,{color:'#007bff',weight:4}).addTo(map) }
  renderStopsList();
}
function renderRider(){
  riderMarkers.forEach(m=>map.removeLayer(m)); riderMarkers=[];
  STATE.riderPoints.forEach((p,i)=> riderMarkers.push(L.circleMarker(p,{radius:7,color:'#ff4444'}).addTo(map).bindTooltip(i===0?'Pickup':'Dropoff')));
}

// stops list UI with simple reorder
function renderStopsList(){
  stopsList.innerHTML='';
  STATE.driverStops.forEach((s,i)=>{
    const item = document.createElement('div'); item.className='stopItem';
    const label = document.createElement('div'); label.className='stopLabel'; label.textContent = `${i+1}. ${toFixed(s.lat,4)}, ${toFixed(s.lng,4)}`;
    const actions = document.createElement('div');
    const up = document.createElement('button'); up.className='iconBtn'; up.innerHTML='<span class="material-icons">arrow_upward</span>'; up.onclick=()=>{ if(i>0){ STATE.driverStops.splice(i-1,0,STATE.driverStops.splice(i,1)[0]); renderDriver(); } };
    const down = document.createElement('button'); down.className='iconBtn'; down.innerHTML='<span class="material-icons">arrow_downward</span>'; down.onclick=()=>{ if(i<STATE.driverStops.length-1){ STATE.driverStops.splice(i+1,0,STATE.driverStops.splice(i,1)[0]); renderDriver(); } };
    const rm = document.createElement('button'); rm.className='iconBtn'; rm.innerHTML='<span class="material-icons">delete</span>'; rm.onclick=()=>{ STATE.driverStops.splice(i,1); renderDriver(); };
    actions.appendChild(up); actions.appendChild(down); actions.appendChild(rm);
    item.appendChild(label); item.appendChild(actions); stopsList.appendChild(item);
  });
}

// map click
map.on('click', e=>{
  const p = {lat:e.latlng.lat, lng:e.latlng.lng};
  if(STATE.mode==='driver'){
    if(STATE.driverStops.length>=12){ alert('Max 12 stops for prototype'); return }
    STATE.driverStops.push(p); renderDriver();
  } else {
    if(STATE.riderPoints.length<2){ STATE.riderPoints.push([p.lat,p.lng]); renderRider(); } else { STATE.riderPoints=[ [p.lat,p.lng] ]; renderRider(); }
  }
});

// UI events
modeEl.addEventListener('change', e=>{ STATE.mode=e.target.value });
clearBtn.addEventListener('click', ()=>{ STATE.driverStops=[]; STATE.riderPoints=[]; renderDriver(); renderRider(); outputEl.textContent=''; sheetContent.innerHTML=''; hideSheet(); });
publishBtn.addEventListener('click', ()=>{
  if(STATE.driverStops.length<2){ alert('Add at least origin + destination'); return }
  const rides = loadRides();
  const ride = { id: 'ride_'+Date.now(), stops: STATE.driverStops.slice(), scheduledAt: dateEl.value? new Date(dateEl.value).getTime(): null };
  rides.push(ride); saveRides(rides); alert('Ride saved to localStorage (demo)');
});
searchBtn.addEventListener('click', ()=>{
  if(STATE.riderPoints.length<2){ alert('Set pickup & dropoff by clicking map'); return }
  const rides = loadRides();
  const tolerance = 500; // meters
  const results = [];
  rides.forEach(r=>{
    if(!r.stops || r.stops.length<2) return;
    const pProj = projectOntoPolyline({lat:STATE.riderPoints[0][0], lng:STATE.riderPoints[0][1]}, r.stops.map(s=>({lat:s.lat||s[0],lng:s.lng||s[1]})));
    const dProj = projectOntoPolyline({lat:STATE.riderPoints[1][0], lng:STATE.riderPoints[1][1]}, r.stops.map(s=>({lat:s.lat||s[0],lng:s.lng||s[1]})));
    if(pProj && dProj && pProj.distanceMeters<=tolerance && dProj.distanceMeters<=tolerance && pProj.tAlong < dProj.tAlong){
      results.push({ride:r, pDist:Math.round(pProj.distanceMeters), dDist:Math.round(dProj.distanceMeters)});
    }
  });
  if(results.length===0){ outputEl.textContent='No matches found.'; sheetContent.innerHTML='No matches'; showSheet(); return }
  outputEl.textContent = JSON.stringify(results,null,2);
  sheetContent.innerHTML = '';
  results.forEach(res=>{
    const el = document.createElement('div'); el.className='stopItem';
    el.innerHTML = `<div><strong>Ride</strong><div class='small muted'>pickup ${res.pDist}m • drop ${res.dDist}m</div></div>`;
    const btn = document.createElement('button'); btn.className='btn primary'; btn.textContent='Show'; btn.onclick=()=>{ showRideOnMap(res.ride) };
    el.appendChild(btn); sheetContent.appendChild(el);
  });
  showSheet();
});

// bottom sheet helpers
function showSheet(){ bottomSheet.classList.remove('hidden'); bottomSheet.setAttribute('aria-hidden','false'); }
function hideSheet(){ bottomSheet.classList.add('hidden'); bottomSheet.setAttribute('aria-hidden','true'); }
document.getElementById('closeSheet').addEventListener('click', hideSheet);

// show ride on map
function showRideOnMap(ride){
  if(window.tempLayer) map.removeLayer(window.tempLayer);
  const latlngs = ride.stops.map(s=>[s.lat||s[0],s.lng||s[1]]);
  window.tempLayer = L.polyline(latlngs,{color:'#22c55e',weight:5}).addTo(map);
  map.fitBounds(window.tempLayer.getBounds(),{padding:[40,40]});
}

// theme toggle
toggleTheme.addEventListener('click', ()=>{
  STATE.theme = STATE.theme==='light'?'dark':'light';
  document.documentElement.setAttribute('data-theme', STATE.theme);
  localStorage.setItem('theme', STATE.theme);
});

// projection math (similar to canvas version)
function pointToSegmentDistance(px,py, x1,y1,x2,y2){
  const dx = x2-x1, dy = y2-y1;
  if(dx===0 && dy===0) return [Math.hypot(px-x1,py-y1),0];
  const t = ((px-x1)*dx + (py-y1)*dy)/(dx*dx+dy*dy);
  if(t<0) return [Math.hypot(px-x1,py-y1),0];
  if(t>1) return [Math.hypot(px-x2,py-y2),1];
  const projx = x1 + t*dx, projy = y1 + t*dy;
  return [Math.hypot(px-projx,py-projy), t];
}
function projectOntoPolyline(point, latlngs){
  if(latlngs.length<2) return null;
  const R = 6371000;
  function toXY(lat,lng){ const x = lng*Math.PI/180 * R * Math.cos(lat*Math.PI/180); const y = lat*Math.PI/180 * R; return [x,y] }
  const pts = latlngs.map(p=>toXY(p.lat,p.lng));
  const pXY = toXY(point.lat, point.lng);
  const segLen=[]; let total=0;
  for(let i=0;i<pts.length-1;i++){ const d = Math.hypot(pts[i+1][0]-pts[i][0], pts[i+1][1]-pts[i][1]); segLen.push(d); total+=d }
  if(total===0) return {distanceMeters: Math.hypot(pXY[0]-pts[0][0], pXY[1]-pts[0][1]), tAlong:0, segIndex:0}
  let best = {distance:Infinity, cumBefore:0, segIndex:0, tSeg:0}; let cum=0;
  for(let i=0;i<pts.length-1;i++){
    const [dist, tSeg] = pointToSegmentDistance(pXY[0],pXY[1], pts[i][0],pts[i][1], pts[i+1][0],pts[i+1][1]);
    if(dist < best.distance){ best = {distance:dist, segIndex:i, tSeg:tSeg, cumBefore:cum} }
    cum += segLen[i];
  }
  const distMeters = best.distance;
  const tAlong = (best.cumBefore + best.tSeg*segLen[best.segIndex]) / total;
  return {distanceMeters: distMeters, tAlong: tAlong, segIndex: best.segIndex};
}

// initial render
renderDriver(); renderRider();
