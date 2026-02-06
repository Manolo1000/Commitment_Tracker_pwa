import { useEffect, useMemo, useState } from "react";
import "./App.css";

type Task = { id: string; title: string; active: boolean };
type CompletionMap = Record<string, Record<string, boolean>>;

type DailyTaskMap = Record<string, Task[]>; // date -> tasks

const [dailyTasks, setDailyTasks] = useState<DailyTaskMap>({});
const [newDailyTaskTitle, setNewDailyTaskTitle] = useState("");


const STORAGE_KEY = "commitmentTracker_pwa_v1";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toISODate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function dayOfWeek(year: number, monthIndex: number, day: number) {
  return new Date(year, monthIndex, day).getDay(); // 0..6
}

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function computeProgress(dateKey: string, tasks: Task[], completions: CompletionMap) {
  const active = tasks.filter((t) => t.active);
  const total = active.length;
  if (total === 0) return { total: 0, done: 0, pct: 0 };

  const day = completions[dateKey] || {};
  let done = 0;
  for (const t of active) if (day[t.id]) done += 1;

  return { total, done, pct: done / total };
}

function statusColor(pct: number, total: number) {
  if (total === 0 || pct === 0) return "#ffffff";
  if (pct > 0 && pct < 1) return "#fff3b0";
  return "#c7f9cc";
}

export default function App() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [monthIndex, setMonthIndex] = useState(today.getMonth());

  const [tasks, setTasks] = useState<Task[]>([
    { id: "water", title: "Drink water", active: true },
    { id: "study", title: "Study", active: true },
    { id: "workout", title: "Workout", active: true },
  ]);

  const [completions, setCompletions] = useState<CompletionMap>({});
  const [selectedDate, setSelectedDate] = useState<string>(toISODate(today));
  const [panelOpen, setPanelOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");

  // Load
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.tasks) setTasks(parsed.tasks);
      if (parsed?.completions) setCompletions(parsed.completions);
      if (parsed?.dailyTasks) setDailyTasks(parsed.dailyTasks);
    } catch {
      // ignore
    }
  }, []);

  // Save
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ tasks, completions, dailyTasks }));
  }, [tasks, completions, dailyTasks]);

  const cells = useMemo(() => {
    const firstDow = dayOfWeek(year, monthIndex, 1);
    const dim = daysInMonth(year, monthIndex);

    const items: Array<{ key: string; dateKey?: string; label?: number }> = [];
    for (let i = 0; i < firstDow; i++) items.push({ key: `blank-${i}` });

    for (let d = 1; d <= dim; d++) {
      const dateKey = `${year}-${pad2(monthIndex + 1)}-${pad2(d)}`;
      items.push({ key: dateKey, dateKey, label: d });
    }

    while (items.length % 7 !== 0) items.push({ key: `blank-tail-${items.length}` });
    return items;
  }, [year, monthIndex]);

  const monthLabel = useMemo(() => {
    const names = [
      "January","February","March","April","May","June",
      "July","August","September","October","November","December",
    ];
    return `${names[monthIndex]} ${year}`;
  }, [monthIndex, year]);

  const tasksForSelectedDay = useMemo(() => {
    const daySpecific = dailyTasks[selectedDate] || [];
    return [...tasks.filter(t => t.active), ...daySpecific.filter(t => t.active)];
  }, [tasks, dailyTasks, selectedDate]);
  

  const selectedProgress = useMemo(
    () => computeProgress(selectedDate, tasksForSelectedDay, completions),
    [selectedDate, tasksForSelectedDay, completions]
  );
  

  

  function toggleTaskDone(dateKey: string, taskId: string) {
    setCompletions((prev) => {
      const day = { ...(prev[dateKey] || {}) };
      day[taskId] = !day[taskId];
      return { ...prev, [dateKey]: day };
    });
  }

  function markAll(dateKey: string, value: boolean) {
    setCompletions((prev) => {
      const nextDay: Record<string, boolean> = {};
      for (const t of tasks.filter((t) => t.active)) nextDay[t.id] = value;
      return { ...prev, [dateKey]: nextDay };
    });
  }

  function addTask() {
    const title = newTaskTitle.trim();
    if (!title) return;
    setTasks((prev) => [...prev, { id: uid(), title, active: true }]);
    setNewTaskTitle("");
  }

  function addDailyTask() {
    const title = newDailyTaskTitle.trim();
    if (!title) return;
  
    const newT: Task = { id: uid(), title, active: true };
  
    setDailyTasks(prev => {
      const cur = prev[selectedDate] || [];
      return { ...prev, [selectedDate]: [...cur, newT] };
    });
  
    setNewDailyTaskTitle("");
  }
  

  function prevMonth() {
    setPanelOpen(false);
    setMonthIndex((m) => {
      if (m === 0) {
        setYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }

  function nextMonth() {
    setPanelOpen(false);
    setMonthIndex((m) => {
      if (m === 11) {
        setYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }

  return (
    <div className={`wrap ${panelOpen ? "panelOpen" : ""}`}>
      <header className="header">
        <button className="navBtn" onClick={prevMonth}>◀</button>
        <div className="title">{monthLabel}</div>
        <button className="navBtn" onClick={nextMonth}>▶</button>
      </header>

      <div className="weekRow">
        {["S","M","T","W","T","F","S"].map((d) => (
          <div key={d} className="weekLabel">{d}</div>
        ))}
      </div>

      <div className="grid">
        {cells.map((item) => {
          if (!item.dateKey) return <div key={item.key} className="cellBlank" />;

          const daySpecific = dailyTasks[item.dateKey] || [];
          const combined = [...tasks.filter(t => t.active), ...daySpecific.filter(t => t.active)];
          const prog = computeProgress(item.dateKey, combined, completions);

          const bg = statusColor(prog.pct, prog.total);
          const isSelected = item.dateKey === selectedDate;

          return (
            <button
              key={item.key}
              className={`cell ${isSelected ? "cellSelected" : ""}`}
              style={{ backgroundColor: bg }}
              onClick={() => {
                setSelectedDate(item.dateKey!);
                setPanelOpen(true);
              }}
            >
              <div className="cellTop">{item.label}</div>
              <div className="miniBarOuter">
                <div className="miniBarInner" style={{ width: `${Math.round(prog.pct * 100)}%` }} />
              </div>
            </button>
          );
        })}
      </div>

      <div className={`sheet ${panelOpen ? "open" : ""}`}>
        <div className="sheetHeader">
          <button className="linkBtn" onClick={() => setPanelOpen(false)}>Close</button>
          <div className="sheetTitle">{selectedDate}</div>
          <div style={{ width: 56 }} />
        </div>

        <div className="progressWrap">
          <div className="progressText">
            {selectedProgress.done}/{selectedProgress.total} done
          </div>
          <div className="barOuter">
            <div className="barInner" style={{ width: `${Math.round(selectedProgress.pct * 100)}%` }} />
          </div>

          <div className="actionsRow">
            <button className="actionBtn" onClick={() => markAll(selectedDate, true)}>Mark all</button>
            <button className="actionBtn" onClick={() => markAll(selectedDate, false)}>Clear</button>
          </div>
        </div>

        <div className="sectionTitle">Tasks</div>

        <div className="taskList">
        {tasksForSelectedDay.map((t) => {
  const done = !!completions[selectedDate]?.[t.id];
  return (
    <button
      key={t.id}
      className={`taskRow ${done ? "taskRowDone" : ""}`}
      onClick={() => toggleTaskDone(selectedDate, t.id)}
    >
      <span className="checkbox">{done ? "☑" : "☐"}</span>
      <span className={`taskText ${done ? "taskTextDone" : ""}`}>{t.title}</span>
    </button>
  );
})}

        </div>

        <div className="addTaskRow">
          <input
            className="input"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="Add a task for the month…"
            onKeyDown={(e) => e.key === "Enter" && addTask()}
          />
          <button className="addBtn" onClick={addTask}>Add</button>
        </div>
        <div className="addTaskRow">
  <input
    className="input"
    value={newDailyTaskTitle}
    onChange={(e) => setNewDailyTaskTitle(e.target.value)}
    placeholder="Add a task for this day…"
    onKeyDown={(e) => e.key === "Enter" && addDailyTask()}
  />
  <button className="addBtn" onClick={addDailyTask}>Add</button>
</div>

      </div>
    </div>
  );
}
