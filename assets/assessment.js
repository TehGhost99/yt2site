/* Interactive self-assessment for Getting Started.
   Scores four habit areas on a 5-point scale and recommends lessons. */
(function () {
  "use strict";

  var root = document.getElementById("self-assessment-app");
  if (!root) return;

  var SCALE = [
    { value: 2, label: "Completely true" },
    { value: 1, label: "Somewhat true" },
    { value: 0, label: "Unsure" },
    { value: -1, label: "Somewhat false" },
    { value: -2, label: "Completely false" }
  ];

  var QUESTIONS = [
    { id: 1, group: "A", text: "When I study, I mostly reread notes/textbook or re-watch lectures." },
    { id: 2, group: "A", text: "I try to make studying easier and lower-effort wherever I can." },
    { id: 3, group: "A", text: "I take notes by capturing as much as possible, close to word-for-word." },
    { id: 4, group: "B", text: "I mostly learn facts and definitions on their own, as I meet them." },
    { id: 5, group: "B", text: "I rarely stop to ask how a new idea connects to what I already know." },
    { id: 6, group: "B", text: "My notes run left-to-right, top-to-bottom down the page (linear)." },
    { id: 7, group: "C", text: "I \"test\" myself by reading a question and checking if the answer looks right." },
    { id: 8, group: "C", text: "I rely heavily on flashcards / spaced repetition as my main method." },
    { id: 9, group: "C", text: "I revise one topic fully before moving to the next." },
    { id: 10, group: "D", text: "I focus on memorizing facts more than on judging what matters and why." },
    { id: 11, group: "D", text: "I only study when I feel motivated." }
  ];

  var GROUPS = {
    A: {
      title: "Passive intake",
      blurb: "You're leaning on rereading, easy study, and transcript-style notes — activity that often feels productive without building usable memory.",
      workOn: [
        { label: "Myths & the Misinterpreted-Effort Trap", href: "myths-mindset.html" },
        { label: "The Effort–Time Exchange", href: "effort-struggle.html" }
      ],
      practice: "myths-mindset"
    },
    B: {
      title: "Isolated knowledge",
      blurb: "Ideas are staying separate instead of connecting into a big picture — so recall and transfer stay fragile.",
      workOn: [
        { label: "How Learning Really Works", href: "the-science.html" },
        { label: "Encoding: Build the Big Picture", href: "encoding.html" },
        { label: "Thinking on Paper", href: "notes-on-paper.html" }
      ],
      practice: "encoding"
    },
    C: {
      title: "Weak retrieval & revision",
      blurb: "Your \"testing\" is closer to recognition than retrieval, and revision may be too blocked or flashcard-heavy.",
      workOn: [
        { label: "Active Recall, Done Right", href: "active-recall.html" },
        { label: "Spacing & the Forgetting Curve", href: "spacing.html" },
        { label: "Interleaving", href: "interleaving.html" }
      ],
      practice: "active-recall"
    },
    D: {
      title: "Shallow thinking & motivation dependence",
      blurb: "You're optimizing for facts and mood instead of higher-order thinking and a system that works on low-motivation days.",
      workOn: [
        { label: "The 6 Levels of Thinking", href: "higher-order-thinking.html" },
        { label: "Motivation & Your Study System", href: "motivation-systems.html" }
      ],
      practice: "higher-order-thinking"
    }
  };

  var STORAGE_KEY = "effective-learner-assessment-v2";
  var answers = {}; // id -> -2..2
  var qIndex = 0;
  var phase = "intro"; // intro | quiz | results

  try {
    var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved && saved.answers && typeof saved.answers === "object") {
      answers = saved.answers;
      phase = "results";
    }
  } catch (e) { /* ignore */ }

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

  function labelForAvg(avg) {
    if (avg >= 1.5) return "Completely true";
    if (avg >= 0.5) return "Somewhat true";
    if (avg > -0.5) return "Unsure";
    if (avg > -1.5) return "Somewhat false";
    return "Completely false";
  }

  function scoreGroups() {
    var scores = {};
    ["A", "B", "C", "D"].forEach(function (g) {
      scores[g] = { sum: 0, total: 0, avg: 0, leanTrue: 0 };
    });
    QUESTIONS.forEach(function (q) {
      var v = answers[q.id];
      if (typeof v !== "number") return;
      scores[q.group].sum += v;
      scores[q.group].total++;
      if (v > 0) scores[q.group].leanTrue++;
    });
    ["A", "B", "C", "D"].forEach(function (g) {
      var s = scores[g];
      s.avg = s.total ? s.sum / s.total : 0;
    });
    return scores;
  }

  function prioritizedGroups(scores) {
    return ["A", "B", "C", "D"]
      .map(function (g) {
        var s = scores[g];
        return { id: g, avg: s.avg, leanTrue: s.leanTrue, total: s.total };
      })
      .filter(function (g) { return g.avg > 0; })
      .sort(function (a, b) { return b.avg - a.avg || b.leanTrue - a.leanTrue; });
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ answers: answers, at: Date.now() }));
    } catch (e) { /* ignore */ }
  }

  function render() {
    root.innerHTML = "";
    if (phase === "intro") renderIntro();
    else if (phase === "quiz") renderQuiz();
    else renderResults();
  }

  function renderIntro() {
    root.appendChild(el("div", { class: "sa-card" }, [
      el("div", { class: "sa-kicker", text: "Self-assessment quiz" }),
      el("h2", { text: "How do you study right now?" }),
      el("p", {
        class: "sa-muted",
        text: "Eleven short statements. Rate each from completely true to completely false — honestly. At the end you'll get a ranked list of what to work on, with links into the lessons and the Practice app."
      }),
      el("p", { class: "sa-muted sa-small", text: "Takes about 2–3 minutes. No account required." }),
      el("button", {
        class: "sa-btn sa-btn-primary",
        text: Object.keys(answers).length ? "Retake the quiz" : "Start the quiz",
        onclick: function () {
          answers = {};
          qIndex = 0;
          phase = "quiz";
          try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
          render();
        }
      }),
      Object.keys(answers).length
        ? el("button", {
            class: "sa-btn sa-btn-ghost",
            text: "See my last results",
            onclick: function () { phase = "results"; render(); }
          })
        : null
    ]));
  }

  function renderQuiz() {
    var q = QUESTIONS[qIndex];
    var answeredCount = Object.keys(answers).length;
    var pct = Math.round((qIndex / QUESTIONS.length) * 100);
    var current = answers[q.id];

    var choices = SCALE.map(function (opt) {
      return el("button", {
        class: "sa-choice" + (current === opt.value ? " sa-choice-on" : ""),
        text: opt.label,
        onclick: function () { pick(opt.value); }
      });
    });

    root.appendChild(el("div", { class: "sa-card" }, [
      el("div", { class: "sa-progress-row" }, [
        el("span", { class: "sa-kicker", text: "Question " + (qIndex + 1) + " of " + QUESTIONS.length }),
        el("span", { class: "sa-muted sa-small", text: answeredCount + " answered" })
      ]),
      el("div", { class: "sa-bar" }, [el("div", { class: "sa-bar-fill", style: "width:" + pct + "%" })]),
      el("p", { class: "sa-group-tag", text: "Area " + q.group + " · " + GROUPS[q.group].title }),
      el("h3", { class: "sa-question", text: q.text }),
      el("p", { class: "sa-muted sa-small", text: "How true is this for how you study today?" }),
      el("div", { class: "sa-choice-row sa-choice-scale" }, choices),
      el("div", { class: "sa-nav-row" }, [
        qIndex > 0
          ? el("button", {
              class: "sa-btn sa-btn-ghost",
              text: "Back",
              onclick: function () { qIndex--; render(); }
            })
          : el("span"),
        el("button", {
          class: "sa-btn sa-btn-ghost",
          text: "Exit quiz",
          onclick: function () { phase = "intro"; render(); }
        })
      ])
    ]));
  }

  function pick(value) {
    var q = QUESTIONS[qIndex];
    answers[q.id] = value;
    if (qIndex + 1 < QUESTIONS.length) {
      qIndex++;
      render();
    } else {
      persist();
      phase = "results";
      render();
      root.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function renderResults() {
    var scores = scoreGroups();
    var ranked = prioritizedGroups(scores);
    var kids = [
      el("div", { class: "sa-kicker", text: "Your results" }),
      el("h2", { text: ranked.length ? "Here's what to work on" : "Solid baseline" }),
      el("p", {
        class: "sa-muted",
        text: ranked.length
          ? "Areas are ranked by how true the statements felt for you. Start with the top item — then use Practice for daily reps."
          : "You leaned false or unsure on most statements. Still start with the foundations so the later techniques have somewhere to land."
      })
    ];

    var chips = ["A", "B", "C", "D"].map(function (g) {
      var s = scores[g];
      var hot = s.avg >= 0.5;
      return el("div", { class: "sa-score-chip" + (hot ? " sa-score-hot" : "") }, [
        el("strong", { text: g }),
        el("span", { text: GROUPS[g].title }),
        el("span", { class: "sa-score-num", text: labelForAvg(s.avg) })
      ]);
    });
    kids.push(el("div", { class: "sa-score-grid" }, chips));

    if (!ranked.length) {
      kids.push(el("div", { class: "sa-result" }, [
        el("h3", { text: "Recommended starting point" }),
        el("p", { text: "Begin with How Learning Really Works, then continue through Learning Materials in order." }),
        el("a", { class: "sa-btn sa-btn-primary", href: "the-science.html", text: "Start the first lesson →" }),
        el("a", { class: "sa-btn sa-btn-ghost", href: "practice.html", text: "Open Practice" })
      ]));
    } else {
      ranked.forEach(function (item, idx) {
        var g = GROUPS[item.id];
        var links = g.workOn.map(function (w) {
          return el("li", {}, [el("a", { href: w.href, text: w.label })]);
        });
        kids.push(el("div", { class: "sa-result" + (idx === 0 ? " sa-result-top" : "") }, [
          el("div", { class: "sa-result-rank", text: idx === 0 ? "Priority 1" : "Also work on" }),
          el("h3", { text: g.title }),
          el("p", { text: g.blurb }),
          el("p", {
            class: "sa-muted sa-small",
            text: "Average in this area: " + labelForAvg(item.avg) +
              " (" + item.leanTrue + " of " + item.total + " answers leaned true)."
          }),
          el("div", { class: "sa-result-label", text: "Lessons to study" }),
          el("ul", { class: "sa-link-list" }, links),
          el("a", {
            class: "sa-btn " + (idx === 0 ? "sa-btn-primary" : "sa-btn-ghost"),
            href: "practice.html",
            text: idx === 0 ? "Practice this area daily →" : "Open Practice"
          })
        ]));
      });
    }

    kids.push(el("div", { class: "sa-footer-actions" }, [
      el("button", {
        class: "sa-btn sa-btn-ghost",
        text: "Retake quiz",
        onclick: function () {
          answers = {};
          qIndex = 0;
          phase = "quiz";
          try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
          render();
        }
      }),
      el("a", { class: "sa-btn sa-btn-ghost", href: "learning-materials.html", text: "Full learning path" })
    ]));

    root.appendChild(el("div", { class: "sa-card" }, kids));
  }

  render();
})();
