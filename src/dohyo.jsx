import { useState, useEffect, useRef } from "react";

const COLORS       = ["#4ade80", "#60a5fa", "#f97316", "#e879f9", "#facc15", "#2dd4bf", "#f87171", "#a78bfa"];
const COLORS_LIGHT = ["#16a34a", "#2563eb", "#c2410c", "#9333ea", "#ca8a04", "#0d9488", "#dc2626", "#7c3aed"];

// ─── PRELOADED COURSES (shared with SWS) ─────────────────────────────────────
const PRESET_COURSES = [
  { id:"laguna-classic", name:"Laguna National", tee:"Classic (Black)", holes:[
    {par:4,si:12},{par:4,si:4},{par:5,si:2},{par:3,si:16},
    {par:4,si:8},{par:4,si:10},{par:3,si:18},{par:4,si:14},
    {par:5,si:6},{par:4,si:5},{par:3,si:15},{par:4,si:1},
    {par:5,si:11},{par:5,si:7},{par:4,si:17},{par:4,si:9},
    {par:3,si:13},{par:4,si:3},
  ]},
  { id:"laguna-masters", name:"Laguna National", tee:"Masters (Blue)", holes:[
    {par:4,si:15},{par:5,si:1},{par:4,si:9},{par:4,si:13},
    {par:3,si:17},{par:4,si:3},{par:5,si:5},{par:3,si:11},
    {par:4,si:7},{par:4,si:16},{par:5,si:2},{par:3,si:18},
    {par:4,si:12},{par:4,si:10},{par:5,si:8},{par:4,si:4},
    {par:3,si:14},{par:4,si:6},
  ]},
  { id:"horizon-hills", name:"Horizon Hills", tee:"Blue", holes:[
    {par:4,si:11},{par:5,si:1},{par:3,si:15},{par:4,si:17},
    {par:4,si:13},{par:5,si:5},{par:4,si:3},{par:3,si:9},
    {par:4,si:7},{par:4,si:10},{par:4,si:6},{par:3,si:14},
    {par:5,si:16},{par:4,si:2},{par:4,si:8},{par:4,si:18},
    {par:3,si:12},{par:5,si:4},
  ]},
  { id:"nsrcc-changi", name:"NSRCC Changi", tee:"Blue", holes:[
    {par:4,si:4},{par:5,si:2},{par:5,si:10},{par:4,si:6},
    {par:4,si:8},{par:3,si:16},{par:4,si:12},{par:4,si:14},
    {par:3,si:18},{par:4,si:11},{par:4,si:1},{par:3,si:17},
    {par:4,si:3},{par:5,si:5},{par:3,si:15},{par:4,si:9},
    {par:4,si:13},{par:5,si:7},
  ]},
  { id:"sembawang", name:"Sembawang CC", tee:"Composite 18", holes:[
    {par:4,si:11},{par:5,si:1},{par:5,si:3},{par:4,si:13},
    {par:4,si:5},{par:4,si:9},{par:3,si:17},{par:4,si:7},
    {par:3,si:15},{par:4,si:12},{par:5,si:2},{par:5,si:4},
    {par:4,si:14},{par:4,si:6},{par:4,si:10},{par:3,si:18},
    {par:4,si:8},{par:3,si:16},
  ]},
];

// ─── COMPUTATION ─────────────────────────────────────────────────────────────
function nassauStrokeSIs(strokes, siList) {
  if (strokes === 0) return { p1: new Set(), p2: new Set() };
  var n = Math.abs(strokes);
  var sorted = siList.slice().sort(function(a,b){return a-b;});
  var set = new Set(sorted.slice(0,n));
  return strokes > 0 ? { p1: new Set(), p2: set } : { p1: set, p2: new Set() };
}
function buildStrokeMaps(matchup, holes) {
  var fSIs = holes.slice(0,9).map(function(h){return h.si;});
  var bSIs = holes.slice(9,18).map(function(h){return h.si;});
  return { front: nassauStrokeSIs(matchup.strokesFront, fSIs), back: nassauStrokeSIs(matchup.strokesBack, bSIs) };
}
function strokesForHole(hi, si, maps) {
  var map = hi < 9 ? maps.front : maps.back;
  return { p1: map.p1.has(si) ? 1 : 0, p2: map.p2.has(si) ? 1 : 0 };
}
function computeNassau(matchup, gross, holes, inPlay) {
  var p1i = matchup.p1, p2i = matchup.p2;
  var maps = buildStrokeMaps(matchup, holes);
  var holeWL = Array(18).fill(0);
  for (var hi = 0; hi < 18; hi++) {
    if (!inPlay[hi]) continue;
    var g1 = parseInt(gross[hi][p1i], 10), g2 = parseInt(gross[hi][p2i], 10);
    if (isNaN(g1)||isNaN(g2)||g1<=0||g2<=0) continue;
    var si = holes[hi].si, par = holes[hi].par;
    var strk = strokesForHole(hi, si, maps);
    var cap = par === 3 ? par+3 : par+4;
    var n1 = Math.min(g1-strk.p1, cap), n2 = Math.min(g2-strk.p2, cap);
    if (n1 < n2) holeWL[hi] = 1; else if (n2 < n1) holeWL[hi] = -1;
  }
  function seg(s, e) {
    var status = 0, hp = 0;
    for (var i = s; i <= e; i++) {
      if (!inPlay[i]) continue;
      var g1 = parseInt(gross[i][p1i],10), g2 = parseInt(gross[i][p2i],10);
      if (isNaN(g1)||isNaN(g2)||g1<=0||g2<=0) continue;
      status += holeWL[i]; hp++;
    }
    return { status: status, holesPlayed: hp };
  }
  return { front: seg(0,8), back: seg(9,17), overall: seg(0,17), presses: [], holeWL: holeWL, strokeMaps: maps };
}
function nassauDollars(matchup, front, back, overall) {
  var stake = matchup.stake;
  var units = matchup.units || [1,1,2];
  var fd = (front.status===0||units[0]===0) ? 0 : front.status>0 ? stake*units[0] : -stake*units[0];
  var bd = (back.status===0||units[1]===0)  ? 0 : back.status>0  ? stake*units[1] : -stake*units[1];
  var od = (overall.status===0||units[2]===0)? 0 : overall.status>0 ? stake*units[2] : -stake*units[2];
  return { frontDollars:fd, backDollars:bd, overallDollars:od, net:fd+bd+od };
}
function computeGDB9(matchup, gross, holes, inPlay, startHi) {
  var p1i = matchup.p1, p2i = matchup.p2;
  var maps = buildStrokeMaps(matchup, holes);
  var holeWL = [];
  for (var hi = startHi; hi <= startHi+8; hi++) {
    if (!inPlay[hi]) { holeWL.push(0); continue; }
    var g1 = parseInt(gross[hi][p1i],10), g2 = parseInt(gross[hi][p2i],10);
    if (isNaN(g1)||isNaN(g2)||g1<=0||g2<=0) { holeWL.push(0); continue; }
    var strk = strokesForHole(hi, holes[hi].si, maps);
    var cap = holes[hi].par===3 ? holes[hi].par+3 : holes[hi].par+4;
    var n1 = Math.min(g1-strk.p1,cap), n2 = Math.min(g2-strk.p2,cap);
    holeWL.push(n1<n2?1:n2<n1?-1:0);
  }
  var playedIdx = [];
  for (var i = 0; i < 9; i++) {
    if (inPlay[startHi+i]) {
      var g1 = parseInt(gross[startHi+i][p1i],10), g2 = parseInt(gross[startHi+i][p2i],10);
      if (!isNaN(g1)&&!isNaN(g2)&&g1>0&&g2>0) playedIdx.push(i);
    }
  }
  var hp = playedIdx.length, gs = 0, gbh = [];
  for (var i = 0; i < hp; i++) { gs += holeWL[playedIdx[i]]; gbh.push(gs); }
  var dormieIdx = null, buyIdx = null;
  for (var i = 0; i < hp; i++) {
    var rem = 9-(i+1);
    if (Math.abs(gbh[i])===rem && rem>0 && dormieIdx===null) dormieIdx=i+1;
    if (Math.abs(gbh[i])>rem && buyIdx===null) buyIdx=i+1;
  }
  var dormie = null, buy = null;
  if (dormieIdx!==null && dormieIdx<hp) {
    var ds=0; for(var i=dormieIdx;i<hp;i++) ds+=holeWL[playedIdx[i]];
    dormie={status:ds,holesPlayed:hp-dormieIdx,startHole:startHi+playedIdx[dormieIdx]+1};
  }
  if (buyIdx!==null && buyIdx<hp) {
    var bs=0; for(var i=buyIdx;i<hp;i++) bs+=holeWL[playedIdx[i]];
    buy={status:bs,holesPlayed:hp-buyIdx,startHole:startHi+playedIdx[buyIdx]+1};
  }
  return { game:{status:gs,holesPlayed:hp}, dormie:dormie, buy:buy, holeWL:holeWL, holesPlayed:hp, gameByHole:gbh, playedIdx:playedIdx, startHi:startHi };
}
function computeGDB(matchup, gross, holes, inPlay) {
  return { front:computeGDB9(matchup,gross,holes,inPlay,0), back:computeGDB9(matchup,gross,holes,inPlay,9), strokeMaps:buildStrokeMaps(matchup,holes) };
}
function gdbDollars(matchup, front, back) {
  var stake = matchup.stake;
  function s9(seg) {
    if (!seg) return { gameDollars:0, dormieDollars:0, buyDollars:0, net:0 };
    var gd = seg.game.status===0?0:seg.game.status>0?stake*3:-stake*3;
    var dd = (!seg.dormie||seg.dormie.status===0)?0:seg.dormie.status>0?stake:-stake;
    var bd = (!seg.buy||seg.buy.status===0)?0:seg.buy.status>0?stake:-stake;
    return { gameDollars:gd, dormieDollars:dd, buyDollars:bd, net:gd+dd+bd };
  }
  var f=s9(front), b=s9(back);
  return { front:f, back:b, net:f.net+b.net };
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
var TCSS = `
  .dm{--bg:#0a1a0a;--card:#0d2210;--input:#071507;--border:#1e3a1e;--border2:#2a5a2a;--text:#e8f5e8;--muted:#5a8a5a;--dim:#4a7a4a;--neg:#f87171;--accent:#4ade80;}
  .lm{--bg:#fff;--card:#eee;--input:#fff;--border:#ccc;--border2:#888;--text:#000;--muted:#333;--dim:#555;--neg:#c00;--accent:#16a34a;}
  *{box-sizing:border-box;}
  input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;}
  input[type=number]{-moz-appearance:textfield;}
`;
var S = {
  inp:  {background:"var(--input)",border:"1px solid var(--border)",borderRadius:8,color:"var(--text)",padding:"10px 12px",fontSize:15,outline:"none"},
  sel:  {background:"var(--input)",border:"1px solid var(--border)",borderRadius:6,color:"var(--text)",padding:"6px 8px",fontSize:14,cursor:"pointer",outline:"none"},
  th:   {padding:"8px 6px",color:"var(--dim)",fontWeight:"500",textAlign:"center",fontSize:11},
  td:   {padding:"7px 4px",textAlign:"center",color:"var(--muted)",fontSize:13},
  btn:  {width:"100%",padding:"16px",background:COLORS[0],color:"#000",border:"none",borderRadius:10,cursor:"pointer",fontSize:18,fontWeight:"bold"},
  cBtn: {padding:"12px",background:"var(--card)",color:"var(--accent)",border:"1px solid var(--border2)",borderRadius:8,cursor:"pointer",fontSize:13},
  pm:   {width:40,height:40,background:"transparent",border:"none",color:"var(--accent)",cursor:"pointer",fontSize:22,display:"flex",alignItems:"center",justifyContent:"center"},
};
function ext(base, extra) { return Object.assign({}, base, extra); }

// ─── LOGO ─────────────────────────────────────────────────────────────────────
function DohyoLogo({ size }) {
  var s = size || 48;
  var c = s / 2;
  var ringR = s * 0.43;
  var tawaraW = s * 0.032;
  var h = s * 0.30;
  var w = h * 0.11;
  var gap = h * 0.68;
  var cupR = w * 2.2;
  var topY = c - h * 0.48;
  var tipY = topY + h;
  var lx = c - gap/2 - w/2;
  var rx = c + gap/2 + w/2;
  function tee(cx) {
    var stemPath =
      "M "+(cx-w*0.5)+" "+topY+
      " L "+(cx+w*0.5)+" "+topY+
      " L "+(cx+w*0.14)+" "+tipY+
      " L "+(cx-w*0.14)+" "+tipY+" Z";
    var rimL=cx-cupR, rimR=cx+cupR, dip=topY+cupR*0.45;
    var cupPath =
      "M "+rimL+" "+topY+
      " C "+(cx-cupR*0.5)+","+topY+" "+cx+","+dip+" "+cx+","+dip+
      " C "+cx+","+dip+" "+(cx+cupR*0.5)+","+topY+" "+rimR+","+topY+
      " L "+rimR+","+(topY+cupR*0.22)+
      " C "+(cx+cupR*0.5)+","+(topY+cupR*0.22)+" "+cx+","+(dip+cupR*0.22)+" "+cx+","+(dip+cupR*0.22)+
      " C "+cx+","+(dip+cupR*0.22)+" "+(cx-cupR*0.5)+","+(topY+cupR*0.22)+" "+rimL+","+(topY+cupR*0.22)+" Z";
    return [stemPath, cupPath];
  }
  var lt = tee(lx), rt = tee(rx);
  return (
    <svg width={s} height={s} viewBox={"0 0 "+s+" "+s}>
      <rect width={s} height={s} rx={s*0.16} fill="#0a0a0a"/>
      <circle cx={c} cy={c} r={ringR+tawaraW} fill="#1a1006"/>
      <circle cx={c} cy={c} r={ringR} fill="none" stroke="#d4a843" strokeWidth={tawaraW}/>
      <circle cx={c} cy={c} r={ringR-tawaraW*0.5} fill="#211608"/>
      <path d={lt[0]} fill="#ffffff"/>
      <path d={lt[1]} fill="#ffffff"/>
      <path d={rt[0]} fill="#ffffff"/>
      <path d={rt[1]} fill="#ffffff"/>
    </svg>
  );
}


// ─── VOICE ───────────────────────────────────────────────────────────────────
var _cachedVoice = null;
function getPreferredVoice() {
  if (_cachedVoice) return _cachedVoice;
  if (!window.speechSynthesis) return null;
  var voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  var male = voices.find(function(v){ return v.lang.startsWith("en") && /daniel|alex|fred|tom|bruce|ralph|albert/i.test(v.name); })
          || voices.find(function(v){ return v.lang.startsWith("en") && !/samantha|victoria|karen|moira|tessa|fiona|zoe|kate/i.test(v.name); })
          || voices.find(function(v){ return v.lang.startsWith("en"); });
  if (male) _cachedVoice = male;
  return male || null;
}
// Trigger voice loading as early as possible
if (window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = function(){ getPreferredVoice(); };
  getPreferredVoice();
}

function RevealHoles(props) {
  var r = props.result, m = props.matchup;
  var players = props.players, refHoles = props.refHoles, isLight = props.isLight;
  var CP = props.COLORS_P, gfn = props.globalFirstNine;
  var onDone = props.onDone, onBack = props.onBack, matchupIdx = props.matchupIdx;

  var playOrder = gfn === "back"
    ? [9,10,11,12,13,14,15,16,17,0,1,2,3,4,5,6,7,8]
    : [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17];

  var pp = useState(0);  var playPos = pp[0], setPlayPos = pp[1];
  var sn = useState(false); var showNett = sn[0], setShowNett = sn[1];
  var dn = useState(false); var done = dn[0], setDone = dn[1];
  var pa = useState(false); var paused = pa[0], setPaused = pa[1];
  var ao = useState(true);  var audioOn = ao[0], setAudioOn = ao[1];
  var wa = useState(false); var waiting = wa[0], setWaiting = wa[1];
  var sh = useState(false); var showHalftime = sh[0], setShowHalftime = sh[1];
  var ap = useState(false); var autoPlay = ap[0], setAutoPlay = ap[1];
  var speechFired = useRef({});

  if (!r || !m) return null;
  var holes = refHoles || Array.from({length:18}, function(_,i){return{par:4,si:i+1};});
  var p1 = players[m.p1], p2 = players[m.p2];
  var p1col = CP(m.p1), p2col = CP(m.p2);
  var isGDB = m.type === "gdb";
  var adjSecond = r.adjSecond != null ? r.adjSecond : (gfn==="front" ? m.strokesBack : m.strokesFront);
  var syn = {
    p1:0, p2:1,
    strokesFront: gfn==="front" ? m.strokesFront : adjSecond,
    strokesBack:  gfn==="front" ? adjSecond : m.strokesBack,
    stake:m.stake, units:m.units||[1,1,2], pressMode:"off"
  };
  var strokeMaps = buildStrokeMaps(syn, holes);

  var holeData = holes.map(function(h, hi) {
    var g1=p1.scores[hi]||0, g2=p2.scores[hi]||0;
    if (!(g1>0&&g2>0)) return {hi:hi,h:h,g1:g1,g2:g2,inPlay:false,wl:0,strk:{p1:0,p2:0},n1:g1,n2:g2};
    var strk=strokesForHole(hi,h.si,strokeMaps);
    var cap=h.par===3?h.par+3:h.par+4;
    var n1=Math.min(g1-strk.p1,cap), n2=Math.min(g2-strk.p2,cap);
    var seg=hi<9?r.front:r.back;
    var relIdx=hi<9?hi:hi-9;
    var wl = (seg && seg.holeWL && seg.holeWL[relIdx] != null) ? seg.holeWL[relIdx] : (n1<n2?1:n2<n1?-1:0);
    return {hi:hi,h:h,g1:g1,g2:g2,inPlay:true,wl:wl,strk:strk,n1:n1,n2:n2};
  });

  var rs=0, rsCum=0, runningArr=[], runningCum=[];
  for (var pos=0; pos<18; pos++) {
    var hi=playOrder[pos];
    if (pos===9) rs=0;
    if (holeData[hi].inPlay) { rs+=holeData[hi].wl; rsCum+=holeData[hi].wl; }
    runningArr.push(rs); runningCum.push(rsCum);
  }

  var holeIdx = playOrder[playPos];
  var current = holeData[holeIdx];
  var statusDisp = runningArr[playPos] || 0;
  var statusCum  = runningCum[playPos] || 0;
  var statusAfter = isGDB ? statusDisp : statusCum;
  var isFirstNineBound = playPos === 8;
  var hasStroke = current.inPlay && (current.strk.p1>0 || current.strk.p2>0);
  var fnLabel = gfn==="front" ? "Front 9" : "Back 9";
  var snLabel = gfn==="front" ? "Back 9"  : "Front 9";

  function speak(text) {
    if (!audioOn || !window.speechSynthesis) return Promise.resolve();
    return new Promise(function(resolve) {
      var warm = new SpeechSynthesisUtterance('\u200B'); warm.volume=0; window.speechSynthesis.speak(warm);
      var u = new SpeechSynthesisUtterance(text); u.rate=1.0; u.lang="en-US";
      var voice = getPreferredVoice();
      if (voice) u.voice = voice;
      var fb = setTimeout(resolve, Math.max(2000, text.length*60));
      u.onend  = function(){ clearTimeout(fb); resolve(); };
      u.onerror= function(){ clearTimeout(fb); resolve(); };
      window.speechSynthesis.speak(u);
    });
  }

  useEffect(function(){
    setShowNett(false);
    speechFired.current = {};
  }, [playPos]);

  useEffect(function(){
    if (!autoPlay || !waiting || done || paused || showHalftime) return;
    var t = setTimeout(function(){
      setWaiting(false);
      setPlayPos(function(p){return p+1;});
    }, 2500);
    return function(){ clearTimeout(t); };
  }, [autoPlay, waiting, done, paused, showHalftime]);

  useEffect(function(){
    if (!current.inPlay || !hasStroke) return;
    var t = setTimeout(function(){ setShowNett(true); }, 800);
    return function(){ clearTimeout(t); };
  }, [playPos]);

  useEffect(function(){
    if (done || paused || waiting || showHalftime) return;
    var key = playPos + "-" + audioOn;
    if (speechFired.current[key]) return;
    speechFired.current[key] = true;
    window.speechSynthesis && window.speechSynthesis.cancel();
    var cancelled = false;
    function delay(ms){ return new Promise(function(res){ setTimeout(res, ms); }); }
    (async function(){
      try {
        var d = current; var text = "";
        if (d.inPlay && hasStroke) {
          if (audioOn) await speak("Hole " + (d.hi+1) + ". ");
          if (cancelled) return; await delay(600); if (cancelled) return;
        } else { text = "Hole " + (d.hi+1) + ". "; }
        if (d.inPlay) {
          var s1 = d.strk.p1>0 ? p1.name+" nett "+d.n1 : p1.name+" "+d.g1;
          var s2 = d.strk.p2>0 ? p2.name+" nett "+d.n2 : p2.name+" "+d.g2;
          text += s1+", "+s2+". ";
          text += d.wl===0 ? "Half. " : (d.wl>0?p1.name:p2.name)+" wins. ";
          if (isGDB) {
            var gdbSeg = d.hi<9 ? r.front : r.back;
            text += statusAfter===0 ? "Square. " : (statusAfter>0?p1.name:p2.name)+" "+Math.abs(statusAfter)+" up. ";
            // Dormie declared this hole
            if (gdbSeg && gdbSeg.dormie && gdbSeg.dormie.startHole === d.hi+2) {
              text += "Dormie in play. ";
            }
            // Bye declared this hole
            if (gdbSeg && gdbSeg.buy && gdbSeg.buy.startHole === d.hi+2) {
              text += "Bye in play. ";
            }
            // Dormie sub-status once active
            if (gdbSeg && gdbSeg.dormie && d.hi+1 >= gdbSeg.dormie.startHole) {
              var isBack = d.hi>=9, relHi = isBack?d.hi-9:d.hi;
              var dRelStart = gdbSeg.dormie.startHole-1-(isBack?9:0);
              var ds=0; for(var di=dRelStart;di<=relHi;di++) ds+=(gdbSeg.holeWL&&gdbSeg.holeWL[di]!=null)?gdbSeg.holeWL[di]:0;
              if (ds===0) text += "Dormie all square. ";
              else text += "Dormie "+(ds>0?p1.name:p2.name)+" "+Math.abs(ds)+" up. ";
            }
            // Bye sub-status once active
            if (gdbSeg && gdbSeg.buy && d.hi+1 >= gdbSeg.buy.startHole) {
              var isBack = d.hi>=9, relHi = isBack?d.hi-9:d.hi;
              var bRelStart = gdbSeg.buy.startHole-1-(isBack?9:0);
              var bs=0; for(var bi=bRelStart;bi<=relHi;bi++) bs+=(gdbSeg.holeWL&&gdbSeg.holeWL[bi]!=null)?gdbSeg.holeWL[bi]:0;
              if (bs===0) text += "Bye all square. ";
              else text += "Bye "+(bs>0?p1.name:p2.name)+" "+Math.abs(bs)+" up. ";
            }
          } else {
            text += statusAfter===0 ? "Square. " : (statusAfter>0?p1.name:p2.name)+" "+Math.abs(statusAfter)+" up. ";
          }
        } else { text += "No score. "; }
        if (isFirstNineBound) {
          text += statusAfter===0 ? "All square "+fnLabel+". " : (statusAfter>0?p1.name:p2.name)+" "+Math.abs(statusAfter)+" up after "+fnLabel+". ";
          var adj2 = r.adjSecond != null ? r.adjSecond : (gfn==="front" ? m.strokesBack : m.strokesFront);
          if (adj2===0) { text += snLabel+" scratch. "; }
          else {
            var gvr = adj2>0?p1:p2, rcvr = adj2>0?p2:p1;
            text += snLabel+": "+gvr.name+" gives "+rcvr.name+" "+Math.abs(adj2)+" stroke"+(Math.abs(adj2)!==1?"s":"")+". ";
          }
        }
        if (audioOn) await speak(text); else await delay(800);
        if (cancelled) return;
        if (playPos < 17) {
          if (isFirstNineBound) { setShowHalftime(true); }
          else { setWaiting(true); }
        } else {
          var net = r.dollars.net, tb = Math.abs(net)/(m.stake||1);
          var ot = net===0 ? "Match all square." : (net>0?p2.name:p1.name)+" pays "+(net>0?p1.name:p2.name)+" "+tb+" "+(tb===1?"ball":"balls")+".";
          if (audioOn) await speak(ot); else await delay(800);
          if (!cancelled) setDone(true);
        }
      } catch(e) { console.error(e); if (!cancelled && playPos<17) setWaiting(true); }
    })();
    return function(){ cancelled = true; };
  }, [playPos, done, paused, waiting, showHalftime, audioOn]);

  var statusColor = statusDisp===0?(isLight?"#555":"#888"):statusDisp>0?p1col:p2col;

  return (
    <div style={{minHeight:"100vh",background:isLight?"#f0f0f0":"#000",color:isLight?"#000":"#fff",display:"flex",flexDirection:"column"}}>
      {/* Top header — match info only */}
      <div style={{background:isLight?"#e0e0e0":"#111",padding:"10px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:isLight?"1px solid #ccc":"1px solid #333"}}>
        <button onClick={function(){window.speechSynthesis&&window.speechSynthesis.cancel();onBack();}} style={{background:"transparent",border:"none",color:isLight?"#16a34a":"#4ade80",cursor:"pointer",fontSize:15,minWidth:60}}>← Back</button>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:14,fontWeight:"700",letterSpacing:2,color:isLight?"#16a34a":"#4ade80"}}>MATCH {matchupIdx+1} · {isGDB?"GDB":"NASSAU"}</div>
          <div style={{fontSize:12,color:isLight?"#333":"#aaa"}}>
            <span style={{color:p1col}}>{p1.name}</span> vs <span style={{color:p2col}}>{p2.name}</span>
          </div>
        </div>
        <div style={{minWidth:60}}/>
      </div>
      <div style={{background:isLight?"#d8d8d8":"#0a0a0a",borderBottom:isLight?"1px solid #bbb":"1px solid #222",padding:"12px 16px"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
          <div style={{fontSize:36,color:"#fff",lineHeight:1,fontWeight:"700"}}>{current.hi+1}</div>
          <div>
            <div style={{fontSize:12,color:isLight?"#333":"#aaa",letterSpacing:2}}>
              {holeIdx<9 ? (gfn==="front"?"FRONT 9 — 1ST NINE":"FRONT 9 — 2ND NINE") : (gfn==="back"?"BACK 9 — 1ST NINE":"BACK 9 — 2ND NINE")}
            </div>
            <div style={{fontSize:13,color:isLight?"#333":"#aaa"}}>Par {current.h.par} · SI {current.h.si}</div>
          </div>
          <div style={{flex:1,display:"flex",flexDirection:"column",gap:3,alignItems:"flex-end"}}>
            {[0,1].map(function(nine){
              return (
                <div key={nine} style={{display:"flex",gap:2}}>
                  {Array.from({length:9},function(_,i){
                    var pos=nine*9+i;
                    return <div key={i} style={{width:11,height:11,borderRadius:"50%",background:pos<playPos?(isLight?"#16a34a":"#4ade80"):pos===playPos?(isLight?"#000":"#fff"):(isLight?"#ccc":"#333")}}/>;
                  })}
                </div>
              );
            })}
          </div>
        </div>
        {current.inPlay ? (
          <div style={{display:"flex",gap:10}}>
            {[
              {p:p1,col:p1col,g:current.g1,n:current.n1,strk:current.strk.p1,wl:current.wl===1},
              {p:p2,col:p2col,g:current.g2,n:current.n2,strk:current.strk.p2,wl:current.wl===-1}
            ].map(function(item,idx){
              return (
                <div key={idx} style={{flex:1,background:item.wl&&showNett?(isLight?"#d4f0d4":"#0d2a0d"):(isLight?"#e0e0e0":"#111"),border:"2px solid "+(item.wl&&showNett?item.col:(isLight?"#ccc":"#333")),borderRadius:10,padding:"10px 8px",textAlign:"center"}}>
                  <div style={{fontSize:12,fontWeight:"700",color:item.col,marginBottom:2}}>
                    {item.p.name}{item.strk>0 && <span style={{fontSize:9,color:"#f97316",marginLeft:3}}>+{item.strk}</span>}
                  </div>
                  <div style={{fontSize:44,fontWeight:"700",lineHeight:1,color:showNett?(item.wl?item.col:(isLight?"#000":"#fff")):(item.strk>0?"#f97316":(isLight?"#000":"#fff"))}}>
                    {showNett||!hasStroke ? (item.strk>0?item.n:item.g) : item.g}
                  </div>
                  {item.strk>0 && <div style={{fontSize:10,color:showNett?(isLight?"#333":"#aaa"):"#f97316",marginTop:2}}>{showNett?"nett "+item.n:"gross "+item.g}</div>}
                  {item.wl && showNett && <div style={{fontSize:10,color:item.col,marginTop:4,fontWeight:"700"}}>▲ WINS</div>}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{color:isLight?"#333":"#aaa",fontSize:14,textAlign:"center",padding:"10px 0"}}>No scores</div>
        )}
        <div style={{marginTop:8,padding:"8px 12px",background:isLight?"#d8d8d8":"#0a0a0a",borderTop:isLight?"1px solid #bbb":"1px solid #222",fontSize:13,color:isLight?"#333":"#aaa",textAlign:"center"}}>
          {(function(){
            var strokes = playPos<9 ? (gfn==="front"?m.strokesFront:m.strokesBack) : (r.adjSecond!=null?r.adjSecond:(gfn==="front"?m.strokesBack:m.strokesFront));
            var label = playPos<9 ? fnLabel : snLabel;
            if (strokes===0) return <span>{label} · <span style={{color:isLight?"#333":"#aaa"}}>Scratch</span></span>;
            var gvr=strokes>0?p1:p2, rcvr=strokes>0?p2:p1, gc=strokes>0?p1col:p2col, rc=strokes>0?p2col:p1col;
            return <span>{label} · <span style={{color:gc,fontWeight:"700"}}>{gvr.name}</span><span style={{color:isLight?"#333":"#aaa"}}> gives </span><span style={{color:rc,fontWeight:"700"}}>{rcvr.name}</span><span style={{color:"#f97316",fontWeight:"700",fontSize:18,marginLeft:6}}>{Math.abs(strokes)}</span></span>;
          })()}
        </div>
      </div>
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"16px 24px",overflowY:"auto"}}>
        <div style={{textAlign:"center",marginBottom:8}}>
          <div style={{fontSize:12,color:isLight?"#333":"#aaa",letterSpacing:2,marginBottom:4}}>{isGDB?"GAME":"MATCH"}</div>
          <div style={{fontSize:32,fontWeight:"700",color:statusColor,letterSpacing:1}}>
            {statusDisp===0 ? "ALL SQUARE" : (statusDisp>0?p1.name:p2.name)+" "+Math.abs(statusDisp)+" UP"}
          </div>
        </div>
        {isGDB && (function(){
          var gdbSeg = holeIdx<9 ? r.front : r.back;
          if (!gdbSeg) return null;
          var dormieDeclared = gdbSeg.dormie && holeIdx+1 === gdbSeg.dormie.startHole-1;
          var dormieActive   = gdbSeg.dormie && holeIdx+1 >= gdbSeg.dormie.startHole;
          var byeDeclared    = gdbSeg.buy && holeIdx+1 === gdbSeg.buy.startHole-1;
          var byeActive      = gdbSeg.buy && holeIdx+1 >= gdbSeg.buy.startHole;
          if (!dormieDeclared && !dormieActive && !byeDeclared && !byeActive) return null;
          function getDormieStatus(seg, hi) {
            if (!seg || !seg.dormie) return 0;
            var isBack=hi>=9, relHi=isBack?hi-9:hi, relStart=seg.dormie.startHole-1-(isBack?9:0);
            var ds=0; for(var i=relStart;i<=relHi;i++) ds+=(seg.holeWL&&seg.holeWL[i])?seg.holeWL[i]:0; return ds;
          }
          function getByeStatus(seg, hi) {
            if (!seg || !seg.buy) return 0;
            var isBack=hi>=9, relHi=isBack?hi-9:hi, relStart=seg.buy.startHole-1-(isBack?9:0);
            var bs=0; for(var i=relStart;i<=relHi;i++) bs+=(seg.holeWL&&seg.holeWL[i])?seg.holeWL[i]:0; return bs;
          }
          var dormieStatus = dormieActive ? getDormieStatus(gdbSeg, holeIdx) : 0;
          var byeStatus    = byeActive    ? getByeStatus(gdbSeg, holeIdx)    : 0;
          return (
            <div style={{display:"flex",gap:10,marginTop:8,flexWrap:"wrap",justifyContent:"center"}}>
              {(dormieDeclared||dormieActive) && (
                <div style={{background:"#0d1a0d",border:"1px solid #4ade80",borderRadius:8,padding:"8px 14px",textAlign:"center",minWidth:100}}>
                  <div style={{fontSize:9,color:"#4ade80",letterSpacing:2,fontWeight:"700",marginBottom:4}}>DORMIE</div>
                  {dormieDeclared
                    ? <div style={{fontSize:13,color:"#4ade80"}}>Declared</div>
                    : <div style={{fontSize:16,fontWeight:"700",color:dormieStatus===0?(isLight?"#555":"#888"):dormieStatus>0?p1col:p2col}}>
                        {dormieStatus===0?"Square":(dormieStatus>0?p1.name:p2.name)+" "+Math.abs(dormieStatus)+" up"}
                      </div>
                  }
                </div>
              )}
              {(byeDeclared||byeActive) && (
                <div style={{background:"#1a0d00",border:"1px solid #f97316",borderRadius:8,padding:"8px 14px",textAlign:"center",minWidth:100}}>
                  <div style={{fontSize:9,color:"#f97316",letterSpacing:2,fontWeight:"700",marginBottom:4}}>BYE</div>
                  {byeDeclared
                    ? <div style={{fontSize:13,color:"#f97316"}}>Declared</div>
                    : <div style={{fontSize:16,fontWeight:"700",color:byeStatus===0?(isLight?"#555":"#888"):byeStatus>0?p1col:p2col}}>
                        {byeStatus===0?"Square":(byeStatus>0?p1.name:p2.name)+" "+Math.abs(byeStatus)+" up"}
                      </div>
                  }
                </div>
              )}
            </div>
          );
        })()}
        {paused && !done && (
          <div style={{marginTop:20,textAlign:"center"}}>
            <button onClick={function(){setPaused(false);}} style={{padding:"12px 28px",background:"#f97316",color:"#000",border:"none",borderRadius:10,cursor:"pointer",fontSize:16,fontWeight:"700"}}>▶ RESUME</button>
          </div>
        )}
        {waiting && !done && !paused && !showHalftime && (
          <div style={{marginTop:20,textAlign:"center"}}>
            <button onClick={function(){setWaiting(false);setPlayPos(function(p){return p+1;});}}
              style={{padding:"14px 36px",background:"#4ade80",color:"#000",border:"none",borderRadius:10,cursor:"pointer",fontSize:18,fontWeight:"700",letterSpacing:2}}>
              {playPos===17 ? "FINISH →" : "HOLE "+(playOrder[playPos+1]+1)+" →"}
            </button>
          </div>
        )}
        {showHalftime && (
          <div style={{marginTop:16,width:"100%",maxWidth:360}}>
            <div style={{textAlign:"center",marginBottom:16}}>
              <div style={{fontSize:12,color:isLight?"#333":"#aaa",letterSpacing:2,marginBottom:4}}>{fnLabel.toUpperCase()} COMPLETE</div>
              <div style={{fontSize:36,fontWeight:"700",color:statusDisp===0?(isLight?"#555":"#888"):statusDisp>0?p1col:p2col}}>
                {statusDisp===0?"ALL SQUARE":(statusDisp>0?p1.name:p2.name)+" "+Math.abs(statusDisp)+" UP"}
              </div>
            </div>
            <div style={{background:isLight?"#e0e0e0":"#111",border:isLight?"1px solid #ccc":"1px solid #333",borderRadius:10,padding:"12px 14px",marginBottom:16}}>
              <div style={{fontSize:12,color:isLight?"#333":"#aaa",letterSpacing:2,marginBottom:8}}>{snLabel.toUpperCase()} STROKES</div>
              {(function(){
                var adj = r.adjSecond!=null ? r.adjSecond : (gfn==="front"?m.strokesBack:m.strokesFront);
                var orig = gfn==="front" ? m.strokesBack : m.strokesFront;
                var firstNineStrokes = gfn==="front" ? m.strokesFront : m.strokesBack;
                var delta = adj - orig;
                if (adj===0) return (
                  <div>
                    <div style={{fontSize:16,color:isLight?"#555":"#888"}}>Scratch</div>
                    <div style={{fontSize:12,color:isLight?"#555":"#888",marginTop:5}}>
                      2nd nine: {Math.abs(orig)} stroke{Math.abs(orig)!==1?"s":""}
                      {orig!==0
                        ? <span style={{color:"#4ade80",fontWeight:"700",marginLeft:6}}>→ 0 (▼{Math.abs(orig)} adjusted)</span>
                        : <span style={{color:isLight?"#333":"#aaa",marginLeft:6}}>· no adjustment</span>
                      }
                    </div>
                  </div>
                );
                var gvr=adj>0?p1:p2, rcvr=adj>0?p2:p1;
                return (
                  <div>
                    <div style={{fontSize:16,color:"#aaa"}}><span style={{color:adj>0?p1col:p2col,fontWeight:"700",fontSize:18}}>{gvr.name}</span><span style={{color:"#aaa"}}> gives </span><span style={{color:adj>0?p2col:p1col,fontWeight:"700",fontSize:18}}>{rcvr.name}</span><span style={{color:"#4ade80",fontSize:26,fontWeight:"700",marginLeft:8}}>{Math.abs(adj)}</span></div>
                    <div style={{fontSize:12,color:isLight?"#333":"#aaa",marginTop:6}}>
                      2nd nine: {Math.abs(orig)} stroke{Math.abs(orig)!==1?"s":""}
                      {delta !== 0
                        ? <span style={{color:delta>0?"#f97316":"#4ade80",fontWeight:"700",marginLeft:6}}>→ {Math.abs(adj)} ({delta>0?"▲":"▼"}{Math.abs(delta)} adjusted)</span>
                        : <span style={{color:"#aaa",marginLeft:6}}>· no adjustment</span>
                      }
                    </div>
                  </div>
                );
              })()}
            </div>
            <button onClick={function(){setShowHalftime(false);setPlayPos(function(p){return p+1;});}}
              style={{width:"100%",padding:"14px 0",background:"#4ade80",color:"#000",border:"none",borderRadius:10,cursor:"pointer",fontSize:18,fontWeight:"700",letterSpacing:2}}>
              START {snLabel.toUpperCase()} →
            </button>
          </div>
        )}
        {done && (
          <div style={{marginTop:16,textAlign:"center"}}>
            <div style={{fontSize:12,color:isLight?"#333":"#aaa",marginBottom:8,letterSpacing:2}}>FINAL SETTLEMENT</div>
            {r.dollars.net===0 ? (
              <div style={{fontSize:28,fontWeight:"700",color:isLight?"#555":"#888"}}>ALL SQUARE</div>
            ) : (
              <div>
                <div style={{fontSize:16,color:isLight?"#333":"#aaa",marginBottom:8}}>
                  <span style={{color:r.dollars.net>0?p2col:p1col,fontWeight:"700"}}>{r.dollars.net>0?p2.name:p1.name}</span>
                  <span style={{color:"#aaa"}}> pays </span>
                  <span style={{color:r.dollars.net>0?p1col:p2col,fontWeight:"700"}}>{r.dollars.net>0?p1.name:p2.name}</span>
                </div>
                <div style={{fontSize:56,fontWeight:"700",color:"#4ade80"}}>${Math.abs(r.dollars.net)}</div>
              </div>
            )}
            <button onClick={function(){window.speechSynthesis&&window.speechSynthesis.cancel();onDone();}}
              style={{marginTop:20,padding:"14px 32px",background:"#4ade80",color:"#000",border:"none",borderRadius:10,cursor:"pointer",fontSize:16,fontWeight:"700",letterSpacing:2}}>
              SEE RESULT →
            </button>
          </div>
        )}
      </div>
      {/* Bottom controls bar */}
      <div style={{background:isLight?"#e0e0e0":"#111",borderTop:isLight?"1px solid #ccc":"1px solid #333",padding:"10px 16px"}}>
        {/* Progress bar */}
        <div style={{height:3,background:isLight?"#ccc":"#333",borderRadius:2,marginBottom:12}}>
          <div style={{height:"100%",background:isLight?"#16a34a":"#4ade80",width:((playPos+1)/18*100)+"%",borderRadius:2,transition:"width 0.3s"}}/>
        </div>
        {/* Controls row: ◀ | ⏸ | ●AUTO | 🔊 */}
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          {/* Rewind */}
          <button onClick={function(){window.speechSynthesis&&window.speechSynthesis.cancel();setPlayPos(function(p){return Math.max(0,p-1);});setShowHalftime(false);setDone(false);setWaiting(false);setPaused(false);}} disabled={playPos===0}
            style={{flex:1,height:44,background:"transparent",border:"1px solid "+(playPos===0?(isLight?"#ccc":"#333"):(isLight?"#bbb":"#444")),borderRadius:8,color:playPos===0?(isLight?"#ccc":"#444"):(isLight?"#333":"#aaa"),cursor:playPos===0?"default":"pointer",fontSize:18}}>◀</button>
          {/* Pause/Resume */}
          <button onClick={function(){if(!paused)window.speechSynthesis&&window.speechSynthesis.cancel();setPaused(function(v){return !v;});}}
            style={{flex:1,height:44,background:paused?"#f97316":"transparent",border:"1px solid "+(paused?"#f97316":(isLight?"#bbb":"#444")),borderRadius:8,color:paused?"#000":(isLight?"#333":"#aaa"),cursor:"pointer",fontSize:18}}>
            {paused?"▶":"⏸"}
          </button>
          {/* Auto */}
          <button onClick={function(){setAutoPlay(function(v){return !v;});}}
            style={{flex:3,height:44,background:autoPlay?(isLight?"#16a34a":"#4ade80"):"transparent",border:"1px solid "+(autoPlay?(isLight?"#16a34a":"#4ade80"):(isLight?"#bbb":"#444")),borderRadius:8,color:autoPlay?"#000":(isLight?"#555":"#888"),cursor:"pointer",fontSize:13,fontWeight:autoPlay?"700":"400",letterSpacing:1}}>
            {autoPlay?"● AUTO":"○ AUTO"}
          </button>
          {/* Audio — far right */}
          <button onClick={function(){setAudioOn(function(v){return !v;});}}
            style={{flex:1,height:44,background:audioOn?(isLight?"#e8f5e8":"#0d2a0d"):"transparent",border:"1px solid "+(audioOn?(isLight?"#16a34a":"#4ade80"):(isLight?"#bbb":"#444")),borderRadius:8,color:audioOn?(isLight?"#16a34a":"#4ade80"):(isLight?"#888":"#555"),cursor:"pointer",fontSize:18}}>
            {audioOn?"🔊":"🔇"}
          </button>
        </div>
      </div>
    </div>
  );
}

const BUILD = "20260410-1359";

// ─── DECODE QR ────────────────────────────────────────────────────────────────
function decodeQRPayload(str) {
  try {
    var clean = str.trim();
    var parsed = JSON.parse(clean);
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.ho || !parsed.sf || !parsed.p) return null;
    var holes = [];
    var scores = [];
    var N = parsed.p.length; // actual player count
    if (parsed.v === "2") {
      // Compact format: ho = string "b12a04..." each hole = 1 par char + 2 si digits
      for (var i = 0; i < parsed.ho.length; i += 3) {
        var pChar = parsed.ho[i];
        var par = {a:3,b:4,c:5,d:6}[pChar] || 4;
        var si = parseInt(parsed.ho.slice(i+1, i+3), 10);
        holes.push({par:par, si:si});
      }
      // sf = base36 string of 18*N chars
      var flat = [];
      for (var j = 0; j < parsed.sf.length; j++) {
        flat.push(parseInt(parsed.sf[j], 36));
      }
      for (var h = 0; h < 18; h++) scores.push(flat.slice(h*N, h*N+N));
    } else {
      // v1 format: ho = array of numbers, sf = flat array of 18*N
      for (var i = 0; i < 36; i+=2) holes.push({ par: parsed.ho[i], si: parsed.ho[i+1] });
      for (var h = 0; h < 18; h++) scores.push(parsed.sf.slice(h*N, h*N+N));
    }
    var inPlay = [];
    for (var j = 0; j < 18; j++) {
      inPlay.push(!!(parsed.ip & (1<<j)));
    }
    return {
      courseName: parsed.c,
      names: parsed.p,
      hcps: parsed.h || [],
      holes: holes,
      scores: scores,
      inPlay: inPlay,
      nassau: parsed.nassau || [],
      firstNine: parsed.fn || "F"
    };
  } catch(e) { return null; }
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
// ─── REPORT ──────────────────────────────────────────────────────────────────
function dohyoLogoSVGString(size) {
  var s = size || 48, c = s/2;
  var ringR = s*0.43, tawaraW = s*0.032;
  var h = s*0.30, w = h*0.11, gap = h*0.68, cupR = w*2.2;
  var topY = c - h*0.48, tipY = topY + h;
  var lx = c - gap/2 - w/2, rx = c + gap/2 + w/2;
  function tee(cx) {
    var stemPath = "M "+(cx-w*0.5)+" "+topY+" L "+(cx+w*0.5)+" "+topY+" L "+(cx+w*0.14)+" "+tipY+" L "+(cx-w*0.14)+" "+tipY+" Z";
    var rimL=cx-cupR, rimR=cx+cupR, dip=topY+cupR*0.45;
    var cupPath = "M "+rimL+" "+topY+" C "+(cx-cupR*0.5)+","+topY+" "+cx+","+dip+" "+cx+","+dip+" C "+cx+","+dip+" "+(cx+cupR*0.5)+","+topY+" "+rimR+","+topY+" L "+rimR+","+(topY+cupR*0.22)+" C "+(cx+cupR*0.5)+","+(topY+cupR*0.22)+" "+cx+","+(dip+cupR*0.22)+" "+cx+","+(dip+cupR*0.22)+" C "+cx+","+(dip+cupR*0.22)+" "+(cx-cupR*0.5)+","+(topY+cupR*0.22)+" "+rimL+","+(topY+cupR*0.22)+" Z";
    return [stemPath, cupPath];
  }
  var lt = tee(lx), rt = tee(rx);
  return '<svg width="'+s+'" height="'+s+'" viewBox="0 0 '+s+' '+s+'" xmlns="http://www.w3.org/2000/svg">'
    +'<rect width="'+s+'" height="'+s+'" rx="'+(s*0.16)+'" fill="#0a0a0a"/>'
    +'<circle cx="'+c+'" cy="'+c+'" r="'+(ringR+tawaraW)+'" fill="#1a1006"/>'
    +'<circle cx="'+c+'" cy="'+c+'" r="'+ringR+'" fill="none" stroke="#d4a843" stroke-width="'+tawaraW+'"/>'
    +'<circle cx="'+c+'" cy="'+c+'" r="'+(ringR-tawaraW*0.5)+'" fill="#211608"/>'
    +'<path d="'+lt[0]+'" fill="#ffffff"/>'
    +'<path d="'+lt[1]+'" fill="#ffffff"/>'
    +'<path d="'+rt[0]+'" fill="#ffffff"/>'
    +'<path d="'+rt[1]+'" fill="#ffffff"/>'
    +'</svg>';
}
function generateDohyoReport({ players, matchups, results, refCourseName, globalFirstNine }) {
  var date = new Date().toLocaleDateString("en-SG", { day:"numeric", month:"long", year:"numeric" });
  var PCOLS = ["#16a34a","#2563eb","#c2410c","#9333ea","#ca8a04","#0d9488","#dc2626","#7c3aed"];

  function fmtDol(d) { return d===0?"—":d>0?"+$"+d:"-$"+Math.abs(d); }
  function fmtSt(s, p1name, p2name) { return s===0?"AS":(s>0?p1name:p2name)+" "+Math.abs(s)+" UP"; }

  // Pay up ledger — store color indices alongside names
  var ledger = {};
  (results||[]).forEach(function(r,mi){
    if(!r||r.dollars.net===0) return;
    var m=matchups[mi], net=r.dollars.net;
    var payer=net>0?r.p2name:r.p1name, payee=net>0?r.p1name:r.p2name, amt=Math.abs(net);
    var payerIdx=net>0?m.p2:m.p1, payeeIdx=net>0?m.p1:m.p2;
    var key=[payer,payee].sort().join("|");
    if(!ledger[key]) ledger[key]={payer:payer,payee:payee,payerIdx:payerIdx,payeeIdx:payeeIdx,amount:0};
    ledger[key].amount+=(ledger[key].payer===payer?1:-1)*amt;
  });
  var payList = Object.values(ledger).filter(function(s){return s.amount!==0;}).map(function(s){
    return s.amount<0?{payer:s.payee,payee:s.payer,payerIdx:s.payeeIdx,payeeIdx:s.payerIdx,amount:-s.amount}:s;
  });

  // Recompute strokes given for a player on a hole, using front/back stroke counts
  function reportStrokes(strokesForNine, si, holesSI) {
    if (strokesForNine <= 0) return 0;
    // Sort SIs ascending, give strokes to lowest SI holes
    var sorted = holesSI.slice().sort(function(a,b){return a-b;});
    var threshold = sorted[Math.min(strokesForNine,sorted.length)-1];
    // Give stroke if this hole's SI <= threshold (handle ties by counting)
    var given = 0;
    if (si <= threshold) given = 1;
    if (strokesForNine > 9 && si <= sorted[strokesForNine-10]) given = 2;
    return given;
  }

  // Build scorecard - split front 9 / back 9, gross + nett rows, stroke-adjusted nett
  function scorecardHTML(r, m) {
    var p1 = players[m.p1], p2 = players[m.p2];
    if (!p1||!p2) return "";
    var holes = p1.holes || p2.holes || [];
    if (!holes.length) return "";

    // Determine strokes for each nine
    var isGDB = r.type === "gdb";
    var sf = globalFirstNine==="front" ? m.strokesFront : m.strokesBack;
    var sb = globalFirstNine==="front" ? (r.adjSecond!=null?r.adjSecond:m.strokesBack) : (r.adjSecond!=null?r.adjSecond:m.strokesFront);
    // sf/sb are relative: positive = p1 gives p2, negative = p2 gives p1
    var frontSIs = holes.slice(0,9).map(function(h){return h.si;});
    var backSIs  = holes.slice(9,18).map(function(h){return h.si;});

    // sf = strokes for first nine played, sb = strokes for second nine played
    // Map back to physical holes correctly
    var physFrontStrokes = globalFirstNine==="front" ? sf : sb;
    var physBackStrokes  = globalFirstNine==="front" ? sb : sf;

    function getStrokes(hi, player) {
      var strokes = hi < 9 ? physFrontStrokes : physBackStrokes;
      var sis = hi < 9 ? frontSIs : backSIs;
      var h = holes[hi];
      if (strokes === 0) return 0;
      var abs = Math.abs(strokes);
      var given = reportStrokes(abs, h.si, sis);
      if (strokes > 0) return player===1 ? given : 0;
      else             return player===0 ? given : 0;
    }

    function scoreStyle(d){ return d<=-2?"color:#15803d;font-weight:700":d===-1?"color:#16a34a;font-weight:700":d===0?"color:#111":d===1?"color:#9ca3af":"color:#dc2626;font-weight:700"; }
    function nettStyle(d){ return d<=-1?"color:#15803d;font-weight:700":d===0?"color:#111":"color:#dc2626;font-weight:700"; }
    function cell(txt,style,w){ return '<td style="padding:2px 3px;text-align:center;font-size:11px;border:1px solid #e5e7eb;min-width:'+(w||18)+'px;'+(style||'')+'">'+txt+'</td>'; }
    function labelCell(txt,col){ return '<td style="padding:2px 6px;font-size:10px;font-weight:700;border:1px solid #e5e7eb;white-space:nowrap;color:'+(col||'#9ca3af')+'">'+txt+'</td>'; }

    function buildNine(startHi) {
      var nineHoles = holes.slice(startHi, startHi+9);
      var isFirst = (startHi===0 && globalFirstNine==="front") || (startHi===9 && globalFirstNine==="back");
      var label = (startHi===0?"FRONT ":"BACK ") + (isFirst?"(1st)":"(2nd)");
      // Header — dark shade
      var hdr = '<td style="padding:2px 6px;font-size:10px;font-weight:700;border:1px solid #e5e7eb;white-space:nowrap;background:#111;color:#fff">'+label+'</td>';
      nineHoles.forEach(function(h,i){
        hdr += cell(startHi+i+1,'background:#111;color:#fff;font-weight:700');
      });
      hdr += cell('TOT','background:#111;color:#fff;font-weight:700');
      // Par — medium shade
      var parRow = labelCell('Par');
      var partot=0;
      nineHoles.forEach(function(h){ partot+=h.par;
        parRow += cell(h.par,'background:#f9fafb;color:#374151');
      });
      parRow += cell(partot,'background:#f9fafb;color:#111;font-weight:700');
      // SI row — lightest shade
      var siRow = labelCell('SI');
      nineHoles.forEach(function(h){ siRow += cell(h.si,'background:#fafafa;color:#6b7280;font-size:10px'); });
      siRow += cell('','background:#fafafa');
      // P1 nett — white
      var p1n = labelCell(p1.name,PCOLS[m.p1%8]);
      var p1ntot=0;
      nineHoles.forEach(function(h,i){ var hi2=startHi+i; var g=p1.scores[hi2]||0; var s=getStrokes(hi2,0); var n=g-s; p1ntot+=n; var dot=s>0?'<sup style="color:#16a34a;font-size:9px">+'+s+'</sup>':''; p1n += cell(n+dot,nettStyle(n-h.par)); });
      p1n += cell(p1ntot,'font-weight:700;color:'+PCOLS[m.p1%8]);
      // P2 nett — very light alternate
      var p2n = labelCell(p2.name,PCOLS[m.p2%8]);
      var p2ntot=0;
      nineHoles.forEach(function(h,i){ var hi2=startHi+i; var g=p2.scores[hi2]||0; var s=getStrokes(hi2,1); var n=g-s; p2ntot+=n; var dot=s>0?'<sup style="color:#16a34a;font-size:9px">+'+s+'</sup>':''; p2n += cell(n+dot,'background:#fafafa;'+nettStyle(n-h.par)); });
      p2n += cell(p2ntot,'background:#fafafa;font-weight:700;color:'+PCOLS[m.p2%8]);

      return '<table style="border-collapse:collapse;width:100%;margin-bottom:6px"><tbody>'
        +'<tr style="background:#e5e7eb">'+hdr+'</tr>'
        +'<tr style="background:#f9fafb">'+parRow+'</tr>'
        +'<tr style="background:#fafafa">'+siRow+'</tr>'
        +'<tr style="border-top:2px solid #d1d5db">'+p1n+'</tr>'
        +'<tr style="border-top:1px solid #e5e7eb;background:#fafafa">'+p2n+'</tr>'
        +'</tbody></table>';
    }

    return '<div style="overflow-x:auto;font-family:sans-serif">'
      + buildNine(0)
      + buildNine(9)
      +'</div>';
  }

  // First nine played indicator
  var firstNineHTML = '<div style="background:#f3f4f6;border-radius:8px;padding:8px 14px;margin-bottom:16px;display:flex;align-items:center;gap:8px">'
    +'<span style="font-size:11px;color:#16a34a;letter-spacing:2px;font-weight:700">PLAY ORDER</span>'
    +'<span style="font-size:13px;font-weight:700;color:#111">'+(globalFirstNine==="front"?"FRONT → BACK":"BACK → FRONT")+'</span>'
    +'</div>';

  // Matchup result sections
  var matchupSections = (results||[]).map(function(r,mi){
    if(!r) return "";
    var m=matchups[mi];
    var net=r.dollars.net;
    var isGDB=r.type==="gdb";
    var p1col=PCOLS[m.p1%8], p2col=PCOLS[m.p2%8];
    var borderCol=net>0?p1col:net<0?p2col:"#e5e7eb";
    var rows="";
    if(!isGDB){
      var u=m.units||[1,1,2];
      var f9s=globalFirstNine==="front"?(r.front&&r.front.status):(r.back&&r.back.status);
      var s9s=globalFirstNine==="front"?(r.back&&r.back.status):(r.front&&r.front.status);
      if(u[0]>0) rows+='<tr><td style="padding:6px 0;color:#6b7280">First 9 ×'+u[0]+'</td><td style="padding:6px 0;color:#6b7280">'+fmtSt(f9s,r.p1name,r.p2name)+'</td><td style="padding:6px 0;text-align:right;font-weight:700">'+fmtDol(r.dollars.frontDollars)+'</td></tr>';
      if(u[1]>0) rows+='<tr><td style="padding:6px 0;color:#6b7280">Second 9 ×'+u[1]+'</td><td style="padding:6px 0;color:#6b7280">'+fmtSt(s9s,r.p1name,r.p2name)+'</td><td style="padding:6px 0;text-align:right;font-weight:700">'+fmtDol(r.dollars.backDollars)+'</td></tr>';
      if(u[2]>0) rows+='<tr><td style="padding:6px 0;color:#6b7280">Overall ×'+u[2]+'</td><td style="padding:6px 0;color:#6b7280">'+fmtSt(r.overall&&r.overall.status,r.p1name,r.p2name)+'</td><td style="padding:6px 0;text-align:right;font-weight:700">'+fmtDol(r.dollars.overallDollars)+'</td></tr>';
    } else {
      [["FIRST 9",globalFirstNine==="front"?r.front:r.back,globalFirstNine==="front"?r.dollars.front:r.dollars.back],
       ["SECOND 9",globalFirstNine==="front"?r.back:r.front,globalFirstNine==="front"?r.dollars.back:r.dollars.front]].forEach(function(row){
        var lbl=row[0],seg=row[1],dol=row[2];
        if(!seg||!dol) return;
        rows+='<tr><td colspan="3" style="padding:4px 0 2px;font-size:11px;color:#9ca3af;font-weight:700;letter-spacing:1px">'+lbl+'</td></tr>';
        rows+='<tr><td style="padding:4px 0;color:#6b7280;padding-left:8px">Game ×3</td><td style="padding:4px 0;color:#6b7280">'+fmtSt(seg.game?seg.game.status:0,r.p1name,r.p2name)+'</td><td style="text-align:right;font-weight:700">'+fmtDol(dol.gameDollars)+'</td></tr>';
        if(seg.dormie) rows+='<tr><td style="padding:4px 0;color:#6b7280;padding-left:8px">Dormie ×1</td><td style="padding:4px 0;color:#6b7280">'+fmtSt(seg.dormie.status,r.p1name,r.p2name)+'</td><td style="text-align:right;font-weight:700">'+fmtDol(dol.dormieDollars)+'</td></tr>';
        if(seg.buy) rows+='<tr><td style="padding:4px 0;color:#6b7280;padding-left:8px">Bye ×1</td><td style="padding:4px 0;color:#6b7280">'+fmtSt(seg.buy.status,r.p1name,r.p2name)+'</td><td style="text-align:right;font-weight:700">'+fmtDol(dol.buyDollars)+'</td></tr>';
      });
    }
    return '<div style="border:2px solid '+borderCol+';border-radius:10px;padding:16px;margin-bottom:16px">'
      +'<div style="font-size:11px;color:#16a34a;letter-spacing:2px;font-weight:700;margin-bottom:6px">MATCH '+(mi+1)+' · '+(isGDB?"GDB":"NASSAU")+'</div>'
      +(function(){
        var sf2 = globalFirstNine==="front" ? m.strokesFront : m.strokesBack;
        var sb2 = globalFirstNine==="front" ? (r.adjSecond!=null?r.adjSecond:m.strokesBack) : (r.adjSecond!=null?r.adjSecond:m.strokesFront);
        var adj = (sb2 !== (globalFirstNine==="front"?m.strokesBack:m.strokesFront));
        var origSb = globalFirstNine==="front" ? m.strokesBack : m.strokesFront;
        function strokeCompact(strokes, label, origStrokes) {
          var adjNote = (origStrokes!==undefined && origStrokes!==strokes) ? ' <span style="color:#f97316;font-size:10px">('+Math.abs(origStrokes)+')</span>' : '';
          if (strokes===0) return '<span style="color:#9ca3af">'+label+': scratch</span>'+adjNote;
          var giver = strokes>0 ? r.p1name : r.p2name;
          var giverCol = strokes>0 ? p1col : p2col;
          return '<span style="color:#9ca3af">'+label+':</span> <span style="color:'+giverCol+';font-weight:700">'+giver+'</span> <span style="color:#9ca3af">gives</span> <b style="color:#111">'+Math.abs(strokes)+'</b>'+adjNote;
        }
        return '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">'
          +'<div style="font-size:18px;font-weight:800">'
          +'<span style="color:'+p1col+'">'+r.p1name+'</span> <span style="color:#9ca3af;font-size:14px">vs</span> <span style="color:'+p2col+'">'+r.p2name+'</span>'
          +'</div>'
          +'<div style="font-size:11px;text-align:right;line-height:1.8;flex-shrink:0;margin-left:10px">'
          +'<div>'+strokeCompact(sf2,'1st Nine')+'</div>'
          +'<div>'+strokeCompact(sb2,'2nd Nine',adj?origSb:undefined)+'</div>'
          +'</div>'
          +'</div>';
      })()
      +'<table style="width:100%;border-collapse:collapse;margin-bottom:10px"><tbody>'+rows+'</tbody></table>'
      +'<div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid #e5e7eb;padding-top:10px">'
      +(net===0
        ?'<span style="font-weight:700;color:#6b7280">All Square</span><span style="font-size:22px;color:#9ca3af">—</span>'
        :'<span style="font-size:14px;font-weight:700"><span style="color:'+(net>0?p2col:p1col)+'">'+(net>0?r.p2name:r.p1name)+'</span> <span style="color:#9ca3af">owes</span> <span style="color:'+(net>0?p1col:p2col)+'">'+(net>0?r.p1name:r.p2name)+'</span></span>'
        +'<span style="font-size:26px;font-weight:800;color:#16a34a">$'+Math.abs(net)+'</span>'
      )
      +'</div>'
      +'<div style="margin-top:16px;border-top:1px solid #e5e7eb;padding-top:12px">'
      +'<div style="font-size:11px;color:#9ca3af;letter-spacing:2px;margin-bottom:8px">SCORECARD (NETT)</div>'
      +scorecardHTML(r,m)
      +'</div>'
      +'</div>';
  }).join("");

  // Build name→color lookup from players array and matchup results
  var nameColorMap = {};
  players.forEach(function(p,i){ nameColorMap[p.name] = PCOLS[i%8]; });
  // Also map from matchup player indices directly
  (results||[]).forEach(function(r,mi){
    if (!r) return;
    var m = matchups[mi];
    nameColorMap[r.p1name] = PCOLS[m.p1%8];
    nameColorMap[r.p2name] = PCOLS[m.p2%8];
  });

  // Pay up section
  var payHTML = payList.length ? '<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:16px;margin-bottom:20px">'
    +'<div style="font-size:11px;color:#16a34a;letter-spacing:2px;font-weight:700;margin-bottom:12px">PAY UP</div>'
    +payList.map(function(s){
      var payerCol = PCOLS[s.payerIdx%8];
      var payeeCol = PCOLS[s.payeeIdx%8];
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #e5e7eb">'
        +'<span style="font-size:15px"><span style="color:'+payerCol+';font-weight:700">'+s.payer+'</span> <span style="color:#9ca3af">pays</span> <span style="color:'+payeeCol+';font-weight:700">'+s.payee+'</span></span>'
        +'<span style="font-size:22px;font-weight:800;color:#16a34a">$'+s.amount+'</span>'
        +'</div>';
    }).join("")
    +'</div>' : '';

  var logoSVG = dohyoLogoSVGString(48);

  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8">'
    +'<meta name="viewport" content="width=device-width,initial-scale=1">'
    +'<title>Dohyo Report</title>'
    +'<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,sans-serif;background:#fff;color:#111;padding:20px;max-width:600px;margin:0 auto}'
    +'@media print{.no-print{display:none}}</style>'
    +'</head><body>'
    +'<div class="no-print" style="margin-bottom:16px">'
    +'<button onclick="window.print()" style="padding:10px 20px;background:#16a34a;color:#fff;border:none;border-radius:8px;font-size:15px;cursor:pointer;font-weight:700">🖨 Print / Save PDF</button>'
    +'</div>'
    // Header
    +'<div style="display:flex;align-items:center;gap:14px;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid #e5e7eb">'
    +logoSVG
    +'<div>'
    +'<div style="font-size:26px;font-weight:900;letter-spacing:4px">dohyo</div>'
    +'<div style="font-size:13px;color:#6b7280;margin-top:2px">Step into the ring, settle the score</div>'
    +'</div>'
    +'</div>'
    // Date + course
    +'<div style="margin-bottom:20px">'
    +'<div style="font-size:14px;color:#6b7280">'+date+'</div>'
    +(refCourseName?'<div style="font-size:16px;font-weight:700;margin-top:4px">'+refCourseName+'</div>':'')
    +'</div>'
    // Pay up
    +payHTML
    // Matchup sections
    +'<div style="font-size:11px;color:#16a34a;letter-spacing:2px;font-weight:700;margin-bottom:12px">MATCHUP RESULTS</div>'
    +firstNineHTML
    +matchupSections
    +'</body></html>';

  return html;
}

// ─── SPLASH ──────────────────────────────────────────────────────────────────
function SplashContent({ onDone }) {
  var [key, setKey] = useState(0);
  function replay() { setKey(function(k){ return k+1; }); }

  var s = 120, c = s/2;
  var ringR = s*0.43, tawaraW = s*0.032;
  var h = s*0.30, w = h*0.11, gap = h*0.68, cupR = w*2.2;
  var topY = c - h*0.48, tipY = topY + h;

  function teePaths(cx) {
    var stemPath = "M "+(cx-w*0.5)+" "+topY+" L "+(cx+w*0.5)+" "+topY+" L "+(cx+w*0.14)+" "+tipY+" L "+(cx-w*0.14)+" "+tipY+" Z";
    var rimL=cx-cupR, rimR=cx+cupR, dip=topY+cupR*0.45;
    var cupPath = "M "+rimL+" "+topY+" C "+(cx-cupR*0.5)+","+topY+" "+cx+","+dip+" "+cx+","+dip+" C "+cx+","+dip+" "+(cx+cupR*0.5)+","+topY+" "+rimR+","+topY+" L "+rimR+","+(topY+cupR*0.22)+" C "+(cx+cupR*0.5)+","+(topY+cupR*0.22)+" "+cx+","+(dip+cupR*0.22)+" "+cx+","+(dip+cupR*0.22)+" C "+cx+","+(dip+cupR*0.22)+" "+(cx-cupR*0.5)+","+(topY+cupR*0.22)+" "+rimL+","+(topY+cupR*0.22)+" Z";
    return [stemPath, cupPath];
  }

  var lx = c - gap/2 - w/2;
  var rx = c + gap/2 + w/2;
  var lt = teePaths(lx), rt = teePaths(rx);

  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:24}}>
      <style>{`
        @keyframes ringAppear {
          0%   { opacity:0; transform: scale(0.5); }
          30%  { opacity:1; transform: scale(1.05); }
          45%  { transform: scale(0.97); }
          55%  { transform: scale(1); }
          100% { opacity:1; transform: scale(1); }
        }
        @keyframes slideInLeft {
          0%   { transform: translateX(-180px); opacity:0; }
          100% { transform: translateX(0px); opacity:1; }
        }
        @keyframes slideInRight {
          0%   { transform: translateX(180px); opacity:0; }
          100% { transform: translateX(0px); opacity:1; }
        }
        @keyframes clashFlash {
          0%   { opacity:0; transform:translate(-50%,-50%) scale(0.2); }
          10%  { opacity:1; transform:translate(-50%,-50%) scale(1.4); }
          40%  { opacity:0; transform:translate(-50%,-50%) scale(0.8); }
          100% { opacity:0; }
        }
        @keyframes titleRise {
          0%   { opacity:0; transform: translateY(24px); }
          100% { opacity:1; transform: translateY(0); }
        }
        @keyframes taglineRise {
          0%   { opacity:0; }
          100% { opacity:1; }
        }
        @keyframes btnAppear {
          0%   { opacity:0; }
          100% { opacity:1; }
        }
        .ring-anim  { animation: ringAppear   0.7s cubic-bezier(0.34,1.56,0.64,1) 0.2s both; }
        .tee-left   { animation: slideInLeft  0.5s cubic-bezier(0.22,1,0.36,1) 1.0s both; }
        .tee-right  { animation: slideInRight 0.5s cubic-bezier(0.22,1,0.36,1) 1.0s both; }
        .clash      { animation: clashFlash   0.6s ease 1.45s both; }
        .title-anim { animation: titleRise    0.6s ease 1.6s both; }
        .tagline-anim { animation: taglineRise 0.5s ease 2.0s both; }
        .btn-anim   { animation: btnAppear    0.5s ease 2.5s both; }
      `}</style>
      {/* Animated content — keyed so replay resets all animations */}
      <div key={key} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:24}}>
        <div style={{position:"relative",width:s,height:s}}>
          <svg className="ring-anim" width={s} height={s} viewBox={"0 0 "+s+" "+s} style={{position:"absolute",top:0,left:0}}>
            <rect width={s} height={s} rx={s*0.16} fill="#0a0a0a"/>
            <circle cx={c} cy={c} r={ringR+tawaraW} fill="#1a1006"/>
            <circle cx={c} cy={c} r={ringR} fill="none" stroke="#d4a843" strokeWidth={tawaraW}/>
            <circle cx={c} cy={c} r={ringR-tawaraW*0.5} fill="#211608"/>
          </svg>
          <svg className="tee-left" width={s} height={s} viewBox={"0 0 "+s+" "+s} style={{position:"absolute",top:0,left:0}}>
            <path d={lt[0]} fill="#ffffff"/>
            <path d={lt[1]} fill="#ffffff"/>
          </svg>
          <svg className="tee-right" width={s} height={s} viewBox={"0 0 "+s+" "+s} style={{position:"absolute",top:0,left:0}}>
            <path d={rt[0]} fill="#ffffff"/>
            <path d={rt[1]} fill="#ffffff"/>
          </svg>
          <div className="clash" style={{position:"absolute",top:"50%",left:"50%",width:50,height:50,borderRadius:"50%",background:"radial-gradient(circle, rgba(212,168,67,0.95) 0%, rgba(212,168,67,0.3) 50%, transparent 70%)",pointerEvents:"none"}}/>
        </div>
        <div className="title-anim" style={{textAlign:"center"}}>
          <div style={{fontSize:42,fontWeight:"900",letterSpacing:6,color:"#fff",lineHeight:1}}>dohyo</div>
        </div>
        <div className="tagline-anim" style={{fontSize:13,color:"#d4a843",letterSpacing:1,textAlign:"center"}}>
          Step into the ring, settle the score
        </div>
        <div className="btn-anim" style={{display:"flex",gap:10,marginTop:8}}>
          <button onClick={onDone} style={{padding:"12px 28px",background:"transparent",border:"1px solid #d4a843",borderRadius:24,color:"#d4a843",fontSize:14,cursor:"pointer",letterSpacing:2}}>
            ENTER →
          </button>
          <button onClick={replay} style={{padding:"12px 16px",background:"transparent",border:"1px solid #555",borderRadius:24,color:"#555",fontSize:14,cursor:"pointer"}}>
            ↺
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  var il = useState(false); var isLight=il[0], setIsLight=il[1];
  var st = useState("splash"); var step=st[0], setStep=st[1];
  var pl = useState([]); var players=pl[0], setPlayers=pl[1];
  var rh = useState(null); var refHoles=rh[0], setRefHoles=rh[1];
  var rc = useState(null); var refCourseName=rc[0], setRefCourseName=rc[1];
  var gf = useState("front"); var globalFirstNine=gf[0], setGlobalFirstNine=gf[1];
  var mu = useState([{p1:0,p2:1,type:"nassau",strokesFront:0,strokesBack:0,autoAdjust:true,stake:5,units:[1,1,2]}]);
  var matchups=mu[0], setMatchups=mu[1];
  var rs = useState(null); var results=rs[0], setResults=rs[1];
  var ht = useState(null); var halftimeResults=ht[0], setHalftimeResults=ht[1];
  var sm = useState(false); var showManual=sm[0], setShowManual=sm[1];
  var cm = useState(false); var showCourseModal=cm[0], setShowCourseModal=cm[1];
  var mn = useState(""); var manualName=mn[0], setManualName=mn[1];
  var ms = useState(Array(18).fill("")); var manualScores=ms[0], setManualScores=ms[1];
  var si = useState(0); var slowIdx=si[0], setSlowIdx=si[1];
  var sc = useState(false); var showScanner=sc[0], setShowScanner=sc[1];
  var se = useState(null); var scanError=se[0], setScanError=se[1];
  var pp2 = useState(null); var pendingPlayers=pp2[0], setPendingPlayers=pp2[1];
  var rp = useState(null); var reportHTML=rp[0], setReportHTML=rp[1];
  var videoRef = useRef(null);
  var scannerRef = useRef(null);
  useEffect(function(){
    try {
      var session = {
        players: players, refHoles: refHoles, refCourseName: refCourseName,
        globalFirstNine: globalFirstNine, matchups: matchups, results: results,
        savedAt: Date.now()
      };
      localStorage.setItem("dohyo_session", JSON.stringify(session));
    } catch(e) {}
  }, [players, refHoles, matchups, results]);

  // Check for existing session on mount
  var savedSessionRef = useRef(null);
  var [hasSession, setHasSession] = useState(function(){
    try {
      var s = localStorage.getItem("dohyo_session");
      if (s) { var d = JSON.parse(s); if (d.players && d.players.length > 0) { savedSessionRef.current = d; return true; } }
    } catch(e) {}
    return false;
  });
  function clearSession() {
    try { localStorage.removeItem("dohyo_session"); } catch(e) {}
    savedSessionRef.current = null;
    setHasSession(false);
  }
  function resumeSession() {
    var d = savedSessionRef.current;
    if (!d) return;
    if (d.players) setPlayers(d.players);
    if (d.refHoles) setRefHoles(d.refHoles);
    if (d.refCourseName) setRefCourseName(d.refCourseName);
    if (d.globalFirstNine) setGlobalFirstNine(d.globalFirstNine);
    if (d.matchups) setMatchups(d.matchups);
    if (d.results) setResults(d.results);
    savedSessionRef.current = null;
    setHasSession(false);
  }

  var tc = isLight ? "lm" : "dm";
  function CP(i){ return isLight ? COLORS_LIGHT[i%4] : COLORS[i%4]; }

  function checkIntegrity(holes, courseName) {
    if (!refHoles) { setRefHoles(holes); setRefCourseName(courseName||null); return true; }
    var a = refHoles.map(function(h){return h.si;}).join(",");
    var b = holes.map(function(h){return h.si;}).join(",");
    if (a !== b) { setScanError("Course SI mismatch — both flights must play the same course"); return false; }
    return true;
  }
  function loadFromQRPayload(payloadStr, sourceLabel) {
    try {
      var d = decodeQRPayload(payloadStr);
      if (!d) {
        setScanError("Could not read QR — try again or use manual entry");
        return false;
      }
      if (!d.names || !d.holes || !d.scores) {
        setScanError("QR decoded but missing fields");
        return false;
      }
      if (!checkIntegrity(d.holes, d.courseName)) return false;
      var newPlayers = d.names.map(function(name, pi) {
        return {
          name: name || ("P"+(pi+1)),
          scores: d.scores.map(function(row){ return row[pi]||0; }),
          source: sourceLabel || d.courseName || "QR",
          holes: d.holes,
        };
      });
      // Check for duplicate names - append (2),(3) etc to dupes
      var existingNames = players.map(function(p){ return p.name.toLowerCase(); });
      var dupes = newPlayers.filter(function(p){ return existingNames.indexOf(p.name.toLowerCase()) >= 0; });
      if (dupes.length > 0) {
        var allNames = existingNames.slice();
        var renamedPlayers = newPlayers.map(function(p){
          if (allNames.indexOf(p.name.toLowerCase()) < 0) {
            allNames.push(p.name.toLowerCase());
            return p;
          }
          // Find next available suffix
          var base = p.name.replace(/ \d+$/, '').slice(0, 7); // max 7 chars for base
          var n = 2;
          var candidate = base + n;
          while (allNames.indexOf(candidate.toLowerCase()) >= 0) { n++; candidate = base + n; }
          allNames.push(candidate.toLowerCase());
          return Object.assign({}, p, { name: candidate });
        });
        setPendingPlayers(renamedPlayers);
        setScanError("duplicate:"+dupes.map(function(p){return p.name;}).join(", "));
        return false;
      }
      setPlayers(function(prev){ return prev.concat(newPlayers); });
      setScanError(null);
      return true;
    } catch(e) { setScanError("Failed to decode QR: "+e.message); return false; }
  }
  function removePlayer(idx) {
    setPlayers(function(prev){return prev.filter(function(_,i){return i!==idx;});});
    setResults(null); setHalftimeResults(null);
  }
  function addManualPlayer() {
    if (!manualName.trim()) return;
    var defaultHoles = refHoles || [{par:4},{par:4},{par:5},{par:3},{par:4},{par:4},{par:3},{par:4},{par:5},{par:4},{par:4},{par:3},{par:4},{par:5},{par:4},{par:3},{par:4},{par:5}];
    setPlayers(function(prev){
      return prev.concat([{
        name: manualName.trim(),
        scores: manualScores.map(function(s,i){ return parseInt(s,10)||(defaultHoles[i]?defaultHoles[i].par:4); }),
        source: "Manual",
        holes: defaultHoles,
      }]);
    });
    setManualName("");
    setManualScores(defaultHoles.map(function(h){return String(h.par);}));
    setShowManual(false);
  }
  async function startScanner() {
    setScanError(null);
    // Preload jsQR library before opening file picker
    function preloadJsQR(cb) {
      if (window.jsQR) { cb(); return; }
      if (document.getElementById('jsqr-script')) {
        var poll = setInterval(function(){ if (window.jsQR){ clearInterval(poll); cb(); } }, 100);
        return;
      }
      var s = document.createElement("script");
      s.id = "jsqr-script";
      s.src = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js";
      s.onload = cb;
      s.onerror = function(){ setScanError("QR decoder unavailable — use manual entry."); };
      document.head.appendChild(s);
    }
    preloadJsQR(function(){});
    // Trigger native camera via file input
    var input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = function(e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function(ev) {
        var img = new Image();
        img.onload = function() {
          if (!window.jsQR) {
            setScanError("QR decoder still loading — try again in a moment.");
            return;
          }
          decodeImage(img);
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    };
    input.click();
    function decodeImage(img) {
      var scales = [0.5, 1.0, 0.25];
      for (var si = 0; si < scales.length; si++) {
        var scale = scales[si];
        var canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        var ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        var code = window.jsQR(imageData.data, imageData.width, imageData.height);
        if (code && code.data) {
          loadFromQRPayload(code.data, "Flight");
          return;
        }
      }
      setScanError("No QR code found — make sure QR fills the frame and try again");
    }
  }
  function stopScanner() {
    if (scannerRef.current) { scannerRef.current.getTracks().forEach(function(t){t.stop();}); scannerRef.current = null; }
    setShowScanner(false);
  }
  function startPoll() {}
  function computeFirstNine(m) {
    var p1=players[m.p1], p2=players[m.p2];
    if (!p1||!p2) return null;
    var holes=refHoles||p1.holes;
    if (!holes) return null;
    var firstStart=globalFirstNine==="front"?0:9, firstEnd=globalFirstNine==="front"?8:17;
    var sf=globalFirstNine==="front"?m.strokesFront:m.strokesBack;
    var gross18=holes.map(function(_,hi){var r=Array(4).fill("0");r[0]=String(p1.scores[hi]||0);r[1]=String(p2.scores[hi]||0);return r;});
    var inPlay=holes.map(function(_,hi){return hi>=firstStart&&hi<=firstEnd&&p1.scores[hi]>0&&p2.scores[hi]>0;});
    var g18=gross18, hm=holes;
    if(globalFirstNine==="back"){g18=gross18.slice(9).concat(gross18.slice(0,9));hm=holes.slice(9).concat(holes.slice(0,9));}
    var inPlayM=globalFirstNine==="back"?inPlay.slice(9).concat(inPlay.slice(0,9)):inPlay;
    var syn={p1:0,p2:1,strokesFront:sf,strokesBack:0,stake:m.stake,units:m.units||[1,1,2],pressMode:"off"};
    var res=computeNassau(syn,g18,hm,inPlayM);
    var p1w=0,p2w=0;
    for(var i=0;i<9;i++){if(res.holeWL[i]===1)p1w++;else if(res.holeWL[i]===-1)p2w++;}
    var winner=p1w>p2w?"p1":p2w>p1w?"p2":null;
    var margin=Math.abs(p1w-p2w);
    return {p1wins:p1w,p2wins:p2w,winner:winner,adjustment:Math.floor(margin/2)};
  }
  function computeAdjSecond(m, htResult) {
    if (!m.autoAdjust||!htResult) return globalFirstNine==="front"?m.strokesBack:m.strokesFront;
    var ss=globalFirstNine==="front"?m.strokesBack:m.strokesFront;
    if (!htResult.winner) return ss;
    return htResult.winner==="p1"?ss+htResult.adjustment:ss-htResult.adjustment;
  }
  function computeAllResults(adjArr) {
    var res=matchups.map(function(m,mi){
      var p1=players[m.p1],p2=players[m.p2];
      if(!p1||!p2) return null;
      var holes=refHoles||p1.holes;
      if(!holes) return null;
      var gross18=holes.map(function(_,hi){var r=Array(4).fill("0");r[0]=String(p1.scores[hi]||0);r[1]=String(p2.scores[hi]||0);return r;});
      var inPlay=holes.map(function(_,hi){return p1.scores[hi]>0&&p2.scores[hi]>0;});
      var adj=adjArr&&adjArr[mi]!=null?adjArr[mi]:(globalFirstNine==="front"?m.strokesBack:m.strokesFront);
      var syn={p1:0,p2:1,strokesFront:globalFirstNine==="front"?m.strokesFront:adj,strokesBack:globalFirstNine==="front"?adj:m.strokesBack,stake:m.stake,units:m.units||[1,1,2],pressMode:"off"};
      if(m.type==="gdb"){
        var result=computeGDB(syn,gross18,holes,inPlay);
        var dol=gdbDollars(syn,result.front,result.back);
        return Object.assign({},result,{dollars:dol,type:"gdb",p1name:p1.name,p2name:p2.name,adjSecond:adj});
      } else {
        var result=computeNassau(syn,gross18,holes,inPlay);
        var f9=globalFirstNine==="front"?result.front:result.back;
        var s9=globalFirstNine==="front"?result.back:result.front;
        var dol=nassauDollars(syn,f9,s9,result.overall);
        return Object.assign({},result,{dollars:dol,type:"nassau",p1name:p1.name,p2name:p2.name,adjSecond:adj});
      }
    });
    setResults(res);
  }
  function computeResults() {
    var htArr=matchups.map(function(m){return computeFirstNine(m);});
    setHalftimeResults(htArr);
    var adj=matchups.map(function(m,mi){return computeAdjSecond(m,htArr[mi]);});
    computeAllResults(adj);
  }

  // SLOW REVEAL
  if (step==="slow") return (
    <RevealHoles result={results&&results[slowIdx]} matchup={matchups[slowIdx]} matchupIdx={slowIdx}
      players={players} refHoles={refHoles} isLight={isLight} COLORS_P={CP}
      globalFirstNine={globalFirstNine} onDone={function(){setStep("singleResult");}} onBack={function(){setStep("shitadara");}} />
  );

  // SPLASH SCREEN
  if (step==="splash") return (
    <div className={tc} style={{minHeight:"100vh",background:"#0a0a0a",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",overflow:"hidden"}}>
      <style>{TCSS}</style>
      <SplashContent onDone={function(){ setStep("load"); }} />
    </div>
  );

  if (step==="load") return (
    <div className={tc} style={{minHeight:"100vh",background:"var(--bg)",color:"var(--text)"}}>
      <style>{TCSS}</style>
      {scanError && scanError.startsWith("duplicate:") && pendingPlayers && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{background:"var(--card)",borderRadius:14,padding:24,width:"100%",maxWidth:380,border:"1px solid #f97316"}}>
            <div style={{fontSize:18,marginBottom:8}}>⚠️</div>
            <div style={{fontSize:15,fontWeight:"700",color:"#f97316",marginBottom:8}}>Duplicate players detected</div>
            <div style={{fontSize:13,color:"var(--muted)",marginBottom:6}}>
              <b style={{color:"var(--text)"}}>{scanError.replace("duplicate:","")}</b> already loaded.
            </div>
            <div style={{fontSize:13,color:"var(--muted)",marginBottom:6}}>
              Duplicates will be renamed:
            </div>
            <div style={{background:"var(--input)",borderRadius:8,padding:"8px 12px",marginBottom:16,fontSize:12,color:"var(--text)"}}>
              {pendingPlayers && pendingPlayers.filter(function(p){ return p.name.match(/\d+$/); }).map(function(p,i){
                var orig = p.name.replace(/\d+$/,'');
                return <div key={i}><span style={{color:"var(--neg)"}}>{orig}</span> → <span style={{color:"var(--accent)",fontWeight:"700"}}>{p.name}</span></div>;
              })}
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={function(){
                setPlayers(function(prev){ return prev.concat(pendingPlayers); });
                setPendingPlayers(null); setScanError(null);
              }} style={{flex:2,padding:"12px 0",background:"#f97316",color:"#000",border:"none",borderRadius:10,cursor:"pointer",fontSize:15,fontWeight:"700"}}>
                Load Anyway
              </button>
              <button onClick={function(){ setPendingPlayers(null); setScanError(null); }}
                style={{flex:1,padding:"12px 0",background:"transparent",border:"1px solid var(--border2)",borderRadius:10,color:"var(--muted)",cursor:"pointer",fontSize:14}}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {showCourseModal && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{background:"var(--card)",borderRadius:14,padding:24,width:"100%",maxWidth:380,border:"1px solid var(--border2)"}}>
            <div style={{fontSize:11,color:"var(--accent)",letterSpacing:3,fontWeight:"700",marginBottom:8}}>SELECT COURSE</div>
            <div style={{fontSize:13,color:"var(--muted)",marginBottom:16}}>Choose the course being played today</div>
            {PRESET_COURSES.map(function(c){
              return (
                <button key={c.id} onClick={function(){
                  setRefHoles(c.holes);
                  setRefCourseName(c.name+" — "+c.tee);
                  setManualScores(c.holes.map(function(h){return String(h.par);}));
                  setShowCourseModal(false);
                  setShowManual(true);
                }} style={{display:"block",width:"100%",textAlign:"left",padding:"12px 14px",background:"var(--input)",border:"1px solid var(--border)",borderRadius:10,cursor:"pointer",marginBottom:8,color:"var(--text)"}}>
                  <div style={{fontSize:15,fontWeight:"700",color:"var(--text)"}}>{c.name}</div>
                  <div style={{fontSize:12,color:"var(--muted)",marginTop:2}}>{c.tee} · Par {c.holes.reduce(function(s,h){return s+h.par;},0)}</div>
                </button>
              );
            })}
            <button onClick={function(){setShowCourseModal(false);}} style={{width:"100%",padding:"12px",background:"transparent",border:"1px solid var(--border)",borderRadius:10,cursor:"pointer",color:"var(--muted)",fontSize:14,marginTop:4}}>Cancel</button>
          </div>
        </div>
      )}
      <div style={{background:"var(--card)",padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid var(--border)"}}>
        <div style={{width:60}}/>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <DohyoLogo size={36}/>
          <div>
            <div style={{fontSize:18,fontWeight:"800",letterSpacing:3,color:"var(--text)",lineHeight:1}}>dohyo</div>
            <div style={{fontSize:9,color:"var(--dim)",letterSpacing:1}}>Step into the ring, settle the score</div>
            <div style={{fontSize:9,color:"var(--dim)",letterSpacing:1}}>v0.1.0 · 2026-04-12 05:45</div>
            <div style={{fontSize:8,color:"var(--dim)",letterSpacing:1,opacity:0.5}}>build {BUILD}</div>
          </div>
        </div>
        <button onClick={function(){setIsLight(function(v){return !v;});}} style={{background:"transparent",border:"none",color:"var(--dim)",cursor:"pointer",fontSize:18,width:60}}>{isLight?"🌙":"☀️"}</button>
      </div>
      <div style={{maxWidth:480,margin:"0 auto",padding:"16px 16px 120px"}}>
        {hasSession && (function(){
          var d = savedSessionRef.current;
          if (!d || !d.players || !d.players.length) return null;
          var savedAt = d.savedAt ? new Date(d.savedAt).toLocaleDateString("en-SG",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}) : "";
          return (
            <div style={{background:"var(--card)",border:"1px solid var(--border2)",borderRadius:10,padding:"12px 14px",marginBottom:16}}>
              <div style={{fontSize:11,color:"var(--accent)",letterSpacing:2,fontWeight:"700",marginBottom:6}}>PREVIOUS SESSION</div>
              <div style={{fontSize:13,color:"var(--text)",marginBottom:2}}>{d.players.map(function(p){return p.name;}).join(" · ")}</div>
              {d.refCourseName && <div style={{fontSize:11,color:"var(--dim)",marginBottom:8}}>{d.refCourseName}{savedAt?" · "+savedAt:""}</div>}
              <div style={{display:"flex",gap:8,marginTop:8}}>
                <button onClick={resumeSession} style={{flex:2,padding:"10px 0",background:"var(--accent)",color:"#000",border:"none",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:"700"}}>Resume</button>
                <button onClick={clearSession} style={{flex:1,padding:"10px 0",background:"transparent",border:"1px solid var(--neg)",borderRadius:8,color:"var(--neg)",cursor:"pointer",fontSize:13}}>Discard</button>
              </div>
            </div>
          );
        })()}
        {refCourseName && (
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"var(--card)",borderRadius:8,padding:"8px 12px",marginBottom:12,border:"1px solid var(--border)"}}>
            <div>
              <div style={{fontSize:9,color:"var(--dim)",letterSpacing:2,marginBottom:2}}>COURSE</div>
              <div style={{fontSize:13,fontWeight:"700",color:"var(--text)"}}>{refCourseName}</div>
            </div>
            <button onClick={function(){setShowCourseModal(true);}} style={{background:"transparent",border:"1px solid var(--border2)",borderRadius:6,color:"var(--accent)",cursor:"pointer",fontSize:12,padding:"4px 10px"}}>Change</button>
          </div>
        )}
        <div style={{fontSize:10,color:"var(--accent)",letterSpacing:2,fontWeight:"700",marginBottom:10}}>PLAYERS ({players.length})</div>
        {players.map(function(p,i){
          return (
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,background:"var(--card)",borderRadius:10,padding:"10px 14px",marginBottom:8,border:"1px solid var(--border)"}}>
              <div style={{width:28,height:28,borderRadius:"50%",background:CP(i),display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:"700",color:"#000",flexShrink:0}}>{i+1}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:15,fontWeight:"700",color:"var(--text)"}}>{p.name}</div>
                <div style={{fontSize:11,color:"var(--dim)"}}>{p.source} · {p.scores.reduce(function(s,v){return s+v;},0)} total</div>
              </div>
              <button onClick={function(){removePlayer(i);}} style={{background:"transparent",border:"1px solid var(--neg)",borderRadius:6,color:"var(--neg)",cursor:"pointer",fontSize:11,padding:"3px 8px"}}>✕</button>
            </div>
          );
        })}
        <div style={{fontSize:10,color:"var(--accent)",letterSpacing:2,fontWeight:"700",marginTop:20,marginBottom:10}}>ADD PLAYER</div>
        <button onClick={startScanner}
          style={{padding:14,background:"var(--card)",color:"var(--accent)",border:"1px solid var(--border2)",borderRadius:10,cursor:"pointer",fontSize:15,fontWeight:"700",textAlign:"left",width:"100%",marginBottom:8}}>
          📷 Scan QR Code <span style={{fontSize:11,color:"var(--dim)",fontWeight:"400"}}>— photo or screenshot of SWS QR</span>
        </button>
        <button onClick={function(){
          if (!showManual) {
            if (!refHoles) { setShowCourseModal(true); return; }
            var defaultHoles = refHoles || PRESET_COURSES[0].holes;
            setManualScores(defaultHoles.map(function(h){return String(h.par);}));
          }
          setShowManual(function(v){return !v;});
        }}
          style={{padding:14,background:"var(--card)",color:"var(--accent)",border:"1px solid var(--border2)",borderRadius:10,cursor:"pointer",fontSize:15,fontWeight:"700",textAlign:"left",width:"100%",marginBottom:8}}>
          ✏️ Manual Entry
        </button>
        {showManual && (function(){
          var displayHoles = refHoles || PRESET_COURSES[0].holes;
          function HoleRow(hi) {
            var par = displayHoles[hi] ? displayHoles[hi].par : 4;
            var score = parseInt(manualScores[hi],10)||par;
            var diff = score - par;
            var scoreCol = diff<=-1?"var(--accent)":diff===0?"var(--text)":diff===1?"var(--muted)":"var(--neg)";
            return (
              <div key={hi} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 0",borderBottom:"1px solid var(--border)"}}>
                <div style={{width:32,textAlign:"center",fontSize:12,color:"var(--muted)",flexShrink:0,fontWeight:"600"}}>H{hi+1}</div>
                <div style={{flex:1,display:"flex",alignItems:"center",background:"var(--input)",borderRadius:8,overflow:"hidden",border:"1px solid var(--border)"}}>
                  <button onClick={function(){var s=manualScores.slice();s[hi]=String(Math.max(1,score-1));setManualScores(s);}}
                    style={{width:44,height:42,background:"transparent",border:"none",cursor:"pointer",fontSize:22,color:"var(--muted)",flexShrink:0}}>−</button>
                  <div style={{flex:1,textAlign:"center",fontSize:22,fontWeight:"700",color:scoreCol}}>{score}</div>
                  <button onClick={function(){var s=manualScores.slice();s[hi]=String(score+1);setManualScores(s);}}
                    style={{width:44,height:42,background:"transparent",border:"none",cursor:"pointer",fontSize:22,color:"var(--muted)",flexShrink:0}}>+</button>
                </div>
              </div>
            );
          }
          return (
            <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:10,padding:14,marginTop:4}}>
              <input value={manualName} onChange={function(e){setManualName(e.target.value);}} placeholder="Player name"
                style={ext(S.inp,{width:"100%",boxSizing:"border-box",marginBottom:10,fontSize:16})}/>

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
                <div>
                  <div style={{fontSize:10,color:"var(--accent)",letterSpacing:2,fontWeight:"700",marginBottom:4}}>FRONT 9</div>
                  {Array.from({length:9},function(_,i){return HoleRow(i);})}
                  <div style={{fontSize:11,color:"var(--dim)",marginTop:6,textAlign:"right"}}>
                    Total <b style={{color:"var(--text)"}}>{Array.from({length:9},function(_,i){return parseInt(manualScores[i],10)||(displayHoles[i]?displayHoles[i].par:4);}).reduce(function(a,b){return a+b;},0)}</b>
                  </div>
                </div>
                <div>
                  <div style={{fontSize:10,color:"var(--accent)",letterSpacing:2,fontWeight:"700",marginBottom:4}}>BACK 9</div>
                  {Array.from({length:9},function(_,i){return HoleRow(i+9);})}
                  <div style={{fontSize:11,color:"var(--dim)",marginTop:6,textAlign:"right"}}>
                    Total <b style={{color:"var(--text)"}}>{Array.from({length:9},function(_,i){return parseInt(manualScores[i+9],10)||(displayHoles[i+9]?displayHoles[i+9].par:4);}).reduce(function(a,b){return a+b;},0)}</b>
                  </div>
                </div>
              </div>
              <button onClick={addManualPlayer} disabled={!manualName.trim()} style={ext(S.btn,{opacity:manualName.trim()?1:0.4})}>Add Player</button>
            </div>
          );
        })()}
        {scanError && !showScanner && !scanError.startsWith("duplicate:") && (
          <div style={{background:"var(--card)",border:"1px solid var(--neg)",borderRadius:8,padding:"10px 14px",color:"var(--neg)",fontSize:13,marginTop:10}}>
            {scanError}
          </div>
        )}

      </div>
      {players.length>=1 && (
        <div style={{position:"fixed",bottom:0,left:0,right:0,padding:"12px 16px 16px",background:isLight?"linear-gradient(0deg,#fff 70%,transparent)":"linear-gradient(0deg,#0a1a0a 70%,transparent)"}}>
          <button onClick={function(){setStep("preview");}} style={S.btn}>PREVIEW SCORES →</button>
        </div>
      )}
    </div>
  );

  // PREVIEW SCREEN
  if (step==="preview") {
    var pholes = refHoles || Array.from({length:18},function(_,i){return{par:4,si:i+1};});
    return (
      <div className={tc} style={{minHeight:"100vh",background:"var(--bg)",color:"var(--text)"}}>
        <style>{TCSS}</style>
        <div style={{background:"var(--card)",padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid var(--border)"}}>
          <button onClick={function(){setStep("load");}} style={{background:"transparent",border:"none",color:"var(--accent)",cursor:"pointer",fontSize:15}}>← Back</button>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:18,fontWeight:"700",letterSpacing:1}}>SCORE PREVIEW</div>
            <div style={{fontSize:14,fontWeight:"600",color:"var(--muted)"}}>{refCourseName||"Course"}</div>
          </div>
          <div style={{width:60}}/>
        </div>
        <div style={{padding:"12px 8px 120px",overflowX:"auto"}}>
          <table style={{borderCollapse:"collapse",fontSize:11,minWidth:"100%"}}>
            <thead>
              <tr style={{background:"var(--card)"}}>
                <th style={ext(S.th,{textAlign:"left",padding:"6px 8px",position:"sticky",left:0,background:"var(--card)",zIndex:1,fontSize:10,color:"var(--accent)",letterSpacing:1,borderRight:"1px solid var(--border2)",borderBottom:"1px solid var(--border2)"})}>Player</th>
                {pholes.map(function(h,i){
                  return <th key={i} style={ext(S.th,{width:22,padding:"4px 2px",fontSize:10,color:i===8||i===17?"var(--accent)":"var(--dim)",borderRight:i===8?"2px solid var(--border2)":"1px solid var(--border)",borderBottom:"1px solid var(--border2)"})}>{i+1}</th>;
                })}
                <th style={ext(S.th,{width:32,color:"var(--accent)",fontSize:10,padding:"4px 3px",borderLeft:"2px solid var(--border2)",borderBottom:"1px solid var(--border2)"})}>TOT</th>
              </tr>
              <tr style={{background:"var(--input)"}}>
                <th style={ext(S.th,{textAlign:"left",padding:"3px 8px",fontSize:9,color:"var(--dim)",position:"sticky",left:0,background:"var(--input)",zIndex:1,borderRight:"1px solid var(--border2)",borderBottom:"1px solid var(--border)"})}>Par</th>
                {pholes.map(function(h,i){
                  return <th key={i} style={ext(S.th,{padding:"2px",fontSize:9,borderRight:i===8?"2px solid var(--border2)":"1px solid var(--border)",borderBottom:"1px solid var(--border)"})}>{h.par}</th>;
                })}
                <th style={ext(S.th,{fontSize:9,borderLeft:"2px solid var(--border2)",borderBottom:"1px solid var(--border)"})}>72</th>
              </tr>
            </thead>
            <tbody>
              {players.map(function(p,pi){
                var tot=p.scores.reduce(function(s,v){return s+(v>0?v:0);},0);
                return (
                  <tr key={pi} style={{background:pi%2===0?"var(--input)":"var(--card)"}}>
                    <td style={ext(S.td,{textAlign:"left",padding:"5px 8px",fontWeight:"700",color:CP(pi),position:"sticky",left:0,background:pi%2===0?"var(--input)":"var(--card)",zIndex:1,fontSize:12,borderRight:"1px solid var(--border2)"})}>{p.name}</td>
                    {pholes.map(function(h,i){
                      var g=p.scores[i];
                      var diff=g>0?g-h.par:null;
                      var col=diff===null?"var(--dim)":diff<0?(isLight?"#16a34a":COLORS[0]):diff===0?"var(--muted)":"var(--neg)";
                      return <td key={i} style={ext(S.td,{padding:"3px 1px",fontSize:11,fontWeight:g>0?"600":"400",color:col,borderRight:i===8?"2px solid var(--border2)":"1px solid var(--border)",borderBottom:"1px solid var(--border)"})}>{g>0?g:"—"}</td>;
                    })}
                    <td style={ext(S.td,{fontWeight:"700",color:CP(pi),fontSize:13,padding:"3px 6px",borderLeft:"2px solid var(--border2)"})}>{tot||"—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{position:"fixed",bottom:0,left:0,right:0,padding:"12px 16px 16px",background:isLight?"linear-gradient(0deg,#fff 70%,transparent)":"linear-gradient(0deg,#0a1a0a 70%,transparent)"}}>
          <button onClick={function(){setStep("matchup");}} style={S.btn}>SET UP MATCHUPS →</button>
        </div>
      </div>
    );
  }

  // MATCHUP SCREEN
  if (step==="matchup") return (
    <div className={tc} style={{minHeight:"100vh",background:"var(--bg)",color:"var(--text)"}}>
      <style>{TCSS}</style>
      <div style={{background:"var(--card)",padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid var(--border)"}}>
        <button onClick={function(){setStep("preview");}} style={{background:"transparent",border:"none",color:"var(--accent)",cursor:"pointer",fontSize:15}}>← Back</button>
        <div style={{fontSize:18,fontWeight:"700",letterSpacing:1}}>MATCHUPS</div>
        <div style={{width:60}}/>
      </div>
      <div style={{maxWidth:480,margin:"0 auto",padding:"16px 16px 140px"}}>
        <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:10,padding:14,marginBottom:16}}>
          <div style={{fontSize:10,color:"var(--accent)",letterSpacing:2,fontWeight:"700",marginBottom:10}}>FIRST NINE — ALL MATCHUPS</div>
          <div style={{display:"flex",gap:8}}>
            {[["front","Front 9"],["back","Back 9"]].map(function(item){
              return (
                <button key={item[0]} onClick={function(){setGlobalFirstNine(item[0]);setResults(null);setHalftimeResults(null);}}
                  style={{flex:1,padding:"12px 0",borderRadius:8,cursor:"pointer",fontSize:15,fontWeight:"700",
                    border:"1px solid "+(globalFirstNine===item[0]?"var(--accent)":"var(--border)"),
                    background:globalFirstNine===item[0]?"var(--accent)":"transparent",
                    color:globalFirstNine===item[0]?"#000":"var(--muted)"}}>
                  {item[1]}
                </button>
              );
            })}
          </div>
        </div>
        {matchups.map(function(m,mi){
          var p1col=m.p1<players.length?CP(m.p1):"var(--dim)";
          var p2col=m.p2<players.length?CP(m.p2):"var(--dim)";
          var giverF=m.strokesFront>=0?m.p1:m.p2, recvF=m.strokesFront>=0?m.p2:m.p1;
          var giverB=m.strokesBack>=0?m.p1:m.p2,  recvB=m.strokesBack>=0?m.p2:m.p1;
          function upd(field,val){
            setMatchups(function(prev){var n=prev.map(function(x){return Object.assign({},x);});n[mi][field]=val;return n;});
            setResults(null); setHalftimeResults(null);
          }
          return (
            <div key={mi} style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:10,padding:14,marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <span style={{fontSize:11,color:"var(--accent)",letterSpacing:2,fontWeight:"700"}}>MATCH {mi+1}</span>
                {matchups.length>1 && <button onClick={function(){setMatchups(function(prev){return prev.filter(function(_,i){return i!==mi;});});}}
                  style={{background:"transparent",border:"1px solid var(--neg)",borderRadius:6,color:"var(--neg)",cursor:"pointer",fontSize:11,padding:"3px 8px"}}>Remove</button>}
              </div>
              <div style={{display:"flex",gap:6,marginBottom:10}}>
                {[["nassau","Nassau"],["gdb","GDB"]].map(function(item){
                  return <button key={item[0]} onClick={function(){upd("type",item[0]);}}
                    style={{flex:1,padding:"8px 0",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:"700",
                      border:"1px solid "+(m.type===item[0]?"var(--accent)":"var(--border)"),
                      background:m.type===item[0]?"var(--accent)":"transparent",color:m.type===item[0]?"#000":"var(--muted)"}}>{item[1]}</button>;
                })}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                <select value={m.p1} style={ext(S.sel,{flex:1})} onChange={function(e){upd("p1",Number(e.target.value));}}>
                  {players.map(function(p,i){return <option key={i} value={i}>{p.name}</option>;})}
                </select>
                <span style={{color:"var(--dim)",fontSize:13,flexShrink:0}}>vs</span>
                <select value={m.p2} style={ext(S.sel,{flex:1})} onChange={function(e){upd("p2",Number(e.target.value));}}>
                  {players.map(function(p,i){return <option key={i} value={i}>{p.name}</option>;})}
                </select>
              </div>
              {[["FRONT","strokesFront",giverF,recvF],["BACK","strokesBack",giverB,recvB]].map(function(row){
                var label=row[0], field=row[1], giver=row[2], recv=row[3];
                return (
                  <div key={field} style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                    <div>
                      <div style={{fontSize:10,color:"var(--dim)",letterSpacing:1}}>{label} STROKES</div>
                      <div style={{fontSize:12,color:"var(--muted)"}}>
                        {m[field]===0 ? "Scratch" :
                          <span><span style={{color:CP(giver),fontWeight:"600"}}>{players[giver]?players[giver].name:"?"}</span>{" gives "}<span style={{color:CP(recv),fontWeight:"600"}}>{players[recv]?players[recv].name:"?"}</span>{" "+Math.abs(m[field])}</span>
                        }
                      </div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",background:"var(--input)",border:"1px solid var(--border)",borderRadius:10,overflow:"hidden"}}>
                      <button onClick={function(){upd(field,m[field]-1);}} style={S.pm}>−</button>
                      <span style={{width:38,textAlign:"center",color:"var(--accent)",fontSize:18,fontWeight:"700"}}>{Math.abs(m[field])}</span>
                      <button onClick={function(){upd(field,m[field]+1);}} style={S.pm}>+</button>
                    </div>
                  </div>
                );
              })}
              <div onClick={function(){upd("autoAdjust",!m.autoAdjust);}}
                style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 12px",borderRadius:8,background:"var(--input)",border:"1px solid "+(m.autoAdjust?"var(--accent)":"var(--border)"),cursor:"pointer",marginBottom:8,userSelect:"none"}}>
                <div>
                  <div style={{fontSize:13,fontWeight:"600",color:m.autoAdjust?"var(--accent)":"var(--muted)"}}>Auto-adjust 2nd nine strokes</div>
                  <div style={{fontSize:11,color:"var(--dim)",marginTop:2}}>Winner of 1st nine gives more strokes</div>
                </div>
                <div style={{width:40,height:22,borderRadius:11,background:m.autoAdjust?"var(--accent)":"var(--border)",position:"relative",flexShrink:0}}>
                  <div style={{width:16,height:16,borderRadius:"50%",background:"#fff",position:"absolute",top:3,left:m.autoAdjust?20:3}}/>
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:m.type==="nassau"?8:0}}>
                <span style={{fontSize:13,color:"var(--muted)"}}>Stake</span>
                <div style={{display:"flex",alignItems:"center",background:"var(--input)",border:"1px solid var(--border)",borderRadius:10,overflow:"hidden"}}>
                  <button onClick={function(){upd("stake",Math.max(1,m.stake-1));}} style={S.pm}>−</button>
                  <span style={{width:42,textAlign:"center",color:"var(--accent)",fontSize:16,fontWeight:"700"}}>${m.stake}</span>
                  <button onClick={function(){upd("stake",m.stake+1);}} style={S.pm}>+</button>
                </div>
              </div>
              {m.type==="nassau" && (
                <div style={{marginTop:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                    <span style={{fontSize:13,color:"var(--muted)"}}>Units ratio</span>
                    <span style={{fontSize:11,color:"var(--dim)"}}>{(m.units||[1,1,2]).join(" : ")} · max ${(m.units||[1,1,2]).reduce(function(s,u){return s+u;},0)*m.stake}</span>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    {["F","B","18"].map(function(lbl,ui){
                      return (
                        <div key={ui} style={{flex:1,textAlign:"center"}}>
                          <div style={{fontSize:10,color:"var(--dim)",marginBottom:4,letterSpacing:1}}>{lbl}</div>
                          <div style={{display:"flex",alignItems:"center",background:"var(--card)",border:"1px solid var(--border)",borderRadius:10,overflow:"hidden"}}>
                            <button onClick={function(){setMatchups(function(prev){var n=prev.map(function(x){return Object.assign({},x,{units:(x.units||[1,1,2]).slice()});});n[mi].units[ui]=Math.max(0,n[mi].units[ui]-1);return n;});}} style={S.pm}>−</button>
                            <span style={{width:28,textAlign:"center",color:(m.units||[1,1,2])[ui]===0?"var(--dim)":"var(--accent)",fontSize:16,fontWeight:"700"}}>{(m.units||[1,1,2])[ui]}</span>
                            <button onClick={function(){setMatchups(function(prev){var n=prev.map(function(x){return Object.assign({},x,{units:(x.units||[1,1,2]).slice()});});n[mi].units[ui]+=1;return n;});}} style={S.pm}>+</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {m.type==="gdb" && <div style={{background:"var(--input)",borderRadius:8,padding:"6px 10px",fontSize:12,color:"var(--dim)",marginTop:8}}>Game ${m.stake*3} · Dormie ${m.stake} · Bye ${m.stake} · max ${m.stake*5}/nine</div>}
            </div>
          );
        })}
        <button onClick={function(){setMatchups(function(prev){return prev.concat([{p1:0,p2:1,type:"nassau",strokesFront:0,strokesBack:0,autoAdjust:true,stake:5,units:[1,1,2]}]);});}}
          style={ext(S.cBtn,{width:"100%",textAlign:"center",marginBottom:8})}>+ Add Matchup ({matchups.length} total)</button>
      </div>
      <div style={{position:"fixed",bottom:0,left:0,right:0,padding:"12px 16px 16px",background:isLight?"linear-gradient(0deg,#fff 70%,transparent)":"linear-gradient(0deg,#0a1a0a 70%,transparent)"}}>
        <button onClick={function(){setResults(null);setHalftimeResults(null);computeResults();setStep("shitadara");}} style={S.btn}>
          START MATCHUP →
        </button>
      </div>
    </div>
  );

  // SHITADARA — staging screen before entering the Dohyo
  if (step==="shitadara") return (
    <div className={tc} style={{minHeight:"100vh",background:"var(--bg)",color:"var(--text)"}}>
      <style>{TCSS}</style>
      <div style={{background:"var(--card)",padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid var(--border)"}}>
        <button onClick={function(){setStep("matchup");}} style={{background:"transparent",border:"none",color:"var(--accent)",cursor:"pointer",fontSize:15}}>← Back</button>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <DohyoLogo size={32}/>
          <div>
            <div style={{fontSize:16,fontWeight:"800",letterSpacing:3,color:"var(--text)",lineHeight:1}}>dohyo</div>
            <div style={{fontSize:9,color:"var(--muted)",letterSpacing:1}}>Settle the score</div>
          </div>
        </div>
        <button onClick={function(){setStep("results");}} style={{background:"transparent",border:"none",color:"var(--muted)",cursor:"pointer",fontSize:13}}>⚡ All</button>
      </div>
      <div style={{maxWidth:480,margin:"0 auto",padding:"24px 16px 40px"}}>
        <div style={{fontSize:11,color:"var(--muted)",letterSpacing:3,textAlign:"center",marginBottom:24}}>SELECT A MATCH TO ENTER THE RING</div>
        {(results||[]).map(function(r,mi){
          if (!r) return null;
          var m=matchups[mi];
          var p1=players[m.p1], p2=players[m.p2];
          var p1col=CP(m.p1), p2col=CP(m.p2);
          var isGDB=m.type==="gdb";
          var sfLabel = globalFirstNine==="front" ? m.strokesFront : m.strokesBack;
          var sbLabel = globalFirstNine==="front" ? m.strokesBack  : m.strokesFront;
          var giverF  = sfLabel>=0?p1:p2, recvF=sfLabel>=0?p2:p1;
          var giverFcol = sfLabel>=0?p1col:p2col, recvFcol=sfLabel>=0?p2col:p1col;
          var giverB  = sbLabel>=0?p1:p2, recvB=sbLabel>=0?p2:p1;
          var giverBcol = sbLabel>=0?p1col:p2col, recvBcol=sbLabel>=0?p2col:p1col;
          return (
            <div key={mi} style={{background:"var(--card)",border:"1px solid var(--border2)",borderRadius:14,padding:20,marginBottom:16}}>
              {/* Match header */}
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
                <div style={{fontSize:11,color:"var(--muted)",letterSpacing:2,fontWeight:"700"}}>MATCH {mi+1} · {isGDB?"GDB":"NASSAU"}</div>
                <div style={{fontSize:12,color:"var(--muted)"}}>${m.stake}{isGDB?" · max $"+(m.stake*5)+"/nine":""}</div>
              </div>
              {/* Players */}
              <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12,marginBottom:20}}>
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:28,fontWeight:"800",color:p1col}}>{p1.name}</div>
                </div>
                <div style={{fontSize:16,color:"var(--muted)",fontWeight:"700"}}>vs</div>
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:28,fontWeight:"800",color:p2col}}>{p2.name}</div>
                </div>
              </div>
              {/* Strokes */}
              <div style={{background:"var(--input)",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:12}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:sfLabel!==sbLabel?6:0}}>
                  <span style={{color:"var(--muted)"}}>1st nine</span>
                  <span>{Math.abs(sfLabel)===0
                    ? <span style={{color:"var(--muted)"}}>Scratch</span>
                    : <span><span style={{color:giverFcol,fontWeight:"700"}}>{giverF.name}</span><span style={{color:"var(--muted)"}}> gives </span><span style={{color:recvFcol,fontWeight:"700"}}>{recvF.name}</span><span style={{color:"var(--text)",fontWeight:"700",marginLeft:4}}>{Math.abs(sfLabel)}</span></span>
                  }</span>
                </div>
                {sfLabel !== sbLabel && (
                  <div style={{display:"flex",justifyContent:"space-between"}}>
                    <span style={{color:"var(--muted)"}}>2nd nine</span>
                    <span>{Math.abs(sbLabel)===0
                      ? <span style={{color:"var(--muted)"}}>Scratch</span>
                      : <span><span style={{color:giverBcol,fontWeight:"700"}}>{giverB.name}</span><span style={{color:"var(--muted)"}}> gives </span><span style={{color:recvBcol,fontWeight:"700"}}>{recvB.name}</span><span style={{color:"var(--text)",fontWeight:"700",marginLeft:4}}>{Math.abs(sbLabel)}</span></span>
                    }</span>
                  </div>
                )}
                {sfLabel === sbLabel && Math.abs(sfLabel)>0 && (
                  <div style={{fontSize:11,color:"var(--muted)",marginTop:2}}>both nines</div>
                )}
              </div>
              {/* Fast / Slow buttons */}
              <div style={{display:"flex",gap:10}}>
                <button onClick={function(){setSlowIdx(mi);setStep("singleResult");}}
                  style={{flex:1,padding:"14px 0",background:"var(--input)",color:"var(--text)",border:"1px solid var(--border2)",borderRadius:10,cursor:"pointer",fontSize:16,fontWeight:"700",letterSpacing:1}}>
                  ⚡ FAST
                </button>
                <button onClick={function(){setSlowIdx(mi);setStep("slow");}}
                  style={{flex:2,padding:"14px 0",background:"var(--accent)",color:"#000",border:"none",borderRadius:10,cursor:"pointer",fontSize:18,fontWeight:"800",letterSpacing:2}}>
                  🎙 ENTER dohyo
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // SINGLE RESULT SCREEN
  if (step==="singleResult") {
    var sr = results && results[slowIdx];
    var sm2 = matchups[slowIdx];
    if (!sr || !sm2) { setStep("results"); return null; }
    var srp1col = CP(sm2.p1), srp2col = CP(sm2.p2);
    var srnet = sr.dollars.net;
    var srwinner = srnet>0?sr.p1name:srnet<0?sr.p2name:null;
    var srloser = srnet>0?sr.p2name:srnet<0?sr.p1name:null;
    var srIsGDB = sr.type==="gdb";
    return (
      <div className={tc} style={{minHeight:"100vh",background:"var(--bg)",color:"var(--text)"}}>
        <style>{TCSS}</style>
        <div style={{background:"var(--card)",padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid var(--border)"}}>
          <button onClick={function(){setStep("shitadara");}} style={{background:"transparent",border:"none",color:"var(--accent)",cursor:"pointer",fontSize:15}}>← Back</button>
          <div style={{fontSize:16,fontWeight:"700",letterSpacing:1}}>MATCH {slowIdx+1} RESULT</div>
          <button onClick={function(){setStep("results");}} style={{background:"transparent",border:"none",color:"var(--dim)",cursor:"pointer",fontSize:13}}>All →</button>
        </div>
        <div style={{maxWidth:480,margin:"0 auto",padding:"16px 16px 40px"}}>
          <div style={{background:"var(--card)",border:"2px solid "+(srnet>0?srp1col:srnet<0?srp2col:"var(--border)"),borderRadius:10,padding:14,marginBottom:14}}>
            <div style={{fontSize:11,color:"var(--accent)",letterSpacing:2,fontWeight:"700",marginBottom:6}}>MATCH {slowIdx+1} · {srIsGDB?"GDB":"NASSAU"}</div>
            <div style={{fontSize:18,fontWeight:"800",marginBottom:6}}>
              <span style={{color:srp1col}}>{sr.p1name}</span>
              {" "}<span style={{color:"var(--dim)",fontSize:13}}>vs</span>{" "}
              <span style={{color:srp2col}}>{sr.p2name}</span>
            </div>
            {!srIsGDB && (function(){
              var u=sm2.units||[1,1,2];
              var f9s=globalFirstNine==="front"?(sr.front&&sr.front.status):(sr.back&&sr.back.status);
              var s9s=globalFirstNine==="front"?(sr.back&&sr.back.status):(sr.front&&sr.front.status);
              function fmtS(s){return s===0?"AS":(s>0?sr.p1name:sr.p2name)+" "+Math.abs(s)+" UP";}
              function row(label,dol,status){
                return (
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"1px solid var(--border)"}}>
                    <div>
                      <span style={{fontSize:15,color:"var(--muted)"}}>{label}</span>
                      <span style={{fontSize:15,color:status>0?srp1col:status<0?srp2col:"var(--dim)",fontWeight:"700",marginLeft:8}}>{fmtS(status)}</span>
                    </div>
                    <span style={{fontSize:16,color:dol>0?srp1col:dol<0?srp2col:"var(--dim)",fontWeight:"700"}}>{dol===0?"—":dol>0?"+$"+dol:"-$"+Math.abs(dol)}</span>
                  </div>
                );
              }
              return (
                <div style={{marginBottom:10}}>
                  {u[0]>0 && row("First 9 ×"+u[0], sr.dollars.frontDollars, f9s)}
                  {u[1]>0 && row("Second 9 ×"+u[1], sr.dollars.backDollars, s9s)}
                  {u[2]>0 && row("Overall ×"+u[2], sr.dollars.overallDollars, sr.overall&&sr.overall.status)}
                </div>
              );
            })()}
            {srIsGDB && [
              ["FIRST 9",  globalFirstNine==="front"?sr.front:sr.back,  globalFirstNine==="front"?sr.dollars.front:sr.dollars.back],
              ["SECOND 9", globalFirstNine==="front"?sr.back:sr.front,  globalFirstNine==="front"?sr.dollars.back:sr.dollars.front]
            ].map(function(row){
              var label=row[0], seg9=row[1], dol9=row[2];
              if (!seg9||!dol9) return null;
              var gStatus=seg9.game?seg9.game.status:0;
              var dStatus=seg9.dormie?seg9.dormie.status:0;
              var bStatus=seg9.buy?seg9.buy.status:0;
              function fmtSt(s){return s===0?"AS":(s>0?sr.p1name:sr.p2name)+" "+Math.abs(s)+" UP";}
              return (
                <div key={label} style={{marginBottom:8}}>
                  <div style={{fontSize:10,color:"var(--accent)",letterSpacing:1,fontWeight:"700",marginBottom:4}}>{label}</div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"1px solid var(--border)"}}>
                    <div><span style={{fontSize:15,color:"var(--dim)"}}>Game ×3</span><span style={{fontSize:15,color:gStatus>0?srp1col:gStatus<0?srp2col:"var(--dim)",fontWeight:"700",marginLeft:8}}>{fmtSt(gStatus)}</span></div>
                    <span style={{fontSize:16,color:dol9.gameDollars>0?srp1col:dol9.gameDollars<0?srp2col:"var(--dim)",fontWeight:"700"}}>{dol9.gameDollars===0?"—":dol9.gameDollars>0?"+$"+dol9.gameDollars:"-$"+Math.abs(dol9.gameDollars)}</span>
                  </div>
                  {seg9.dormie && <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"1px solid var(--border)"}}>
                    <div><span style={{fontSize:15,color:"var(--dim)"}}>Dormie ×1</span><span style={{fontSize:15,color:dStatus>0?srp1col:dStatus<0?srp2col:"var(--dim)",fontWeight:"700",marginLeft:8}}>{fmtSt(dStatus)}</span></div>
                    <span style={{fontSize:16,color:dol9.dormieDollars>0?srp1col:dol9.dormieDollars<0?srp2col:"var(--dim)",fontWeight:"700"}}>{dol9.dormieDollars===0?"—":dol9.dormieDollars>0?"+$"+dol9.dormieDollars:"-$"+Math.abs(dol9.dormieDollars)}</span>
                  </div>}
                  {seg9.buy && <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"1px solid var(--border)"}}>
                    <div><span style={{fontSize:15,color:"var(--dim)"}}>Bye ×1</span><span style={{fontSize:15,color:bStatus>0?srp1col:bStatus<0?srp2col:"var(--dim)",fontWeight:"700",marginLeft:8}}>{fmtSt(bStatus)}</span></div>
                    <span style={{fontSize:16,color:dol9.buyDollars>0?srp1col:dol9.buyDollars<0?srp2col:"var(--dim)",fontWeight:"700"}}>{dol9.buyDollars===0?"—":dol9.buyDollars>0?"+$"+dol9.buyDollars:"-$"+Math.abs(dol9.buyDollars)}</span>
                  </div>}
                </div>
              );
            })}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:10,marginTop:4}}>
              <span style={{fontSize:14,fontWeight:"700",color:"var(--text)"}}>
                {srnet===0 ? "All Square" :
                  <span><span style={{color:srnet>0?srp2col:srp1col}}>{srloser}</span><span style={{color:"var(--muted)"}}> owes </span><span style={{color:srnet>0?srp1col:srp2col}}>{srwinner}</span></span>
                }
              </span>
              <span style={{fontSize:26,fontWeight:"700",color:srnet>0?(isLight?"#16a34a":COLORS[0]):srnet<0?"var(--neg)":"var(--dim)"}}>
                {srnet===0?"—":"$"+Math.abs(srnet)}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

    // RESULTS SCREEN
  if (step==="results") return (
    <div className={tc} style={{minHeight:"100vh",background:"var(--bg)",color:"var(--text)"}}>
      <style>{TCSS}</style>
      <div style={{background:"var(--card)",padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid var(--border)"}}>
        <button onClick={function(){setStep("shitadara");}} style={{background:"transparent",border:"none",color:"var(--accent)",cursor:"pointer",fontSize:15}}>← Back</button>
        <div style={{fontSize:18,fontWeight:"700",letterSpacing:1}}>RESULTS</div>
        <button onClick={function(){
          var html = generateDohyoReport({players,matchups,results,refCourseName,globalFirstNine});
          setReportHTML(html);
          setStep("report");
        }} style={{background:"transparent",border:"none",color:"var(--accent)",cursor:"pointer",fontSize:13}}>📄 Report</button>
      </div>
      <div style={{maxWidth:480,margin:"0 auto",padding:"16px 16px 40px"}}>
        <div style={{fontSize:10,color:"var(--accent)",letterSpacing:2,fontWeight:"700",marginBottom:10}}>SETTLEMENT</div>
        {(results||[]).map(function(r,mi){
          if (!r) return null;
          var m=matchups[mi];
          var p1col=CP(m.p1), p2col=CP(m.p2);
          var net=r.dollars.net;
          var winner=net>0?r.p1name:net<0?r.p2name:null;
          var loser=net>0?r.p2name:net<0?r.p1name:null;
          var isGDB=r.type==="gdb";
          return (
            <div key={mi} style={{background:"var(--card)",border:"2px solid "+(net>0?p1col:net<0?p2col:"var(--border)"),borderRadius:10,padding:14,marginBottom:14}}>
              <div style={{fontSize:11,color:"var(--accent)",letterSpacing:2,fontWeight:"700",marginBottom:6}}>MATCH {mi+1} · {isGDB?"GDB":"NASSAU"}</div>
              <div style={{fontSize:18,fontWeight:"800",marginBottom:6}}>
                <span style={{color:p1col}}>{r.p1name}</span>
                {" "}<span style={{color:"var(--dim)",fontSize:13}}>vs</span>{" "}
                <span style={{color:p2col}}>{r.p2name}</span>
              </div>
              {!isGDB && (function(){
                var u=m.units||[1,1,2];
                var f9s=globalFirstNine==="front"?(r.front&&r.front.status):(r.back&&r.back.status);
                var s9s=globalFirstNine==="front"?(r.back&&r.back.status):(r.front&&r.front.status);
                function fmtS(s){return s===0?"AS":(s>0?r.p1name:r.p2name)+" "+Math.abs(s)+" UP";}
                function row(label,dol,status){
                  return (
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"1px solid var(--border)"}}>
                      <div>
                        <span style={{fontSize:15,color:"var(--muted)"}}>{label}</span>
                        <span style={{fontSize:15,color:status>0?p1col:status<0?p2col:"var(--dim)",fontWeight:"700",marginLeft:8}}>{fmtS(status)}</span>
                      </div>
                      <span style={{fontSize:16,color:dol>0?p1col:dol<0?p2col:"var(--dim)",fontWeight:"700"}}>{dol===0?"—":dol>0?"+$"+dol:"-$"+Math.abs(dol)}</span>
                    </div>
                  );
                }
                return (
                  <div style={{marginBottom:10}}>
                    {u[0]>0 && row("First 9 ×"+u[0], r.dollars.frontDollars, f9s)}
                    {u[1]>0 && row("Second 9 ×"+u[1], r.dollars.backDollars, s9s)}
                    {u[2]>0 && row("Overall ×"+u[2], r.dollars.overallDollars, r.overall&&r.overall.status)}
                  </div>
                );
              })()}
              {isGDB && [
                ["FIRST 9",  globalFirstNine==="front"?r.front:r.back,  globalFirstNine==="front"?r.dollars.front:r.dollars.back],
                ["SECOND 9", globalFirstNine==="front"?r.back:r.front,  globalFirstNine==="front"?r.dollars.back:r.dollars.front]
              ].map(function(row){
                var label=row[0], seg9=row[1], dol9=row[2];
                if (!seg9||!dol9) return null;
                var gStatus=seg9.game?seg9.game.status:0;
                var dStatus=seg9.dormie?seg9.dormie.status:0;
                var bStatus=seg9.buy?seg9.buy.status:0;
                function fmtSt(s){return s===0?"AS":(s>0?r.p1name:r.p2name)+" "+Math.abs(s)+" UP";}
                return (
                  <div key={label} style={{marginBottom:8}}>
                    <div style={{fontSize:10,color:"var(--accent)",letterSpacing:1,fontWeight:"700",marginBottom:4}}>{label}</div>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"1px solid var(--border)"}}>
                      <div><span style={{fontSize:15,color:"var(--dim)"}}>Game ×3</span><span style={{fontSize:15,color:gStatus>0?p1col:gStatus<0?p2col:"var(--dim)",fontWeight:"700",marginLeft:8}}>{fmtSt(gStatus)}</span></div>
                      <span style={{fontSize:16,color:dol9.gameDollars>0?p1col:dol9.gameDollars<0?p2col:"var(--dim)",fontWeight:"700"}}>{dol9.gameDollars===0?"—":dol9.gameDollars>0?"+$"+dol9.gameDollars:"-$"+Math.abs(dol9.gameDollars)}</span>
                    </div>
                    {seg9.dormie && <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"1px solid var(--border)"}}>
                      <div><span style={{fontSize:15,color:"var(--dim)"}}>Dormie ×1</span><span style={{fontSize:15,color:dStatus>0?p1col:dStatus<0?p2col:"var(--dim)",fontWeight:"700",marginLeft:8}}>{fmtSt(dStatus)}</span></div>
                      <span style={{fontSize:16,color:dol9.dormieDollars>0?p1col:dol9.dormieDollars<0?p2col:"var(--dim)",fontWeight:"700"}}>{dol9.dormieDollars===0?"—":dol9.dormieDollars>0?"+$"+dol9.dormieDollars:"-$"+Math.abs(dol9.dormieDollars)}</span>
                    </div>}
                    {seg9.buy && <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"1px solid var(--border)"}}>
                      <div><span style={{fontSize:15,color:"var(--dim)"}}>Bye ×1</span><span style={{fontSize:15,color:bStatus>0?p1col:bStatus<0?p2col:"var(--dim)",fontWeight:"700",marginLeft:8}}>{fmtSt(bStatus)}</span></div>
                      <span style={{fontSize:16,color:dol9.buyDollars>0?p1col:dol9.buyDollars<0?p2col:"var(--dim)",fontWeight:"700"}}>{dol9.buyDollars===0?"—":dol9.buyDollars>0?"+$"+dol9.buyDollars:"-$"+Math.abs(dol9.buyDollars)}</span>
                    </div>}
                  </div>
                );
              })}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:10,marginTop:4}}>
                <span style={{fontSize:14,fontWeight:"700",color:"var(--text)"}}>
                  {net===0 ? "All Square" :
                    <span><span style={{color:net>0?p2col:p1col}}>{loser}</span><span style={{color:"var(--muted)"}}> owes </span><span style={{color:net>0?p1col:p2col}}>{winner}</span></span>
                  }
                </span>
                <span style={{fontSize:26,fontWeight:"700",color:net>0?(isLight?"#16a34a":COLORS[0]):net<0?"var(--neg)":"var(--dim)"}}>
                  {net===0?"—":"$"+Math.abs(net)}
                </span>
              </div>
            </div>
          );
        })}
        {(function(){
          var ledger={};
          (results||[]).forEach(function(r,mi){
            if(!r||r.dollars.net===0) return;
            var m=matchups[mi], net=r.dollars.net;
            var payer=net>0?r.p2name:r.p1name, payee=net>0?r.p1name:r.p2name, amt=Math.abs(net);
            var key=[payer,payee].sort().join("|");
            if(!ledger[key]) ledger[key]={payer:payer,payee:payee,amount:0};
            ledger[key].amount+=(ledger[key].payer===payer?1:-1)*amt;
          });
          var list=Object.values(ledger).filter(function(s){return s.amount!==0;}).map(function(s){return s.amount<0?{payer:s.payee,payee:s.payer,amount:-s.amount}:s;});
          if (!list.length) return null;
          return (
            <div style={{background:"var(--card)",border:"1px solid var(--border2)",borderRadius:10,padding:14,marginTop:8}}>
              <div style={{fontSize:10,color:"var(--accent)",letterSpacing:2,fontWeight:"700",marginBottom:10}}>PAY UP</div>
              {list.map(function(s,i){
                return (
                  <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:i<list.length-1?"1px solid var(--border)":"none"}}>
                    <span style={{fontSize:14,color:"var(--text)"}}>
                      <span style={{color:"var(--neg)",fontWeight:"700"}}>{s.payer}</span>
                      <span style={{color:"var(--dim)"}}> pays </span>
                      <span style={{color:isLight?"#16a34a":COLORS[0],fontWeight:"700"}}>{s.payee}</span>
                    </span>
                    <span style={{fontSize:24,fontWeight:"700",color:isLight?"#16a34a":COLORS[0]}}>${s.amount}</span>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    </div>
  );

  // REPORT SCREEN
  if (step==="report") return (
    <div style={{minHeight:"100vh",background:"#fff",display:"flex",flexDirection:"column"}}>
      <div style={{background:"#f3f4f6",padding:"10px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid #e5e7eb",flexShrink:0}}>
        <button onClick={function(){setStep("results");}} style={{background:"transparent",border:"none",color:"#16a34a",cursor:"pointer",fontSize:15}}>← Back</button>
        <div style={{fontSize:15,fontWeight:"700",color:"#111"}}>Report</div>
        <button onClick={function(){
          var blob = new Blob([reportHTML],{type:"text/html"});
          var a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = "dohyo-report.html";
          a.click();
        }} style={{background:"transparent",border:"none",color:"#16a34a",cursor:"pointer",fontSize:13}}>⬇ Save</button>
      </div>
      <iframe srcDoc={reportHTML} style={{flex:1,border:"none",width:"100%",minHeight:"80vh"}} title="Dohyo Report"/>
    </div>
  );

  return null;
}
