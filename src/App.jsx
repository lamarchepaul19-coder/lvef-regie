import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Home, Building2, CalendarPlus, ListChecks, CalendarDays, Settings,
  Camera, Video, Image as ImageIcon, Megaphone, Zap, Wand2, Upload, Film,
  Trash2, Pencil, Plus, ChevronLeft, ChevronRight, Clapperboard,
  Sparkles, CheckCircle2, Circle, Clock, X, RotateCcw, Save,
  Users, RefreshCw, WifiOff, AtSign
} from "lucide-react";
import { supabase, SUPABASE_READY } from "./supabaseClient";

/* ------------------------------------------------------------------ */
/*  Données établissements                                            */
/* ------------------------------------------------------------------ */
const VENUES = [
  { id: "charrette", name: "La Charrette", color: "#F0A93B", handle: "@lacharrette",
    vibe: "Rap · Shatta · Urbain · Jeune",
    ambiances: ["Rap / Shatta", "Urbain", "Soirée à thème", "Guest"] },
  { id: "spacer", name: "Le Spacer", color: "#9D6BFF", handle: "@lespacer",
    vibe: "Techno underground",
    ambiances: ["La Konez · tech", "On Board · house glam", "La Dark · hard techno / cage"] },
  { id: "cardinal", name: "Le Cardinal", color: "#FF4D5A", handle: "@lecardinal",
    vibe: "80's · 2 salles / 2 ambiances",
    ambiances: ["Salle 80's", "Salle 2 · autre ambiance"] },
  { id: "cafedeparis", name: "Café de Paris", color: "#FF5FA2", handle: "@cafedeparis",
    vibe: "Bar chic · Ambiance totale",
    ambiances: ["Bar chic", "Bar du soir", "Ambiance totale"] },
  { id: "cab", name: "CA Brive · CAB", color: "#D8D8DC", handle: "@cabcorreze",
    vibe: "Rugby · Reposts",
    ambiances: ["Repost", "Match", "Événement"] },
];
const venueById = (id) => VENUES.find((v) => v.id === id) || VENUES[0];

const DEFAULT_SETTINGS = {
  teasing: 7, visuel: 4, rappel: 3,
  retouche: 1, publiPhoto: 2, montage: 1, publiVideo: 4,
};

const pad = (n) => String(n).padStart(2, "0");
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseISO = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const diffDays = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / 86400000);
const fmtDay = (d) => d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
const fmtLong = (d) => d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const relLabel = (n) => n === 0 ? "aujourd'hui" : n === 1 ? "demain" : n === -1 ? "hier"
  : n > 0 ? `dans ${n} j` : `il y a ${-n} j`;
const jTag = (o) => o === 0 ? "Jour J" : o < 0 ? `J-${-o}` : `J+${o}`;

function buildTasks(ev, s) {
  const d = parseISO(ev.date);
  const t = [];
  const push = (offset, kind, label, note) =>
    t.push({ id: `${ev.id}::${kind}::${offset}`, eventId: ev.id, offset, kind, label, note, date: addDays(d, offset) });

  if (ev.teasing) push(-Math.abs(s.teasing), "teasing", "Teaser / save the date", "Story + éventuel post d'annonce");
  push(-Math.abs(s.visuel), "visuel", "Publier le visuel principal", "Post feed : date, line-up, infos pratiques");
  push(-Math.abs(s.rappel), "story", "Story de rappel", "Repartage du visuel + sticker rappel");
  push(-1, "countdown", "Story « demain »", "Compte à rebours");
  push(0, "jour", "Story « c'est ce soir »", "Ambiance + infos porte");

  if (ev.photo || ev.video) {
    const what = ev.photo && ev.video ? "photo + vidéo" : ev.photo ? "photo" : "vidéo";
    push(0, "shooting", `Sur place — captation ${what}`, "Stories live pendant la soirée");
  }
  if (ev.photo) {
    push(Math.abs(s.retouche), "retouche", "Retoucher les photos", "Tri + retouche du shooting");
    push(Math.abs(s.publiPhoto), "publiPhoto", "Publier les photos", "Carrousel recap");
  }
  if (ev.video) {
    push(Math.abs(s.montage), "montage", "Dérushage + montage", "Sélection des rushes, début montage");
    push(Math.abs(s.publiVideo), "publiVideo", "Publier l'aftermovie", "Reel + repartage en story");
  }
  return t.sort((a, b) => a.date - b.date || a.offset - b.offset);
}

const KIND_ICON = {
  teasing: Sparkles, visuel: ImageIcon, story: Megaphone, countdown: Clock, jour: Zap,
  shooting: Camera, retouche: Wand2, publiPhoto: Upload, montage: Clapperboard, publiVideo: Film,
};

/* Stockage partagé : table Supabase "app_data" (key text, value jsonb) */
const mem = {};
let syncErrors = [];
const store = {
  async get(key, fb) {
    if (SUPABASE_READY) {
      const { data, error } = await supabase.from("app_data").select("value").eq("key", key).maybeSingle();
      if (error) {
        syncErrors.push(`Lecture "${key}" : ${error.message}`);
        console.error("[Supabase] erreur de lecture", key, error);
      } else {
        if (data) return data.value;
        return fb;
      }
    }
    return key in mem ? mem[key] : fb;
  },
  async set(key, val) {
    mem[key] = val;
    if (SUPABASE_READY) {
      const { error } = await supabase.from("app_data").upsert({ key, value: val, updated_at: new Date().toISOString() });
      if (error) {
        syncErrors.push(`Écriture "${key}" : ${error.message}`);
        console.error("[Supabase] erreur d'écriture", key, error);
      }
    }
  },
};

const Dot = ({ c, size = 10 }) => (
  <span style={{ width: size, height: size, borderRadius: 99, background: c, flex: "none", display: "inline-block" }} />
);
const J = ({ o }) => <span className="jpill">{jTag(o)}</span>;
const Toggle = ({ on, onClick, label, icon: Icon, color }) => (
  <button className={"toggle" + (on ? " on" : "")} onClick={onClick} type="button"
    style={on && color ? { borderColor: color, color } : undefined}>
    {Icon && <Icon size={15} />}<span>{label}</span>
    <span className="toggle-knob" style={on && color ? { background: color } : undefined} />
  </button>
);

export default function App() {
  const [ready, setReady] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [tab, setTab] = useState("accueil");

  const [events, setEvents] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [handles, setHandles] = useState({});
  const [done, setDone] = useState({});

  const blank = { venueId: "charrette", name: "", ambiance: "", date: toISO(new Date()), photo: true, video: false, teasing: false, notes: "" };
  const [draft, setDraft] = useState(blank);
  const [editingId, setEditingId] = useState(null);

  const [calRef, setCalRef] = useState(startOfDay(new Date()));
  const [selDay, setSelDay] = useState(null);

  const today = startOfDay(new Date());
  const suppressNextRealtime = useRef(0);

  const syncFromCloud = async () => {
    syncErrors = [];
    const [ev, st, hd, dn] = await Promise.all([
      store.get("lvef:events", []),
      store.get("lvef:settings", {}),
      store.get("lvef:handles", {}),
      store.get("lvef:done", {}),
    ]);
    setEvents(ev); setSettings({ ...DEFAULT_SETTINGS, ...st }); setHandles(hd); setDone(dn);
    setSyncError(syncErrors.length ? syncErrors[0] : null);
  };

  useEffect(() => { (async () => { await syncFromCloud(); setReady(true); })(); }, []);
  useEffect(() => { if (ready) store.set("lvef:settings", settings); }, [settings, ready]);
  useEffect(() => { if (ready) store.set("lvef:handles", handles); }, [handles, ready]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onFocus = () => { if (ready) syncFromCloud(); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [ready]);

  // Filet de sécurité : re-synchro toutes les 15s même si le temps réel
  // ou l'événement "focus" ne se déclenchent pas (ex. onglet resté ouvert
  // en arrière-plan, ou realtime mal configuré côté Supabase).
  useEffect(() => {
    if (!ready) return;
    const interval = setInterval(() => { syncFromCloud(); }, 15000);
    return () => clearInterval(interval);
  }, [ready]);

  useEffect(() => {
    if (!SUPABASE_READY || !ready) return;
    const channel = supabase
      .channel("app_data_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "app_data" }, () => {
        if (Date.now() < suppressNextRealtime.current) return;
        syncFromCloud();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [ready]);

  const doSync = async () => { setSyncing(true); try { await syncFromCloud(); } finally { setSyncing(false); } };

  const allTasks = useMemo(() => {
    const out = [];
    for (const e of events)
      for (const t of buildTasks(e, settings))
        out.push({ ...t, venue: venueById(e.venueId), event: e });
    return out.sort((a, b) => a.date - b.date);
  }, [events, settings]);

  const tasksToday = allTasks.filter((t) => diffDays(today, t.date) === 0 && !done[t.id]);
  const overdue = allTasks.filter((t) => diffDays(today, t.date) < 0 && !done[t.id]);
  const upcomingEvents = [...events].filter((e) => diffDays(today, parseISO(e.date)) >= 0)
    .sort((a, b) => parseISO(a.date) - parseISO(b.date));

  const handleOf = (v) => handles[v.id] ?? v.handle;

  const persistEvents = async (fn) => {
    suppressNextRealtime.current = Date.now() + 2000;
    syncErrors = [];
    const cur = await store.get("lvef:events", []);
    const next = fn(cur);
    setEvents(next);
    await store.set("lvef:events", next);
    setSyncError(syncErrors.length ? syncErrors[0] : null);
  };
  const persistDone = async (fn) => {
    suppressNextRealtime.current = Date.now() + 2000;
    syncErrors = [];
    const cur = await store.get("lvef:done", {});
    const next = fn(cur);
    setDone(next);
    await store.set("lvef:done", next);
    setSyncError(syncErrors.length ? syncErrors[0] : null);
  };
  const toggleDone = (id) => persistDone((cur) => ({ ...cur, [id]: !cur[id] }));

  const saveEvent = () => {
    if (!draft.name.trim()) return;
    if (editingId) persistEvents((cur) => cur.map((e) => (e.id === editingId ? { ...draft, id: editingId } : e)));
    else persistEvents((cur) => [...cur, { ...draft, id: `ev_${Date.now()}` }]);
    setDraft(blank); setEditingId(null);
  };
  const editEvent = (e) => { setDraft({ ...e }); setEditingId(e.id); setTab("soirees"); window?.scrollTo?.({ top: 0, behavior: "smooth" }); };
  const deleteEvent = (id) => {
    persistEvents((cur) => cur.filter((e) => e.id !== id));
    persistDone((cur) => { const c = { ...cur }; Object.keys(c).forEach((k) => k.startsWith(id + "::") && delete c[k]); return c; });
    if (editingId === id) { setDraft(blank); setEditingId(null); }
  };
  const loadExample = () => {
    const ex = [
      { id: "ev_ex1", venueId: "charrette", name: "Soirée Beach", ambiance: "Soirée à thème", date: toISO(addDays(today, 6)), photo: true, video: false, teasing: true, notes: "Déco palmiers, dress code blanc." },
      { id: "ev_ex2", venueId: "spacer", name: "On Board", ambiance: "On Board · house glam", date: toISO(addDays(today, 3)), photo: true, video: true, teasing: false, notes: "House glamour, lumières tamisées." },
      { id: "ev_ex3", venueId: "cardinal", name: "Flashback 80's", ambiance: "Salle 80's", date: toISO(addDays(today, 10)), photo: false, video: false, teasing: false, notes: "" },
    ];
    persistEvents((cur) => [...cur.filter((e) => !e.id.startsWith("ev_ex")), ...ex]);
  };

  const renderAccueil = () => (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Régie contenu</div>
          <h1 className="h1">Salut Paul</h1>
          <p className="sub">Ton fil de la semaine, calé sur chaque soirée.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setDraft(blank); setEditingId(null); setTab("soirees"); }}>
          <Plus size={16} /> Nouvelle soirée
        </button>
      </div>

      <div className="stat-grid">
        <div className="stat"><div className="stat-num">{tasksToday.length}</div><div className="stat-lab">à faire aujourd'hui</div></div>
        <div className="stat"><div className="stat-num">{upcomingEvents.length}</div><div className="stat-lab">soirées à venir</div></div>
        <div className="stat"><div className="stat-num" style={{ color: overdue.length ? "#FF4D5A" : undefined }}>{overdue.length}</div><div className="stat-lab">en retard</div></div>
      </div>

      <h2 className="h2">À faire aujourd'hui</h2>
      {tasksToday.length === 0 ? (
        <div className="empty sm">Rien de calé pour aujourd'hui. Profite ou prends de l'avance.</div>
      ) : (
        <div className="card list">{tasksToday.map((t) => taskRow(t))}</div>
      )}

      <h2 className="h2">Prochaines soirées</h2>
      {upcomingEvents.length === 0 ? (
        <div className="empty">
          <p>Aucune soirée enregistrée pour l'instant.</p>
          <div className="empty-actions">
            <button className="btn btn-primary" onClick={() => setTab("soirees")}><Plus size={16} /> Ajouter une soirée</button>
            <button className="btn btn-ghost" onClick={loadExample}><Sparkles size={16} /> Charger un exemple</button>
          </div>
        </div>
      ) : (
        <div className="soiree-grid">
          {upcomingEvents.slice(0, 6).map((e) => {
            const v = venueById(e.venueId); const n = diffDays(today, parseISO(e.date));
            return (
              <button key={e.id} className="soiree-mini" style={{ borderLeftColor: v.color }} onClick={() => editEvent(e)}>
                <div className="row between"><span className="mini-venue" style={{ color: v.color }}><Dot c={v.color} />{v.name}</span><span className="mini-count">{n === 0 ? "ce soir" : relLabel(n)}</span></div>
                <div className="mini-name">{e.name}</div>
                <div className="mini-meta">{fmtLong(parseISO(e.date))}</div>
                <div className="mini-tags">
                  {e.photo && <span className="tag"><Camera size={11} /> photo</span>}
                  {e.video && <span className="tag"><Video size={11} /> vidéo</span>}
                  {!e.photo && !e.video && <span className="tag muted">annonce seule</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </>
  );

  const taskRow = (t, showDate = false) => {
    const Icon = KIND_ICON[t.kind] || Circle;
    const isDone = !!done[t.id];
    const late = diffDays(today, t.date) < 0 && !isDone;
    return (
      <div key={t.id + (showDate ? "_d" : "")} className={"taskrow" + (isDone ? " done" : "")}>
        <button className={"check" + (isDone ? " on" : "")} onClick={() => toggleDone(t.id)} aria-label="Marquer fait">
          {isDone ? <CheckCircle2 size={20} /> : <Circle size={20} />}
        </button>
        <span className="task-ico" style={{ color: t.venue.color }}><Icon size={16} /></span>
        <div className="task-body">
          <div className="task-top">
            <span className="task-label">{t.label}</span>
            <J o={t.offset} />
            {late && <span className="late">en retard</span>}
          </div>
          <div className="task-sub">
            <span className="task-venue" style={{ color: t.venue.color }}><Dot c={t.venue.color} size={7} />{t.venue.name}</span>
            <span className="dot-sep">·</span><span>{t.event.name}</span>
            {t.note && <><span className="dot-sep">·</span><span className="muted">{t.note}</span></>}
            {showDate && <><span className="dot-sep">·</span><span className="muted">{fmtDay(t.date)}</span></>}
          </div>
        </div>
      </div>
    );
  };

  const renderEtablissements = () => (
    <>
      <div className="page-head"><div><div className="eyebrow">Le groupe</div><h1 className="h1">Lieux</h1><p className="sub">Les comptes que tu gères. Renseigne le @ pour t'y retrouver.</p></div></div>
      <div className="venue-grid">
        {VENUES.map((v) => {
          const cnt = upcomingEvents.filter((e) => e.venueId === v.id).length;
          return (
            <div key={v.id} className="venue-card" style={{ borderLeftColor: v.color }}>
              <div className="row between">
                <div className="venue-name" style={{ color: v.color }}>{v.name}</div>
                <span className="venue-cnt">{cnt} à venir</span>
              </div>
              <div className="venue-vibe">{v.vibe}</div>
              <div className="handle-row">
                <AtSign size={14} style={{ color: v.color }} />
                <input className="handle-input" value={handleOf(v)} onChange={(e) => setHandles((h) => ({ ...h, [v.id]: e.target.value }))} placeholder="@compte" />
              </div>
              <div className="amb-list">{v.ambiances.map((a) => <span key={a} className="amb-chip">{a}</span>)}</div>
            </div>
          );
        })}
      </div>
    </>
  );

  const renderSoirees = () => (
    <>
      <div className="page-head"><div><div className="eyebrow">Saisie</div><h1 className="h1">Soirées</h1><p className="sub">Note une soirée : le planning se génère tout seul dans l'onglet Planning.</p></div></div>

      <div className="card form">
        <div className="form-title">{editingId ? "Modifier la soirée" : "Nouvelle soirée"}</div>
        <div className="form-grid">
          <div className="field">
            <label className="label">Lieu</label>
            <select className="input" value={draft.venueId} onChange={(e) => setDraft({ ...draft, venueId: e.target.value, ambiance: "" })}>
              {VENUES.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label">Nom de la soirée</label>
            <input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Soirée Beach" />
          </div>
          <div className="field">
            <label className="label">Ambiance / style</label>
            <input className="input" list="amb-opts" value={draft.ambiance} onChange={(e) => setDraft({ ...draft, ambiance: e.target.value })} placeholder="Choisir ou écrire" />
            <datalist id="amb-opts">{venueById(draft.venueId).ambiances.map((a) => <option key={a} value={a} />)}</datalist>
          </div>
          <div className="field">
            <label className="label">Date</label>
            <input className="input" type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
          </div>
        </div>

        <label className="label" style={{ marginTop: 4 }}>Contenu prévu</label>
        <div className="toggle-row">
          <Toggle on={draft.photo} color="#F0A93B" icon={Camera} label="Photo" onClick={() => setDraft({ ...draft, photo: !draft.photo })} />
          <Toggle on={draft.video} color="#9D6BFF" icon={Video} label="Vidéo" onClick={() => setDraft({ ...draft, video: !draft.video })} />
          <Toggle on={draft.teasing} color="#FF5FA2" icon={Sparkles} label="Teaser anticipé" onClick={() => setDraft({ ...draft, teasing: !draft.teasing })} />
        </div>

        <div className="field" style={{ marginTop: 12 }}>
          <label className="label">Notes (optionnel)</label>
          <textarea className="input area" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="Dress code, guest, déco…" rows={2} />
        </div>

        <div className="form-actions">
          <button className="btn btn-primary" onClick={saveEvent}><Save size={16} /> {editingId ? "Enregistrer" : "Ajouter la soirée"}</button>
          {editingId && <button className="btn btn-ghost" onClick={() => { setDraft(blank); setEditingId(null); }}><X size={16} /> Annuler</button>}
        </div>
      </div>

      <div className="row between" style={{ margin: "26px 0 12px" }}>
        <h2 className="h2" style={{ margin: 0 }}>Soirées enregistrées</h2>
        {events.length === 0 && <button className="btn btn-ghost btn-sm" onClick={loadExample}><Sparkles size={15} /> Exemple</button>}
      </div>

      {events.length === 0 ? (
        <div className="empty sm">Aucune soirée. Remplis le formulaire ci-dessus pour commencer.</div>
      ) : (
        <div className="ev-list">
          {[...events].sort((a, b) => parseISO(a.date) - parseISO(b.date)).map((e) => {
            const v = venueById(e.venueId); const n = diffDays(today, parseISO(e.date));
            return (
              <div key={e.id} className="ev-item" style={{ borderLeftColor: v.color }}>
                <div className="ev-main">
                  <div className="ev-top">
                    <span className="ev-venue" style={{ color: v.color }}><Dot c={v.color} />{v.name}</span>
                    <span className="ev-name">{e.name}</span>
                    {e.ambiance && <span className="ev-amb">{e.ambiance}</span>}
                  </div>
                  <div className="ev-meta">
                    <span>{fmtLong(parseISO(e.date))}</span>
                    <span className="pill-rel" style={n < 0 ? { opacity: .55 } : undefined}>{n === 0 ? "ce soir" : relLabel(n)}</span>
                    {e.photo && <span className="tag"><Camera size={11} /> photo</span>}
                    {e.video && <span className="tag"><Video size={11} /> vidéo</span>}
                    {e.teasing && <span className="tag"><Sparkles size={11} /> teaser</span>}
                  </div>
                </div>
                <div className="ev-actions">
                  <button className="icon-btn" onClick={() => editEvent(e)} aria-label="Modifier"><Pencil size={15} /></button>
                  <button className="icon-btn danger" onClick={() => deleteEvent(e.id)} aria-label="Supprimer"><Trash2 size={15} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );

  const [planView, setPlanView] = useState("avenir");
  const renderPlanning = () => {
    let list = allTasks;
    if (planView === "avenir") list = allTasks.filter((t) => diffDays(today, t.date) >= 0 || (diffDays(today, t.date) < 0 && !done[t.id]));
    else if (planView === "semaine") list = allTasks.filter((t) => { const n = diffDays(today, t.date); return n >= 0 && n < 7; });

    const groups = {};
    for (const t of list) { const k = toISO(t.date); (groups[k] ||= []).push(t); }
    const keys = Object.keys(groups).sort();

    return (
      <>
        <div className="page-head"><div><div className="eyebrow">Généré automatiquement</div><h1 className="h1">Planning</h1><p className="sub">Quand publier, quoi publier — déduit de tes soirées et des règles.</p></div></div>

        <div className="segmented">
          {[["avenir", "À venir"], ["semaine", "Cette semaine"], ["tout", "Tout"]].map(([k, l]) => (
            <button key={k} className={"seg" + (planView === k ? " active" : "")} onClick={() => setPlanView(k)}>{l}</button>
          ))}
        </div>

        {keys.length === 0 ? (
          <div className="empty">
            <p>Rien à afficher. Ajoute une soirée pour générer le planning.</p>
            <div className="empty-actions"><button className="btn btn-primary" onClick={() => setTab("soirees")}><Plus size={16} /> Ajouter une soirée</button></div>
          </div>
        ) : keys.map((k) => {
          const d = parseISO(k); const n = diffDays(today, d); const isToday = n === 0;
          return (
            <div key={k} className="day-group">
              <div className={"day-head" + (isToday ? " today" : "")}>
                <span className="day-date">{fmtDay(d)}</span>
                <span className="day-rel">{relLabel(n)}</span>
              </div>
              <div className="card list">{groups[k].map((t) => taskRow(t))}</div>
            </div>
          );
        })}
      </>
    );
  };

  const renderCalendrier = () => {
    const y = calRef.getFullYear(), m = calRef.getMonth();
    const first = new Date(y, m, 1);
    const startDow = (first.getDay() + 6) % 7;
    const dim = new Date(y, m + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= dim; d++) cells.push(new Date(y, m, d));
    while (cells.length % 7) cells.push(null);

    const dayEvents = (d) => events.filter((e) => e.date === toISO(d));
    const dayTaskCount = (d) => allTasks.filter((t) => toISO(t.date) === toISO(d)).length;

    const sel = selDay ? parseISO(selDay) : null;
    const selEvents = sel ? dayEvents(sel) : [];
    const selTasks = sel ? allTasks.filter((t) => toISO(t.date) === selDay) : [];

    return (
      <>
        <div className="page-head"><div><div className="eyebrow">Vue mensuelle</div><h1 className="h1">Calendrier</h1><p className="sub">Les soirées et les tâches, mois par mois.</p></div>
          <div className="cal-nav">
            <button className="icon-btn" onClick={() => { setCalRef(new Date(y, m - 1, 1)); }} aria-label="Mois précédent"><ChevronLeft size={18} /></button>
            <span className="cal-month">{calRef.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</span>
            <button className="icon-btn" onClick={() => { setCalRef(new Date(y, m + 1, 1)); }} aria-label="Mois suivant"><ChevronRight size={18} /></button>
          </div>
        </div>

        <div className="cal">
          <div className="cal-dow">{["L", "M", "M", "J", "V", "S", "D"].map((d, i) => <span key={i}>{d}</span>)}</div>
          <div className="cal-grid">
            {cells.map((d, i) => {
              if (!d) return <div key={i} className="cal-cell empty-cell" />;
              const evs = dayEvents(d); const tc = dayTaskCount(d);
              const isToday = toISO(d) === toISO(today);
              const isSel = selDay === toISO(d);
              return (
                <button key={i} className={"cal-cell" + (isToday ? " today" : "") + (isSel ? " sel" : "")} onClick={() => setSelDay(isSel ? null : toISO(d))}>
                  <span className="cal-num">{d.getDate()}</span>
                  <span className="cal-dots">
                    {evs.slice(0, 4).map((e) => <Dot key={e.id} c={venueById(e.venueId).color} size={6} />)}
                  </span>
                  {tc > 0 && <span className="cal-badge">{tc}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {sel && (
          <div className="day-panel">
            <div className="row between"><h2 className="h2" style={{ margin: 0 }}>{fmtLong(sel)}</h2><button className="icon-btn" onClick={() => setSelDay(null)} aria-label="Fermer"><X size={16} /></button></div>
            {selEvents.length > 0 && (
              <div className="panel-block">
                <div className="panel-lab">Soirées</div>
                {selEvents.map((e) => { const v = venueById(e.venueId); return (
                  <div key={e.id} className="panel-ev" style={{ borderLeftColor: v.color }}>
                    <span className="ev-venue" style={{ color: v.color }}><Dot c={v.color} />{v.name}</span>
                    <span className="ev-name">{e.name}</span>
                  </div>);})}
              </div>
            )}
            <div className="panel-block">
              <div className="panel-lab">Tâches du jour</div>
              {selTasks.length === 0 ? <div className="empty sm">Aucune tâche ce jour.</div>
                : <div className="card list">{selTasks.map((t) => taskRow(t))}</div>}
            </div>
          </div>
        )}
      </>
    );
  };

  const numField = (key, label, dir) => (
    <div className="set-row">
      <div className="set-lab">{label}</div>
      <div className="set-ctrl">
        <span className="set-j">{dir === "before" ? "J-" : "J+"}</span>
        <input className="set-input" type="number" min="0" value={settings[key]}
          onChange={(e) => setSettings((s) => ({ ...s, [key]: Math.max(0, parseInt(e.target.value || "0", 10)) }))} />
      </div>
    </div>
  );

  const renderReglages = () => (
    <>
      <div className="page-head"><div><div className="eyebrow">Le moteur</div><h1 className="h1">Réglages</h1><p className="sub">Ajuste les décalages : tout le planning se recalcule, pour toute l'équipe.</p></div></div>

      {!SUPABASE_READY && (
        <div className="warn-card">
          <WifiOff size={16} />
          <span>Base de données non connectée — les données restent sur cet appareil uniquement. Vérifie les variables d'environnement Supabase.</span>
        </div>
      )}

      <div className="card set-card">
        <div className="set-group">Avant la soirée</div>
        {numField("teasing", "Teaser / save the date", "before")}
        {numField("visuel", "Visuel principal", "before")}
        {numField("rappel", "Story de rappel", "before")}
        <div className="set-note">La story « demain » (J-1) et « c'est ce soir » (Jour J) sont automatiques.</div>

        <div className="set-group">Après la soirée</div>
        {numField("retouche", "Retouche des photos", "after")}
        {numField("publiPhoto", "Publication des photos", "after")}
        {numField("montage", "Dérushage / montage", "after")}
        {numField("publiVideo", "Aftermovie", "after")}
      </div>

      <div className="card set-card">
        <div className="set-group">Données</div>
        <div className="set-actions">
          <button className="btn btn-ghost" onClick={() => setSettings(DEFAULT_SETTINGS)}><RotateCcw size={15} /> Réglages par défaut</button>
          <button className="btn btn-danger" onClick={() => { if (typeof window !== "undefined" && window.confirm("Effacer toutes les soirées ? Action définitive pour toute l'équipe.")) { persistEvents(() => []); persistDone(() => ({})); } }}><Trash2 size={15} /> Effacer les soirées</button>
        </div>
      </div>
    </>
  );

  const NAV = [
    ["accueil", Home, "Accueil"],
    ["etablissements", Building2, "Lieux"],
    ["soirees", CalendarPlus, "Soirées"],
    ["planning", ListChecks, "Planning"],
    ["calendrier", CalendarDays, "Calendrier"],
    ["reglages", Settings, "Réglages"],
  ];

  return (
    <div className="app">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <nav className="sidebar">
        <div className="brand">
          <div className="brand-mark"><span className="glow" /><Clapperboard size={20} /></div>
          <div className="brand-txt"><div className="brand-name">La vie est une fête</div><div className="brand-sub">Régie contenu · Brive</div></div>
        </div>
        <div className="nav">
          {NAV.map(([k, Icon, label]) => (
            <button key={k} className={"nav-item" + (tab === k ? " active" : "")} onClick={() => setTab(k)}>
              <Icon size={18} /><span>{label}</span>
              {k === "planning" && tasksToday.length > 0 && <span className="nav-badge">{tasksToday.length}</span>}
            </button>
          ))}
        </div>
        <div className="sidebar-foot">
          <div className="sync-status" title={syncError || undefined}>
            {syncError ? <WifiOff size={13} style={{ color: "#FF7A84" }} /> : SUPABASE_READY ? <Users size={13} /> : <WifiOff size={13} />}
            <span style={syncError ? { color: "#FF7A84" } : undefined}>
              {syncError ? "Erreur de synchro" : SUPABASE_READY ? "Espace partagé" : "Hors ligne"}
            </span>
          </div>
          <button className="sync-btn" onClick={doSync} disabled={syncing} title="Synchroniser">
            <RefreshCw size={14} className={syncing ? "spin" : ""} />
          </button>
        </div>
        {syncError && (
          <div className="sync-error-detail">{syncError}</div>
        )}
      </nav>

      <main className="main">
        {!ready ? <div className="empty">Chargement…</div> : (
          <div className="page">
            {tab === "accueil" && renderAccueil()}
            {tab === "etablissements" && renderEtablissements()}
            {tab === "soirees" && renderSoirees()}
            {tab === "planning" && renderPlanning()}
            {tab === "calendrier" && renderCalendrier()}
            {tab === "reglages" && renderReglages()}
          </div>
        )}
      </main>
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=Space+Mono:wght@400;700&display=swap');

*{box-sizing:border-box}
.app{
  --bg:#0a0a0e; --panel:#141420; --panel2:#1a1a28; --line:#26262f; --line2:#33333f;
  --text:#ececf1; --muted:#8c8c9c; --muted2:#5f5f6d; --white:#f7f7fa;
  font-family:'Inter',system-ui,sans-serif; color:var(--text); background:var(--bg);
  min-height:100vh; width:100%; display:flex; -webkit-font-smoothing:antialiased;
}
.app button{font-family:inherit; cursor:pointer}
.mono{font-family:'Space Mono',monospace}
.muted{color:var(--muted)}

.sidebar{width:238px; flex:none; border-right:1px solid var(--line); background:#0c0c12; padding:22px 14px; display:flex; flex-direction:column; gap:26px; position:sticky; top:0; height:100vh}
.brand{display:flex; align-items:center; gap:11px; padding:0 4px}
.brand-mark{position:relative; width:40px; height:40px; border-radius:11px; background:var(--panel2); border:1px solid var(--line2); display:flex; align-items:center; justify-content:center; color:var(--white); overflow:hidden}
.glow{position:absolute; inset:-40%; background:radial-gradient(circle at 30% 20%, rgba(157,107,255,.5), transparent 55%), radial-gradient(circle at 75% 80%, rgba(240,169,59,.4), transparent 55%); filter:blur(6px); opacity:.55}
.brand-name{font-family:'Space Grotesk',sans-serif; font-weight:600; font-size:14px; line-height:1.2}
.brand-sub{font-size:11px; color:var(--muted2); margin-top:2px}
.nav{display:flex; flex-direction:column; gap:3px}
.nav-item{display:flex; align-items:center; gap:11px; padding:10px 12px; border-radius:9px; border:none; background:transparent; color:var(--muted); font-size:14px; font-weight:500; text-align:left; transition:.15s; position:relative}
.nav-item:hover{background:var(--panel); color:var(--text)}
.nav-item.active{background:var(--panel2); color:var(--white)}
.nav-item.active::before{content:''; position:absolute; left:0; top:9px; bottom:9px; width:3px; border-radius:2px; background:var(--white)}
.nav-badge{margin-left:auto; background:#FF4D5A; color:#fff; font-size:11px; font-weight:600; min-width:19px; height:19px; padding:0 5px; border-radius:99px; display:flex; align-items:center; justify-content:center}
.sidebar-foot{margin-top:auto; display:flex; align-items:center; justify-content:space-between; gap:8px; padding:10px 12px; background:var(--panel); border:1px solid var(--line); border-radius:10px}
.sync-error-detail{font-size:10.5px; color:#FF7A84; padding:0 4px; line-height:1.4; word-break:break-word}
.sync-status{display:flex; align-items:center; gap:7px; font-size:12px; color:var(--muted)}
.sync-btn{background:transparent; border:none; color:var(--muted); display:flex; padding:2px}
.sync-btn:hover{color:var(--text)}
.spin{animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}

.main{flex:1; min-width:0; padding:34px 40px 80px; max-width:1100px}
.page{animation:fade .25s ease}
@keyframes fade{from{opacity:0; transform:translateY(4px)}to{opacity:1; transform:none}}

.page-head{display:flex; justify-content:space-between; align-items:flex-end; gap:16px; margin-bottom:26px; flex-wrap:wrap}
.eyebrow{font-family:'Space Mono',monospace; font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:var(--muted2); margin-bottom:8px}
.h1{font-family:'Space Grotesk',sans-serif; font-size:30px; font-weight:600; margin:0; letter-spacing:-.01em}
.h2{font-family:'Space Grotesk',sans-serif; font-size:17px; font-weight:600; margin:30px 0 12px}
.sub{color:var(--muted); font-size:14px; margin:8px 0 0; max-width:52ch}

.btn{display:inline-flex; align-items:center; gap:8px; padding:10px 15px; border-radius:9px; font-size:14px; font-weight:500; border:1px solid var(--line2); background:var(--panel); color:var(--text); transition:.15s}
.btn:hover{border-color:#4a4a58}
.btn-primary{background:var(--white); color:#0a0a0e; border-color:var(--white)}
.btn-primary:hover{background:#e2e2e8}
.btn-ghost{background:transparent}
.btn-danger{background:transparent; color:#FF7A84; border-color:rgba(255,77,90,.4)}
.btn-danger:hover{background:rgba(255,77,90,.1)}
.btn-sm{padding:7px 12px; font-size:13px}
.icon-btn{width:34px; height:34px; border-radius:8px; border:1px solid var(--line2); background:var(--panel); color:var(--muted); display:inline-flex; align-items:center; justify-content:center; transition:.15s}
.icon-btn:hover{color:var(--text); border-color:#4a4a58}
.icon-btn.danger:hover{color:#FF7A84; border-color:rgba(255,77,90,.4); background:rgba(255,77,90,.08)}

.stat-grid{display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-bottom:8px}
.stat{background:var(--panel); border:1px solid var(--line); border-radius:13px; padding:18px 20px}
.stat-num{font-family:'Space Grotesk',sans-serif; font-size:34px; font-weight:600; line-height:1}
.stat-lab{color:var(--muted); font-size:13px; margin-top:6px}

.card{background:var(--panel); border:1px solid var(--line); border-radius:13px}
.list{overflow:hidden}
.empty{background:var(--panel); border:1px dashed var(--line2); border-radius:13px; padding:30px; text-align:center; color:var(--muted)}
.empty.sm{padding:20px; font-size:14px}
.empty-actions{display:flex; gap:10px; justify-content:center; margin-top:16px; flex-wrap:wrap}

.warn-card{display:flex; align-items:center; gap:10px; background:rgba(240,169,59,.1); border:1px solid rgba(240,169,59,.35); color:#F0A93B; border-radius:11px; padding:12px 16px; font-size:13px; margin-bottom:18px}

.taskrow{display:flex; align-items:flex-start; gap:12px; padding:13px 16px; border-bottom:1px solid var(--line)}
.taskrow:last-child{border-bottom:none}
.taskrow.done{opacity:.5}
.taskrow.done .task-label{text-decoration:line-through}
.check{border:none; background:transparent; color:var(--muted2); padding:0; margin-top:1px; transition:.15s; display:flex}
.check:hover{color:var(--muted)}
.check.on{color:#3ECF8E}
.task-ico{margin-top:1px; flex:none}
.task-body{flex:1; min-width:0}
.task-top{display:flex; align-items:center; gap:9px; flex-wrap:wrap}
.task-label{font-weight:500; font-size:14px}
.jpill{font-family:'Space Mono',monospace; font-size:11px; font-weight:700; letter-spacing:.02em; color:var(--muted); background:var(--panel2); border:1px solid var(--line2); padding:2px 7px; border-radius:6px}
.late{font-size:11px; font-weight:600; color:#FF7A84; background:rgba(255,77,90,.12); padding:2px 7px; border-radius:6px}
.task-sub{display:flex; align-items:center; gap:7px; flex-wrap:wrap; font-size:12.5px; color:var(--muted); margin-top:4px}
.task-venue{display:inline-flex; align-items:center; gap:5px; font-weight:500}
.dot-sep{color:var(--muted2)}

.soiree-grid{display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:13px}
.soiree-mini{text-align:left; background:var(--panel); border:1px solid var(--line); border-left:3px solid; border-radius:12px; padding:15px 16px; transition:.15s; display:flex; flex-direction:column; gap:7px}
.soiree-mini:hover{border-color:var(--line2); transform:translateY(-1px)}
.row{display:flex; align-items:center; gap:8px}
.between{justify-content:space-between}
.mini-venue{display:inline-flex; align-items:center; gap:6px; font-size:12.5px; font-weight:600}
.mini-count{font-family:'Space Mono',monospace; font-size:11px; color:var(--muted)}
.mini-name{font-family:'Space Grotesk',sans-serif; font-size:17px; font-weight:600}
.mini-meta{font-size:12.5px; color:var(--muted)}
.mini-tags{display:flex; gap:6px; flex-wrap:wrap; margin-top:2px}
.tag{display:inline-flex; align-items:center; gap:4px; font-size:11px; color:var(--muted); background:var(--panel2); border:1px solid var(--line2); padding:3px 8px; border-radius:6px}
.tag.muted{opacity:.7}

.venue-grid{display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:15px}
.venue-card{background:var(--panel); border:1px solid var(--line); border-left:3px solid; border-radius:13px; padding:18px 20px}
.venue-name{font-family:'Space Grotesk',sans-serif; font-size:19px; font-weight:600}
.venue-cnt{font-family:'Space Mono',monospace; font-size:11px; color:var(--muted2)}
.venue-vibe{font-size:13px; color:var(--muted); margin:6px 0 14px}
.handle-row{display:flex; align-items:center; gap:8px; background:var(--panel2); border:1px solid var(--line2); border-radius:9px; padding:0 12px; margin-bottom:14px}
.handle-input{flex:1; background:transparent; border:none; color:var(--text); font-size:13.5px; padding:9px 0; outline:none; font-family:'Space Mono',monospace}
.amb-list{display:flex; gap:7px; flex-wrap:wrap}
.amb-chip{font-size:12px; color:var(--muted); background:var(--panel2); border:1px solid var(--line2); padding:5px 10px; border-radius:7px}

.form{padding:22px 24px}
.form-title{font-family:'Space Grotesk',sans-serif; font-size:16px; font-weight:600; margin-bottom:18px}
.form-grid{display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:16px}
.field{display:flex; flex-direction:column; gap:7px}
.label{font-size:12px; font-weight:500; color:var(--muted); letter-spacing:.01em}
.input{background:var(--panel2); border:1px solid var(--line2); border-radius:9px; padding:10px 12px; color:var(--text); font-size:14px; font-family:inherit; outline:none; transition:.15s; width:100%}
.input:focus{border-color:#5a5a6a; box-shadow:0 0 0 3px rgba(157,107,255,.12)}
.input::placeholder{color:var(--muted2)}
.area{resize:vertical; min-height:44px}
select.input{appearance:none; background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' fill='none' stroke='%238c8c9c' stroke-width='2'%3E%3Cpath d='M3 5l4 4 4-4'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 12px center; padding-right:34px}
input[type=date].input{color-scheme:dark}
.toggle-row{display:flex; gap:10px; flex-wrap:wrap}
.toggle{display:inline-flex; align-items:center; gap:8px; padding:9px 14px 9px 13px; border-radius:9px; border:1px solid var(--line2); background:var(--panel2); color:var(--muted); font-size:13.5px; font-weight:500; transition:.15s}
.toggle:hover{color:var(--text)}
.toggle.on{background:var(--panel2)}
.toggle-knob{width:8px; height:8px; border-radius:99px; background:var(--muted2); margin-left:2px}
.form-actions{display:flex; gap:10px; margin-top:18px}

.ev-list{display:flex; flex-direction:column; gap:10px}
.ev-item{display:flex; align-items:center; gap:14px; background:var(--panel); border:1px solid var(--line); border-left:3px solid; border-radius:12px; padding:14px 16px}
.ev-main{flex:1; min-width:0}
.ev-top{display:flex; align-items:center; gap:10px; flex-wrap:wrap}
.ev-venue{display:inline-flex; align-items:center; gap:6px; font-size:13px; font-weight:600}
.ev-name{font-family:'Space Grotesk',sans-serif; font-size:16px; font-weight:600}
.ev-amb{font-size:12px; color:var(--muted); background:var(--panel2); border:1px solid var(--line2); padding:3px 9px; border-radius:6px}
.ev-meta{display:flex; align-items:center; gap:8px; flex-wrap:wrap; font-size:13px; color:var(--muted); margin-top:7px}
.pill-rel{font-family:'Space Mono',monospace; font-size:11px; color:var(--text); background:var(--panel2); border:1px solid var(--line2); padding:2px 8px; border-radius:6px}
.ev-actions{display:flex; gap:7px; flex:none}

.segmented{display:inline-flex; background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:4px; gap:3px; margin-bottom:22px}
.seg{padding:8px 15px; border-radius:7px; border:none; background:transparent; color:var(--muted); font-size:13.5px; font-weight:500; transition:.15s}
.seg:hover{color:var(--text)}
.seg.active{background:var(--panel2); color:var(--white)}

.day-group{margin-bottom:22px}
.day-head{display:flex; align-items:baseline; gap:11px; margin-bottom:10px; padding-left:2px}
.day-date{font-family:'Space Grotesk',sans-serif; font-size:15px; font-weight:600; text-transform:capitalize}
.day-rel{font-family:'Space Mono',monospace; font-size:11.5px; color:var(--muted2)}
.day-head.today .day-date{color:#9D6BFF}
.day-head.today .day-rel{color:#9D6BFF}

.cal-nav{display:flex; align-items:center; gap:12px}
.cal-month{font-family:'Space Grotesk',sans-serif; font-size:15px; font-weight:600; text-transform:capitalize; min-width:150px; text-align:center}
.cal{background:var(--panel); border:1px solid var(--line); border-radius:14px; padding:16px}
.cal-dow{display:grid; grid-template-columns:repeat(7,1fr); margin-bottom:8px}
.cal-dow span{text-align:center; font-family:'Space Mono',monospace; font-size:11px; color:var(--muted2); font-weight:700}
.cal-grid{display:grid; grid-template-columns:repeat(7,1fr); gap:6px}
.cal-cell{position:relative; aspect-ratio:1/.92; border-radius:9px; border:1px solid var(--line); background:var(--panel2); padding:7px 8px; text-align:left; transition:.12s; display:flex; flex-direction:column; align-items:flex-start; gap:4px}
.cal-cell:hover{border-color:var(--line2)}
.cal-cell.empty-cell{background:transparent; border:none; pointer-events:none}
.cal-cell.today{border-color:#9D6BFF}
.cal-cell.sel{border-color:var(--white); background:#20202c}
.cal-num{font-size:13px; font-weight:500; color:var(--text)}
.cal-cell.today .cal-num{color:#9D6BFF; font-weight:600}
.cal-dots{display:flex; gap:3px; flex-wrap:wrap}
.cal-badge{position:absolute; bottom:6px; right:7px; font-family:'Space Mono',monospace; font-size:10px; color:var(--muted); background:var(--panel); border:1px solid var(--line2); border-radius:5px; padding:0 4px; line-height:15px}

.day-panel{margin-top:22px; background:var(--panel); border:1px solid var(--line); border-radius:14px; padding:20px 22px}
.panel-block{margin-top:16px}
.panel-lab{font-family:'Space Mono',monospace; font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:var(--muted2); margin-bottom:10px}
.panel-ev{display:flex; align-items:center; gap:10px; padding:10px 12px; background:var(--panel2); border:1px solid var(--line2); border-left:3px solid; border-radius:9px; margin-bottom:8px}

.set-card{padding:8px 22px 18px; margin-bottom:16px}
.set-group{font-family:'Space Grotesk',sans-serif; font-size:14px; font-weight:600; color:var(--white); margin:18px 0 6px; padding-top:12px; border-top:1px solid var(--line)}
.set-card .set-group:first-child{border-top:none; padding-top:6px}
.set-row{display:flex; align-items:center; justify-content:space-between; padding:11px 0; border-bottom:1px solid var(--line)}
.set-row:last-child{border-bottom:none}
.set-lab{font-size:14px}
.set-ctrl{display:flex; align-items:center; gap:8px}
.set-j{font-family:'Space Mono',monospace; font-size:13px; color:var(--muted); font-weight:700}
.set-input{width:64px; background:var(--panel2); border:1px solid var(--line2); border-radius:8px; padding:8px 10px; color:var(--text); font-family:'Space Mono',monospace; font-size:14px; text-align:center; outline:none}
.set-input:focus{border-color:#5a5a6a}
.set-note{font-size:12.5px; color:var(--muted2); margin-top:12px; line-height:1.5}
.set-actions{display:flex; gap:10px; flex-wrap:wrap; padding-top:6px}

@media(max-width:860px){
  .app{flex-direction:column}
  .sidebar{width:100%; height:auto; position:sticky; top:0; z-index:20; flex-direction:row; align-items:center; gap:14px; padding:12px 14px; border-right:none; border-bottom:1px solid var(--line); overflow-x:auto}
  .brand{flex:none}
  .brand-txt{display:none}
  .nav{flex-direction:row; gap:4px}
  .nav-item{padding:9px 12px; white-space:nowrap}
  .nav-item span{display:none}
  .nav-item.active::before{display:none}
  .nav-badge{position:absolute; top:-4px; right:-4px; margin:0}
  .sidebar-foot{display:none}
  .main{padding:24px 18px 70px}
  .form-grid,.stat-grid{grid-template-columns:1fr}
  .h1{font-size:25px}
  .cal-cell{padding:5px 6px}
  .cal-num{font-size:12px}
}
@media(prefers-reduced-motion:reduce){*{transition:none!important; animation:none!important}}
:focus-visible{outline:2px solid #9D6BFF; outline-offset:2px}
`;
