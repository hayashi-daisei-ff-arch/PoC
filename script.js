const FALLBACK_CSV = `scene_id,scene_title,patient_state,prompt,choice_id,choice_text,response_label,next_scene,feedback,score_delta
opening,Opening,初診受付後・緊張あり,導入の声かけを選択してください,1,選択肢①,選択肢①に対する画像や動画などの表示,assessment,ここに選択肢①に対するフィードバック,1
opening,Opening,初診受付後・緊張あり,導入の声かけを選択してください,2,選択肢②,選択肢②に対する画像や動画などの表示,assessment,ここに選択肢②に対するフィードバック,0
assessment,Assessment,少し話し始めている,リスク評価につながる問いかけを選択してください,1,選択肢①,選択肢①に対する画像や動画などの表示,support,ここに選択肢①に対するフィードバック,1
assessment,Assessment,少し話し始めている,リスク評価につながる問いかけを選択してください,2,選択肢②,選択肢②に対する画像や動画などの表示,support,ここに選択肢②に対するフィードバック,-1
support,Support,支援の選択肢を検討中,次の支援につながる応答を選択してください,1,選択肢①,選択肢①に対する画像や動画などの表示,closing,ここに選択肢①に対するフィードバック,1
support,Support,支援の選択肢を検討中,次の支援につながる応答を選択してください,2,選択肢②,選択肢②に対する画像や動画などの表示,closing,ここに選択肢②に対するフィードバック,0
closing,Closing,会話終了前,終了前の確認を選択してください,1,選択肢①,選択肢①に対する画像や動画などの表示,complete,ここに選択肢①に対するフィードバック,1
closing,Closing,会話終了前,終了前の確認を選択してください,2,選択肢②,選択肢②に対する画像や動画などの表示,complete,ここに選択肢②に対するフィードバック,0`;

const state = {
  rows: [],
  sceneId: "opening",
  transcript: [],
  feedback: [],
  score: 0,
  activeTab: "talk",
  transitionTimer: null,
};

const el = {
  sceneBadge: document.querySelector("#sceneBadge"),
  patientState: document.querySelector("#patientState"),
  sceneTitle: document.querySelector("#sceneTitle"),
  scenePrompt: document.querySelector("#scenePrompt"),
  choiceList: document.querySelector("#choiceList"),
  choiceSearch: document.querySelector("#choiceSearch"),
  feedbackList: document.querySelector("#feedbackList"),
  scoreBadge: document.querySelector("#scoreBadge"),
  transcriptList: document.querySelector("#transcriptList"),
  notesInput: document.querySelector("#notesInput"),
  responseOverlay: document.querySelector("#responseOverlay"),
  responseTitle: document.querySelector("#responseTitle"),
  responseCaption: document.querySelector("#responseCaption"),
  responseProgress: document.querySelector("#responseProgress"),
  exportLogButton: document.querySelector("#exportLogButton"),
  resetButton: document.querySelector("#resetButton"),
  tabButtons: document.querySelectorAll(".tab-button"),
  panels: {
    talk: document.querySelector("#talkPanel"),
    transcript: document.querySelector("#transcriptPanel"),
    notes: document.querySelector("#notesPanel"),
  },
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  row.push(value);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);

  const [headers, ...records] = rows;
  return records.map((record) =>
    Object.fromEntries(headers.map((header, index) => [header.trim(), (record[index] ?? "").trim()])),
  );
}

async function loadScenario() {
  try {
    const response = await fetch("data/scenarios.csv", { cache: "no-store" });
    if (!response.ok) throw new Error("CSV load failed");
    state.rows = parseCsv(await response.text());
  } catch {
    state.rows = parseCsv(FALLBACK_CSV);
  }
}

function getSceneRows() {
  return state.rows.filter((row) => row.scene_id === state.sceneId);
}

function getCurrentScene() {
  const [scene] = getSceneRows();
  return scene;
}

function saveSession() {
  const payload = {
    sceneId: state.sceneId,
    transcript: state.transcript,
    feedback: state.feedback,
    score: state.score,
    notes: el.notesInput.value,
  };
  localStorage.setItem("virtualPatientMiniPoc", JSON.stringify(payload));
}

function restoreSession() {
  try {
    const payload = JSON.parse(localStorage.getItem("virtualPatientMiniPoc") || "null");
    if (!payload) return;
    state.sceneId = payload.sceneId || "opening";
    state.transcript = Array.isArray(payload.transcript) ? payload.transcript : [];
    state.feedback = Array.isArray(payload.feedback) ? payload.feedback : [];
    state.score = Number(payload.score) || 0;
    el.notesInput.value = payload.notes || "";
  } catch {
    localStorage.removeItem("virtualPatientMiniPoc");
  }
}

function render() {
  renderScene();
  renderFeedback();
  renderTranscript();
  saveSession();
}

function renderScene() {
  const scene = getCurrentScene();

  if (!scene) {
    el.sceneBadge.textContent = "Done";
    el.patientState.textContent = "終了";
    el.sceneTitle.textContent = "Complete";
    el.scenePrompt.textContent = "最終フィードバック";
    el.choiceList.innerHTML = `
      <div class="feedback-item">
        <strong>総合フィードバック</strong>
        <span>ここに総合フィードバックを表示</span>
      </div>
    `;
    return;
  }

  const query = el.choiceSearch.value.trim().toLowerCase();
  const rows = getSceneRows().filter((row) => row.choice_text.toLowerCase().includes(query));

  el.sceneBadge.textContent = scene.scene_title;
  el.patientState.textContent = scene.patient_state;
  el.sceneTitle.textContent = scene.scene_title;
  el.scenePrompt.textContent = scene.prompt;
  el.choiceList.innerHTML = rows
    .map(
      (row) => `
        <button class="choice-button" type="button" data-choice="${row.choice_id}">
          <span class="choice-number">${row.choice_id}</span>
          <span class="choice-text">${escapeHtml(row.choice_text)}</span>
        </button>
      `,
    )
    .join("");

  document.querySelectorAll(".choice-button").forEach((button) => {
    button.addEventListener("click", () => {
      const row = rows.find((item) => item.choice_id === button.dataset.choice);
      if (row) selectChoice(row);
    });
  });
}

function renderFeedback() {
  el.scoreBadge.textContent = String(state.score);
  if (state.feedback.length === 0) {
    el.feedbackList.innerHTML = '<p class="empty-state">フィードバックなし</p>';
    return;
  }

  el.feedbackList.innerHTML = state.feedback
    .map(
      (item) => `
        <div class="feedback-item">
          <strong>${escapeHtml(item.scene)} / ${escapeHtml(item.choice)}</strong>
          <span>${escapeHtml(item.text)}</span>
        </div>
      `,
    )
    .join("");
}

function renderTranscript() {
  if (state.transcript.length === 0) {
    el.transcriptList.innerHTML = '<p class="empty-state">Transcriptなし</p>';
    return;
  }

  el.transcriptList.innerHTML = state.transcript
    .map(
      (item) => `
        <div class="transcript-item ${item.speaker === "patient" ? "patient" : ""}">
          <strong>${escapeHtml(item.speakerLabel)}</strong>
          <span>${escapeHtml(item.text)}</span>
        </div>
      `,
    )
    .join("");
}

function selectChoice(row) {
  window.clearInterval(state.transitionTimer);
  state.transcript.push({
    speaker: "learner",
    speakerLabel: "Learner",
    text: row.choice_text,
  });
  showResponse(row);
}

function showResponse(row) {
  let elapsed = 0;
  el.responseTitle.textContent = row.response_label;
  el.responseCaption.textContent = "5秒間の想定表示";
  el.responseProgress.value = 0;
  el.responseOverlay.classList.add("active");
  el.responseOverlay.setAttribute("aria-hidden", "false");

  state.transitionTimer = window.setInterval(() => {
    elapsed += 1;
    el.responseProgress.value = elapsed;
    el.responseCaption.textContent = `表示中 ${elapsed} / 5`;

    if (elapsed >= 5) {
      window.clearInterval(state.transitionTimer);
      finishChoice(row);
    }
  }, 1000);
}

function finishChoice(row) {
  el.responseOverlay.classList.remove("active");
  el.responseOverlay.setAttribute("aria-hidden", "true");
  state.feedback.push({
    scene: row.scene_title,
    choice: row.choice_text,
    text: row.feedback,
  });
  state.transcript.push({
    speaker: "patient",
    speakerLabel: "Patient",
    text: row.response_label,
  });
  state.score += Number(row.score_delta) || 0;
  state.sceneId = row.next_scene;
  el.choiceSearch.value = "";
  render();
}

function exportLog() {
  const headers = ["speaker", "text"];
  const lines = [
    headers.join(","),
    ...state.transcript.map((item) => [item.speakerLabel, item.text].map(csvEscape).join(",")),
    "",
    "feedback_scene,choice,feedback",
    ...state.feedback.map((item) => [item.scene, item.choice, item.text].map(csvEscape).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "virtual-patient-log.csv";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function resetSession() {
  window.clearInterval(state.transitionTimer);
  state.sceneId = "opening";
  state.transcript = [];
  state.feedback = [];
  state.score = 0;
  el.notesInput.value = "";
  el.choiceSearch.value = "";
  el.responseOverlay.classList.remove("active");
  localStorage.removeItem("virtualPatientMiniPoc");
  render();
}

function setTab(tab) {
  state.activeTab = tab;
  el.tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tab);
  });
  Object.entries(el.panels).forEach(([key, panel]) => {
    panel.classList.toggle("active", key === tab);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function csvEscape(value) {
  const text = String(value);
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

el.choiceSearch.addEventListener("input", renderScene);
el.exportLogButton.addEventListener("click", exportLog);
el.resetButton.addEventListener("click", resetSession);
el.notesInput.addEventListener("input", saveSession);
el.tabButtons.forEach((button) => {
  button.addEventListener("click", () => setTab(button.dataset.tab));
});

loadScenario().then(() => {
  restoreSession();
  render();
});
