(() => {
  "use strict";

  const DATA = window.CHEM_DATA;
  const LEGACY_STORAGE_KEY = "guoguo-chemistry-progress-v1";
  const CLOUD_CONFIG = window.CHEM_SUPABASE_CONFIG || {};
  const cloudConfigured = Boolean(CLOUD_CONFIG.url && CLOUD_CONFIG.publishableKey && !CLOUD_CONFIG.url.includes("YOUR_") && !CLOUD_CONFIG.publishableKey.includes("YOUR_"));
  const REVIEW_INTERVALS = [0, 1, 3, 7];
  const app = document.getElementById("app");
  const toast = document.getElementById("toast");
  let cloud = null;
  let currentUser = null;
  let stateRevision = 0;
  let syncStatus = "idle";
  let syncTimer = null;
  let syncInFlight = false;
  let syncPending = false;

  const iconPaths = {
    home: '<path d="M3 11 12 3l9 8v9a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
    map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>',
    bank: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    wrong: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="m9 9 6 6m0-6-6 6"/>',
    test: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4m8-4v4M7 11h10M7 15h6"/>',
    record: '<path d="M4 19V9m6 10V5m6 14v-7m4 7H2"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1z"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4H6.5A2.5 2.5 0 0 0 4 6.5z"/><path d="M4 6.5v13M8 8h8"/>',
    arrow: '<path d="m9 18 6-6-6-6"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    flask: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-9V3"/><path d="M7.5 16h9"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M5 21h14"/>',
    upload: '<path d="M12 21V9m-5 5 5-5 5 5M5 3h14"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>'
  };
  const icon = (name, cls = "") => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] || iconPaths.book}</svg>`;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const todayISO = () => new Date().toISOString().slice(0, 10);
  const addDays = (iso, days) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };
  const questionById = id => DATA.questions.find(question => question.id === id);
  const dayById = id => DATA.days.find(day => day.id === id) || DATA.days[0];

  function scheduledDay() {
    const start = new Date(`${DATA.startDate}T00:00:00`);
    const now = new Date();
    const diff = Math.floor((now - start) / 86400000) + 1;
    return `day${String(Math.max(1, Math.min(30, diff))).padStart(2, "0")}`;
  }

  function defaultState() {
    return {
      version: DATA.version,
      currentDay: scheduledDay(),
      tasks: {}, answers: {}, wrong: {}, parentVerified: {},
      lessonSection: {}, questionIndex: {}, hints: {}, oralOpen: {},
      settings: { reminderEnabled: true, times: ["10:30"] }
    };
  }

  function normalizeState(value) {
    return value && typeof value === "object" ? {...defaultState(), ...value, settings: {...defaultState().settings, ...(value.settings || {})}} : defaultState();
  }
  function readState(key) {
    try {
      const saved = JSON.parse(localStorage.getItem(key));
      return saved && typeof saved === "object" ? normalizeState(saved) : null;
    } catch { return null; }
  }
  function userStorageKey() {
    return currentUser ? `${LEGACY_STORAGE_KEY}:${currentUser.id}` : null;
  }
  function saveLocalState() {
    const key = userStorageKey();
    if (key) localStorage.setItem(key, JSON.stringify(state));
  }
  let state = defaultState();
  function saveState() {
    saveLocalState();
    stateRevision += 1;
    scheduleCloudSave();
  }
  function notify(message) { toast.textContent = message; toast.classList.add("show"); clearTimeout(notify.timer); notify.timer = setTimeout(() => toast.classList.remove("show"), 2200); }
  function syncStatusText() {
    return syncStatus === "saving" ? "保存中" : syncStatus === "saved" ? "已保存" : syncStatus === "error" ? "保存失败" : "等待同步";
  }
  function syncStatusMarkup() {
    return `<span class="sync-status ${syncStatus}" data-sync-status><span>${syncStatusText()}</span></span>`;
  }
  function updateSyncStatus(next) {
    syncStatus = next;
    document.querySelectorAll("[data-sync-status]").forEach(element => {
      element.className = `sync-status ${next}`;
      const label = element.querySelector("span");
      if (label) label.textContent = syncStatusText();
    });
  }
  function scheduleCloudSave() {
    if (!cloud || !currentUser) return;
    updateSyncStatus("saving");
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncStateNow, 350);
  }
  async function syncStateNow() {
    if (!cloud || !currentUser) return false;
    if (syncInFlight) { syncPending = true; return false; }
    clearTimeout(syncTimer);
    syncInFlight = true;
    syncPending = false;
    updateSyncStatus("saving");
    const revision = stateRevision;
    const snapshot = JSON.parse(JSON.stringify(state));
    let error = null;
    try {
      ({error} = await cloud.from("user_progress").upsert({user_id:currentUser.id,state:snapshot,updated_at:new Date().toISOString()},{onConflict:"user_id"}));
    } catch {
      error = true;
    }
    syncInFlight = false;
    if (error) { updateSyncStatus("error"); return false; }
    if (revision === stateRevision && !syncPending) updateSyncStatus("saved");
    else scheduleCloudSave();
    return true;
  }
  async function loadCloudState() {
    const scoped = readState(userStorageKey());
    const legacy = readState(LEGACY_STORAGE_KEY);
    const {data,error} = await cloud.from("user_progress").select("state,updated_at").eq("user_id",currentUser.id).maybeSingle();
    if (error) throw error;
    if (data?.state) {
      state = normalizeState(data.state);
      saveLocalState();
      if (legacy) localStorage.removeItem(LEGACY_STORAGE_KEY);
      updateSyncStatus("saved");
      return;
    }
    state = normalizeState(scoped || legacy || defaultState());
    saveLocalState();
    const migrated = await syncStateNow();
    if (migrated && legacy) localStorage.removeItem(LEGACY_STORAGE_KEY);
  }
  function renderAuth(errorMessage = "") {
    const unavailable = !cloudConfigured ? "云端服务尚未配置。请先按照 README 填写 config.js。" : !window.supabase?.createClient ? "登录组件加载失败，请检查网络后刷新页面。" : "";
    app.innerHTML = `<main id="main" class="auth-page"><div class="auth-shell"><section class="auth-intro"><div class="brand">${icon("flask","brand-mark")}<span>果果的化学<br>30天通关</span></div><h1>每天学懂一点，进度一直都在。</h1><p>登录后，Safari 和 Edge 会读取同一份学习记录。</p></section><section class="auth-card"><h2>登录学习账号</h2><p>使用家长管理的邮箱和密码登录。</p>${unavailable ? `<div class="setup-note">${esc(unavailable)}</div>` : ""}${errorMessage ? `<div class="auth-error" role="alert">${esc(errorMessage)}</div>` : ""}<form class="auth-form" id="login-form"><label class="auth-field">邮箱<input type="email" name="email" autocomplete="username" required ${unavailable ? "disabled" : ""}></label><label class="auth-field">密码<input type="password" name="password" autocomplete="current-password" required ${unavailable ? "disabled" : ""}></label><button class="button primary" type="submit" ${unavailable ? "disabled" : ""}>登录并读取学习进度</button></form></section></div></main>`;
  }
  async function signIn(form) {
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = "正在登录…";
    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;
    let data;
    let error;
    try {
      ({data,error} = await cloud.auth.signInWithPassword({email,password}));
    } catch {
      renderAuth("无法连接登录服务，请检查网络后重试。");
      return;
    }
    if (error || !data.user) { renderAuth("邮箱或密码不正确，请检查后重试。"); return; }
    currentUser = data.user;
    try {
      await loadCloudState();
      if (!location.hash) location.hash = "#/today";
      render();
    } catch {
      await cloud.auth.signOut();
      currentUser = null;
      renderAuth("账号已登录，但读取学习进度失败。请检查网络或数据库配置。");
    }
  }
  async function signOut() {
    await syncStateNow();
    try { await cloud.auth.signOut(); } catch {}
    clearTimeout(syncTimer);
    currentUser = null;
    state = defaultState();
    syncStatus = "idle";
    syncPending = false;
    renderAuth();
  }
  async function bootstrap() {
    if (!cloudConfigured || !window.supabase?.createClient) { renderAuth(); return; }
    cloud = window.supabase.createClient(CLOUD_CONFIG.url,CLOUD_CONFIG.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    const {data,error} = await cloud.auth.getSession();
    if (error || !data.session?.user) { renderAuth(error ? "无法检查登录状态，请刷新后重试。" : ""); return; }
    currentUser = data.session.user;
    try {
      await loadCloudState();
      if (!location.hash) location.hash = "#/today";
      render();
    } catch {
      currentUser = null;
      renderAuth("读取学习进度失败，请检查网络或数据库配置。");
    }
  }

  function navItems() {
    return [
      ["today", "今日学习", "home"], ["map", "知识地图", "map"], ["bank", "分考点题库", "bank"],
      ["wrong", "错题本", "wrong"], ["test/day03", "三日测", "test"], ["record", "学习记录", "record"]
    ];
  }
  function shell(content, active = "today") {
    const nav = navItems().map(([route, label, iconName]) => `<button class="nav-button ${active === route.split("/")[0] ? "active" : ""}" data-route="${route}">${icon(iconName)}<span>${label}</span></button>`).join("");
    const mobile = [["today","今日","home"],["bank","题库","bank"],["wrong","错题","wrong"],["record","记录","record"]].map(([route,label,iconName]) => `<button class="${active === route ? "active" : ""}" data-route="${route}">${icon(iconName)}<span>${label}</span></button>`).join("");
    return `<div class="mobile-top"><div class="brand">${icon("flask","brand-mark")}<span>果果的化学·30天通关</span></div><div class="mobile-top-actions">${syncStatusMarkup()}<button class="button ghost small" data-route="settings" aria-label="设置">${icon("menu")}</button><button class="button ghost small" data-action="logout">退出</button></div></div>
      <div class="app-shell"><aside class="sidebar"><div class="brand">${icon("flask","brand-mark")}<span>果果的化学<br>30天通关</span></div><nav class="nav" aria-label="主导航">${nav}</nav><div class="sidebar-bottom"><button class="nav-button" data-route="settings">${icon("settings")}<span>提醒与数据</span></button><div class="quiet-note">先把今天真正学懂，再向前走。不会做不是失败，是系统需要补课的信号。</div></div></aside>
      <div class="main-wrap"><header class="topbar"><div class="topbar-actions">${syncStatusMarkup()}<span class="account-email" title="${esc(currentUser.email || "")}">${esc(currentUser.email || "")}</span><button class="button ghost" data-route="settings">${icon("settings")}提醒与数据</button><button class="button" data-route="parent/${activeDayId()}">${icon("users")}家长视图</button><button class="button ghost" data-action="logout">退出</button></div></header><main id="main">${content}</main></div></div>
      <nav class="mobile-nav" aria-label="移动端主导航">${mobile}</nav>`;
  }

  function activeDayId() {
    const route = parseRoute();
    return route.parts.find(part => /^day\d{2}$/.test(part)) || (dayById(state.currentDay).id);
  }
  function parseRoute() {
    const raw = (location.hash || "#/today").replace(/^#\/?/, "");
    const [path, queryString = ""] = raw.split("?");
    return { parts: path.split("/").filter(Boolean), query: new URLSearchParams(queryString) };
  }

  function taskDone(dayId, index) { return Boolean(state.tasks[`${dayId}:${index}`]); }
  function answeredQuestions(day) { return day.questions.filter(id => state.answers[id]?.status === "correct").length; }
  function dueWrong() { const today = todayISO(); return Object.values(state.wrong).filter(item => !item.resolved && item.due <= today); }
  function completion(day) {
    const tasks = day.tasks.filter((_, index) => taskDone(day.id, index)).length;
    const correct = answeredQuestions(day);
    return {tasks, taskTotal: day.tasks.length, correct, questionTotal: day.questions.length, verified: Boolean(state.parentVerified[day.id])};
  }

  function renderToday() {
    let day = dayById(state.currentDay);
    if (!DATA.days.some(item => item.id === state.currentDay)) day = DATA.days[0];
    const stats = completion(day);
    const steps = [
      ["课本与教材帮", day.reading[0], taskDone(day.id,0)], ["分段讲解", "按小节学完，边学边做随堂题", taskDone(day.id,1)],
      ["即时练习", `${stats.correct}/${stats.questionTotal}题已正确`, stats.correct === stats.questionTotal], ["当日检测", "正确率达到85%并完成订正", taskDone(day.id,3)],
      ["家长验收", "口头检查三个核心问题", stats.verified]
    ];
    const rail = steps.map((step,index) => `<div class="rail-row ${step[2] ? "done" : index === 0 ? "current" : ""}"><div class="rail-number">${step[2] ? icon("check") : index+1}</div><div class="rail-label">${esc(step[0])}</div><div class="rail-note">${esc(step[1])}</div>${index < 2 ? `<button class="button small" data-route="lesson/${day.id}">进入</button>` : `<span class="check-button ${step[2] ? "checked" : ""}">${step[2] ? icon("check") : ""}</span>`}</div>`).join("");
    const taskList = day.tasks.map((task,index) => `<button class="task-row ${taskDone(day.id,index) ? "done" : ""}" data-action="toggle-task" data-day="${day.id}" data-index="${index}"><span class="task-check">${taskDone(day.id,index) ? icon("check") : ""}</span><span><strong>任务${index+1}</strong>${esc(task)}</span></button>`).join("");
    const due = dueWrong();
    const dueHtml = due.length ? due.slice(0,4).map(item => { const q = questionById(item.questionId); return `<div class="due-item"><p>${esc(q?.question || item.questionId)}</p><div class="meta"><span>${esc(item.reason)}</span><span class="attention">今天到期</span></div></div>`; }).join("") + `<button class="button ghost small" data-route="wrong">查看全部错题 ${icon("arrow")}</button>` : `<div class="empty"><p>今天没有到期错题。</p></div>`;
    const route = DATA.route.map(item => `<div class="route-day ${item.ready ? "ready" : ""} ${item.id === day.id ? "today" : ""}"><div class="route-circle">${String(item.day).padStart(2,"0")}</div><b>${esc(item.title)}</b></div>`).join("");
    const content = `<div class="page"><section class="hero"><div class="hero-copy"><h1>Day ${String(day.day).padStart(2,"0")} ${esc(day.title)}</h1><p class="lead">${esc(day.goal)}</p><button class="button primary" data-route="lesson/${day.id}">${icon("book")}开始今天的学习</button></div><div class="hero-art"><img src="assets/lab-illustration.png" alt="试管、烧瓶和学习笔记组成的化学学习插画"></div></section>
      <div class="today-layout"><section><div class="section-title"><h2>今日学习流程</h2><p>${stats.tasks}/${stats.taskTotal}项任务完成</p></div><div class="learning-rail">${rail}</div><div class="section-title"><h2>每日任务清单</h2><p>做完一项，确认一项</p></div><div class="task-list">${taskList}</div><div class="section-title"><h2>30天通关路线图</h2><button class="button ghost small" data-route="map">查看完整路线</button></div><div class="route-strip">${route}</div></section>
      <aside class="side-column"><section class="side-panel"><h2>今日到期错题</h2>${dueHtml}</section><section class="side-panel"><h2>完成条件</h2><div class="completion-list"><div class="completion-item"><span class="status-dot ${stats.tasks === stats.taskTotal ? "ok" : ""}"></span><span>完成今日全部学习任务</span></div><div class="completion-item"><span class="status-dot ${stats.correct >= Math.ceil(stats.questionTotal*.85) ? "ok" : ""}"></span><span>练习正确至少${Math.ceil(stats.questionTotal*.85)}题</span></div><div class="completion-item"><span class="status-dot ${stats.verified ? "ok" : ""}"></span><span>完成家长口头验收</span></div></div></section></aside></div></div>`;
    app.innerHTML = shell(content, "today");
  }

  function questionFeedback(q) {
    const answer = state.answers[q.id];
    if (!answer) return "";
    if (answer.status === "wrong" && answer.attempts < 2 && !answer.revealed) return `<div class="feedback wrong"><h3>还差一步</h3><p>先打开下一层提示，重新检查判断依据。连续两次错误后系统会显示完整解析。</p></div>`;
    const title = answer.status === "correct" ? "回答正确" : answer.status === "unknown" ? "已记为不会" : "完整解析";
    const cls = answer.status === "correct" ? "correct" : "wrong";
    return `<div class="feedback ${cls}"><h3>${title}</h3><p><strong>参考答案：</strong>${esc(q.answer)}</p><p><strong>解析：</strong>${esc(q.explanation)}</p>${answer.matched ? `<p><strong>已命中要点：</strong>${esc(answer.matched.join("、"))}</p>` : ""}<p class="source">来源：${esc(q.source)}${q.origin === "adapted" ? "（改编）" : ""}</p></div>`;
  }

  function renderQuestion(q, context = "practice", position = 0, total = 1) {
    const answer = state.answers[q.id];
    const selected = answer?.value || "";
    const control = q.type === "choice" ? `<div class="options">${q.options.map(option => `<label class="option"><input type="radio" name="answer-${q.id}" value="${esc(option)}" ${selected === option ? "checked" : ""}><span>${esc(option)}</span></label>`).join("")}</div>` : `<textarea class="text-answer" id="answer-${q.id}" placeholder="先写判断，再写依据。">${esc(selected)}</textarea>`;
    const shown = state.hints[q.id] || 0;
    const hints = shown ? `<div class="hint-content">${q.hints.slice(0, shown).map((hint,index) => `<p><strong>${index+1}.</strong> ${esc(hint)}</p>`).join("")}${shown < q.hints.length ? `<button class="button ghost small" data-action="more-hint" data-id="${q.id}">再看一层提示</button>` : ""}</div>` : "";
    return `<div class="question-head"><strong>${context === "test" ? "滚动检测" : "随堂练习"} ${position+1}/${total}</strong><span class="difficulty">难度：${esc(q.difficulty)}</span></div><p class="question-text">${esc(q.question)}</p>${control}<div class="question-actions"><button class="button primary" data-action="submit-answer" data-id="${q.id}">检查答案</button><button class="button" data-action="unknown" data-id="${q.id}">我不会</button></div><div class="hint-box"><button class="hint-toggle" data-action="show-hint" data-id="${q.id}"><span>分步提示</span><span>${shown ? "收起/继续" : "展开"}</span></button>${hints}</div><button class="button ghost small" data-action="reveal" data-id="${q.id}">查看完整答案</button>${questionFeedback(q)}<div class="question-nav"><button class="button small" data-action="prev-question" ${position === 0 ? "disabled" : ""}>${icon("back")}上一题</button><span class="meta">${esc(q.topic)} · ${esc(q.source)}</span><button class="button small" data-action="next-question" ${position === total-1 ? "disabled" : ""}>下一题${icon("arrow")}</button></div>`;
  }

  function renderLesson(dayId) {
    const day = dayById(dayId);
    state.currentDay = day.id;
    saveState();
    const sectionIndex = Math.min(state.lessonSection[day.id] || 0, day.sections.length - 1);
    const questionIndex = Math.min(state.questionIndex[day.id] || 0, day.questions.length - 1);
    const section = day.sections[sectionIndex];
    const q = questionById(day.questions[questionIndex]);
    const outline = day.sections.map((item,index) => `<button class="outline-item ${index === sectionIndex ? "active" : ""}" data-action="lesson-section" data-day="${day.id}" data-index="${index}">${index+1}. ${esc(item.title)}</button>`).join("");
    const content = `<div class="lesson-shell"><aside class="lesson-outline"><button class="back-link" data-route="today">${icon("back")}返回今日学习</button><h2>${esc(day.unit)}</h2><p class="meta">学习进度 ${sectionIndex+1}/${day.sections.length}</p><div class="outline-progress"><span style="width:${(sectionIndex+1)/day.sections.length*100}%"></span></div>${outline}</aside>
      <article class="lesson-main"><div class="reading-ref">${icon("book")}<div><strong>今日资料定位</strong><div>${esc(day.reading[0])}</div></div></div>${sectionIndex === 0 ? `<div class="study-sequence">${day.reading.map((item,index) => `<div class="study-step"><span class="study-step-number">${index+1}</span><div><strong>${["先看课本","再看教材帮","合上资料输出"][index] || "立即练习"}</strong><p>${esc(item)}</p></div></div>`).join("")}</div>` : ""}<section class="lesson-section"><h1>${esc(section.title)}</h1>${section.body.map(text => `<p>${esc(text)}</p>`).join("")}<div class="rule-box">考试口令：${esc(section.rule)}</div>${sectionIndex === 0 ? `<div class="note-box"><strong>执行顺序：</strong>看完本节后立即做右侧对应题；答错先看分步提示，再回到正文定位规则，最后独立重做。</div>` : ""}</section><div class="lesson-actions"><button class="button" data-action="prev-section" data-day="${day.id}" ${sectionIndex===0?"disabled":""}>${icon("back")}上一节</button><button class="button primary" data-action="next-section" data-day="${day.id}" ${sectionIndex===day.sections.length-1?"disabled":""}>下一节${icon("arrow")}</button></div></article>
      <aside class="practice-rail">${renderQuestion(q, "practice", questionIndex, day.questions.length)}</aside></div>`;
    app.innerHTML = shell(content, "today");
  }

  function renderPractice(dayId, forcedQuestion) {
    const day = dayById(dayId);
    if (forcedQuestion && day.questions.includes(forcedQuestion)) state.questionIndex[day.id] = day.questions.indexOf(forcedQuestion);
    const index = Math.min(state.questionIndex[day.id] || 0, day.questions.length-1);
    const q = questionById(day.questions[index]);
    const content = `<div class="page narrow"><button class="back-link" data-route="today">${icon("back")}返回今日学习</button><h1>${esc(day.title)}：分考点练习</h1><p class="lead">每天30题不是为了刷数量，而是让每个考点都留下可追踪的证据。</p><section class="side-panel">${renderQuestion(q, "practice", index, day.questions.length)}</section></div>`;
    app.innerHTML = shell(content, "bank");
  }

  function renderMap() {
    const route = DATA.route.map(item => `<div class="question-row"><strong>Day ${String(item.day).padStart(2,"0")}</strong><div><p>${esc(item.title)}</p><span class="tag">${item.ready ? "详细学练内容已就绪" : "后续滚动交付"}</span></div>${item.ready ? `<button class="button small" data-route="lesson/${item.id}">开始学习</button>` : `<span class="meta">路线已确定</span>`}</div>`).join("");
    app.innerHTML = shell(`<div class="page narrow"><h1>30天知识地图</h1><p class="lead">先建立概念与实验基础，再学习微观世界、化学用语和方程式，最后用四套综合卷连续验收。</p><div class="question-list">${route}</div></div>`, "map");
  }

  function renderBank() {
    const route = parseRoute();
    const dayFilter = route.query.get("day") || "all";
    const topicFilter = route.query.get("topic") || "all";
    const topics = [...new Set(DATA.questions.map(q => q.topic))];
    const filtered = DATA.questions.filter(q => (dayFilter === "all" || q.day === dayFilter) && (topicFilter === "all" || q.topic === topicFilter));
    const rows = filtered.map(q => `<div class="question-row"><strong>${esc(q.id)}</strong><div><p>${esc(q.question)}</p><span class="tag">${esc(q.topic)} · ${esc(q.difficulty)} · 来源在家长视图可查</span></div><button class="button small" data-route="practice/${q.day}?question=${q.id}">练习</button></div>`).join("");
    const content = `<div class="page"><h1>分考点题库</h1><p class="lead">前10天已整理并核对 ${DATA.questions.length} 题，覆盖对应考点、方法、易错点和典型题型；相似但考法不同的变式题保留。</p><div class="filters"><select class="select" data-filter="day"><option value="all">全部日期</option>${DATA.days.map(day => `<option value="${day.id}" ${dayFilter===day.id?"selected":""}>Day ${String(day.day).padStart(2,"0")}</option>`).join("")}</select><select class="select" data-filter="topic"><option value="all">全部考点</option>${topics.map(topic => `<option value="${esc(topic)}" ${topicFilter===topic?"selected":""}>${esc(topic)}</option>`).join("")}</select></div><div class="question-list">${rows}</div></div>`;
    app.innerHTML = shell(content, "bank");
  }

  function renderWrong() {
    const items = Object.values(state.wrong).filter(item => !item.resolved).sort((a,b) => a.due.localeCompare(b.due));
    const rows = items.map(item => { const q = questionById(item.questionId); return `<div class="question-row"><strong>${esc(item.reason)}</strong><div><p>${esc(q?.question || item.questionId)}</p><span class="tag">${esc(q?.topic || "")} · 下次复习 ${esc(item.due)} · 已完成${item.reviewIndex || 0}轮</span></div><button class="button small" data-route="practice/${q?.day || "day01"}?question=${item.questionId}">重新做</button></div>`; }).join("");
    app.innerHTML = shell(`<div class="page"><h1>错题本与到期复习</h1><p class="lead">“答错”“不会做”“直接查看答案”分开记录，但都会按当天、次日、第3天、第7天重新出现。</p>${items.length ? `<div class="question-list">${rows}</div>` : `<div class="empty"><h2>目前没有待复习题</h2><p>完成练习后，系统会在这里安排错题回流。</p></div>`}</div>`, "wrong");
  }

  function topicMastery(day) {
    const map = {};
    day.questions.forEach(id => { const q = questionById(id); map[q.topic] ||= {correct:0, attempted:0}; const a = state.answers[id]; if (a) map[q.topic].attempted += 1; if (a?.status === "correct") map[q.topic].correct += 1; });
    return map;
  }
  function renderParent(dayId) {
    const day = dayById(dayId);
    const stats = completion(day);
    const mastery = topicMastery(day);
    const oral = day.parent.map((item,index) => `<div class="oral-item"><button class="oral-question" data-action="oral-toggle" data-day="${day.id}" data-index="${index}"><span>${index+1}. ${esc(item.q)}</span><span>${state.oralOpen[`${day.id}:${index}`] ? "−" : "+"}</span></button>${state.oralOpen[`${day.id}:${index}`] ? `<div class="oral-answer"><p><strong>参考要点：</strong>${esc(item.points)}</p><div class="danger-note"><strong>危险信号：</strong>${esc(item.danger)}</div></div>` : ""}</div>`).join("");
    const masteryRows = Object.entries(mastery).map(([topic,value]) => { const rate = value.attempted ? value.correct/value.attempted : 0; const status = !value.attempted ? ["未检测","none"] : rate >= .85 ? ["已掌握","ok"] : ["需复习","warn"]; return `<div class="mastery-row"><span>${esc(topic)}<small class="meta">${value.correct}/${value.attempted}</small></span><strong class="mastery-status ${status[1]}">${status[0]}</strong></div>`; }).join("");
    const content = `<div class="page"><button class="button" data-route="today">返回学生视图</button><h1>Day ${String(day.day).padStart(2,"0")} 家长验收</h1><p class="lead">请花10–15分钟，让孩子先回答，再展开参考要点。</p><div class="summary-grid"><div class="summary-cell"><small>任务完成</small><strong>${stats.tasks}/${stats.taskTotal}</strong></div><div class="summary-cell"><small>练习正确</small><strong>${stats.correct}/${stats.questionTotal}</strong></div><div class="summary-cell"><small>到期错题</small><strong>${dueWrong().length}</strong></div><div class="summary-cell"><small>验收状态</small><strong>${stats.verified ? "已验收" : "待验收"}</strong></div></div><div class="parent-layout"><section class="side-panel"><h2>口头检查</h2><div class="oral-list">${oral}</div><h2 style="margin-top:24px">今日易错检查</h2><p>${day.id === "day01" ? "追问：有气泡为什么不一定是化学变化？" : day.id === "day02" ? "追问：能燃烧和燃烧了有什么区别？" : "追问：量筒读数时视线放在哪里？"}</p><div style="display:flex;gap:10px;flex-wrap:wrap"><button class="button primary" data-action="parent-verify" data-day="${day.id}">${icon("check")}确认已验收</button><button class="button" data-action="export">${icon("download")}导出今日记录</button></div></section><aside class="side-panel"><h2>知识点掌握情况</h2>${masteryRows}</aside></div></div>`;
    app.innerHTML = shell(content, "record");
  }

  function renderRecord() {
    const attempted = Object.keys(state.answers).length;
    const correct = Object.values(state.answers).filter(answer => answer.status === "correct").length;
    const unresolved = Object.values(state.wrong).filter(item => !item.resolved).length;
    const rows = DATA.days.map(day => { const stats = completion(day); return `<div class="question-row"><strong>Day ${String(day.day).padStart(2,"0")}</strong><div><p>${esc(day.title)}</p><span class="tag">任务 ${stats.tasks}/${stats.taskTotal} · 正确 ${stats.correct}/${stats.questionTotal} · ${stats.verified ? "已验收" : "未验收"}</span></div><button class="button small" data-route="parent/${day.id}">查看报告</button></div>`; }).join("");
    app.innerHTML = shell(`<div class="page"><h1>学习记录</h1><div class="summary-grid"><div class="summary-cell"><small>已作答</small><strong>${attempted}</strong></div><div class="summary-cell"><small>当前正确</small><strong>${correct}</strong></div><div class="summary-cell"><small>待复习</small><strong>${unresolved}</strong></div><div class="summary-cell"><small>数据版本</small><strong style="font-size:16px">${esc(DATA.version)}</strong></div></div><div class="question-list">${rows}</div></div>`, "record");
  }

  function renderTest(dayId) {
    const day = dayById(dayId);
    if (!day.test) { app.innerHTML = shell(`<div class="page"><div class="empty"><h2>本次滚动检测尚未开放</h2><p>第一次三日测安排在Day03。</p></div></div>`, "test"); return; }
    const key = `test:${day.id}`;
    const index = Math.min(state.questionIndex[key] || 0, day.test.length-1);
    const q = questionById(day.test[index]);
    app.innerHTML = shell(`<div class="page narrow"><h1>Day 01–03 第一次滚动检测</h1><p class="lead">15题，建议独立完成。检测后统一回看所有错误题的完整解析。</p><section class="side-panel">${renderQuestion(q,"test",index,day.test.length)}</section></div>`, "test");
  }

  function renderSettings() {
    const times = state.settings.times.map((time,index) => `<div class="time-row"><input class="input" type="time" value="${esc(time)}" data-time-index="${index}"><button class="button small danger" data-action="remove-time" data-index="${index}">删除</button></div>`).join("");
    const content = `<div class="page narrow"><h1>提醒与数据</h1><div class="settings-grid"><section class="setting-block"><h2>学习提醒</h2><label class="completion-item"><input type="checkbox" id="reminder-enabled" ${state.settings.reminderEnabled ? "checked" : ""}>启用提醒时段</label><div id="time-list">${times}</div><button class="button small" data-action="add-time">添加时段</button><p class="meta">网页关闭后由iPhone日历负责提醒；网站本身不申请推送权限。</p><button class="button" data-action="calendar">${icon("download")}生成日历提醒文件</button></section><section class="setting-block"><h2>云端同步与备份</h2><p>登录账号后，电脑与移动设备会自动读取同一份学习进度。请等待顶部显示“已保存”后再关闭网页。</p><div style="display:flex;gap:10px;flex-wrap:wrap"><button class="button" data-action="export">${icon("download")}导出进度</button><label class="button">${icon("upload")}导入进度<input class="file-input" id="import-file" type="file" accept="application/json"></label></div></section><section class="setting-block"><h2>重置</h2><p>只在需要从头开始时使用。此操作会清除当前账号的答案和错题记录，并同步到云端。</p><button class="button danger" data-action="reset">重置当前账号进度</button></section></div></div>`;
    app.innerHTML = shell(content, "settings");
  }

  function evaluate(q, value) {
    if (q.type === "choice") return {correct: value === q.answer, matched: []};
    const normalized = String(value).replace(/[\s，。；、,.!?！？]/g, "").toLowerCase();
    const matched = q.keywords.filter(keyword => normalized.includes(String(keyword).replace(/[\s，。；、,.!?！？]/g, "").toLowerCase()));
    return {correct: matched.length >= q.threshold, matched};
  }
  function addWrong(q, reason) {
    const existing = state.wrong[q.id];
    state.wrong[q.id] = existing || {questionId:q.id, reason, firstAt:todayISO(), due:todayISO(), reviewIndex:0, resolved:false};
    state.wrong[q.id].reason = reason;
  }
  function resolveReview(q) {
    const item = state.wrong[q.id];
    if (!item || item.resolved || item.due > todayISO()) return;
    item.reviewIndex += 1;
    if (item.reviewIndex >= REVIEW_INTERVALS.length) { item.resolved = true; item.resolvedAt = todayISO(); }
    else item.due = addDays(todayISO(), REVIEW_INTERVALS[item.reviewIndex]);
  }
  function getAnswerValue(q) {
    if (q.type === "choice") return document.querySelector(`input[name="answer-${q.id}"]:checked`)?.value || "";
    return document.getElementById(`answer-${q.id}`)?.value.trim() || "";
  }
  function submitAnswer(id) {
    const q = questionById(id); const value = getAnswerValue(q);
    if (!value) { notify("请先作答，再检查答案。"); return; }
    const previous = state.answers[id] || {attempts:0};
    const result = evaluate(q,value);
    state.answers[id] = {value, status:result.correct?"correct":"wrong", attempts:(previous.attempts||0)+1, matched:result.matched, lastAt:todayISO(), revealed:previous.revealed||false};
    if (result.correct) { resolveReview(q); notify("回答正确，继续保持判断依据完整。"); }
    else { addWrong(q,"答错"); notify(state.answers[id].attempts >= 2 ? "连续两次错误，已显示完整解析。" : "先看提示，找出判断依据再答一次。"); }
    saveState(); render();
  }
  function markUnknown(id) {
    const q = questionById(id); addWrong(q,"不会做"); state.answers[id] = {...(state.answers[id]||{}), value:getAnswerValue(q), status:"unknown", attempts:(state.answers[id]?.attempts||0)+1, revealed:true, lastAt:todayISO()}; saveState(); notify("已记为不会做，并加入错题回流。"); render();
  }
  function revealAnswer(id) {
    const q = questionById(id); const current = state.answers[id]; const hints = state.hints[id] || 0;
    if (!current?.attempts && hints < 1) { notify("请先尝试作答，或至少打开一级提示。"); return; }
    addWrong(q,"查看答案"); state.answers[id] = {...(current||{}), value:current?.value||getAnswerValue(q), status:current?.status==="correct"?"correct":"wrong", attempts:current?.attempts||0, revealed:true, lastAt:todayISO()}; saveState(); render();
  }

  function exportState() {
    const blob = new Blob([JSON.stringify({app:"guoguo-chemistry", exportedAt:new Date().toISOString(), state}, null, 2)], {type:"application/json"});
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `果果的化学学习进度_${todayISO()}.json`; link.click(); URL.revokeObjectURL(link.href); notify("进度文件已导出。");
  }
  function importState(file) {
    const reader = new FileReader(); reader.onload = () => { try { const parsed = JSON.parse(reader.result); const next = parsed.state || parsed; if (!next.answers || !next.settings) throw new Error("格式不正确"); state = {...defaultState(), ...next}; saveState(); notify("进度已导入。"); render(); } catch { notify("导入失败：请选择本网站导出的JSON文件。"); } }; reader.readAsText(file,"utf-8");
  }
  function calendarFile() {
    if (!state.settings.reminderEnabled || !state.settings.times.length) { notify("请先启用并设置至少一个提醒时间。"); return; }
    const events = [];
    for (let day=0; day<30; day += 1) for (const time of state.settings.times) {
      const date = addDays(DATA.startDate,day).replace(/-/g,""); const compact = time.replace(":","");
      events.push(["BEGIN:VEVENT",`UID:guoguo-chem-${day}-${compact}@local`,`DTSTART:${date}T${compact}00`,`DTEND:${date}T${compact}00`,`SUMMARY:果果的化学 Day ${String(day+1).padStart(2,"0")}`,`DESCRIPTION:${DATA.route[day].title}。打开学习网站完成今天的学练闭环。`,"END:VEVENT"].join("\r\n"));
    }
    const ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Guoguo Chemistry//CN\r\n${events.join("\r\n")}\r\nEND:VCALENDAR`;
    const blob = new Blob([ics],{type:"text/calendar;charset=utf-8"}); const link=document.createElement("a");link.href=URL.createObjectURL(blob);link.download="果果的化学30天提醒.ics";link.click();URL.revokeObjectURL(link.href);notify("日历提醒文件已生成。");
  }

  function changeQuestion(delta) {
    const route = parseRoute(); const day = dayById(route.parts[1] || state.currentDay); const isTest = route.parts[0] === "test"; const key = isTest ? `test:${day.id}` : day.id; const ids = isTest ? (day.test || []) : day.questions; state.questionIndex[key] = Math.max(0, Math.min(ids.length-1,(state.questionIndex[key]||0)+delta)); saveState(); render();
  }
  function render() {
    const route = parseRoute(); const [page, id] = route.parts;
    if (page === "lesson") return renderLesson(id);
    if (page === "practice") return renderPractice(id, route.query.get("question"));
    if (page === "map") return renderMap();
    if (page === "bank") return renderBank();
    if (page === "wrong") return renderWrong();
    if (page === "record") return renderRecord();
    if (page === "parent") return renderParent(id);
    if (page === "test") return renderTest(id);
    if (page === "settings") return renderSettings();
    return renderToday();
  }

  app.addEventListener("click", event => {
    if (!currentUser) return;
    const routeTarget = event.target.closest("[data-route]");
    if (routeTarget) { location.hash = `#/${routeTarget.dataset.route}`; return; }
    const actionTarget = event.target.closest("[data-action]"); if (!actionTarget) return;
    const {action,id,day,index} = actionTarget.dataset;
    if (action === "submit-answer") submitAnswer(id);
    else if (action === "unknown") markUnknown(id);
    else if (action === "reveal") revealAnswer(id);
    else if (action === "show-hint" || action === "more-hint") { const q=questionById(id); state.hints[id]=Math.min(q.hints.length,(state.hints[id]||0)+1); saveState(); render(); }
    else if (action === "next-question") changeQuestion(1);
    else if (action === "prev-question") changeQuestion(-1);
    else if (action === "lesson-section") { state.lessonSection[day]=Number(index); saveState(); render(); }
    else if (action === "next-section" || action === "prev-section") { const d=dayById(day); state.lessonSection[day]=Math.max(0,Math.min(d.sections.length-1,(state.lessonSection[day]||0)+(action==="next-section"?1:-1))); saveState(); render(); }
    else if (action === "oral-toggle") { const key=`${day}:${index}`; state.oralOpen[key]=!state.oralOpen[key]; saveState(); render(); }
    else if (action === "toggle-task") { const key=`${day}:${index}`; state.tasks[key]=!state.tasks[key]; saveState(); render(); }
    else if (action === "parent-verify") { state.parentVerified[day]=true; saveState(); notify("已记录家长验收。"); render(); }
    else if (action === "logout") signOut();
    else if (action === "export") exportState();
    else if (action === "calendar") calendarFile();
    else if (action === "add-time") { state.settings.times.push("16:00"); saveState(); render(); }
    else if (action === "remove-time") { state.settings.times.splice(Number(index),1); saveState(); render(); }
    else if (action === "reset" && confirm("确认重置当前账号的全部学习进度吗？此操作会同步到云端且不可撤销。")) { state=defaultState();saveState();notify("当前账号进度已重置。");render(); }
  });
  app.addEventListener("change", event => {
    if (event.target.matches("[data-filter]")) { const day=document.querySelector('[data-filter="day"]')?.value||"all"; const topic=document.querySelector('[data-filter="topic"]')?.value||"all"; location.hash=`#/bank?day=${encodeURIComponent(day)}&topic=${encodeURIComponent(topic)}`; }
    if (event.target.id === "import-file" && event.target.files[0]) importState(event.target.files[0]);
    if (event.target.id === "reminder-enabled") { state.settings.reminderEnabled=event.target.checked;saveState(); }
    if (event.target.matches("[data-time-index]")) { state.settings.times[Number(event.target.dataset.timeIndex)]=event.target.value;saveState(); }
  });
  app.addEventListener("submit", event => {
    if (event.target.id !== "login-form") return;
    event.preventDefault();
    signIn(event.target);
  });
  window.addEventListener("hashchange", () => { if (currentUser) render(); });
  window.addEventListener("online", () => { if (currentUser) syncStateNow(); });
  bootstrap();
})();
