import { useState, useEffect, useRef } from "react";

const COLORS       = ["#4ade80", "#60a5fa", "#f97316", "#e879f9"];
const COLORS_LIGHT = ["#16a34a", "#2563eb", "#c2410c", "#9333ea"];

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
      var fb = setTimeout(resolve, Math.max(2000, text.length*60));
      u.onend  = function(){ clearTimeout(fb); resolve(); };
      u.onerror= function(){ clearTimeout(fb); resolve(); };
      window.speechSynthesis.speak(u);
    });
  }

  useEffect(function(){ setShowNett(false); setWaiting(false); speechFired.current = {}; }, [playPos]);

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
          if (isFirstNineBound) setShowHalftime(true); else setWaiting(true);
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
      <div style={{background:isLight?"#e0e0e0":"#111",padding:"10px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:isLight?"1px solid #ccc":"1px solid #333"}}>
        <button onClick={function(){window.speechSynthesis&&window.speechSynthesis.cancel();onBack();}} style={{background:"transparent",border:"none",color:isLight?"#16a34a":"#4ade80",cursor:"pointer",fontSize:15}}>← Back</button>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:14,fontWeight:"700",letterSpacing:2,color:isLight?"#16a34a":"#4ade80"}}>MATCH {matchupIdx+1} · {isGDB?"GDB":"NASSAU"}</div>
          <div style={{fontSize:12,color:isLight?"#333":"#aaa"}}>
            <span style={{color:p1col}}>{p1.name}</span> vs <span style={{color:p2col}}>{p2.name}</span>
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button onClick={function(){window.speechSynthesis&&window.speechSynthesis.cancel();setPlayPos(function(p){return Math.max(0,p-1);});setShowHalftime(false);setDone(false);setWaiting(false);setPaused(false);}} disabled={playPos===0}
            style={{background:"transparent",border:"1px solid "+(playPos===0?(isLight?"#ccc":"#333"):(isLight?"#bbb":"#222")),borderRadius:6,color:playPos===0?(isLight?"#ccc":"#333"):(isLight?"#333":"#aaa"),cursor:playPos===0?"default":"pointer",fontSize:15,padding:"4px 10px"}}>◀</button>
          <button onClick={function(){setAudioOn(function(v){return !v;});}}
            style={{background:"transparent",border:"1px solid "+(audioOn?(isLight?"#16a34a":"#4ade80"):(isLight?"#bbb":"#222")),borderRadius:6,color:audioOn?(isLight?"#16a34a":"#4ade80"):(isLight?"#bbb":"#222"),cursor:"pointer",fontSize:15,padding:"4px 8px"}}>{audioOn?"🔊":"🔇"}</button>
          <button onClick={function(){if(!paused)window.speechSynthesis&&window.speechSynthesis.cancel();setPaused(function(v){return !v;});}}
            style={{background:"transparent",border:"1px solid "+(paused?"#f97316":(isLight?"#bbb":"#222")),borderRadius:6,color:paused?"#f97316":(isLight?"#000":"#fff"),cursor:"pointer",fontSize:15,padding:"4px 8px"}}>{paused?"▶":"⏸"}</button>
        </div>
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
                    <div style={{fontSize:12,color:"#aaa",marginTop:5}}>2nd nine: {Math.abs(orig)} stroke{Math.abs(orig)!==1?"s":""} · <span style={{color:isLight?"#333":"#aaa"}}>no adjustment</span></div>
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
              SEE ALL RESULTS →
            </button>
          </div>
        )}
      </div>
      <div style={{height:3,background:isLight?"#ccc":"#333"}}><div style={{height:"100%",background:isLight?"#16a34a":"#4ade80",width:((playPos+1)/18*100)+"%"}}/></div>
    </div>
  );
}

// ─── DECODE QR ────────────────────────────────────────────────────────────────
function decodeQRPayload(str) {
  try {
    var d = JSON.parse(str);
    if (d.v !== "1") return null;
    var holes = [];
    for (var i = 0; i < 36; i+=2) holes.push({ par: d.ho[i], si: d.ho[i+1] });
    var scores = [];
    for (var h = 0; h < 18; h++) scores.push(d.sf.slice(h*4, h*4+4));
    var inPlay = Array.from({length:18}, function(_,i){ return !!(d.ip & (1<<i)); });
    return { courseName:d.c, names:d.p, hcps:d.h, holes:holes, scores:scores,
             inPlay:inPlay, games:d.g, stakes:d.st, dollars:d.dl, nassau:d.nassau||[], firstNine:d.fn };
  } catch(e) { return null; }
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  var il = useState(false); var isLight=il[0], setIsLight=il[1];
  var st = useState("load"); var step=st[0], setStep=st[1];
  var pl = useState([]); var players=pl[0], setPlayers=pl[1];
  var rh = useState(null); var refHoles=rh[0], setRefHoles=rh[1];
  var rc = useState(null); var refCourseName=rc[0], setRefCourseName=rc[1];
  var gf = useState("front"); var globalFirstNine=gf[0], setGlobalFirstNine=gf[1];
  var mu = useState([{p1:0,p2:1,type:"nassau",strokesFront:0,strokesBack:0,autoAdjust:true,stake:5,units:[1,1,2]}]);
  var matchups=mu[0], setMatchups=mu[1];
  var rs = useState(null); var results=rs[0], setResults=rs[1];
  var ht = useState(null); var halftimeResults=ht[0], setHalftimeResults=ht[1];
  var sm = useState(false); var showManual=sm[0], setShowManual=sm[1];
  var mn = useState(""); var manualName=mn[0], setManualName=mn[1];
  var ms = useState(Array(18).fill("")); var manualScores=ms[0], setManualScores=ms[1];
  var si = useState(0); var slowIdx=si[0], setSlowIdx=si[1];
  var sc = useState(false); var showScanner=sc[0], setShowScanner=sc[1];
  var se = useState(null); var scanError=se[0], setScanError=se[1];
  var videoRef = useRef(null);
  var scannerRef = useRef(null);

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
      if (!d) { setScanError("Invalid QR — not a Swimming With Sharks round"); return false; }
      if (!checkIntegrity(d.holes, d.courseName)) return false;
      var newPlayers = d.names.map(function(name, pi) {
        return {
          name: name || ("P"+(pi+1)),
          scores: d.scores.map(function(row){ return row[pi]||0; }),
          source: sourceLabel || d.courseName || "QR",
          holes: d.holes,
        };
      });
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
    setPlayers(function(prev){
      return prev.concat([{name:manualName.trim(),scores:manualScores.map(function(s){return parseInt(s,10)||0;}),source:"Manual",holes:refHoles}]);
    });
    setManualName(""); setManualScores(Array(18).fill("")); setShowManual(false);
  }
  async function startScanner() {
    setScanError(null); setShowScanner(true);
    try {
      var stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode:"environment" } });
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); scannerRef.current = stream; startPoll(); }
    } catch(e) { setScanError("Camera access denied — use manual entry instead."); setShowScanner(false); }
  }
  function stopScanner() {
    if (scannerRef.current) { scannerRef.current.getTracks().forEach(function(t){t.stop();}); scannerRef.current = null; }
    setShowScanner(false);
  }
  function startPoll() {
    var canvas = document.createElement("canvas");
    var ctx = canvas.getContext("2d");
    function poll() {
      if (!videoRef.current || !scannerRef.current) return;
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      if (canvas.width === 0) { setTimeout(poll, 300); return; }
      ctx.drawImage(videoRef.current, 0, 0);
      var img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      if (window.jsQR) {
        var code = window.jsQR(img.data, img.width, img.height);
        if (code && code.data) {
          loadFromQRPayload(code.data, "Flight");
          stopScanner();
          return;
        }
      }
      setTimeout(poll, 500);
    }
    if (!window.jsQR) {
      var s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js";
      s.onload = function(){ setTimeout(poll, 500); };
      s.onerror = function(){ setScanError("QR scanner unavailable — use manual entry."); stopScanner(); };
      document.head.appendChild(s);
    } else { setTimeout(poll, 300); }
  }
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
      globalFirstNine={globalFirstNine} onDone={function(){setStep("results");}} onBack={function(){setStep("shitadara");}} />
  );

  // SCANNER SCREEN
  if (showScanner) return (
    <div style={{minHeight:"100vh",background:"#000",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20}}>
      <style>{TCSS}</style>
      <div style={{fontSize:14,color:"#4ade80",marginBottom:12}}>Point camera at QR code</div>
      <video ref={videoRef} style={{width:"100%",maxWidth:360,borderRadius:8,border:"2px solid #4ade80"}} playsInline muted/>
      {scanError&&<div style={{color:"#f87171",fontSize:12,marginTop:10,textAlign:"center"}}>{scanError}</div>}
      <button onClick={stopScanner} style={{marginTop:20,padding:"12px 32px",background:"transparent",color:"#4ade80",border:"1px solid #4ade80",borderRadius:10,cursor:"pointer",fontSize:15}}>Cancel</button>
    </div>
  );

  // LOAD SCREEN
  if (step==="load") return (
    <div className={tc} style={{minHeight:"100vh",background:"var(--bg)",color:"var(--text)"}}>
      <style>{TCSS}</style>
      <div style={{background:"var(--card)",padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid var(--border)"}}>
        <div style={{width:60}}/>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <DohyoLogo size={36}/>
          <div>
            <div style={{fontSize:18,fontWeight:"800",letterSpacing:3,color:"var(--text)",lineHeight:1}}>DOHYO</div>
            <div style={{fontSize:9,color:"var(--dim)",letterSpacing:1}}>Step into the ring, settle the score</div>
          </div>
        </div>
        <button onClick={function(){setIsLight(function(v){return !v;});}} style={{background:"transparent",border:"none",color:"var(--dim)",cursor:"pointer",fontSize:18,width:60}}>{isLight?"🌙":"☀️"}</button>
      </div>
      <div style={{maxWidth:480,margin:"0 auto",padding:"16px 16px 120px"}}>
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
          📷 Scan QR Code <span style={{fontSize:11,color:"var(--dim)",fontWeight:"400"}}>— scan a SWS QR code</span>
        </button>
        <button onClick={function(){setShowManual(function(v){return !v;});}}
          style={{padding:14,background:"var(--card)",color:"var(--accent)",border:"1px solid var(--border2)",borderRadius:10,cursor:"pointer",fontSize:15,fontWeight:"700",textAlign:"left",width:"100%",marginBottom:8}}>
          ✏️ Manual Entry
        </button>
        {showManual && (
          <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:10,padding:14,marginTop:4}}>
            <input value={manualName} onChange={function(e){setManualName(e.target.value);}} placeholder="Player name"
              style={ext(S.inp,{width:"100%",boxSizing:"border-box",marginBottom:12})}/>
            <div style={{fontSize:11,color:"var(--dim)",marginBottom:6}}>Holes 1–9</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(9,1fr)",gap:4,marginBottom:8}}>
              {Array.from({length:9},function(_,i){
                return (
                  <div key={i} style={{textAlign:"center"}}>
                    <div style={{fontSize:9,color:"var(--dim)",marginBottom:2}}>{i+1}</div>
                    <input type="number" min="1" max="15" value={manualScores[i]}
                      onChange={function(e){var s=manualScores.slice();s[i]=e.target.value;setManualScores(s);}}
                      style={ext(S.inp,{width:"100%",textAlign:"center",fontSize:13,padding:"3px 2px",boxSizing:"border-box"})}/>
                  </div>
                );
              })}
            </div>
            <div style={{fontSize:11,color:"var(--dim)",marginBottom:6}}>Holes 10–18</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(9,1fr)",gap:4,marginBottom:12}}>
              {Array.from({length:9},function(_,i){
                return (
                  <div key={i+9} style={{textAlign:"center"}}>
                    <div style={{fontSize:9,color:"var(--dim)",marginBottom:2}}>{i+10}</div>
                    <input type="number" min="1" max="15" value={manualScores[i+9]}
                      onChange={function(e){var s=manualScores.slice();s[i+9]=e.target.value;setManualScores(s);}}
                      style={ext(S.inp,{width:"100%",textAlign:"center",fontSize:13,padding:"3px 2px",boxSizing:"border-box"})}/>
                  </div>
                );
              })}
            </div>
            <button onClick={addManualPlayer} disabled={!manualName.trim()} style={ext(S.btn,{opacity:manualName.trim()?1:0.4})}>Add Player</button>
          </div>
        )}
        {scanError && !showScanner && <div style={{background:"var(--card)",border:"1px solid var(--neg)",borderRadius:8,padding:"10px 14px",color:"var(--neg)",fontSize:13,marginTop:10}}>{scanError}</div>}
      </div>
      {players.length>=2 && (
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
            <div style={{fontSize:11,color:"var(--dim)"}}>{refCourseName||"Course"}</div>
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
            <div style={{fontSize:16,fontWeight:"800",letterSpacing:3,color:"var(--text)",lineHeight:1}}>DOHYO</div>
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
                <button onClick={function(){setStep("results");}}
                  style={{flex:1,padding:"14px 0",background:"var(--input)",color:"var(--text)",border:"1px solid var(--border2)",borderRadius:10,cursor:"pointer",fontSize:16,fontWeight:"700",letterSpacing:1}}>
                  ⚡ FAST
                </button>
                <button onClick={function(){setSlowIdx(mi);setStep("slow");}}
                  style={{flex:2,padding:"14px 0",background:"var(--accent)",color:"#000",border:"none",borderRadius:10,cursor:"pointer",fontSize:18,fontWeight:"800",letterSpacing:2}}>
                  🎙 ENTER DOHYO
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // RESULTS SCREEN
  if (step==="results") return (
    <div className={tc} style={{minHeight:"100vh",background:"var(--bg)",color:"var(--text)"}}>
      <style>{TCSS}</style>
      <div style={{background:"var(--card)",padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid var(--border)"}}>
        <button onClick={function(){setStep("shitadara");}} style={{background:"transparent",border:"none",color:"var(--accent)",cursor:"pointer",fontSize:15}}>← Back</button>
        <div style={{fontSize:18,fontWeight:"700",letterSpacing:1}}>RESULTS</div>
        <button onClick={function(){setStep("load");}} style={{background:"transparent",border:"none",color:"var(--dim)",cursor:"pointer",fontSize:13}}>Reset</button>
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

  return null;
}
