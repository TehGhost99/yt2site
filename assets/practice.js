/* Practice app for The Effective Learner.
   Vanilla JS. Progress is always saved to localStorage; when the user is
   signed in (Appwrite configured in assets/appwrite-config.js), the same
   state is mirrored to one Appwrite row per user. */
(function () {
  "use strict";

  var root = document.getElementById("practice-app");
  if (!root) return;

  var CUR = window.CURRICULUM;
  if (!CUR || !CUR.subjects || !CUR.subjects.length) {
    root.innerHTML =
      '<div class="pa-card pa-notice">The practice curriculum has not been generated yet. ' +
      "Run <code>py scripts/build_curriculum.py</code> and rebuild the site.</div>";
    return;
  }

  var GOAL = CUR.goalDays;
  var STORAGE_KEY = "effective-learner-practice-v1";
  var REVIEW_QUESTIONS = 2; // bonus spaced-review checks from earlier days

  /* Normalize a day to the task+check shape. Older quiz/apply/MCQ days still work. */
  function normalizeCheck(q) {
    if (!q) return null;
    if (q.rubric && !q.choices) return q;
    // Legacy multiple-choice → temporary open-ended bridge until curriculum is rewritten.
    if (q.choices && typeof q.answer === "number") {
      var right = q.choices[q.answer] || "";
      return {
        q: q.q,
        rubric: "A strong answer should capture this idea: " + right +
          (q.explain ? " Additional guidance: " + q.explain : ""),
        exemplar: right + (q.explain ? " — " + q.explain : "")
      };
    }
    return q;
  }

  function normalizeDay(day) {
    if (!day) return day;
    var checks = (day.check || day.quiz || []).map(normalizeCheck).filter(Boolean);
    if (day.task && day.check && day.check[0] && day.check[0].rubric && !day.check[0].choices) {
      return day;
    }
    return {
      focus: day.focus,
      review: day.review,
      task: day.task || {
        do: day.apply || "Practice today's idea with your own study material for a few minutes.",
        capture: "Write what you did and what you noticed.",
        minutes: 8
      },
      check: checks
    };
  }

  /* ---------------- state ---------------- */

  function newState() {
    return { startedAt: null, completedDays: [], log: {}, dates: {}, updatedAt: 0 };
  }

  function loadLocal() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  var state = loadLocal() || newState();
  backfillPracticeDates();

  function mergeStates(a, b) {
    var days = {};
    (a.completedDays || []).concat(b.completedDays || []).forEach(function (d) {
      days[d] = true;
    });
    var merged = newState();
    merged.completedDays = Object.keys(days)
      .map(Number)
      .sort(function (x, y) { return x - y; });
    if (a.startedAt && b.startedAt) {
      merged.startedAt = a.startedAt < b.startedAt ? a.startedAt : b.startedAt;
    } else {
      merged.startedAt = a.startedAt || b.startedAt;
    }
    var older = (a.updatedAt || 0) <= (b.updatedAt || 0) ? a : b;
    var newer = older === a ? b : a;
    merged.log = {};
    Object.keys(older.log || {}).forEach(function (k) { merged.log[k] = older.log[k]; });
    Object.keys(newer.log || {}).forEach(function (k) { merged.log[k] = newer.log[k]; });
    merged.dates = {};
    [older, newer].forEach(function (src) {
      Object.keys(src.dates || {}).forEach(function (key) {
        if (!merged.dates[key]) merged.dates[key] = [];
        var seen = {};
        merged.dates[key].forEach(function (n) { seen[n] = true; });
        (src.dates[key] || []).forEach(function (n) {
          n = Number(n);
          if (isFinite(n) && !seen[n]) {
            seen[n] = true;
            merged.dates[key].push(n);
          }
        });
      });
    });
    merged.updatedAt = Math.max(a.updatedAt || 0, b.updatedAt || 0);
    return merged;
  }

  function save() {
    state.updatedAt = Date.now();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) { /* storage full or blocked; cloud sync may still work */ }
    pushCloud();
  }

  /* ---------------- appwrite ---------------- */

  var cfg = window.APPWRITE_CONFIG || null;
  var aw = null;      // { account, tables }
  var user = null;    // Appwrite user object when signed in
  var syncMsg = "";   // short human-readable sync status
  var authView = "login"; // login | forgot | forgot-sent | reset | reset-done
  var recoveryUserId = null;
  var recoverySecret = null;

  try {
    var recoveryParams = new URLSearchParams(window.location.search);
    var rid = recoveryParams.get("userId");
    var rsecret = recoveryParams.get("secret");
    if (rid && rsecret) {
      authView = "reset";
      recoveryUserId = rid;
      recoverySecret = rsecret;
    }
  } catch (e) { /* ignore bad URL */ }

  if (cfg && window.Appwrite) {
    var client = new Appwrite.Client().setEndpoint(cfg.endpoint).setProject(cfg.projectId);
    aw = {
      account: new Appwrite.Account(client),
      tables: new Appwrite.TablesDB(client),
      functions: new Appwrite.Functions(client)
    };
  }

  function pullCloud() {
    if (!aw || !user) return Promise.resolve();
    return aw.tables
      .getRow({ databaseId: cfg.databaseId, tableId: cfg.tableId, rowId: user.$id })
      .then(function (row) {
        var remote;
        try { remote = JSON.parse(row.data); } catch (e) { remote = null; }
        if (remote) {
          state = mergeStates(state, remote);
          backfillPracticeDates();
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
        }
        syncMsg = "Progress synced.";
      })
      .catch(function (err) {
        if (err && err.code === 404) {
          // First device for this account - create the row from local state.
          return createCloudRow();
        }
        syncMsg = "Couldn't load cloud progress: " + (err.message || err);
      });
  }

  function createCloudRow() {
    var P = Appwrite.Permission, R = Appwrite.Role;
    return aw.tables
      .createRow({
        databaseId: cfg.databaseId,
        tableId: cfg.tableId,
        rowId: user.$id,
        data: { data: JSON.stringify(state) },
        permissions: [
          P.read(R.user(user.$id)),
          P.update(R.user(user.$id)),
          P.delete(R.user(user.$id))
        ]
      })
      .then(function () { syncMsg = "Progress synced."; })
      .catch(function (err) {
        syncMsg = "Couldn't create cloud save: " + (err.message || err);
      });
  }

  function pushCloud() {
    if (!aw || !user) return;
    aw.tables
      .updateRow({
        databaseId: cfg.databaseId,
        tableId: cfg.tableId,
        rowId: user.$id,
        data: { data: JSON.stringify(state) }
      })
      .then(function () { syncMsg = "Progress synced."; renderSyncLine(); })
      .catch(function (err) {
        if (err && err.code === 404) {
          createCloudRow().then(renderSyncLine);
        } else {
          syncMsg = "Sync failed: " + (err.message || err);
          renderSyncLine();
        }
      });
  }

  /* ---------------- curriculum helpers ---------------- */

  function dayEntry(n) {
    var idx = n - 1;
    for (var i = 0; i < CUR.subjects.length; i++) {
      var s = CUR.subjects[i];
      if (idx < s.days.length) {
        return {
          subject: s,
          day: normalizeDay(s.days[idx]),
          subjectDay: idx + 1,
          subjectIndex: i
        };
      }
      idx -= s.days.length;
    }
    return null;
  }

  function currentDay() {
    // Suggested next: first incomplete day in plan order (gaps allowed).
    var done = {};
    (state.completedDays || []).forEach(function (d) { done[d] = true; });
    for (var i = 1; i <= GOAL; i++) {
      if (!done[i]) return i;
    }
    return GOAL + 1;
  }

  function backfillPracticeDates() {
    if (!state.dates) state.dates = {};
    Object.keys(state.log || {}).forEach(function (k) {
      var entry = state.log[k];
      if (!entry || !entry.date) return;
      var n = Number(k);
      if (!isFinite(n)) return;
      recordPracticeDate(entry.date, n, true);
    });
  }

  function recordPracticeDate(dateKey, dayNumber, skipSort) {
    if (!dateKey || !isFinite(dayNumber)) return;
    if (!state.dates) state.dates = {};
    var list = state.dates[dateKey] || [];
    if (list.indexOf(dayNumber) === -1) list.push(dayNumber);
    if (!skipSort) list.sort(function (a, b) { return a - b; });
    state.dates[dateKey] = list;
  }

  function practicedDateSet() {
    var set = {};
    Object.keys(state.dates || {}).forEach(function (k) {
      if ((state.dates[k] || []).length) set[k] = true;
    });
    Object.keys(state.log || {}).forEach(function (k) {
      var d = state.log[k] && state.log[k].date;
      if (d) set[d] = true;
    });
    return set;
  }

  function daysPracticedCount() {
    return Object.keys(practicedDateSet()).length;
  }

  function sessionsOnDate(dateKey) {
    var seen = {};
    var out = [];
    function add(n) {
      n = Number(n);
      if (!isFinite(n) || seen[n]) return;
      seen[n] = true;
      out.push(n);
    }
    ((state.dates && state.dates[dateKey]) || []).forEach(add);
    Object.keys(state.log || {}).forEach(function (k) {
      if (state.log[k] && state.log[k].date === dateKey) add(k);
    });
    out.sort(function (a, b) { return a - b; });
    return out;
  }

  function isDayCompleted(n) {
    return (state.completedDays || []).indexOf(n) !== -1;
  }

  function todayKey() {
    var d = new Date();
    return d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
  }

  function streak() {
    var dates = {};
    Object.keys(state.log).forEach(function (k) {
      if (state.log[k] && state.log[k].date) dates[state.log[k].date] = true;
    });
    var count = 0;
    var cursor = new Date();
    if (!dates[todayKey()]) cursor.setDate(cursor.getDate() - 1); // streak survives until today ends
    for (;;) {
      var key = cursor.getFullYear() + "-" +
        String(cursor.getMonth() + 1).padStart(2, "0") + "-" +
        String(cursor.getDate()).padStart(2, "0");
      if (!dates[key]) break;
      count++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return count;
  }

  function reviewQuestions(beforeDay) {
    // Bonus spaced-review checks drawn from earlier, already-covered days.
    var pool = [];
    for (var d = 1; d < beforeDay; d++) {
      var e = dayEntry(d);
      if (!e) continue;
      (e.day.check || []).forEach(function (q) {
        pool.push({ q: q, from: e.subject.title });
      });
    }
    var picked = [];
    while (picked.length < REVIEW_QUESTIONS && pool.length) {
      picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    return picked;
  }

  /* ---------------- tiny DOM helper ---------------- */

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "text") node.textContent = attrs[k];
        else if (k === "html") node.innerHTML = attrs[k];
        else if (k === "onclick") node.addEventListener("click", attrs[k]);
        else node.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach(function (c) { if (c) node.appendChild(c); });
    return node;
  }

  function emphasize(text) {
    // Minimal, safe *emphasis* support for review prose.
    var span = document.createElement("span");
    text.split(/(\*[^*]+\*)/g).forEach(function (part) {
      if (part.length > 2 && part[0] === "*" && part[part.length - 1] === "*") {
        var em = document.createElement("em");
        em.textContent = part.slice(1, -1);
        span.appendChild(em);
      } else if (part) {
        span.appendChild(document.createTextNode(part));
      }
    });
    return span;
  }

  /* ---------------- views ---------------- */

  var session = null; // active session data, null when on dashboard
  var calView = (function () {
    var now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  })();
  var calSelected = null; // YYYY-MM-DD or null
  var hashApplied = false;

  function render() {
    root.innerHTML = "";
    if (session) renderSession();
    else renderDashboard();
    root.appendChild(renderAccountPanel());
  }

  function renderSyncLine() {
    var line = document.getElementById("pa-sync-line");
    if (line) line.textContent = syncMsg;
  }

  function renderDashboard() {
    var done = state.completedDays.length;
    var day = currentDay();
    var pct = Math.min(100, Math.round((done / GOAL) * 100));

    var header = el("div", { class: "pa-card pa-dash" }, [
      el("div", { class: "pa-dash-top" }, [
        el("div", {}, [
          el("div", { class: "pa-kicker", text: done >= GOAL ? "Plan complete" : "Suggested next · Day " + day + " of " + GOAL }),
          el("div", { class: "pa-big", text: done >= GOAL ? "You did it." : (dayEntry(day) ? dayEntry(day).subject.title : "") })
        ]),
        el("div", { class: "pa-stats" }, [
          stat(done, "sessions done"),
          stat(daysPracticedCount(), "days practiced"),
          stat(streak(), "day streak")
        ])
      ]),
      el("div", { class: "pa-bar" }, [el("div", { class: "pa-bar-fill", style: "width:" + pct + "%" })]),
      el("div", { class: "pa-bar-label", text: pct + "% of the 4-month plan" })
    ]);

    root.appendChild(header);

    if (done >= GOAL) {
      root.appendChild(el("div", { class: "pa-card pa-notice" }, [
        el("p", { text: "All " + GOAL + " sessions are complete — every concept in the course, practiced. Open any subject below and start or retry any day you want." })
      ]));
    } else {
      var entry = dayEntry(day);
      var alreadyToday = sessionDoneToday();
      var cta = el("div", { class: "pa-card pa-today" }, [
        el("div", { class: "pa-kicker", text: "Suggested session · about 15 minutes" }),
        el("h3", { text: entry.day.focus }),
        el("p", { class: "pa-muted", text: entry.subject.title + " - day " + entry.subjectDay + " of " + entry.subject.days.length }),
        el("p", { class: "pa-small pa-muted", text: "This is a suggested next step, not a lock. Jump to any subject or day below — you can mix concepts instead of finishing one at a time." }),
        el("button", {
          class: "pa-btn pa-btn-primary",
          text: alreadyToday ? "Start another session (Day " + day + ")" : "Start Day " + day,
          onclick: function () { startSession(day); }
        }),
        alreadyToday
          ? el("p", { class: "pa-muted pa-small", text: "You already practiced today. Another session still counts on the calendar; completed days can be retried anytime." })
          : null
      ]);
      root.appendChild(cta);
    }

    root.appendChild(renderCalendar());
    root.appendChild(renderSubjectGrid());
    applyLocationHash();
  }

  function stat(value, label) {
    return el("div", { class: "pa-stat" }, [
      el("div", { class: "pa-stat-num", text: String(value) }),
      el("div", { class: "pa-stat-label", text: label })
    ]);
  }

  function sessionDoneToday() {
    var t = todayKey();
    return Object.keys(state.log).some(function (k) {
      return state.log[k] && state.log[k].date === t;
    });
  }

  function monthLabel(year, month) {
    return new Date(year, month, 1).toLocaleString(undefined, { month: "long", year: "numeric" });
  }

  function dateKeyFromParts(year, month, day) {
    return year + "-" + String(month + 1).padStart(2, "0") + "-" + String(day).padStart(2, "0");
  }

  function renderCalendar() {
    var practiced = practicedDateSet();
    var year = calView.year;
    var month = calView.month;
    var first = new Date(year, month, 1);
    var startWeekday = first.getDay(); // 0 = Sunday
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var today = todayKey();
    var countThisMonth = 0;
    var cells = [];
    var i;
    for (i = 0; i < startWeekday; i++) {
      cells.push(el("div", { class: "pa-cal-cell pa-cal-empty", "aria-hidden": "true" }));
    }
    for (i = 1; i <= daysInMonth; i++) {
      var key = dateKeyFromParts(year, month, i);
      var did = !!practiced[key];
      if (did) countThisMonth++;
      var isToday = key === today;
      var isSelected = calSelected === key;
      var label = (did ? "Practiced on " : "No practice on ") + key;
      var classes = "pa-cal-cell pa-cal-day";
      if (did) classes += " pa-cal-practiced";
      if (isToday) classes += " pa-cal-today";
      if (isSelected) classes += " pa-cal-selected";
      cells.push(el("button", {
        class: classes,
        type: "button",
        "aria-label": label,
        "aria-pressed": isSelected ? "true" : "false",
        onclick: (function (dateKey) {
          return function () {
            calSelected = calSelected === dateKey ? null : dateKey;
            render();
          };
        })(key)
      }, [
        el("span", { class: "pa-cal-num", text: String(i) }),
        did ? el("span", { class: "pa-cal-dot", "aria-hidden": "true" }) : null
      ]));
    }

    var weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(function (d) {
      return el("div", { class: "pa-cal-dow", text: d });
    });

    var detail = null;
    if (calSelected) {
      var onDay = sessionsOnDate(calSelected);
      if (onDay.length) {
        var items = onDay.map(function (n) {
          var e = dayEntry(n);
          var title = e ? (e.subject.title + " · " + (e.day.focus || ("Day " + e.subjectDay))) : ("Day " + n);
          return el("li", {}, [
            el("button", {
              class: "pa-link-btn",
              type: "button",
              text: "Day " + n + " — " + title,
              onclick: (function (dayN) {
                return function () { startSession(dayN); };
              })(n)
            })
          ]);
        });
        detail = el("div", { class: "pa-cal-detail" }, [
          el("p", { class: "pa-cal-detail-head", text: "You practiced on " + calSelected + ":" }),
          el("ul", { class: "pa-cal-detail-list" }, items)
        ]);
      } else {
        detail = el("div", { class: "pa-cal-detail" }, [
          el("p", { class: "pa-muted pa-small", text: "No practice recorded on " + calSelected + "." })
        ]);
      }
    }

    return el("div", { class: "pa-card pa-cal" }, [
      el("div", { class: "pa-cal-head" }, [
        el("div", {}, [
          el("div", { class: "pa-kicker", text: "Learning calendar" }),
          el("h2", { class: "pa-section-title", text: "Days you actually practiced" })
        ]),
        el("div", { class: "pa-cal-nav" }, [
          el("button", {
            class: "pa-btn pa-btn-ghost pa-btn-small",
            type: "button",
            text: "Previous",
            "aria-label": "Previous month",
            onclick: function () {
              calView.month -= 1;
              if (calView.month < 0) { calView.month = 11; calView.year -= 1; }
              render();
            }
          }),
          el("div", { class: "pa-cal-month", text: monthLabel(year, month) }),
          el("button", {
            class: "pa-btn pa-btn-ghost pa-btn-small",
            type: "button",
            text: "Next",
            "aria-label": "Next month",
            onclick: function () {
              calView.month += 1;
              if (calView.month > 11) { calView.month = 0; calView.year += 1; }
              render();
            }
          })
        ])
      ]),
      el("p", {
        class: "pa-muted pa-small",
        text: daysPracticedCount()
          ? ("Highlighted days are calendar dates you completed a session. " +
             countThisMonth + " day" + (countThisMonth === 1 ? "" : "s") + " this month.")
          : "Complete any session and that calendar day lights up here — so you can see when you actually showed up."
      }),
      el("div", { class: "pa-cal-weekdays" }, weekdays),
      el("div", { class: "pa-cal-grid" }, cells),
      el("div", { class: "pa-cal-legend" }, [
        el("span", { class: "pa-cal-legend-item" }, [
          el("span", { class: "pa-cal-swatch pa-cal-practiced" }),
          el("span", { text: "Practiced" })
        ]),
        el("span", { class: "pa-cal-legend-item" }, [
          el("span", { class: "pa-cal-swatch pa-cal-today" }),
          el("span", { text: "Today" })
        ])
      ]),
      detail
    ]);
  }

  function applyLocationHash() {
    if (hashApplied) return;
    var h = (location.hash || "").replace(/^#/, "");
    if (!h) {
      hashApplied = true;
      return;
    }
    var dayMatch = /^day-(\d+)$/.exec(h);
    if (dayMatch) {
      var n = Number(dayMatch[1]);
      var row = document.getElementById("pa-day-" + n);
      if (row) {
        var details = row.closest("details");
        if (details) details.open = true;
        row.classList.add("pa-day-jump");
        row.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      hashApplied = true;
      return;
    }
    var subMatch = /^subject-(.+)$/.exec(h);
    if (subMatch) {
      var panel = document.getElementById("pa-subject-" + subMatch[1]);
      if (panel) {
        panel.open = true;
        panel.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
    hashApplied = true;
  }

  function renderSubjectGrid() {
    var offset = 0;
    var next = currentDay();
    var panels = CUR.subjects.map(function (s, subjectIndex) {
      var startDay = offset + 1;
      var endDay = offset + s.days.length;
      var doneInSubject = state.completedDays.filter(function (d) {
        return d >= startDay && d <= endDay;
      }).length;
      var isCurrent = next >= startDay && next <= endDay && next <= GOAL;
      var isComplete = doneInSubject === s.days.length;
      var statusLabel = isComplete ? "Complete" : (isCurrent ? "Suggested" : (doneInSubject ? "In progress" : "Open"));
      var statusClass = isComplete ? "pa-status-done" : (isCurrent ? "pa-status-current" : (doneInSubject ? "pa-status-progress" : "pa-status-upcoming"));

      var dayRows = [];
      for (var i = 0; i < s.days.length; i++) {
        var globalDay = startDay + i;
        var focus = (normalizeDay(s.days[i]).focus) || ("Day " + (i + 1));
        var completed = isDayCompleted(globalDay);
        var isNext = globalDay === next && next <= GOAL;
        var statusPill = completed
          ? el("span", { class: "pa-pill pa-pill-done", text: "Done" })
          : (isNext
            ? el("span", { class: "pa-pill pa-pill-next", text: "Suggested" })
            : el("span", { class: "pa-pill pa-pill-open", text: "Open" }));

        var action = el("button", {
          class: "pa-btn " + (isNext && !completed ? "pa-btn-primary" : "pa-btn-ghost") + " pa-btn-small",
          text: completed ? "Retry day" : "Start day",
          onclick: (function (d, doneAlready) {
            return function () { startSession(d, { retry: doneAlready }); };
          })(globalDay, completed)
        });

        dayRows.push(el("div", {
          class: "pa-day-row" + (completed ? " pa-day-done" : "") + (isNext ? " pa-day-next" : ""),
          id: "pa-day-" + globalDay
        }, [
          el("div", { class: "pa-day-index", text: String(i + 1).padStart(2, "0") }),
          el("div", { class: "pa-day-meta" }, [
            el("div", { class: "pa-day-focus", text: focus }),
            el("div", { class: "pa-day-sub", text: "Plan day " + globalDay + " of " + GOAL })
          ]),
          statusPill,
          action
        ]));
      }

      var summary = el("summary", { class: "pa-accordion-summary" }, [
        el("div", { class: "pa-accordion-left" }, [
          el("span", { class: "pa-accordion-part", text: "Subject " + (subjectIndex + 1) }),
          el("span", { class: "pa-accordion-title", text: s.title }),
          el("a", {
            class: "pa-accordion-lesson",
            href: s.lesson,
            text: "Lesson page",
            onclick: function (ev) { ev.stopPropagation(); }
          })
        ]),
        el("div", { class: "pa-accordion-right" }, [
          el("span", { class: "pa-status " + statusClass, text: statusLabel }),
          el("span", { class: "pa-accordion-count", text: doneInSubject + " / " + s.days.length }),
          el("span", { class: "pa-accordion-chevron", "aria-hidden": "true", text: "" })
        ])
      ]);

      var body = el("div", { class: "pa-accordion-body" }, [
        el("div", { class: "pa-bar pa-bar-mini" }, [
          el("div", { class: "pa-bar-fill", style: "width:" + Math.round((doneInSubject / s.days.length) * 100) + "%" })
        ]),
        el("p", {
          class: "pa-muted pa-small pa-accordion-hint",
          text: isComplete
            ? "All days in this subject are done. Retry any day below for spaced practice."
            : "Every day here is open. Start any session — you do not have to finish this subject first."
        }),
        el("div", { class: "pa-day-list" }, dayRows)
      ]);

      var details = el("details", {
        class: "pa-accordion" + (isCurrent ? " pa-accordion-current" : ""),
        id: "pa-subject-" + s.id
      }, [summary, body]);
      if (isCurrent) details.open = true;

      offset += s.days.length;
      return details;
    });

    return el("div", { class: "pa-subject-panel" }, [
      el("div", { class: "pa-subject-panel-head" }, [
        el("h2", { class: "pa-section-title", text: "All sessions" }),
        el("p", { class: "pa-muted pa-small", text: "Open any subject and start any day. Mix concepts freely — a suggested next step is highlighted if you want a default path." })
      ]),
      el("div", { class: "pa-accordion-list" }, panels)
    ]);
  }

  /* ---------------- session flow ---------------- */

  function startSession(dayNumber, opts) {
    opts = opts || {};
    // Guard against onclick passing a MouseEvent as the first argument.
    if (typeof dayNumber !== "number" || !isFinite(dayNumber)) {
      dayNumber = currentDay();
      opts = {};
    }
    var entry = dayEntry(dayNumber);
    if (!entry) return;
    var isRetry = !!opts.retry || isDayCompleted(dayNumber);
    var questions = (entry.day.check || []).map(function (q) { return { q: q, from: null }; })
      .concat(reviewQuestions(dayNumber));
    session = {
      dayNumber: dayNumber,
      entry: entry,
      questions: questions,
      qIndex: 0,
      grades: [],
      work: "",
      isRetry: isRetry,
      phase: "review"
    };
    if (!state.startedAt) { state.startedAt = new Date().toISOString(); save(); }
    render();
    root.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderSession() {
    var s = session;
    var steps = { review: 1, task: 2, check: 3, done: 3 };
    var labels = { review: "Concept cue", task: "Do the practice", check: "Check your work", done: "Done" };
    var head = el("div", { class: "pa-session-head" }, [
      el("div", { class: "pa-kicker", text: (s.isRetry ? "Retry · " : "") + "Day " + s.dayNumber + " of " + GOAL + " - " + s.entry.subject.title }),
      s.phase !== "done" ? el("div", { class: "pa-step-label", text: "Step " + steps[s.phase] + " of 3 · " + labels[s.phase] }) : null,
      el("button", { class: "pa-btn pa-btn-ghost pa-exit", text: "Exit session", onclick: function () { session = null; render(); } })
    ]);
    root.appendChild(head);
    if (s.isRetry && s.phase === "review") {
      root.appendChild(el("div", { class: "pa-card pa-notice" }, [
        el("p", { text: "This is a retry of a day you already completed. Your plan progress stays where it is — you're just practicing again." })
      ]));
    }

    if (s.phase === "review") renderReview();
    else if (s.phase === "task") renderTask();
    else if (s.phase === "check") renderCheck();
    else renderDone();
  }

  function renderReview() {
    var s = session;
    root.appendChild(el("div", { class: "pa-card" }, [
      el("h3", { text: s.entry.day.focus }),
      el("p", { class: "pa-review" }, [emphasize(s.entry.day.review)]),
      el("p", { class: "pa-small" }, [
        el("a", { href: s.entry.subject.lesson, text: "Read the full lesson: " + s.entry.subject.title })
      ]),
      el("button", {
        class: "pa-btn pa-btn-primary",
        text: "Start today's practice task",
        onclick: function () { s.phase = "task"; render(); }
      })
    ]));
  }

  function renderTask() {
    var s = session;
    var task = s.entry.day.task || {};
    var mins = task.minutes || 8;
    var area = el("textarea", {
      class: "pa-textarea",
      rows: "6",
      placeholder: task.capture || "Write your attempt here…"
    });
    area.value = s.work || "";
    area.addEventListener("input", function () { s.work = area.value; });

    root.appendChild(el("div", { class: "pa-card" }, [
      el("div", { class: "pa-kicker", text: "Do this now · about " + mins + " minutes" }),
      el("h3", { text: "Today's practice task" }),
      el("p", { class: "pa-review" }, [emphasize(task.do || "")]),
      el("p", { class: "pa-muted pa-small", text: "Use your own study material. The check step will ask about what you just did — so do the work first." }),
      el("label", { class: "pa-label", text: task.capture || "Capture your attempt" }),
      area,
      el("button", {
        class: "pa-btn pa-btn-primary",
        text: "I've done the task — check me",
        onclick: function () {
          s.work = area.value;
          if (!s.work.trim()) {
            if (!window.confirm("You haven't written anything yet. Continue to the check anyway?")) return;
          }
          s.phase = "check";
          render();
        }
      })
    ]));
  }

  function gradeLabel(grade) {
    if (grade === "correct") return "Correct";
    if (grade === "mostly_correct") return "Mostly correct";
    return "Not correct";
  }

  function gradeClass(grade) {
    if (grade === "correct") return "pa-grade-correct";
    if (grade === "mostly_correct") return "pa-grade-mostly";
    return "pa-grade-incorrect";
  }

  function callGradeFunction(payload) {
    if (!aw || !cfg || !cfg.functionId) {
      return Promise.reject(new Error("AI grading is not configured yet."));
    }
    if (!user) {
      return Promise.reject(new Error("Sign in to get AI feedback on your written answers."));
    }
    return aw.functions
      .createExecution({
        functionId: cfg.functionId,
        body: JSON.stringify(payload),
        xasync: false,
        path: "/",
        method: "POST",
        headers: { "content-type": "application/json" }
      })
      .then(function (exec) {
        var status = exec.responseStatusCode || exec.statusCode;
        var raw = exec.responseBody || "";
        var data;
        try { data = JSON.parse(raw); } catch (e) {
          throw new Error("Grader returned an unreadable response.");
        }
        if (status && status >= 400) {
          throw new Error(data.error || "Grading failed (" + status + ").");
        }
        if (data.error) throw new Error(data.error);
        if (!data.grade) throw new Error("Grader did not return a grade.");
        return data;
      });
  }

  function renderCheck() {
    var s = session;
    var item = s.questions[s.qIndex];
    var q = item.q;
    var draftKey = "checkDraft" + s.qIndex;
    if (s[draftKey] === undefined) s[draftKey] = "";

    var kids = [];
    if (s.work && s.work.trim()) {
      kids.push(el("details", { class: "pa-work-recall" }, [
        el("summary", { text: "Your attempt from the practice task" }),
        el("pre", { class: "pa-work-text", text: s.work })
      ]));
    }

    kids.push(
      el("div", { class: "pa-quiz-meta", text: "Check " + (s.qIndex + 1) + " of " + s.questions.length + (item.from ? " · spaced review from " + item.from : "") }),
      el("h3", { class: "pa-question", text: q.q }),
      el("p", { class: "pa-muted pa-small", text: "Write your answer in your own words. An open-source model (GPT-OSS via Groq) will grade it as correct, mostly correct, or not correct." })
    );

    var area = el("textarea", {
      class: "pa-textarea",
      rows: "5",
      placeholder: "Type your answer here…"
    });
    area.value = s[draftKey];
    area.addEventListener("input", function () { s[draftKey] = area.value; });
    kids.push(area);

    var statusLine = el("p", { class: "pa-muted pa-small", id: "pa-grade-status" });
    var feedbackBox = el("div", { class: "pa-feedback" });
    var actions = el("div", { class: "pa-auth-buttons" });

    function setBusy(b) {
      area.disabled = b;
      actions.querySelectorAll("button").forEach(function (btn) { btn.disabled = b; });
    }

    function showResult(result) {
      feedbackBox.innerHTML = "";
      feedbackBox.appendChild(el("div", {
        class: "pa-grade-badge " + gradeClass(result.grade),
        text: gradeLabel(result.grade)
      }));
      feedbackBox.appendChild(el("p", { class: "pa-explain " + (result.grade === "incorrect" ? "pa-explain-wrong" : "pa-explain-right"), text: result.feedback || "" }));

      actions.innerHTML = "";
      actions.appendChild(el("button", {
        class: "pa-btn pa-btn-ghost",
        text: "Retry this check",
        onclick: function () {
          s.grades[s.qIndex] = undefined;
          render();
        }
      }));
      actions.appendChild(el("button", {
        class: "pa-btn pa-btn-primary",
        text: s.qIndex + 1 < s.questions.length ? "Continue to next check" : "Finish session",
        onclick: function () {
          s.grades[s.qIndex] = result.grade;
          s.qIndex++;
          if (s.qIndex >= s.questions.length) completeSession();
          else render();
        }
      }));
    }

    actions.appendChild(el("button", {
      class: "pa-btn pa-btn-primary",
      text: "Submit for AI grading",
      onclick: function () {
        var answer = (area.value || "").trim();
        s[draftKey] = area.value;
        if (!answer) {
          statusLine.textContent = "Write an answer before submitting.";
          statusLine.className = "pa-error";
          return;
        }
        statusLine.className = "pa-muted pa-small";
        statusLine.textContent = "Grading with GPT-OSS (Groq)…";
        setBusy(true);
        callGradeFunction({
          question: q.q,
          rubric: q.rubric,
          exemplar: q.exemplar || "",
          userAnswer: answer,
          focus: s.entry.day.focus || "",
          taskWork: s.work || ""
        })
          .then(function (result) {
            statusLine.textContent = "";
            setBusy(false);
            showResult(result);
          })
          .catch(function (err) {
            setBusy(false);
            statusLine.className = "pa-error";
            statusLine.textContent = (err && err.message) || "Grading failed.";
          });
      }
    }));

    kids.push(statusLine, feedbackBox, actions);
    root.appendChild(el("div", { class: "pa-card" }, kids));
  }

  function completeSession() {
    var s = session;
    var wasAlreadyDone = isDayCompleted(s.dayNumber);
    if (!wasAlreadyDone) {
      state.completedDays.push(s.dayNumber);
      state.completedDays.sort(function (a, b) { return a - b; });
    }
    var tallies = { correct: 0, mostly_correct: 0, incorrect: 0 };
    (s.grades || []).forEach(function (g) { if (tallies[g] !== undefined) tallies[g]++; });
    var prev = state.log[s.dayNumber] || {};
    state.log[s.dayNumber] = {
      date: todayKey(),
      grades: s.grades.slice(),
      tallies: tallies,
      total: s.questions.length,
      work: (s.work || "").slice(0, 2000),
      retryCount: (prev.retryCount || 0) + (wasAlreadyDone || s.isRetry ? 1 : 0),
      lastWasRetry: !!(wasAlreadyDone || s.isRetry)
    };
    recordPracticeDate(todayKey(), s.dayNumber);
    save();
    s.phase = "done";
    render();
  }

  function renderDone() {
    var s = session;
    var next = currentDay();
    var tallies = { correct: 0, mostly_correct: 0, incorrect: 0 };
    (s.grades || []).forEach(function (g) { if (tallies[g] !== undefined) tallies[g]++; });
    var summary = tallies.correct + " correct · " + tallies.mostly_correct + " mostly · " + tallies.incorrect + " not correct";
    var msg;
    if (s.isRetry) {
      msg = "Retry complete. That calendar day is marked. Jump to any other session whenever you like.";
    } else if (next > GOAL) {
      msg = "Every session in the plan is complete. Extraordinary work. You can still open any day from the subject list.";
    } else if (tallies.incorrect === 0) {
      msg = "Solid checks. Suggested next is Day " + next + " — or pick any other session.";
    } else {
      msg = "Session complete — use the feedback on the weaker answers. Suggested next is Day " + next + ", or jump to any concept.";
    }
    root.appendChild(el("div", { class: "pa-card pa-done" }, [
      el("div", { class: "pa-done-mark", text: "\u2713" }),
      el("h3", { text: s.isRetry ? "Day " + s.dayNumber + " retry complete" : "Day " + s.dayNumber + " complete" }),
      el("p", { text: summary + ". " + msg }),
      el("p", { class: "pa-muted pa-small", text: "Current streak: " + streak() + " day" + (streak() === 1 ? "" : "s") + "." }),
      el("div", { class: "pa-auth-buttons" }, [
        el("button", { class: "pa-btn pa-btn-primary", text: "Back to overview", onclick: function () { session = null; render(); } }),
        next <= GOAL && !s.isRetry
          ? el("button", {
              class: "pa-btn pa-btn-ghost",
              text: "Start suggested Day " + next,
              onclick: function () { startSession(next); }
            })
          : null,
        el("button", {
          class: "pa-btn pa-btn-ghost",
          text: "Retry this day again",
          onclick: function () { startSession(s.dayNumber, { retry: true }); }
        })
      ])
    ]));
  }

  /* ---------------- account panel ---------------- */

  function recoveryRedirectUrl() {
    return new URL(location.pathname, location.href).href;
  }

  function clearRecoveryParams() {
    try {
      if (window.history && window.history.replaceState) {
        window.history.replaceState({}, "", location.pathname + (location.hash || ""));
      }
    } catch (e) { /* ignore */ }
    recoveryUserId = null;
    recoverySecret = null;
  }

  function authFailMessage(err) {
    var msg = (err && err.message) || "Something went wrong. Please try again.";
    // Unknown Appwrite web platform → browser hides the 403 as a NetworkError.
    if (/networkerror|failed to fetch|load failed|network request failed/i.test(msg)) {
      msg =
        "Could not reach Appwrite from " + location.origin +
        ". In the Appwrite console, add a Web platform for hostname \"" +
        location.hostname +
        "\" (Overview → Platforms), then try again.";
    }
    return msg;
  }

  function renderAccountPanel() {
    var panel = el("div", { class: "pa-card pa-account" });
    panel.appendChild(el("h2", { class: "pa-section-title", text: "Account & sync" }));

    if (!cfg) {
      panel.appendChild(el("p", { class: "pa-muted", text: "Cloud sync isn't set up yet - your progress is saved in this browser only. Once the Appwrite project is configured (assets/appwrite-config.js), you'll be able to create an account and sync progress across devices." }));
      return panel;
    }
    if (!window.Appwrite) {
      panel.appendChild(el("p", { class: "pa-muted", text: "The Appwrite SDK failed to load (offline?). Progress is being saved in this browser and will sync next time you're online and signed in." }));
      return panel;
    }

    if (user) {
      panel.appendChild(el("p", {}, [
        document.createTextNode("Signed in as "),
        el("strong", { text: user.email || user.name || user.$id }),
        document.createTextNode(". Progress syncs to the cloud, and written checks are graded by an open-source model (GPT-OSS via Groq).")
      ]));
      panel.appendChild(el("p", { class: "pa-muted pa-small", id: "pa-sync-line", text: syncMsg }));
      panel.appendChild(el("button", {
        class: "pa-btn pa-btn-ghost",
        text: "Sign out",
        onclick: function () {
          aw.account.deleteSession({ sessionId: "current" }).finally(function () {
            user = null;
            syncMsg = "";
            authView = "login";
            render();
          });
        }
      }));
      return panel;
    }

    var errLine = el("p", { class: "pa-error" });
    var okLine = el("p", { class: "pa-ok" });

    function busy(b) {
      panel.querySelectorAll("button, input").forEach(function (n) { n.disabled = b; });
    }

    function afterAuth() {
      return aw.account.get().then(function (u) {
        user = u;
        syncMsg = "Syncing\u2026";
        authView = "login";
        return pullCloud();
      }).then(function () {
        save(); // push merged state back up
        render();
      });
    }

    function fail(err) {
      busy(false);
      okLine.textContent = "";
      errLine.textContent = authFailMessage(err);
    }

    if (authView === "forgot" || authView === "forgot-sent") {
      panel.appendChild(el("p", {
        class: "pa-muted",
        text: authView === "forgot-sent"
          ? "If an account exists for that email, Appwrite sent a reset link. Open it on this device to choose a new password."
          : "Enter the email for your Practice account. We'll email a reset link that brings you back here."
      }));
      var resetEmail = el("input", {
        class: "pa-input",
        type: "email",
        placeholder: "Email",
        autocomplete: "email"
      });
      var sendReset = el("button", {
        class: "pa-btn pa-btn-primary",
        text: "Send reset link",
        onclick: function () {
          errLine.textContent = "";
          okLine.textContent = "";
          var addr = resetEmail.value.trim();
          if (!addr) {
            errLine.textContent = "Enter your email address.";
            return;
          }
          busy(true);
          aw.account.createRecovery({ email: addr, url: recoveryRedirectUrl() })
            .then(function () {
              busy(false);
              authView = "forgot-sent";
              render();
            })
            .catch(fail);
        }
      });
      panel.appendChild(el("div", { class: "pa-auth-form" }, [
        resetEmail,
        el("div", { class: "pa-auth-buttons" }, [sendReset]),
        okLine,
        errLine,
        el("div", { class: "pa-auth-links" }, [
          el("button", {
            class: "pa-link-btn",
            text: "Back to sign in",
            onclick: function () { authView = "login"; render(); }
          })
        ])
      ]));
      return panel;
    }

    if (authView === "reset" || authView === "reset-done") {
      if (authView === "reset-done") {
        panel.appendChild(el("p", { class: "pa-ok", text: "Password updated. You can sign in with your new password." }));
        panel.appendChild(el("button", {
          class: "pa-btn pa-btn-primary",
          text: "Go to sign in",
          onclick: function () { authView = "login"; render(); }
        }));
        return panel;
      }

      panel.appendChild(el("p", { class: "pa-muted", text: "Choose a new password for your Practice account (at least 8 characters)." }));
      var newPass = el("input", {
        class: "pa-input",
        type: "password",
        placeholder: "New password (8+ characters)",
        autocomplete: "new-password"
      });
      var confirmPass = el("input", {
        class: "pa-input",
        type: "password",
        placeholder: "Confirm new password",
        autocomplete: "new-password"
      });
      var savePass = el("button", {
        class: "pa-btn pa-btn-primary",
        text: "Update password",
        onclick: function () {
          errLine.textContent = "";
          okLine.textContent = "";
          if (!newPass.value || newPass.value.length < 8) {
            errLine.textContent = "Password must be at least 8 characters.";
            return;
          }
          if (newPass.value !== confirmPass.value) {
            errLine.textContent = "Passwords do not match.";
            return;
          }
          if (!recoveryUserId || !recoverySecret) {
            errLine.textContent = "This reset link is incomplete. Request a new one from Sign in.";
            return;
          }
          busy(true);
          aw.account.updateRecovery({
            userId: recoveryUserId,
            secret: recoverySecret,
            password: newPass.value
          })
            .then(function () {
              clearRecoveryParams();
              authView = "reset-done";
              render();
            })
            .catch(fail);
        }
      });
      panel.appendChild(el("div", { class: "pa-auth-form" }, [
        newPass,
        confirmPass,
        el("div", { class: "pa-auth-buttons" }, [savePass]),
        errLine,
        el("div", { class: "pa-auth-links" }, [
          el("button", {
            class: "pa-link-btn",
            text: "Back to sign in",
            onclick: function () {
              clearRecoveryParams();
              authView = "login";
              render();
            }
          })
        ])
      ]));
      return panel;
    }

    panel.appendChild(el("p", { class: "pa-muted", text: "Sign in to sync progress and unlock AI grading on written checks. Until then, progress stays in this browser and checks cannot be graded." }));

    var email = el("input", { class: "pa-input", type: "email", placeholder: "Email", autocomplete: "email" });
    var password = el("input", { class: "pa-input", type: "password", placeholder: "Password (8+ characters)", autocomplete: "current-password" });

    var signIn = el("button", {
      class: "pa-btn pa-btn-primary",
      text: "Sign in",
      onclick: function () {
        errLine.textContent = "";
        okLine.textContent = "";
        busy(true);
        aw.account.createEmailPasswordSession({ email: email.value.trim(), password: password.value })
          .then(afterAuth)
          .catch(fail);
      }
    });

    var signUp = el("button", {
      class: "pa-btn pa-btn-ghost",
      text: "Create account",
      onclick: function () {
        errLine.textContent = "";
        okLine.textContent = "";
        busy(true);
        aw.account.create({ userId: Appwrite.ID.unique(), email: email.value.trim(), password: password.value })
          .then(function () {
            return aw.account.createEmailPasswordSession({ email: email.value.trim(), password: password.value });
          })
          .then(afterAuth)
          .catch(fail);
      }
    });

    panel.appendChild(el("div", { class: "pa-auth-form" }, [
      email,
      password,
      el("div", { class: "pa-auth-buttons" }, [signIn, signUp]),
      okLine,
      errLine,
      el("div", { class: "pa-auth-links" }, [
        el("button", {
          class: "pa-link-btn",
          text: "Forgot password?",
          onclick: function () { authView = "forgot"; render(); }
        })
      ])
    ]));
    return panel;
  }

  /* ---------------- boot ---------------- */

  function boot() {
    if (aw) {
      aw.account.get()
        .then(function (u) {
          user = u;
          syncMsg = "Syncing\u2026";
          return pullCloud();
        })
        .catch(function () { user = null; })
        .finally(render);
    } else {
      render();
    }
  }

  boot();
  window.addEventListener("hashchange", function () {
    hashApplied = false;
    if (!session) render();
  });
})();
