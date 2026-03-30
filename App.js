import React, { useState, useEffect } from "react";

// ── [설정 창] 여기 숫자만 바꾸면 앱에 바로 반영됨 ──────────────────────
const FX_RATE = 1488;   // 현재 환율
const VIX_NOW = 31.05;  // VIX 지수
const CNN_NOW = 18;     // CNN Fear & Greed 지수 (0~100)
// ──────────────────────────────────────────────────────────

const CONDITIONS = [
  { rank:"1순위", emoji:"💹", title:"금리 스탠스",     pct:18, color:"#ff3b3b", role:"비중 조절",       roleDesc:"금리 전환 시 최대 비중 +20% 허용", data:[["기준금리","3.50~3.75%","neg"],["FOMC","매파 동결","neg"],["Core PCE","3.1%","neg"],["점도표","25bp 1회↓","warn"]], signal:"파월 매파 유지. 5월 FOMC + 후임 워쉬 지명이 핵심 변수." },
  { rank:"2순위", emoji:"🛢️", title:"유가 선물커브",   pct:28, color:"#f5c542", role:"매수 속도 조절",   roleDesc:"백워데이션 유지 시 매수 간격 2배로 늘림", data:[["WTI 현물","$99.64","neg"],["WTI 12월물","$77.36","warn"],["커브 구조","백워데이션","warn"],["4/6 최후통첩","D-8","neg"]], signal:"강한 백워데이션. 콘탱고 전환 전까지 매수 속도 절반 유지." },
  { rank:"3순위", emoji:"👷", title:"실업률 (후행)",   pct:15, color:"#ff3b3b", role:"참고용만",         roleDesc:"매수 결정에 직접 사용 안 함. 추세만 모니터링.", data:[["2월 실업률","4.4%","neg"],["2월 고용","–92,000명","neg"],["수정치","–69,000명↓","neg"],["추세","재악화","neg"]], signal:"후행지표. 매수 속도 조절 참고용으로만 사용." },
  { rank:"4순위", emoji:"📊", title:"기업 실적",       pct:12, color:"#f5c542", role:"비중 조절",       roleDesc:"EPS 하향 멈추면 최대 비중 제한 해제", data:[["S&P500","6,369","neg"],["VIX","31.05","neg"],["CAPE P/E","39.8x","neg"],["EPS 추세","하향 중","neg"]], signal:"4월 어닝시즌이 첫 리트머스. 하향 지속 시 최대 비중 –10%." },
  { rank:"5순위", emoji:"💳", title:"크레딧 스프레드", pct:20, color:"#4fc3f7", role:"최대 비중 캡",     roleDesc:"HY 700bp+ 시 최대 비중 40%로 강제 제한", data:[["HY 스프레드","487bp","neg"],["IG 스프레드","112bp","warn"],["전월 대비","+89bp↑","neg"],["위험 임계","700bp","warn"]], signal:"현재 경고 구간(487bp). 700bp 돌파 시 최대 비중 자동 캡 적용." },
];

const TOTAL = CONDITIONS.reduce((s,c)=>s+c.pct,0)/100;

function getMacroSpeed(score) {
  if (score<2) return { label:"공포", speed:"느리게", interval:"4~6주", col:"#ff3b3b" };
  if (score<3) return { label:"중립", speed:"보통",   interval:"2~3주", col:"#f5c542" };
  if (score<4) return { label:"안정", speed:"빠르게", interval:"1~2주", col:"#00e676" };
  return              { label:"과열", speed:"매우 천천히", interval:"8주+", col:"#4fc3f7" };
}

function getCnnStrength(cnn) {
  if (cnn<=25)  return { label:"Extreme Fear", strength:100, buy:"최대", col:"#ff3b3b", bg:"rgba(255,59,59,0.1)" };
  if (cnn<=45)  return { label:"Fear",         strength:70,  buy:"많이", col:"#f5c542", bg:"rgba(245,197,66,0.08)" };
  if (cnn<=55)  return { label:"Neutral",      strength:40,  buy:"보통", col:"#aaaacc", bg:"rgba(170,170,200,0.06)" };
  if (cnn<=75)  return { label:"Greed",        strength:20,  buy:"적게", col:"#00e676", bg:"rgba(0,230,118,0.07)" };
  return               { label:"Extreme Greed",strength:5,   buy:"최소", col:"#4fc3f7", bg:"rgba(79,195,247,0.07)" };
}

function getVixBoost(vix) {
  if (vix>=35) return { label:"패닉 (≥35)", boost:"+30%", mult:1.3, col:"#ff3b3b", override:true };
  if (vix>=25) return { label:"경계 (25~35)", boost:"+15%", mult:1.15, col:"#f5c542", override:false };
  if (vix>=20) return { label:"주의 (20~25)", boost:"±0%",  mult:1.0,  col:"#aaaacc", override:false };
  return              { label:"안정 (<20)",  boost:"–10%", mult:0.9,  col:"#00e676", override:false };
}

function getFxAdj(rate) {
  if (rate<1400) return { label:"LOW",    adj:"+10%", mult:1.1,  col:"#00e676", cap:100 };
  if (rate<1480) return { label:"NORMAL", adj:"±0%",  mult:1.0,  col:"#a0d070", cap:80  };
  if (rate<1550) return { label:"HIGH",   adj:"–15%", mult:0.85, col:"#f5c542", cap:70  };
  return                { label:"DANGER", adj:"–40%", mult:0.6,  col:"#ff3b3b", cap:30  };
}

function calcResult() {
  const cnn  = getCnnStrength(CNN_NOW);
  const vix  = getVixBoost(VIX_NOW);
  const macro= getMacroSpeed(TOTAL);
  const fx   = getFxAdj(FX_RATE);
  const isOverride = vix.override && cnn.label === "Extreme Fear";
  const rawStrength = isOverride ? 100 : Math.min(100, cnn.strength * vix.mult);
  const finalStrength = Math.min(100, rawStrength * fx.mult);
  const finalCap = Math.min(fx.cap, 15);
  return { cnn, vix, macro, fx, isOverride, rawStrength, finalStrength, finalCap };
}

function Bar({ pct, color, height=3 }) {
  const [w, setW] = useState(0);
  useEffect(()=>{ setTimeout(()=>setW(pct),400); },[pct]);
  return (
    <div style={{height, background:"#12121f", borderRadius:2}}>
      <div style={{height:"100%", width:`${w}%`, background:color, borderRadius:2, transition:"width 1s ease"}}/>
    </div>
  );
}

function Ring({ score, max, size=96 }) {
  const [a,setA]=useState(false);
  useEffect(()=>{setTimeout(()=>setA(true),150);},[]);
  const r=size/2-7, circ=2*Math.PI*r;
  const offset=circ*(1-(a?score/max:0));
  return (
    <div style={{position:"relative",width:size,height:size,flexShrink:0}}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{transform:"rotate(-90deg)"}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#12121f" strokeWidth="7"/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#ff3b3b" strokeWidth="7" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} style={{transition:"stroke-dashoffset 1.5s ease"}}/>
      </svg>
      <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
        <div style={{fontFamily:"monospace",fontSize:24,fontWeight:900,color:"#ff3b3b"}}>{score.toFixed(1)}</div>
      </div>
    </div>
  );
}

function MiniArc({ pct, color, size=44 }) {
  const [a,setA]=useState(false);
  useEffect(()=>{setTimeout(()=>setA(true),500);},[]);
  const r=17, circ=2*Math.PI*r;
  const offset=circ*(1-(a?pct/100:0));
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" style={{transform:"rotate(-90deg)"}}>
      <circle cx="22" cy="22" r={r} fill="none" stroke="#12121f" strokeWidth="5"/>
      <circle cx="22" cy="22" r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} style={{transition:"stroke-dashoffset 1s ease"}}/>
    </svg>
  );
}

function CondCard({ c, i }) {
  const [open,setOpen]=useState(false);
  const vc=t=>t==="neg"?"#ff5555":t==="warn"?"#f5c542":"#00e676";
  return (
    <div style={{background:"#0c0c18",border:"1px solid #1a1a2e",borderRadius:9, marginBottom:7,borderLeft:`3px solid ${c.color}`,overflow:"hidden"}}>
      <div style={{padding:"12px 13px"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
          <MiniArc pct={c.pct} color={c.color}/>
          <div style={{flex:1}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div><div style={{fontSize:13,fontWeight:700,color:"#d0d0e8"}}>{c.emoji} {c.title}</div></div>
              <div style={{fontFamily:"monospace",fontSize:19,fontWeight:900,color:c.color}}>{c.pct}%</div>
            </div>
            <div style={{marginTop:5}}><Bar pct={c.pct} color={c.color}/></div>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,marginBottom:8}}>
          {c.data.map(([k,v,t],j)=>(
            <div key={j} style={{background:"#080812",border:"1px solid #151525",borderRadius:5,padding:"5px 8px"}}>
              <div style={{fontSize:9,color:"#444460"}}>{k}</div>
              <div style={{fontFamily:"monospace",fontSize:11,fontWeight:700,color:vc(t)}}>{v}</div>
            </div>
          ))}
        </div>
        <button onClick={()=>setOpen(!open)} style={{background:"none",border:"none",color:"#444460",fontSize:10,cursor:"pointer"}}>
          {open?"▲ 접기":"▼ 세부 방법"}
        </button>
        {open&&( <div style={{marginTop:9,fontSize:11,color:"#6060a0"}}>{c.signal}</div> )}
      </div>
    </div>
  );
}

function AlgoFlow() {
  const result = calcResult();
  const { cnn, vix, macro, fx, isOverride, finalStrength, finalCap } = result;
  const steps = [
    { id:"S0", icon:"🎯", title:"가격 도달?", role:"트리거", roleCol:"#4fc3f7", currentVal: "도달 가정", currentCol: "#00e676" },
    { id:"S1", icon:"😱", title:"CNN 지수", role:"강도 결정", roleCol:"#ff3b3b", currentVal: `${CNN_NOW}pt · ${cnn.label}`, currentCol: cnn.col },
    { id:"S2", icon:"📈", title:"VIX", role:"보정/예외", roleCol:"#f5c542", currentVal: `${VIX_NOW} · ${vix.label}`, currentCol: vix.col },
    { id:"S3", icon:"📊", title:"매크로", role:"속도 조절", roleCol:"#a0a0ff", currentVal: `${TOTAL.toFixed(1)}점 · ${macro.label}`, currentCol: macro.col },
    { id:"S4", icon:"💱", title:"환율", role:"수량 조절", roleCol:"#aaaacc", currentVal: `${FX_RATE}원 · ${fx.label}`, currentCol: fx.col },
  ];
  return (
    <div style={{background:"#0c0c18",border:"1px solid #1a1a2e",borderRadius:12, padding:"14px 13px",marginBottom:14}}>
      {isOverride && <div style={{background:"rgba(255,59,59,0.12)",border:"1px solid #ff3b3b",borderRadius:8,padding:"10px",marginBottom:12,color:"#ff3b3b",fontWeight:900}}>⚡ OVERRIDE: 즉시 MAX 실행</div>}
      {steps.map((s)=>(
        <div key={s.id} style={{display:"flex",gap:11,marginBottom:8}}>
          <div style={{width:38,height:38,background:"#111122",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center"}}>{s.icon}</div>
          <div style={{flex:1,background:"#0a0a16",padding:"9px",borderRadius:8,borderLeft:`2px solid ${s.roleCol}`}}>
            <div style={{fontSize:13,fontWeight:700}}>{s.title} <span style={{fontSize:9,color:s.roleCol}}>[{s.role}]</span></div>
            <div style={{fontSize:11,color:s.currentCol,fontFamily:"monospace"}}>{s.currentVal}</div>
          </div>
        </div>
      ))}
      <div style={{marginTop:10,background:"rgba(0,230,118,0.07)",padding:"13px",borderRadius:10,border:"1px solid #00e676"}}>
        <div style={{fontSize:14,fontWeight:900,color:"#e0e0f8"}}>최종: {Math.round(finalStrength)}% 강도 / {macro.interval} 간격</div>
      </div>
    </div>
  );
}

export default function App() {
  const macro = getMacroSpeed(TOTAL);
  const fx = getFxAdj(FX_RATE);
  return (
    <div style={{background:"#07070e",minHeight:"100vh",padding:"20px",color:"#d0d0e8",fontFamily:"sans-serif"}}>
      <div style={{maxWidth:460,margin:"0 auto"}}>
        <div style={{marginBottom:20}}>
          <div style={{fontSize:24,fontWeight:900}}>바닥 투자 시스템 v4</div>
          <div style={{fontSize:12,color:"#444460"}}>DATA: 2026.03.30</div>
        </div>
        <div style={{background:"#0c0c18",padding:16,borderRadius:12,marginBottom:14,display:"flex",gap:14,alignItems:"center"}}>
          <Ring score={TOTAL} max={5}/>
          <div>
            <div style={{fontSize:14,fontWeight:900}}>매크로 점수: {TOTAL.toFixed(1)}</div>
            <div style={{fontSize:11,color:"#ff3b3b"}}>속도: {macro.interval} 간격 권장</div>
          </div>
        </div>
        <AlgoFlow/>
        {CONDITIONS.map((c,i)=><CondCard key={i} c={c} i={i}/>)}
      </div>
    </div>
  );
}
