const $ = (id) => document.getElementById(id);

const state = {
  title: "【LIVE】今日は雑談します！",
  creator: "配信ごっこチャンネル",
  subscribers: 12800,
  viewers: 386,
  likes: 121,
  elapsed: 0,
  avatarData: "",
  posterData: "",
  chatMode: "auto",
  subscribed: false,
  ended: false,
  slowMode: false,
  viewerPeak: 386,
  subscriberGain: 0,
  sentComments: 0
};

const botNames = [
  "あおい","ゆう","たこ焼き","ねこまる","しろくま","Kaito","みかん","そら",
  "はる","たけ","mame","りんご","名無しの視聴者","青空","こむぎ","もち",
  "こはく","ユウキ","みなみ","くろ","しお","さくら","だいふく","つばさ",
  "りょう","なな","まる","おもち","こま","あき","れん","ひなた"
];

let avatarObjectUrl = null;
let posterObjectUrl = null;
let timerId = null;
let viewerId = null;
let chatId = null;
let autoCommentIndex = 0;
let lastEventAt = 0;

function formatNumber(n) {
  return Number(n || 0).toLocaleString("ja-JP");
}

function formatTime(sec) {
  const h = Math.floor(sec / 3600).toString().padStart(2, "0");
  const m = Math.floor((sec % 3600) / 60).toString().padStart(2, "0");
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function makeInitialAvatar(name) {
  const first = [...(name || "配信")][0] || "配";
  const colors = ["#3a3a3a","#4f3f55","#33495f","#4d4b38","#374f48"];
  const idx = [...(name || "")].reduce((a,c)=>a+c.charCodeAt(0),0) % colors.length;
  return { text:first, color:colors[idx] };
}

function setAvatarImage(element, dataUrl, alt = "") {
  if (!element) return;
  if (dataUrl) {
    element.innerHTML = "";
    element.style.backgroundImage = `url("${dataUrl}")`;
    element.style.backgroundSize = "cover";
    element.style.backgroundPosition = "center";
    element.textContent = "";
    element.alt = alt;
  } else {
    const a = makeInitialAvatar(state.creator);
    element.style.backgroundImage = "none";
    element.style.backgroundColor = a.color;
    element.textContent = a.text;
    element.alt = alt;
  }
}

function syncSetupAvatar() {
  setAvatarImage($("setupAvatar"), state.avatarData);
}

function syncUI() {
  $("playerTitle").textContent = state.title;
  $("infoTitle").textContent = state.title;
  $("streamCreator").textContent = state.creator;
  $("streamSubs").textContent = formatNumber(state.subscribers);
  $("likesCount").textContent = formatNumber(state.likes);
  $("playerViewers").textContent = formatNumber(state.viewers);
  $("descriptionViewers").textContent = formatNumber(state.viewers);

  setAvatarImage($("streamAvatar"), state.avatarData, state.creator);
  setAvatarImage($("userAvatarSmall"), state.avatarData);

  if (state.posterData) {
    $("playerBackground").style.backgroundImage = `url("${state.posterData}")`;
    $("playerBackground").style.backgroundSize = "cover";
    $("playerBackground").style.backgroundPosition = "center";
  } else {
    $("playerBackground").style.backgroundImage = "";
  }
}

function showToast(text) {
  const t = $("toast");
  t.textContent = text;
  t.classList.remove("hidden");
  setTimeout(() => t.classList.add("hidden"), 1800);
}

function addChat(name, message, opts = {}) {
  const {creator=false, donation=false, member=false} = opts;
  const row = document.createElement("div");
  row.className = "chat-line" + (creator ? " creator" : "") + (donation ? " donation" : "") + (member ? " member" : "");

  const avatar = document.createElement("div");
  avatar.className = "avatar avatar-sm avatar-placeholder";
  if (creator && state.avatarData) {
    setAvatarImage(avatar, state.avatarData);
  } else {
    const a = makeInitialAvatar(name);
    avatar.style.background = a.color;
    avatar.textContent = a.text;
  }

  const body = document.createElement("div");
  const badge = member ? '<span style="font-size:10px;background:#275b9a;padding:2px 5px;border-radius:5px;margin-left:4px">メンバー</span>' : "";
  const donationBadge = donation ? '<span style="font-size:11px;color:#e3b44a;font-weight:900;margin-left:5px">￥1,000</span>' : "";
  body.innerHTML = `<div><span class="chat-name">${escapeHtml(name)}</span>${badge}${donationBadge}</div>
                    <div class="chat-text">${escapeHtml(message)}</div>`;
  row.appendChild(avatar);
  row.appendChild(body);
  $("chatMessages").appendChild(row);
  $("chatMessages").scrollTop = $("chatMessages").scrollHeight;

  while ($("chatMessages").children.length > 100) {
    $("chatMessages").firstChild.remove();
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

function randomName() {
  return botNames[Math.floor(Math.random() * botNames.length)];
}

function randomComment() {
  // 800-ish unique candidates.
  const base = COMMENT_POOL[autoCommentIndex % COMMENT_POOL.length];
  autoCommentIndex += 1;
  return base;
}

function seedChat() {
  $("chatMessages").innerHTML = "";
  const seed = [
    ["ねこまる","こんばんは！"],
    ["Kaito","今来た！"],
    ["みかん","今日も配信ありがとう"],
    ["そら","この時間帯好き"],
    ["たこ焼き","高評価押した"],
    ["はる","こんばんは〜"],
    ["こむぎ","初見です！"],
    ["しろくま","待ってました"]
  ];
  seed.forEach(([n,m], i) => addChat(n,m,{member:i===6}));
}

function startStream() {
  readFormIntoState();
  state.ended = false;
  state.elapsed = 0;
  state.viewerPeak = state.viewers;
  state.subscriberGain = 0;
  state.sentComments = 0;

  $("setupScreen").classList.add("hidden");
  $("streamScreen").classList.remove("hidden");
  $("endModal").classList.add("hidden");
  $("eventBanner").classList.add("hidden");
  $("pinnedComment").classList.add("hidden");
  $("elapsedTime").textContent = "00:00:00";
  $("clockText").textContent = "00:00:00";

  syncUI();
  seedChat();

  clearInterval(timerId);
  clearInterval(viewerId);
  clearInterval(chatId);

  timerId = setInterval(() => {
    state.elapsed += 1;
    $("elapsedTime").textContent = formatTime(state.elapsed);
    $("clockText").textContent = formatTime(state.elapsed);

    // Occasional organic-looking events.
    if (state.elapsed > 15 && state.elapsed - lastEventAt > 35 && Math.random() < 0.08) {
      randomAutoEvent();
      lastEventAt = state.elapsed;
    }
  }, 1000);

  viewerId = setInterval(() => {
    let delta = Number($("viewerDelta").value);
    let jitter = Math.floor(Math.random() * 11) - 5;
    let eventBias = Math.random() < 0.06 ? Math.floor(Math.random() * 80) : 0;
    state.viewers = Math.max(0, state.viewers + delta + jitter + eventBias);

    if (Math.random() < 0.12 && state.viewers > 50) {
      state.viewers = Math.max(0, state.viewers - Math.floor(Math.random()*30));
    }

    if (state.viewers > state.viewerPeak) state.viewerPeak = state.viewers;
    if (Math.random() < 0.04) {
      state.subscribers += 1;
      state.subscriberGain += 1;
    }

    syncUI();
  }, 4500);

  autoCommentIndex = Math.floor(Math.random() * Math.max(0, COMMENT_POOL.length - 1));
  scheduleChat();
}

function getChatInterval() {
  const base = Number($("chatSpeed").value);
  return state.slowMode ? Math.max(base * 2.6, 5000) : base;
}

function scheduleChat() {
  clearInterval(chatId);
  if (state.chatMode !== "auto") return;
  chatId = setInterval(() => {
    const name = randomName();
    const message = randomComment();
    const r = Math.random();
    addChat(name, message, {
      donation: r < 0.025,
      member: r >= 0.025 && r < 0.07
    });
  }, getChatInterval());
}

function randomAutoEvent() {
  const events = ["spike","superchat","milestone","hype"];
  runEvent(events[Math.floor(Math.random()*events.length)]);
}

function announce(text) {
  const banner = $("eventBanner");
  banner.textContent = text;
  banner.classList.remove("hidden");
  setTimeout(() => banner.classList.add("hidden"), 4200);
}

function runEvent(type) {
  if (state.ended) return;

  if (type === "spike") {
    const before = state.viewers;
    const add = 100 + Math.floor(Math.random()*700);
    state.viewers += add;
    state.viewerPeak = Math.max(state.viewerPeak, state.viewers);
    syncUI();
    announce(`📈 視聴者が急増！ いま ${formatNumber(state.viewers)} 人が視聴中`);
    addChat("システム", `視聴者が増えました（+${formatNumber(add)}）`, {member:true});
  }

  if (type === "superchat") {
    const name = randomName();
    addChat(name, randomSuperchatMessage(), {donation:true});
    announce(`💰 ${name} さんからスーパーチャット風メッセージ！`);
  }

  if (type === "milestone") {
    state.subscribers += 100;
    state.subscriberGain += 100;
    syncUI();
    announce(`🎉 登録者 ${formatNumber(state.subscribers)} 人突破！`);
    addChat("システム", `登録者 ${formatNumber(state.subscribers)} 人突破おめでとう！`, {member:true});
  }

  if (type === "raid") {
    const add = 500 + Math.floor(Math.random()*1800);
    state.viewers += add;
    state.viewerPeak = Math.max(state.viewerPeak, state.viewers);
    syncUI();
    announce(`🚨 大量の視聴者が流入！ +${formatNumber(add)} 人`);
    ["うわ人増えた！","何事！？","急に人きたｗ","こんばんは！","ここから見ます"].forEach((m,i)=>{
      setTimeout(()=>addChat(randomName(),m,{member:i===2}), i*280);
    });
  }

  if (type === "hype") {
    for (let i=0;i<4;i++) setTimeout(()=>addChat(randomName(), randomComment()), i*210);
    announce("🔥 コメント欄が盛り上がっています！");
  }
}

function randomSuperchatMessage() {
  const messages = [
    "いつも楽しく見ています！",
    "今日も配信ありがとう！",
    "初見ですが、楽しませてもらってます！",
    "これからも応援してます！",
    "記念に投げます！",
    "最高の配信です！",
    "今日も来れてよかったです！",
    "配信助かります！",
    "ここ好きです！",
    "これからも頑張ってください！"
  ];
  return messages[Math.floor(Math.random()*messages.length)];
}

function endStream() {
  clearInterval(timerId);
  clearInterval(viewerId);
  clearInterval(chatId);
  state.ended = true;

  $("endSummary").innerHTML =
    `配信時間 <strong>${formatTime(state.elapsed)}</strong><br>` +
    `最大視聴者数 <strong>${formatNumber(state.viewerPeak)}</strong> 人<br>` +
    `配信中の登録者増加 <strong>+${formatNumber(state.subscriberGain)}</strong> ・ ` +
    `高評価 <strong>${formatNumber(state.likes)}</strong>`;
  $("endModal").classList.remove("hidden");
}

function readFormIntoState() {
  state.title = $("titleInput").value.trim() || "【LIVE】配信ごっこ";
  state.creator = $("creatorInput").value.trim() || "配信者";
  state.subscribers = Math.max(0, Number($("subsInput").value) || 0);
  state.viewers = Math.max(0, Number($("viewersInput").value) || 0);
  state.likes = Math.max(0, Number($("likesInput").value) || 0);
  state.chatMode = $("chatModeInput").value;
}

function loadDemo() {
  $("titleInput").value = "【LIVE】深夜の雑談配信！";
  $("creatorInput").value = "しろくま放送局";
  $("subsInput").value = "48200";
  $("viewersInput").value = "1260";
  $("likesInput").value = "683";
  $("chatModeInput").value = "auto";
  showToast("デモ設定を読み込みました");
}

function populateSetupFromState() {
  $("titleInput").value = state.title;
  $("creatorInput").value = state.creator;
  $("subsInput").value = state.subscribers;
  $("viewersInput").value = state.viewers;
  $("likesInput").value = state.likes;
  $("chatModeInput").value = state.chatMode;
  syncSetupAvatar();
}

function makeShareUrl() {
  const cfg = {
    title: state.title,
    creator: state.creator,
    subscribers: state.subscribers,
    viewers: state.viewers,
    likes: state.likes,
    avatarData: state.avatarData,
    posterData: state.posterData,
    chatMode: state.chatMode
  };
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(cfg))));
  return `${location.origin}${location.pathname}#config=${encoded}`;
}

async function shareStream() {
  const url = makeShareUrl();
  try {
    await navigator.clipboard.writeText(url);
    $("shareToast").classList.remove("hidden");
    setTimeout(() => $("shareToast").classList.add("hidden"), 1800);
  } catch {
    window.prompt("このリンクをコピーしてください", url);
  }
}

function loadFromHash() {
  const hash = location.hash;
  if (!hash.startsWith("#config=")) return;
  try {
    const encoded = hash.slice(8);
    const cfg = JSON.parse(decodeURIComponent(escape(atob(encoded))));
    Object.assign(state, cfg);
    populateSetupFromState();
  } catch (e) {
    console.warn("share config could not be loaded", e);
  }
}

$("avatarInput").addEventListener("change", () => {
  const file = $("avatarInput").files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    state.avatarData = reader.result;
    syncSetupAvatar();
  };
  reader.readAsDataURL(file);
});

$("posterInput").addEventListener("change", () => {
  const file = $("posterInput").files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    state.posterData = reader.result;
    $("posterPreview").innerHTML = `<img src="${reader.result}" alt="配信背景プレビュー">`;
  };
  reader.readAsDataURL(file);
});

$("startButton").addEventListener("click", startStream);
$("loadDemoButton").addEventListener("click", loadDemo);

$("backToSetup").addEventListener("click", () => {
  clearInterval(timerId);
  clearInterval(viewerId);
  clearInterval(chatId);
  $("streamScreen").classList.add("hidden");
  $("setupScreen").classList.remove("hidden");
  populateSetupFromState();
});

$("endButton").addEventListener("click", endStream);
$("restartButton").addEventListener("click", startStream);
$("editButton").addEventListener("click", () => {
  $("endModal").classList.add("hidden");
  $("streamScreen").classList.add("hidden");
  $("setupScreen").classList.remove("hidden");
  populateSetupFromState();
});

$("likeButton").addEventListener("click", () => {
  state.likes += 1;
  $("likesCount").textContent = formatNumber(state.likes);
  showToast("高評価を追加しました");
});

$("subscribeButton").addEventListener("click", () => {
  state.subscribed = !state.subscribed;
  $("subscribeButton").classList.toggle("subscribed", state.subscribed);
  $("subscribeButton").textContent = state.subscribed ? "登録済み" : "チャンネル登録";
  if (state.subscribed) {
    state.subscribers += 1;
    syncUI();
    addChat("自分", "チャンネル登録しました！");
  }
});

$("shareButton").addEventListener("click", shareStream);
$("shareButton2").addEventListener("click", shareStream);

$("clipButton").addEventListener("click", () => showToast("クリップを作成しました（演出）"));
$("saveButton").addEventListener("click", () => showToast("保存しました（演出）"));
$("moreButton").addEventListener("click", () => {
  $("moreButton").textContent = $("moreButton").textContent === "もっと見る" ? "閉じる" : "もっと見る";
});

$("viewerDelta").addEventListener("input", (e) => {
  const v = Number(e.target.value);
  $("viewerDeltaValue").textContent = v >= 0 ? `+${v}` : `${v}`;
});

$("chatSpeed").addEventListener("change", scheduleChat);

$("chatSlowModeButton").addEventListener("click", () => {
  state.slowMode = !state.slowMode;
  $("chatSlowModeButton").classList.toggle("slow", state.slowMode);
  showToast(state.slowMode ? "低速モード ON" : "低速モード OFF");
  scheduleChat();
});

document.querySelectorAll(".mini-event").forEach(btn => {
  btn.addEventListener("click", () => runEvent(btn.dataset.event));
});

$("creatorMessageButton").addEventListener("click", () => {
  const input = $("creatorMessageInput");
  const msg = input.value.trim();
  if (!msg) return;
  addChat(state.creator, msg, {creator:true});
  state.sentComments += 1;
  input.value = "";
  if (Math.random() < 0.4) setTimeout(()=>addChat(randomName(), randomComment()), 650);
});

$("creatorMessageInput").addEventListener("keydown", e => {
  if (e.key === "Enter") $("creatorMessageButton").click();
});

function sendChat() {
  const input = $("chatInput");
  const msg = input.value.trim();
  if (!msg) return;
  addChat("自分", msg);
  state.sentComments += 1;
  input.value = "";
  if (Math.random() < 0.55) {
    setTimeout(() => addChat(randomName(), randomComment()), state.slowMode ? 1700 : 850);
  }
}

$("chatSendButton").addEventListener("click", sendChat);
$("chatInput").addEventListener("keydown", e => {
  if (e.key === "Enter") sendChat();
});

window.addEventListener("load", () => {
  loadFromHash();
  syncSetupAvatar();
});
