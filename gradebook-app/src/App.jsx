import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer,
} from "recharts";
import {
  LayoutGrid, Table2, Users, Layers, ArrowLeft, Plus, Trash2, Pencil, Printer,
  Check, X, AlertTriangle, ChevronRight, GraduationCap, MessageSquare, RotateCcw,
} from "lucide-react";

/* ============================================================================
   STYLE TOKENS
   Paper ledger palette: warm parchment ground, deep ink text, a single
   oxblood accent reserved for interactive elements. Achievement-level colour
   is used ONLY for grade badges and the distribution chart.
============================================================================ */
const PALETTE = {
  paper: "#EFE9DB",
  paperRaised: "#FAF7EF",
  ink: "#28231E",
  inkSoft: "#6E6455",
  inkFaint: "#9A9080",
  rule: "#DCD2B8",
  ruleStrong: "#C9BC98",
  accent: "#6E2A2A",
  accentSoft: "#F1DFDC",
  accentText: "#F7EEEC",
};

const LEVEL_COLORS = { 4: "#3F7A5C", 3: "#2E6488", 2: "#B08526", 1: "#BD6A35", R: "#A6433F" };
const LEVEL_LABELS = { 4: "Level 4", 3: "Level 3", 2: "Level 2", 1: "Level 1", R: "Level R" };

const CATEGORY_ORDER = ["K", "T", "C", "A", "S", "F"];
const CATEGORY_LABELS = {
  K: "Knowledge & Understanding",
  T: "Thinking & Inquiry",
  C: "Communication",
  A: "Application",
  S: "Summative",
  F: "Final Exam",
};
const CATEGORY_COLORS = {
  K: "#55708C", T: "#7A5C8C", C: "#8C6A4A", A: "#6E6A8C", S: "#8C5C5C", F: "#3A4A5C",
};

const GlobalStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
    .gb-root { font-family:'IBM Plex Sans', sans-serif; color:${PALETTE.ink}; }
    .gb-display { font-family:'Fraunces', serif; }
    .gb-tab { font-variant-numeric: tabular-nums; }
    .gb-root ::selection { background:${PALETTE.accentSoft}; }
    .gb-scroll::-webkit-scrollbar { height:10px; width:10px; }
    .gb-scroll::-webkit-scrollbar-track { background:${PALETTE.paper}; }
    .gb-scroll::-webkit-scrollbar-thumb { background:${PALETTE.ruleStrong}; border-radius:6px; }
    .gb-focus:focus-visible { outline:2px solid ${PALETTE.accent}; outline-offset:2px; }
    .gb-cell:focus { outline:2px solid ${PALETTE.accent}; outline-offset:-2px; position:relative; z-index:5; }
    @keyframes gb-rise { from { transform: scaleY(0.4); opacity:0.3; } to { transform: scaleY(1); opacity:1; } }
    .gb-bar-rise { transform-origin: bottom; animation: gb-rise 0.5s cubic-bezier(.2,.8,.2,1) both; }
    @media (prefers-reduced-motion: reduce) { .gb-bar-rise { animation:none; } }
    @media print {
      .no-print { display:none !important; }
      .gb-print-area { box-shadow:none !important; border:none !important; }
      body { background:#fff !important; }
    }
  `}</style>
);

/* ============================================================================
   DETERMINISTIC RNG (seeded, for reproducible demo data)
============================================================================ */
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let idCounter = 0;
const genId = (p = "id") => `${p}-${Date.now().toString(36)}-${(idCounter++).toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/* ============================================================================
   DEFAULTS
============================================================================ */
function buildDefaultWeights() {
  return { K: 17.5, T: 17.5, C: 17.5, A: 17.5, S: 10, F: 20 };
}
function buildDefaultEvalTypes() {
  return [
    { id: genId("ev"), name: "Test", multiplier: 3 },
    { id: genId("ev"), name: "Quiz", multiplier: 2 },
    { id: genId("ev"), name: "Assignment", multiplier: 1 },
    { id: genId("ev"), name: "Inquiry", multiplier: 1 },
    { id: genId("ev"), name: "Presentation", multiplier: 3 },
    { id: genId("ev"), name: "Report/Essay", multiplier: 3 },
  ];
}
function buildDefaultGradeBands() {
  const rows = [
    ["L4++", 97, 100, 4], ["L4+", 93, 96, 4], ["L4", 90, 92, 4], ["L4-", 87, 89, 4],
    ["L3+", 83, 86, 3], ["L3", 80, 82, 3], ["L3-", 77, 79, 3],
    ["L2+", 73, 76, 2], ["L2", 70, 72, 2], ["L2-", 67, 69, 2],
    ["L1+", 63, 66, 1], ["L1", 60, 62, 1], ["L1-", 57, 59, 1],
    ["R+", 50, 56, "R"], ["R", 40, 49, "R"], ["R-", 0, 39, "R"],
  ];
  return rows.map(([label, min, max, level]) => ({ id: genId("band"), label, min, max, level }));
}

/* ============================================================================
   SEED DATA GENERATION
============================================================================ */
function makeClass({ name, term, rngSeed, studentNames, assessmentDefs }) {
  const rng = mulberry32(rngSeed);
  const evalTypes = buildDefaultEvalTypes();
  const findEval = (n) => evalTypes.find((e) => e.name === n).id;
  const assessments = assessmentDefs.map((a) => ({
    id: genId("as"), name: a.name, category: a.category, evalTypeId: findEval(a.evalTypeName), outOf: a.outOf,
  }));
  const students = studentNames.map((n) => ({ id: genId("st"), name: n }));
  const abilities = {};
  students.forEach((s) => { abilities[s.id] = 0.55 + rng() * 0.4; });
  const marks = {};
  students.forEach((s) => {
    marks[s.id] = {};
    assessments.forEach((a) => {
      if (rng() < 0.06) return; // missing mark, excluded from calc
      let pct = abilities[s.id] + (rng() - 0.5) * 0.16;
      if (a.category === "F" || a.category === "S") pct += (rng() - 0.5) * 0.08 - 0.02;
      pct = Math.min(1, Math.max(0.3, pct));
      marks[s.id][a.id] = Math.round(pct * a.outOf);
    });
  });
  return {
    id: genId("cls"), name, term,
    weights: buildDefaultWeights(),
    evalTypes, gradeBands: buildDefaultGradeBands(),
    assessments, students, marks, comments: {},
  };
}

function seedClasses() {
  const functions = makeClass({
    name: "Grade 11 Functions", term: "Fall 2026", rngSeed: 11,
    studentNames: ["Ava Thompson", "Liam Chen", "Sofia Martinez", "Noah Patel", "Emma Nguyen",
      "Lucas Kim", "Olivia Brown", "Ethan Singh", "Mia Rodriguez", "Jacob Lee"],
    assessmentDefs: [
      { name: "Quiz: Quadratic Relations", category: "K", evalTypeName: "Quiz", outOf: 20 },
      { name: "Test: Unit 1 Functions", category: "K", evalTypeName: "Test", outOf: 50 },
      { name: "Assignment: Function Transformations", category: "A", evalTypeName: "Assignment", outOf: 25 },
      { name: "Inquiry: Rate of Change Investigation", category: "T", evalTypeName: "Inquiry", outOf: 30 },
      { name: "Test: Trigonometric Identities", category: "K", evalTypeName: "Test", outOf: 40 },
      { name: "Presentation: Real-World Functions Project", category: "C", evalTypeName: "Presentation", outOf: 40 },
      { name: "Quiz: Exponential Functions", category: "K", evalTypeName: "Quiz", outOf: 20 },
      { name: "Assignment: Trig Applications", category: "A", evalTypeName: "Assignment", outOf: 25 },
      { name: "Culminating Task", category: "S", evalTypeName: "Test", outOf: 60 },
      { name: "Final Exam", category: "F", evalTypeName: "Test", outOf: 100 },
    ],
  });
  const english = makeClass({
    name: "Grade 12 English", term: "Fall 2026", rngSeed: 12,
    studentNames: ["Chloe Adams", "Ryan Wilson", "Priya Sharma", "Marcus Johnson", "Grace Kim",
      "Daniel O'Brien", "Zoe Campbell", "Aiden Murphy", "Isabella Torres", "Nathan Wright"],
    assessmentDefs: [
      { name: "Reading Response Quiz", category: "K", evalTypeName: "Quiz", outOf: 15 },
      { name: "Essay: Thematic Analysis", category: "T", evalTypeName: "Report/Essay", outOf: 40 },
      { name: "Seminar Presentation", category: "C", evalTypeName: "Presentation", outOf: 30 },
      { name: "Independent Study Project", category: "A", evalTypeName: "Inquiry", outOf: 35 },
      { name: "Grammar & Style Test", category: "K", evalTypeName: "Test", outOf: 30 },
      { name: "Essay: Comparative Literature", category: "T", evalTypeName: "Report/Essay", outOf: 50 },
      { name: "Group Discussion Assessment", category: "C", evalTypeName: "Assignment", outOf: 20 },
      { name: "Culminating Essay", category: "S", evalTypeName: "Report/Essay", outOf: 60 },
      { name: "Final Exam", category: "F", evalTypeName: "Test", outOf: 100 },
    ],
  });
  const science = makeClass({
    name: "Grade 10 Science", term: "Fall 2026", rngSeed: 10,
    studentNames: ["Ben Foster", "Clara Diaz", "Tyler Nguyen", "Hannah Scott", "Owen Bennett",
      "Sophie Turner", "Jack Edwards", "Amelia Ross", "Carter Bell", "Lily Osei"],
    assessmentDefs: [
      { name: "Chemistry Quiz", category: "K", evalTypeName: "Quiz", outOf: 20 },
      { name: "Lab Report: Chemical Reactions", category: "T", evalTypeName: "Report/Essay", outOf: 30 },
      { name: "Group Lab Presentation", category: "C", evalTypeName: "Presentation", outOf: 25 },
      { name: "Ecosystem Inquiry Project", category: "A", evalTypeName: "Inquiry", outOf: 30 },
      { name: "Physics Test", category: "K", evalTypeName: "Test", outOf: 40 },
      { name: "Lab Report: Motion", category: "T", evalTypeName: "Report/Essay", outOf: 30 },
      { name: "Safety & Procedure Quiz", category: "K", evalTypeName: "Quiz", outOf: 15 },
      { name: "Culminating Task", category: "S", evalTypeName: "Assignment", outOf: 50 },
      { name: "Final Exam", category: "F", evalTypeName: "Test", outOf: 100 },
    ],
  });
  return [functions, english, science];
}

/* ============================================================================
   GRADING MATH  (src/lib/grading.ts equivalent)
============================================================================ */
function categoryScore(cls, studentId, category) {
  const studentMarks = cls.marks[studentId] || {};
  const relevant = cls.assessments.filter((a) => a.category === category);
  let weightedSum = 0, weightTotal = 0;
  for (const a of relevant) {
    const raw = studentMarks[a.id];
    if (raw === undefined || raw === null || raw === "") continue;
    const evalType = cls.evalTypes.find((e) => e.id === a.evalTypeId);
    const mult = evalType ? evalType.multiplier : 1;
    const pct = (Number(raw) / a.outOf) * 100;
    weightedSum += pct * mult;
    weightTotal += mult;
  }
  if (weightTotal === 0) return null;
  return weightedSum / weightTotal;
}
function overallAverage(cls, studentId) {
  let weightedSum = 0, weightTotal = 0;
  for (const cat of CATEGORY_ORDER) {
    const score = categoryScore(cls, studentId, cat);
    if (score === null) continue;
    const w = Number(cls.weights[cat]) || 0;
    weightedSum += score * w;
    weightTotal += w;
  }
  if (weightTotal === 0) return null;
  return Math.round((weightedSum / weightTotal) * 10) / 10;
}
function bandForScore(cls, score) {
  if (score === null || score === undefined) return null;
  const bands = cls.gradeBands;
  let found = bands.find((b) => score >= Number(b.min) && score <= Number(b.max));
  if (!found) found = score > Number(bands[0].max) ? bands[0] : bands[bands.length - 1];
  return found;
}
function median(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
function classStats(cls) {
  const perStudent = cls.students.map((s) => {
    const avg = overallAverage(cls, s.id);
    const band = avg === null ? null : bandForScore(cls, avg);
    return { id: s.id, name: s.name, avg, band };
  });
  const graded = perStudent.filter((s) => s.avg !== null);
  const average = graded.length ? Math.round((graded.reduce((a, b) => a + b.avg, 0) / graded.length) * 10) / 10 : null;
  const med = graded.length ? Math.round(median(graded.map((s) => s.avg)) * 10) / 10 : null;
  const distribution = { 4: 0, 3: 0, 2: 0, 1: 0, R: 0 };
  graded.forEach((s) => { if (s.band) distribution[s.band.level]++; });
  return { perStudent, average, median: med, distribution, ungraded: perStudent.length - graded.length };
}
function weightTotalOf(weights) {
  return CATEGORY_ORDER.reduce((sum, c) => sum + (Number(weights[c]) || 0), 0);
}

/* ============================================================================
   STORAGE
============================================================================ */
const STORAGE_KEY = "gradebook:classes:v1";

async function loadClasses() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* not found or read error -> fall through to seed */ }
  return null;
}
async function saveClasses(classes) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(classes)); }
  catch (e) { /* best-effort, e.g. storage disabled or quota exceeded */ }
}

/* ============================================================================
   SMALL UI PRIMITIVES
============================================================================ */
function Badge({ level, label }) {
  const color = LEVEL_COLORS[level] || PALETTE.inkFaint;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold gb-tab"
      style={{ background: `${color}1A`, color, border: `1px solid ${color}55` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
function SectionTitle({ children, right }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="gb-display text-xl" style={{ color: PALETTE.ink }}>{children}</h2>
      {right}
    </div>
  );
}
function Panel({ children, className = "", raised = true }) {
  return (
    <div
      className={`rounded-xl p-5 ${className}`}
      style={{
        background: raised ? PALETTE.paperRaised : "transparent",
        border: `1px solid ${PALETTE.rule}`,
        boxShadow: raised ? "0 2px 10px rgba(40,35,30,0.06), 0 1px 2px rgba(40,35,30,0.05)" : "none",
      }}
    >
      {children}
    </div>
  );
}
function Btn({ children, onClick, variant = "primary", size = "md", icon: Icon, className = "", type = "button", disabled }) {
  const base = "inline-flex items-center gap-1.5 rounded-lg font-medium transition-colors gb-focus disabled:opacity-40 disabled:cursor-not-allowed";
  const sizes = size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2 text-sm";
  const styles = {
    primary: { background: PALETTE.accent, color: PALETTE.accentText },
    ghost: { background: "transparent", color: PALETTE.ink, border: `1px solid ${PALETTE.rule}` },
    subtle: { background: PALETTE.paper, color: PALETTE.ink },
    danger: { background: "transparent", color: PALETTE.accent, border: `1px solid ${PALETTE.accent}66` },
  }[variant];
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${sizes} ${className}`} style={styles}>
      {Icon && <Icon size={size === "sm" ? 14 : 16} />}
      {children}
    </button>
  );
}
function TextField({ value, onChange, className = "", type = "text", placeholder, step, min, max }) {
  return (
    <input
      type={type} value={value} placeholder={placeholder} step={step} min={min} max={max}
      onChange={(e) => onChange(type === "number" ? e.target.value : e.target.value)}
      className={`gb-focus rounded-md px-2.5 py-1.5 text-sm bg-transparent ${className}`}
      style={{ border: `1px solid ${PALETTE.rule}`, color: PALETTE.ink }}
    />
  );
}
function Select({ value, onChange, children, className = "" }) {
  return (
    <select
      value={value} onChange={(e) => onChange(e.target.value)}
      className={`gb-focus rounded-md px-2.5 py-1.5 text-sm ${className}`}
      style={{ border: `1px solid ${PALETTE.rule}`, color: PALETTE.ink, background: PALETTE.paperRaised }}
    >
      {children}
    </select>
  );
}
function Confirm({ prompt, onConfirm, onCancel }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs rounded-md px-2 py-1" style={{ background: PALETTE.accentSoft, color: PALETTE.accent }}>
      {prompt}
      <button onClick={onConfirm} className="gb-focus font-semibold underline">Yes</button>
      <button onClick={onCancel} className="gb-focus underline">No</button>
    </span>
  );
}

/* ============================================================================
   CLASS + TERM SELECTOR
============================================================================ */
function ClassTermSelector({ classes, currentClassId, onSelect }) {
  const current = classes.find((c) => c.id === currentClassId);
  const names = [...new Set(classes.map((c) => c.name))];
  const termsForName = current ? classes.filter((c) => c.name === current.name) : [];
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Select
        value={current ? current.name : ""}
        onChange={(name) => {
          const match = classes.find((c) => c.name === name);
          if (match) onSelect(match.id);
        }}
      >
        {names.map((n) => <option key={n} value={n}>{n}</option>)}
      </Select>
      <Select
        value={currentClassId}
        onChange={(id) => onSelect(id)}
      >
        {termsForName.map((c) => <option key={c.id} value={c.id}>{c.term}</option>)}
      </Select>
    </div>
  );
}

/* ============================================================================
   SIDEBAR / NAV
============================================================================ */
const NAV_ITEMS = [
  { key: "overview", label: "Overview", icon: LayoutGrid },
  { key: "grades", label: "Grades", icon: Table2 },
  { key: "students", label: "Students", icon: Users },
  { key: "classes", label: "Classes", icon: Layers },
];
function Sidebar({ view, setView }) {
  return (
    <aside
      className="no-print hidden md:flex flex-col w-56 shrink-0 py-6 px-4 gap-1"
      style={{ background: PALETTE.paperRaised, borderRight: `1px solid ${PALETTE.rule}` }}
    >
      <div className="flex items-center gap-2 px-2 mb-8">
        <GraduationCap size={22} color={PALETTE.accent} />
        <span className="gb-display text-lg" style={{ color: PALETTE.ink }}>Gradebook</span>
      </div>
      {NAV_ITEMS.map((item) => {
        const active = view === item.key || (item.key === "students" && view === "report");
        return (
          <button
            key={item.key}
            onClick={() => setView(item.key)}
            className="gb-focus flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-left transition-colors"
            style={{
              background: active ? PALETTE.accentSoft : "transparent",
              color: active ? PALETTE.accent : PALETTE.inkSoft,
              fontWeight: active ? 600 : 500,
            }}
          >
            <item.icon size={17} />
            {item.label}
          </button>
        );
      })}
      <div className="mt-auto px-2 pt-6 text-xs" style={{ color: PALETTE.inkFaint }}>
        Stored locally in this browser.
      </div>
    </aside>
  );
}
function MobileNav({ view, setView }) {
  return (
    <nav
      className="no-print md:hidden fixed bottom-0 left-0 right-0 flex justify-around py-2 z-30"
      style={{ background: PALETTE.paperRaised, borderTop: `1px solid ${PALETTE.rule}` }}
    >
      {NAV_ITEMS.map((item) => {
        const active = view === item.key || (item.key === "students" && view === "report");
        return (
          <button key={item.key} onClick={() => setView(item.key)} className="gb-focus flex flex-col items-center gap-0.5 px-3 py-1 text-[11px]" style={{ color: active ? PALETTE.accent : PALETTE.inkSoft }}>
            <item.icon size={18} />
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}

/* ============================================================================
   OVERVIEW PAGE
============================================================================ */
function DistributionChart({ distribution, selectedLevel, onSelectLevel }) {
  const data = ["4", "3", "2", "1", "R"].map((lvl) => ({
    level: lvl, label: LEVEL_LABELS[lvl].replace("Level ", ""), count: distribution[lvl] || 0,
  }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={PALETTE.rule} />
        <XAxis dataKey="label" tick={{ fill: PALETTE.inkSoft, fontSize: 12 }} axisLine={{ stroke: PALETTE.rule }} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fill: PALETTE.inkSoft, fontSize: 12 }} axisLine={false} tickLine={false} />
        <Tooltip
          cursor={{ fill: PALETTE.paper }}
          contentStyle={{ background: PALETTE.paperRaised, border: `1px solid ${PALETTE.rule}`, borderRadius: 8, fontSize: 13 }}
          formatter={(v) => [`${v} student${v === 1 ? "" : "s"}`, "Count"]}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={64} isAnimationActive={false}>
          {data.map((entry) => (
            <Cell
              key={entry.level}
              className="gb-bar-rise"
              fill={LEVEL_COLORS[entry.level]}
              opacity={selectedLevel && selectedLevel !== entry.level ? 0.35 : 1}
              stroke={selectedLevel === entry.level ? PALETTE.ink : "none"}
              strokeWidth={selectedLevel === entry.level ? 2 : 0}
              cursor="pointer"
              onClick={() => onSelectLevel(selectedLevel === entry.level ? null : entry.level)}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function OverviewPage({ cls, updateClass, onOpenStudent }) {
  const [selectedLevel, setSelectedLevel] = useState(null);
  const stats = useMemo(() => classStats(cls), [cls]);
  const wTotal = weightTotalOf(cls.weights);
  const wOk = Math.abs(wTotal - 100) < 0.001;

  const filteredStudents = selectedLevel
    ? stats.perStudent.filter((s) => s.band && s.band.level === selectedLevel)
    : stats.perStudent;

  const updateBand = (bandId, field, value) => {
    updateClass((c) => ({
      ...c,
      gradeBands: c.gradeBands.map((b) => (b.id === bandId ? { ...b, [field]: field === "label" ? value : Number(value) } : b)),
    }));
  };
  const updateWeight = (cat, value) => {
    updateClass((c) => ({ ...c, weights: { ...c.weights, [cat]: value === "" ? "" : Number(value) } }));
  };
  const updateEvalType = (id, field, value) => {
    updateClass((c) => ({
      ...c,
      evalTypes: c.evalTypes.map((e) => (e.id === id ? { ...e, [field]: field === "name" ? value : Number(value) } : e)),
    }));
  };
  const [deleteEvalId, setDeleteEvalId] = useState(null);
  const removeEvalType = (id) => {
    const usedBy = cls.assessments.filter((a) => a.evalTypeId === id).length;
    if (usedBy > 0) { setDeleteEvalId(null); return; }
    updateClass((c) => ({ ...c, evalTypes: c.evalTypes.filter((e) => e.id !== id) }));
  };
  const addEvalType = () => {
    updateClass((c) => ({ ...c, evalTypes: [...c.evalTypes, { id: genId("ev"), name: "New Type", multiplier: 1 }] }));
  };

  const bandCounts = useMemo(() => {
    const counts = {};
    cls.gradeBands.forEach((b) => (counts[b.id] = 0));
    stats.perStudent.forEach((s) => { if (s.band) counts[s.band.id] = (counts[s.band.id] || 0) + 1; });
    return counts;
  }, [cls.gradeBands, stats.perStudent]);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="grid grid-cols-2 gap-4">
        <Panel>
          <div className="text-sm mb-1" style={{ color: PALETTE.inkSoft }}>Class average</div>
          <div className="gb-display gb-tab text-4xl" style={{ color: PALETTE.ink }}>
            {stats.average === null ? "—" : stats.average.toFixed(1)}
          </div>
        </Panel>
        <Panel>
          <div className="text-sm mb-1" style={{ color: PALETTE.inkSoft }}>Class median</div>
          <div className="gb-display gb-tab text-4xl" style={{ color: PALETTE.ink }}>
            {stats.median === null ? "—" : stats.median.toFixed(1)}
          </div>
        </Panel>
      </div>

      <Panel>
        <SectionTitle right={selectedLevel && <Btn size="sm" variant="ghost" onClick={() => setSelectedLevel(null)} icon={X}>Clear filter</Btn>}>
          Achievement distribution
        </SectionTitle>
        <DistributionChart distribution={stats.distribution} selectedLevel={selectedLevel} onSelectLevel={setSelectedLevel} />
        {stats.ungraded > 0 && (
          <p className="text-xs mt-1" style={{ color: PALETTE.inkFaint }}>{stats.ungraded} student{stats.ungraded === 1 ? "" : "s"} without recorded marks are not shown above.</p>
        )}
        <div className="mt-4 divide-y" style={{ borderColor: PALETTE.rule }}>
          {filteredStudents.map((s) => (
            <button
              key={s.id}
              onClick={() => onOpenStudent(s.id)}
              className="gb-focus w-full flex items-center justify-between py-2.5 text-left hover:opacity-80"
              style={{ borderTop: `1px solid ${PALETTE.rule}` }}
            >
              <span className="text-sm font-medium">{s.name}</span>
              <span className="flex items-center gap-3">
                <span className="text-sm gb-tab" style={{ color: PALETTE.inkSoft }}>{s.avg === null ? "—" : s.avg.toFixed(1)}</span>
                {s.band ? <Badge level={s.band.level} label={s.band.label} /> : <span className="text-xs" style={{ color: PALETTE.inkFaint }}>No marks</span>}
                <ChevronRight size={16} color={PALETTE.inkFaint} />
              </span>
            </button>
          ))}
          {filteredStudents.length === 0 && <p className="text-sm py-3" style={{ color: PALETTE.inkFaint }}>No students in this bucket.</p>}
        </div>
      </Panel>

      <Panel>
        <SectionTitle>Grade bands</SectionTitle>
        <div className="overflow-x-auto gb-scroll">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ color: PALETTE.inkSoft }}>
                <th className="text-left font-medium pb-2 pr-2">Label</th>
                <th className="text-left font-medium pb-2 pr-2">Min %</th>
                <th className="text-left font-medium pb-2 pr-2">Max %</th>
                <th className="text-left font-medium pb-2 pr-2">Level</th>
                <th className="text-left font-medium pb-2">Students</th>
              </tr>
            </thead>
            <tbody>
              {cls.gradeBands.map((b) => (
                <tr key={b.id} style={{ borderTop: `1px solid ${PALETTE.rule}` }}>
                  <td className="py-1.5 pr-2">
                    <TextField value={b.label} onChange={(v) => updateBand(b.id, "label", v)} className="w-20" />
                  </td>
                  <td className="py-1.5 pr-2">
                    <TextField type="number" value={b.min} onChange={(v) => updateBand(b.id, "min", v)} className="w-16 gb-tab" />
                  </td>
                  <td className="py-1.5 pr-2">
                    <TextField type="number" value={b.max} onChange={(v) => updateBand(b.id, "max", v)} className="w-16 gb-tab" />
                  </td>
                  <td className="py-1.5 pr-2"><Badge level={b.level} label={LEVEL_LABELS[b.level]} /></td>
                  <td className="py-1.5 gb-tab">{bandCounts[b.id] || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel>
        <SectionTitle right={!wOk && (
          <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: PALETTE.accent }}>
            <AlertTriangle size={14} /> Weights total {wTotal.toFixed(1)}%, not 100%
          </span>
        )}>
          Category weighting
        </SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {CATEGORY_ORDER.map((cat) => (
            <div key={cat} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ border: `1px solid ${PALETTE.rule}` }}>
              <span className="text-sm">{CATEGORY_LABELS[cat]}</span>
              <span className="flex items-center gap-1">
                <TextField type="number" value={cls.weights[cat]} onChange={(v) => updateWeight(cat, v)} className="w-16 gb-tab text-right" />
                <span className="text-sm" style={{ color: PALETTE.inkSoft }}>%</span>
              </span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <SectionTitle right={<Btn size="sm" variant="ghost" icon={Plus} onClick={addEvalType}>Add type</Btn>}>
          Evaluation types
        </SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {cls.evalTypes.map((e) => (
            <div key={e.id} className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ border: `1px solid ${PALETTE.rule}` }}>
              <TextField value={e.name} onChange={(v) => updateEvalType(e.id, "name", v)} className="flex-1 min-w-0" />
              <span className="text-sm" style={{ color: PALETTE.inkSoft }}>×</span>
              <TextField type="number" value={e.multiplier} onChange={(v) => updateEvalType(e.id, "multiplier", v)} className="w-14 gb-tab text-right" />
              {deleteEvalId === e.id ? (
                <Confirm prompt="Remove?" onConfirm={() => removeEvalType(e.id)} onCancel={() => setDeleteEvalId(null)} />
              ) : (
                <button className="gb-focus p-1 rounded" style={{ color: PALETTE.inkFaint }} onClick={() => setDeleteEvalId(e.id)}>
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

/* ============================================================================
   GRADES PAGE
============================================================================ */
function AddAssessmentForm({ cls, onAdd, onCancel }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("K");
  const [evalTypeId, setEvalTypeId] = useState(cls.evalTypes[0]?.id || "");
  const [outOf, setOutOf] = useState(20);
  return (
    <div className="flex flex-wrap items-end gap-2 p-3 rounded-lg" style={{ background: PALETTE.paper, border: `1px solid ${PALETTE.rule}` }}>
      <div>
        <label className="block text-xs mb-1" style={{ color: PALETTE.inkSoft }}>Name</label>
        <TextField value={name} onChange={setName} placeholder="Assessment name" className="w-48" />
      </div>
      <div>
        <label className="block text-xs mb-1" style={{ color: PALETTE.inkSoft }}>Category</label>
        <Select value={category} onChange={setCategory}>
          {CATEGORY_ORDER.map((c) => <option key={c} value={c}>{c} — {CATEGORY_LABELS[c]}</option>)}
        </Select>
      </div>
      <div>
        <label className="block text-xs mb-1" style={{ color: PALETTE.inkSoft }}>Type</label>
        <Select value={evalTypeId} onChange={setEvalTypeId}>
          {cls.evalTypes.map((e) => <option key={e.id} value={e.id}>{e.name} (×{e.multiplier})</option>)}
        </Select>
      </div>
      <div>
        <label className="block text-xs mb-1" style={{ color: PALETTE.inkSoft }}>Out of</label>
        <TextField type="number" value={outOf} onChange={setOutOf} className="w-20 gb-tab" />
      </div>
      <Btn size="sm" icon={Check} onClick={() => name.trim() && onAdd({ name: name.trim(), category, evalTypeId, outOf: Number(outOf) || 1 })}>Add</Btn>
      <Btn size="sm" variant="ghost" icon={X} onClick={onCancel}>Cancel</Btn>
    </div>
  );
}

function GradesPage({ cls, updateClass }) {
  const [adding, setAdding] = useState(false);
  const [removeCol, setRemoveCol] = useState(null);
  const cellRefs = useRef({});
  const rows = cls.students;
  const cols = cls.assessments;

  const setMark = (studentId, assessmentId, value) => {
    updateClass((c) => ({
      ...c,
      marks: {
        ...c.marks,
        [studentId]: { ...c.marks[studentId], [assessmentId]: value === "" ? undefined : value },
      },
    }));
  };
  const updateAssessment = (id, field, value) => {
    updateClass((c) => ({
      ...c,
      assessments: c.assessments.map((a) => (a.id === id ? { ...a, [field]: field === "name" ? value : field === "outOf" ? Number(value) || 1 : value } : a)),
    }));
  };
  const addAssessment = (def) => {
    updateClass((c) => ({ ...c, assessments: [...c.assessments, { id: genId("as"), ...def }] }));
    setAdding(false);
  };
  const removeAssessment = (id) => {
    updateClass((c) => ({ ...c, assessments: c.assessments.filter((a) => a.id !== id) }));
    setRemoveCol(null);
  };

  const focusCell = (r, c) => {
    const el = cellRefs.current[`${r}-${c}`];
    if (el) { el.focus(); el.select && el.select(); }
  };
  const onKeyDown = (e, r, c) => {
    if (e.key === "ArrowDown" || e.key === "Enter") { e.preventDefault(); focusCell(Math.min(r + 1, rows.length - 1), c); }
    else if (e.key === "ArrowUp") { e.preventDefault(); focusCell(Math.max(r - 1, 0), c); }
    else if (e.key === "ArrowRight") { e.preventDefault(); focusCell(r, Math.min(c + 1, cols.length - 1)); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); focusCell(r, Math.max(c - 1, 0)); }
  };

  const stickyLeft = { position: "sticky", left: 0, background: PALETTE.paperRaised, zIndex: 2 };
  const stickyRightAvg = { position: "sticky", right: 96, background: PALETTE.paperRaised, zIndex: 2 };
  const stickyRightLvl = { position: "sticky", right: 0, background: PALETTE.paperRaised, zIndex: 2 };

  return (
    <div className="space-y-4">
      <SectionTitle right={<Btn size="sm" icon={Plus} onClick={() => setAdding((a) => !a)}>Add assessment</Btn>}>
        Grades — {cls.name}
      </SectionTitle>
      {adding && <AddAssessmentForm cls={cls} onAdd={addAssessment} onCancel={() => setAdding(false)} />}

      <div className="rounded-xl gb-scroll overflow-auto gb-print-area" style={{ border: `1px solid ${PALETTE.rule}`, maxHeight: "70vh" }}>
        <table className="border-collapse text-sm min-w-max">
          <thead>
            <tr>
              <th className="text-left px-3 py-2 font-medium" style={{ ...stickyLeft, borderBottom: `1px solid ${PALETTE.rule}`, minWidth: 160 }}>Student</th>
              {cols.map((a, ci) => {
                const evalType = cls.evalTypes.find((e) => e.id === a.evalTypeId);
                return (
                  <th key={a.id} className="px-2 py-2 align-top" style={{ borderBottom: `1px solid ${PALETTE.rule}`, borderLeft: `1px solid ${PALETTE.rule}`, minWidth: 148 }}>
                    <div className="flex items-start justify-between gap-1">
                      <input
                        value={a.name}
                        onChange={(e) => updateAssessment(a.id, "name", e.target.value)}
                        className="gb-focus bg-transparent text-xs font-semibold w-full mb-1"
                        style={{ color: PALETTE.ink }}
                      />
                      {removeCol === a.id ? (
                        <Confirm prompt="Delete?" onConfirm={() => removeAssessment(a.id)} onCancel={() => setRemoveCol(null)} />
                      ) : (
                        <button className="no-print gb-focus" onClick={() => setRemoveCol(a.id)} style={{ color: PALETTE.inkFaint }}><X size={13} /></button>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-[10px] font-semibold rounded px-1.5 py-0.5" style={{ background: `${CATEGORY_COLORS[a.category]}22`, color: CATEGORY_COLORS[a.category] }}>{a.category}</span>
                      <select value={a.evalTypeId} onChange={(e) => updateAssessment(a.id, "evalTypeId", e.target.value)} className="gb-focus text-[11px] bg-transparent" style={{ color: PALETTE.inkSoft }}>
                        {cls.evalTypes.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                      </select>
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-[11px]" style={{ color: PALETTE.inkSoft }}>
                      /<input type="number" value={a.outOf} onChange={(e) => updateAssessment(a.id, "outOf", e.target.value)} className="gb-focus bg-transparent w-10 gb-tab" />
                    </div>
                  </th>
                );
              })}
              <th className="px-3 py-2 font-medium text-right" style={{ ...stickyRightAvg, borderBottom: `1px solid ${PALETTE.rule}`, borderLeft: `1px solid ${PALETTE.ruleStrong}`, minWidth: 96 }}>Average</th>
              <th className="px-3 py-2 font-medium text-center" style={{ ...stickyRightLvl, borderBottom: `1px solid ${PALETTE.rule}`, minWidth: 96 }}>Level</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s, ri) => {
              const avg = overallAverage(cls, s.id);
              const band = avg === null ? null : bandForScore(cls, avg);
              return (
                <tr key={s.id}>
                  <td className="px-3 py-1.5 text-sm font-medium" style={{ ...stickyLeft, borderTop: `1px solid ${PALETTE.rule}` }}>{s.name}</td>
                  {cols.map((a, ci) => (
                    <td key={a.id} className="p-0" style={{ borderTop: `1px solid ${PALETTE.rule}`, borderLeft: `1px solid ${PALETTE.rule}` }}>
                      <input
                        ref={(el) => (cellRefs.current[`${ri}-${ci}`] = el)}
                        type="number"
                        value={cls.marks[s.id]?.[a.id] ?? ""}
                        onChange={(e) => setMark(s.id, a.id, e.target.value)}
                        onKeyDown={(e) => onKeyDown(e, ri, ci)}
                        placeholder="—"
                        className="gb-cell gb-tab w-full h-full px-2 py-1.5 text-sm text-center bg-transparent"
                      />
                    </td>
                  ))}
                  <td className="px-3 py-1.5 text-right text-sm font-semibold gb-tab" style={{ ...stickyRightAvg, borderTop: `1px solid ${PALETTE.rule}`, borderLeft: `1px solid ${PALETTE.ruleStrong}` }}>
                    {avg === null ? "—" : avg.toFixed(1)}
                  </td>
                  <td className="px-3 py-1.5 text-center" style={{ ...stickyRightLvl, borderTop: `1px solid ${PALETTE.rule}` }}>
                    {band ? <Badge level={band.level} label={band.label} /> : <span className="text-xs" style={{ color: PALETTE.inkFaint }}>—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs" style={{ color: PALETTE.inkFaint }}>Arrow keys move between cells · Tab moves to the next field · blank marks are excluded from averages.</p>
    </div>
  );
}

/* ============================================================================
   STUDENTS PAGE
============================================================================ */
function StudentsPage({ cls, updateClass, onOpenStudent }) {
  const stats = useMemo(() => classStats(cls), [cls]);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [removeId, setRemoveId] = useState(null);

  const addStudent = () => {
    if (!newName.trim()) return;
    updateClass((c) => ({ ...c, students: [...c.students, { id: genId("st"), name: newName.trim() }] }));
    setNewName(""); setAdding(false);
  };
  const saveEdit = (id) => {
    updateClass((c) => ({ ...c, students: c.students.map((s) => (s.id === id ? { ...s, name: editName.trim() || s.name } : s)) }));
    setEditingId(null);
  };
  const removeStudent = (id) => {
    updateClass((c) => {
      const marks = { ...c.marks }; delete marks[id];
      const comments = { ...c.comments }; delete comments[id];
      return { ...c, students: c.students.filter((s) => s.id !== id), marks, comments };
    });
    setRemoveId(null);
  };

  const byId = Object.fromEntries(stats.perStudent.map((s) => [s.id, s]));

  return (
    <div className="space-y-4 max-w-3xl">
      <SectionTitle right={<Btn size="sm" icon={Plus} onClick={() => setAdding((a) => !a)}>Add student</Btn>}>
        Students — {cls.name}
      </SectionTitle>
      {adding && (
        <div className="flex items-center gap-2">
          <TextField value={newName} onChange={setNewName} placeholder="Full name" className="w-64" />
          <Btn size="sm" icon={Check} onClick={addStudent}>Add</Btn>
          <Btn size="sm" variant="ghost" icon={X} onClick={() => setAdding(false)}>Cancel</Btn>
        </div>
      )}
      <Panel className="p-0" raised>
        <div className="divide-y" style={{ borderColor: PALETTE.rule }}>
          {cls.students.map((s) => {
            const info = byId[s.id];
            return (
              <div key={s.id} className="flex items-center justify-between px-4 py-3" style={{ borderTop: `1px solid ${PALETTE.rule}` }}>
                {editingId === s.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <TextField value={editName} onChange={setEditName} className="flex-1" />
                    <Btn size="sm" icon={Check} onClick={() => saveEdit(s.id)}>Save</Btn>
                    <Btn size="sm" variant="ghost" icon={X} onClick={() => setEditingId(null)}>Cancel</Btn>
                  </div>
                ) : (
                  <>
                    <button onClick={() => onOpenStudent(s.id)} className="gb-focus text-left flex-1">
                      <div className="text-sm font-medium">{s.name}</div>
                    </button>
                    <div className="flex items-center gap-3">
                      <span className="text-sm gb-tab" style={{ color: PALETTE.inkSoft }}>{info?.avg === null || info?.avg === undefined ? "—" : info.avg.toFixed(1)}</span>
                      {info?.band ? <Badge level={info.band.level} label={info.band.label} /> : <span className="text-xs" style={{ color: PALETTE.inkFaint }}>No marks</span>}
                      <button className="gb-focus p-1" style={{ color: PALETTE.inkFaint }} onClick={() => { setEditingId(s.id); setEditName(s.name); }}><Pencil size={15} /></button>
                      {removeId === s.id ? (
                        <Confirm prompt="Remove?" onConfirm={() => removeStudent(s.id)} onCancel={() => setRemoveId(null)} />
                      ) : (
                        <button className="gb-focus p-1" style={{ color: PALETTE.inkFaint }} onClick={() => setRemoveId(s.id)}><Trash2 size={15} /></button>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
          {cls.students.length === 0 && <p className="text-sm px-4 py-6" style={{ color: PALETTE.inkFaint }}>No students yet. Add your first student above.</p>}
        </div>
      </Panel>
    </div>
  );
}

/* ============================================================================
   STUDENT REPORT PAGE
============================================================================ */
function StudentReportPage({ cls, studentId, updateClass, onBack }) {
  const student = cls.students.find((s) => s.id === studentId);
  const [comment, setComment] = useState(cls.comments[studentId] || "");
  useEffect(() => { setComment(cls.comments[studentId] || ""); }, [studentId, cls.id]);

  if (!student) {
    return (
      <div className="max-w-2xl">
        <Btn variant="ghost" icon={ArrowLeft} onClick={onBack}>Back to students</Btn>
        <p className="mt-4 text-sm" style={{ color: PALETTE.inkSoft }}>This student no longer exists in {cls.name}.</p>
      </div>
    );
  }

  const avg = overallAverage(cls, studentId);
  const band = avg === null ? null : bandForScore(cls, avg);
  const studentMarks = cls.marks[studentId] || {};

  const saveComment = (val) => {
    setComment(val);
    updateClass((c) => ({ ...c, comments: { ...c.comments, [studentId]: val } }));
  };

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between no-print">
        <Btn variant="ghost" icon={ArrowLeft} onClick={onBack}>Back to students</Btn>
        <Btn variant="ghost" icon={Printer} onClick={() => window.print()}>Print report</Btn>
      </div>

      <Panel className="gb-print-area">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="gb-display text-2xl">{student.name}</h1>
            <p className="text-sm" style={{ color: PALETTE.inkSoft }}>{cls.name} · {cls.term}</p>
          </div>
          <div className="text-right">
            <div className="gb-display gb-tab text-3xl">{avg === null ? "—" : avg.toFixed(1)}</div>
            {band && <div className="mt-1"><Badge level={band.level} label={band.label} /></div>}
          </div>
        </div>
      </Panel>

      <Panel className="gb-print-area">
        <SectionTitle>Category breakdown</SectionTitle>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr style={{ color: PALETTE.inkSoft }}>
              <th className="text-left font-medium pb-2">Category</th>
              <th className="text-left font-medium pb-2">Weight</th>
              <th className="text-left font-medium pb-2">Score</th>
            </tr>
          </thead>
          <tbody>
            {CATEGORY_ORDER.map((cat) => {
              const score = categoryScore(cls, studentId, cat);
              return (
                <tr key={cat} style={{ borderTop: `1px solid ${PALETTE.rule}` }}>
                  <td className="py-2 flex items-center gap-2">
                    <span className="text-[10px] font-semibold rounded px-1.5 py-0.5" style={{ background: `${CATEGORY_COLORS[cat]}22`, color: CATEGORY_COLORS[cat] }}>{cat}</span>
                    {CATEGORY_LABELS[cat]}
                  </td>
                  <td className="py-2 gb-tab">{cls.weights[cat]}%</td>
                  <td className="py-2 gb-tab font-medium">{score === null ? "—" : score.toFixed(1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>

      <Panel className="gb-print-area">
        <SectionTitle>Assessment history</SectionTitle>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr style={{ color: PALETTE.inkSoft }}>
              <th className="text-left font-medium pb-2">Assessment</th>
              <th className="text-left font-medium pb-2">Category</th>
              <th className="text-left font-medium pb-2">Type</th>
              <th className="text-left font-medium pb-2">Score</th>
              <th className="text-left font-medium pb-2">%</th>
            </tr>
          </thead>
          <tbody>
            {cls.assessments.map((a) => {
              const raw = studentMarks[a.id];
              const has = raw !== undefined && raw !== null && raw !== "";
              const evalType = cls.evalTypes.find((e) => e.id === a.evalTypeId);
              return (
                <tr key={a.id} style={{ borderTop: `1px solid ${PALETTE.rule}` }}>
                  <td className="py-2">{a.name}</td>
                  <td className="py-2">
                    <span className="text-[10px] font-semibold rounded px-1.5 py-0.5" style={{ background: `${CATEGORY_COLORS[a.category]}22`, color: CATEGORY_COLORS[a.category] }}>{a.category}</span>
                  </td>
                  <td className="py-2" style={{ color: PALETTE.inkSoft }}>{evalType?.name}</td>
                  <td className="py-2 gb-tab">{has ? `${raw} / ${a.outOf}` : "Missing"}</td>
                  <td className="py-2 gb-tab">{has ? `${((Number(raw) / a.outOf) * 100).toFixed(1)}%` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>

      <Panel className="gb-print-area">
        <SectionTitle right={<MessageSquare size={16} color={PALETTE.inkSoft} />}>Teacher comment</SectionTitle>
        <textarea
          value={comment}
          onChange={(e) => saveComment(e.target.value)}
          rows={5}
          placeholder="Write a comment for this student's report…"
          className="gb-focus w-full rounded-lg p-3 text-sm bg-transparent"
          style={{ border: `1px solid ${PALETTE.rule}` }}
        />
      </Panel>
    </div>
  );
}

/* ============================================================================
   CLASSES PAGE
============================================================================ */
function ClassesPage({ classes, setClasses, currentClassId, onSelect, onResetSeed }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [term, setTerm] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editTerm, setEditTerm] = useState("");
  const [removeId, setRemoveId] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const addClass = () => {
    if (!name.trim() || !term.trim()) return;
    const newClass = {
      id: genId("cls"), name: name.trim(), term: term.trim(),
      weights: buildDefaultWeights(), evalTypes: buildDefaultEvalTypes(), gradeBands: buildDefaultGradeBands(),
      assessments: [], students: [], marks: {}, comments: {},
    };
    setClasses((prev) => [...prev, newClass]);
    setName(""); setTerm(""); setAdding(false);
  };
  const saveEdit = (id) => {
    setClasses((prev) => prev.map((c) => (c.id === id ? { ...c, name: editName.trim() || c.name, term: editTerm.trim() || c.term } : c)));
    setEditingId(null);
  };
  const removeClass = (id) => {
    setClasses((prev) => prev.filter((c) => c.id !== id));
    setRemoveId(null);
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <SectionTitle right={<Btn size="sm" icon={Plus} onClick={() => setAdding((a) => !a)}>Add class</Btn>}>
        Classes
      </SectionTitle>
      {adding && (
        <div className="flex flex-wrap items-end gap-2 p-3 rounded-lg" style={{ background: PALETTE.paper, border: `1px solid ${PALETTE.rule}` }}>
          <div>
            <label className="block text-xs mb-1" style={{ color: PALETTE.inkSoft }}>Class name</label>
            <TextField value={name} onChange={setName} placeholder="e.g. Grade 9 Geography" className="w-56" />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: PALETTE.inkSoft }}>Term</label>
            <TextField value={term} onChange={setTerm} placeholder="e.g. Winter 2027" className="w-40" />
          </div>
          <Btn size="sm" icon={Check} onClick={addClass}>Add</Btn>
          <Btn size="sm" variant="ghost" icon={X} onClick={() => setAdding(false)}>Cancel</Btn>
        </div>
      )}

      <div className="space-y-3">
        {classes.map((c) => {
          const stats = classStats(c);
          const active = c.id === currentClassId;
          return (
            <Panel key={c.id} className={active ? "ring-2" : ""} raised>
              {editingId === c.id ? (
                <div className="flex flex-wrap items-end gap-2">
                  <TextField value={editName} onChange={setEditName} className="w-56" />
                  <TextField value={editTerm} onChange={setEditTerm} className="w-40" />
                  <Btn size="sm" icon={Check} onClick={() => saveEdit(c.id)}>Save</Btn>
                  <Btn size="sm" variant="ghost" icon={X} onClick={() => setEditingId(null)}>Cancel</Btn>
                </div>
              ) : (
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h3 className="gb-display text-lg">{c.name}</h3>
                    <p className="text-sm" style={{ color: PALETTE.inkSoft }}>
                      {c.term} · {c.students.length} students · {c.assessments.length} assessments · avg {stats.average === null ? "—" : stats.average.toFixed(1)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Btn size="sm" variant={active ? "primary" : "subtle"} onClick={() => onSelect(c.id)}>{active ? "Selected" : "Select"}</Btn>
                    <button className="gb-focus p-1.5" style={{ color: PALETTE.inkFaint }} onClick={() => { setEditingId(c.id); setEditName(c.name); setEditTerm(c.term); }}><Pencil size={16} /></button>
                    {removeId === c.id ? (
                      <Confirm prompt="Delete class?" onConfirm={() => removeClass(c.id)} onCancel={() => setRemoveId(null)} />
                    ) : (
                      <button className="gb-focus p-1.5" style={{ color: PALETTE.inkFaint }} onClick={() => setRemoveId(c.id)}><Trash2 size={16} /></button>
                    )}
                  </div>
                </div>
              )}
            </Panel>
          );
        })}
        {classes.length === 0 && <p className="text-sm" style={{ color: PALETTE.inkFaint }}>No classes yet — add one above.</p>}
      </div>

      <div className="pt-4" style={{ borderTop: `1px solid ${PALETTE.rule}` }}>
        {confirmReset ? (
          <Confirm prompt="Replace all data with the seeded demo classes?" onConfirm={onResetSeed} onCancel={() => setConfirmReset(false)} />
        ) : (
          <Btn size="sm" variant="ghost" icon={RotateCcw} onClick={() => setConfirmReset(true)}>Reset demo data</Btn>
        )}
      </div>
    </div>
  );
}

/* ============================================================================
   ROOT APP
============================================================================ */
export default function GradebookApp() {
  const [classes, setClasses] = useState(null);
  const [currentClassId, setCurrentClassId] = useState(null);
  const [view, setView] = useState("overview");
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const saveTimer = useRef(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const stored = await loadClasses();
      const initial = stored && stored.length ? stored : seedClasses();
      if (!mounted) return;
      setClasses(initial);
      setCurrentClassId(initial[0]?.id || null);
      if (!stored) saveClasses(initial);
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!classes) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveClasses(classes), 400);
    return () => clearTimeout(saveTimer.current);
  }, [classes]);

  useEffect(() => {
    const titles = { overview: "Overview", grades: "Grades", students: "Students", report: "Student report", classes: "Classes" };
    document.title = `Gradebook — ${titles[view] || ""}`;
  }, [view]);

  const currentClass = classes ? classes.find((c) => c.id === currentClassId) : null;

  const updateClass = useCallback((updater) => {
    setClasses((prev) => prev.map((c) => (c.id === currentClassId ? updater(c) : c)));
  }, [currentClassId]);

  const openStudent = (studentId) => { setSelectedStudentId(studentId); setView("report"); };
  const resetSeed = () => {
    const fresh = seedClasses();
    setClasses(fresh);
    setCurrentClassId(fresh[0]?.id || null);
    setView("overview");
  };

  if (!classes || !currentClass) {
    return (
      <div className="gb-root min-h-screen flex items-center justify-center" style={{ background: PALETTE.paper }}>
        <GlobalStyle />
        <p className="text-sm" style={{ color: PALETTE.inkSoft }}>Loading gradebook…</p>
      </div>
    );
  }

  return (
    <div className="gb-root min-h-screen flex" style={{ background: PALETTE.paper }}>
      <GlobalStyle />
      <Sidebar view={view} setView={(v) => { setView(v); }} />
      <main className="flex-1 min-w-0 px-5 sm:px-8 py-6 pb-20 md:pb-6">
        <div className="no-print flex items-center justify-between flex-wrap gap-3 mb-6">
          <div className="flex items-center gap-2 md:hidden">
            <GraduationCap size={20} color={PALETTE.accent} />
            <span className="gb-display text-lg">Gradebook</span>
          </div>
          {view !== "classes" && (
            <ClassTermSelector classes={classes} currentClassId={currentClassId} onSelect={setCurrentClassId} />
          )}
        </div>

        {view === "overview" && (
          <OverviewPage cls={currentClass} updateClass={updateClass} onOpenStudent={openStudent} />
        )}
        {view === "grades" && (
          <GradesPage cls={currentClass} updateClass={updateClass} />
        )}
        {view === "students" && (
          <StudentsPage cls={currentClass} updateClass={updateClass} onOpenStudent={openStudent} />
        )}
        {view === "report" && (
          <StudentReportPage cls={currentClass} studentId={selectedStudentId} updateClass={updateClass} onBack={() => setView("students")} />
        )}
        {view === "classes" && (
          <ClassesPage classes={classes} setClasses={setClasses} currentClassId={currentClassId} onSelect={(id) => { setCurrentClassId(id); }} onResetSeed={resetSeed} />
        )}
      </main>
      <MobileNav view={view} setView={setView} />
    </div>
  );
}
