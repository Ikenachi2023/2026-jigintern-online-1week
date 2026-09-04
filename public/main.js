/**
 * 動画プレイヤー（HLS再生）
 */
const STREAM_URL = "https://intern-hls-server.tdmi0e341.workers.dev/stream.m3u8";
const video = document.getElementById("video");
const videoPlayer = document.querySelector(".video-player");
const videoStatus = document.querySelector(".video-status");
const playToggle = document.querySelector(".video-play-toggle");
const playIconUse = document.getElementById("play-icon-use");
const muteToggle = document.querySelector(".video-mute-toggle");
const muteIconUse = document.getElementById("mute-icon-use");
const muteBadge = document.querySelector(".video-mute-badge");
const muteBadgeIconUse = document.getElementById("mute-badge-icon-use");
const volumeSlider = document.querySelector(".video-volume-slider");
const centerFlash = document.querySelector(".video-center-flash");
const centerFlashIconUse = document.getElementById("center-flash-icon-use");
const fullscreenToggle = document.querySelector(".video-fullscreen-toggle");
const fullscreenIconUse = document.getElementById("fullscreen-icon-use");
const videoDanmakuLayer = document.querySelector(".video-danmaku-layer");

// 読み込み中／エラーの状態表示を切り替える。nullなら状態表示自体を隠す。
function setVideoStatus(mode) {
  if (!videoStatus) return;
  if (mode === null) {
    videoStatus.hidden = true;
    return;
  }
  videoStatus.hidden = false;
  videoStatus.dataset.mode = mode;
}

if (video) {
  setVideoStatus("loading");

  if (window.Hls && Hls.isSupported()) {
    const hls = new Hls({ capLevelToPlayerSize: true });
    hls.loadSource(STREAM_URL);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      // autoplay属性だけでは再生されない環境があるため、明示的に呼ぶ（失敗は無視してよい）
      video.play().catch(() => {});
    });
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) setVideoStatus("error");
    });
  } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
    /* HLSを使えそうか？
    video.canPlayType("application/vnd.apple.mpegurl")
    m3u8のMIMEタイプ：application/vnd.apple.mpegurl
    戻り値:"", "maybe", "probably" */
    video.src = STREAM_URL;
    video.addEventListener("loadedmetadata", () => {
      video.play().catch(() => {});
    });
    video.addEventListener("error", () => setVideoStatus("error"));
  }

  // 再生が始まったら状態表示を消し、バッファリングで止まったら読み込み中に戻す。
  video.addEventListener("playing", () => setVideoStatus(null));
  video.addEventListener("waiting", () => setVideoStatus("loading"));
}

/**
 * 動画のオリジナルコントロール（再生/一時停止・ミュート・フルスクリーン）
 */
if (
  video &&
  videoPlayer &&
  playToggle &&
  playIconUse &&
  muteToggle &&
  muteIconUse &&
  fullscreenToggle &&
  fullscreenIconUse
) {
  // 中央に再生/一時停止アイコンを一瞬浮かばせる。初回自動再生時には呼ばず、
  // ユーザー操作（動画クリック・再生ボタン・スペースキー）によるtogglePlay()からのみ呼ぶ。
  function flashCenterIcon(iconId) {
    if (!centerFlash || !centerFlashIconUse) return;
    centerFlashIconUse.setAttribute("href", iconId);
    centerFlash.classList.remove("is-flashing");
    void centerFlash.offsetWidth; // reflowさせてアニメーションを再始動させる
    centerFlash.classList.add("is-flashing");
  }

  function togglePlay() {
    if (video.paused) {
      video.play();
      flashCenterIcon("#icon-play");
    } else {
      video.pause();
      flashCenterIcon("#icon-pause");
    }
  }

  video.addEventListener("play", () => {
    playIconUse.setAttribute("href", "#icon-pause");
    playToggle.setAttribute("aria-label", "一時停止");
  });

  video.addEventListener("pause", () => {
    playIconUse.setAttribute("href", "#icon-play");
    playToggle.setAttribute("aria-label", "再生");
    // 一時停止中は操作しやすいよう、コントロールバーを表示したままにする。
    clearTimeout(controlsFadeTimer);
    videoPlayer.classList.add("controls-visible");
  });

  playToggle.addEventListener("click", togglePlay);
  video.addEventListener("click", togglePlay);

  // コメント入力中などテキストを打っているときはスペースキーを再生/一時停止に奪わない。
  document.addEventListener("keydown", (event) => {
    if (event.code !== "Space") return;
    const target = event.target;
    const isTyping =
      target instanceof HTMLElement &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable);
    if (isTyping) return;

    event.preventDefault();
    togglePlay();
  });

  // 音量スライダーを0まで下げた時に記憶しておく直前の音量。ミュート解除時にここへ戻す。
  const DEFAULT_VOLUME = 0.75;
  let lastNonZeroVolume = DEFAULT_VOLUME;

  // ミュート状態に関わる表示（アイコン・aria属性・常時バッジ・音量スライダー位置）を
  // まとめて更新する。呼び出し元ごとに更新箇所が漏れないよう、更新関数をここに集約する。
  function setMuted(isMuted) {
    video.muted = isMuted;
    muteIconUse.setAttribute("href", isMuted ? "#icon-volume-off" : "#icon-volume-on");
    muteToggle.setAttribute("aria-pressed", String(isMuted));
    muteToggle.setAttribute("aria-label", isMuted ? "ミュート解除" : "ミュート");
    if (muteBadgeIconUse) {
      muteBadgeIconUse.setAttribute("href", isMuted ? "#icon-volume-off" : "#icon-volume-on");
    }
    if (muteBadge) muteBadge.hidden = !isMuted;
    if (volumeSlider) {
      if (isMuted) {
        volumeSlider.value = "0";
      } else {
        // スライダーを0までドラッグしてミュートになったケースでは、直前の音量に戻す
        if (video.volume === 0) video.volume = lastNonZeroVolume;
        volumeSlider.value = String(video.volume);
      }
    }
  }

  muteToggle.addEventListener("click", () => setMuted(!video.muted));
  // バッジは表示中は常にミュート中なので、クリック＝ミュート解除でよい
  if (muteBadge) muteBadge.addEventListener("click", () => setMuted(false));

  if (volumeSlider) {
    video.volume = DEFAULT_VOLUME;

    // スライダーとミュートは双方向連動：0まで下げるとミュート、動かすとミュート解除になる
    volumeSlider.addEventListener("input", () => {
      const value = Number(volumeSlider.value);
      video.volume = value;
      if (value > 0) lastNonZeroVolume = value;
      setMuted(value === 0);
    });
  }

  // video要素はautoplayのためHTML側でmuted属性を付けているので、その初期状態を
  // バッジ・スライダー表示に反映させる。
  setMuted(video.muted);

  fullscreenToggle.addEventListener("click", () => {
    if (document.fullscreenElement === videoPlayer) {
      document.exitFullscreen();
    } else {
      videoPlayer.requestFullscreen();
    }
  });

  document.addEventListener("fullscreenchange", () => {
    const isFullscreen = document.fullscreenElement === videoPlayer;
    fullscreenIconUse.setAttribute(
      "href",
      isFullscreen ? "#icon-fullscreen-exit" : "#icon-fullscreen-enter",
    );
    fullscreenToggle.setAttribute(
      "aria-label",
      isFullscreen ? "全画面表示を終了" : "全画面表示",
    );
    // 全画面を終了すると流れるコメントは表示上の意味を失う（サイドバーのコメント欄が
    // 見える状態に戻るため）ので、残っているコメントを消して次の全画面時に持ち越さない。
    if (!isFullscreen && videoDanmakuLayer) {
      videoDanmakuLayer.replaceChildren();
    }
  });

  // マウス操作があった間だけコントロールバーを表示し、無操作が続いたらフェードアウトする。
  const CONTROLS_FADE_DELAY = 2500;
  let controlsFadeTimer;

  function showControls() {
    videoPlayer.classList.add("controls-visible");
    clearTimeout(controlsFadeTimer);
    if (video.paused) return; // 一時停止中はフェードアウトさせない
    controlsFadeTimer = setTimeout(() => {
      videoPlayer.classList.remove("controls-visible");
    }, CONTROLS_FADE_DELAY);
  }

  videoPlayer.addEventListener("mousemove", showControls);
  videoPlayer.addEventListener("mouseleave", () => {
    clearTimeout(controlsFadeTimer);
    if (!video.paused) videoPlayer.classList.remove("controls-visible");
  });
}

/**
 * 全画面表示中のニコニコ動画風コメント
 * サイドバーのコメント欄が見えなくなる全画面時だけ、届いたコメントを動画上に右から左へ流す。
 */
// 上下に重ならないよう、流すレーン（縦位置）を順番に割り当てる。
const DANMAKU_LANE_COUNT = 10;
let danmakuLaneIndex = 0;
const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

// レーン（縦位置）を順番に割り当てる。コメント・アイテムで共通のプールを使う。
function nextDanmakuLaneTop() {
  const lane = danmakuLaneIndex % DANMAKU_LANE_COUNT;
  danmakuLaneIndex += 1;
  return `${(lane / DANMAKU_LANE_COUNT) * 100}%`;
}

// 全画面判定とreduced-motion判定は3種類のdanmaku（コメント・アイテム・コメント付き
// アイテム）で共通なので、ここにまとめて呼び出し側の条件分岐を減らす。
function canSpawnDanmaku() {
  // reduced-motion環境ではCSS側でレイヤーごと非表示にしており、
  // animationendが発火せず要素が残ってしまうため、ここで作らずに止める
  if (!videoPlayer || !videoDanmakuLayer || prefersReducedMotion) return false;
  // 全画面時以外はサイドバーのコメント欄で十分見えているため、二重に流さない。
  return document.fullscreenElement === videoPlayer;
}

function spawnDanmakuComment(text) {
  if (!text || !canSpawnDanmaku()) return;

  const span = document.createElement("span");
  span.className = "video-danmaku-comment";
  span.textContent = text;
  span.style.top = nextDanmakuLaneTop();

  // 文字数が多いほど画面に出続けると邪魔になるため、短い時間で早く流し切る
  span.style.animationDuration = `${Math.max(4, 9 - text.length / 8)}s`;

  // animationendはCSSのアニメーションが1回終わったタイミングで発火するイベント。
  // forwards指定で流れ切った後も要素が画面外に残り続けるため、ここで自分で消す
  span.addEventListener("animationend", () => span.remove());
  videoDanmakuLayer.appendChild(span);
}

// アイテム単体（コメントなし）はキャプション文字を持たせず、アイコンだけを流す。
// 文字数の概念が無いため速さは固定とし、複数アイテムが前後入れ替わって見える
// 分かりにくさを避ける。
const DANMAKU_ITEM_DURATION = "6s";

function spawnDanmakuItem(iconUrl) {
  if (!iconUrl || !canSpawnDanmaku()) return;

  const img = document.createElement("img");
  img.className = "video-danmaku-item";
  img.src = iconUrl;
  img.alt = "";
  img.style.top = nextDanmakuLaneTop();
  img.style.animationDuration = DANMAKU_ITEM_DURATION;

  img.addEventListener("animationend", () => img.remove());
  videoDanmakuLayer.appendChild(img);
}

// コメント付きアイテムは本文が主役で、アイテム単体（アイコンのみの半透明演出）
// より価値が高い情報なので、枠で囲わず通常コメントと同じ不透明・縁取りの
// スタイルで流す（色だけブランドカラーにして区別する、詳細はCSS側）。
// 速さは通常の文字コメントと同じ計算式を使い、長文が画面に居座らないようにする。
function spawnDanmakuItemComment(iconUrl, text) {
  if (!iconUrl || !text || !canSpawnDanmaku()) return;

  const wrapper = document.createElement("span");
  wrapper.className = "video-danmaku-item-comment";
  wrapper.style.top = nextDanmakuLaneTop();
  wrapper.style.animationDuration = `${Math.max(4, 9 - text.length / 8)}s`;

  const img = document.createElement("img");
  img.className = "video-danmaku-item-comment-icon";
  img.src = iconUrl;
  img.alt = "";

  const textSpan = document.createElement("span");
  textSpan.textContent = text;

  wrapper.append(img, textSpan);
  wrapper.addEventListener("animationend", () => wrapper.remove());
  videoDanmakuLayer.appendChild(wrapper);
}

/**
 * コメント受信（SSE）
 * サーバーからのイベントを受け取り、コメント・アイテムを画面に追加する。
 */
const COMMENT_EVENTS_URL =
  "https://intern-comment-server.intern-comment-server.deno.net/events";
const commentArea = document.querySelector(".comment-area");
const newCommentNotice = document.querySelector(".new-comment-notice");
const newCommentNoticeLabel = document.querySelector(
  ".new-comment-notice-label",
);

// コメント欄に保持する最大件数。超えた分は古い順に削除する。
const MAX_COMMENT_COUNT = 200;

// コメント欄の件数がMAX_COMMENT_COUNTを超えていたら、古い順に削除する。
function trimComments() {
  while (commentArea.children.length > MAX_COMMENT_COUNT) {
    commentArea.removeChild(commentArea.firstElementChild);
  }
}

// 過去ログを見ている間に届いた新着件数。ボタンのラベル文言に連動するため、
// 更新箇所をここ1つにまとめる。表示・非表示自体はスクロール位置だけで決まる
// （＝新着0件でも最下部でなければ「下に戻る」ボタンとして出続ける）。
let unseenCommentCount = 0;

// スクロール位置が最下部付近かどうか。
// コメント件数が少なくスクロール自体が発生しない場合はscrollHeightとclientHeightが
// ほぼ同値になるはずだが、flexレイアウトの端数誤差でscrollHeightがわずかに大きく
// 判定され「上にいる」と誤判定されることがあるため、まずスクロール可能かどうかを見る。
function isCommentAreaScrolledToBottom() {
  const { scrollHeight, scrollTop, clientHeight } = commentArea;
  if (scrollHeight <= clientHeight) return true; // そもそもスクロールできる余地がない
  return scrollHeight - scrollTop - clientHeight <= 4;
}

// ボタンの表示・非表示とラベルを、現在のスクロール位置とunseenCommentCountから
// 導出する。呼び出し元ごとに条件を書くとhiddenとラベルがずれるため、常にここを通す。
function updateNewCommentNotice() {
  if (!newCommentNotice) return;
  const atBottom = isCommentAreaScrolledToBottom();
  if (atBottom) unseenCommentCount = 0; // 最下部まで見ているなら新着扱いにしない

  newCommentNotice.hidden = atBottom;
  if (newCommentNoticeLabel) {
    newCommentNoticeLabel.textContent =
      unseenCommentCount > 0 ? `新着${unseenCommentCount}件` : "";
  }
}

function scrollCommentAreaToBottom() {
  commentArea.scrollTop = commentArea.scrollHeight;
  updateNewCommentNotice();
}

if (newCommentNotice) {
  newCommentNotice.addEventListener("click", scrollCommentAreaToBottom);
}

if (commentArea) {
  // 新着の有無にかかわらず、スクロールして最下部から離れたら「下に戻る」ボタンを出す。
  commentArea.addEventListener("scroll", updateNewCommentNotice);
}

// コメント・アイテムの共通追加処理。追加前の時点で最下部を見ていた場合だけ
// 自動スクロールし、そうでなければ新着通知ボタンの件数を増やす。
function appendCommentItem(li) {
  const wasAtBottom = isCommentAreaScrolledToBottom();

  commentArea.appendChild(li);
  trimComments(); // 上限件数を超えたら古いコメントから削除する

  if (wasAtBottom) {
    commentArea.scrollTop = commentArea.scrollHeight;
  } else {
    unseenCommentCount += 1;
  }
  updateNewCommentNotice();
}

if (commentArea) {
  const eventSource = new EventSource(COMMENT_EVENTS_URL);

  eventSource.onmessage = (event) => {
    // event.data は文字列。中身はJSON文字列で送られてくる想定なのでパースする。
    //パース：jsonをjsのオブジェクトに変換すること
    let payload;
    try {//tryはエラーが起きそうな処理 catchにエラーが起きたときの処理
      payload = JSON.parse(event.data);
    } catch {
      return;
    }
    if (!payload) return;

    // textとitemの両方があれば「コメント付きアイテム」として1つにまとめて表示する。
    if (payload.text && payload.item) {
      addItemWithComment(
        payload.item.iconUrl ?? "", //Null合体演算子：左側の値が null または undefined のときだけ、右側の値を代わりに使います
        payload.item.name ?? "",
        payload.text,
      );
    } else if (payload.text) {
      // text プロパティのみあれば「コメント」として表示する。
      addComment(payload.text);
    } else if (payload.item) {
      // item プロパティのみあれば「アイテム」として表示する。
      addItem(payload.item.iconUrl ?? "", payload.item.name ?? "");
    }
  };
}

/**
 * アイテム一覧の取得・表示・開閉
 * アイテム送信は行わず、一覧の表示のみを行う。
 */
const ITEMS_URL =
  "https://intern-comment-server.intern-comment-server.deno.net/items";
const ITEMS_PER_PAGE = 5; // アイコン画像の通信量削減のため、一度に表示する件数を絞る
const itemToggle = document.querySelector(".item-toggle");
const itemPriceFilter = document.querySelector(".item-price-filter");
const itemListRow = document.querySelector(".item-list-row");
const itemList = document.querySelector(".item-list");
const itemPagePrev = document.querySelector(".item-page-prev");
const itemPageNext = document.querySelector(".item-page-next");
const selectedItemChip = document.querySelector(".selected-item-chip");
const selectedItemIcon = document.querySelector(".selected-item-icon");
const selectedItemName = document.querySelector(".selected-item-name");
const selectedItemRemove = document.querySelector(".selected-item-remove");

// 選択中のアイテム（1件のみ）。未選択時はnull。
let selectedItem = null;

// 選択状態に合わせて、入力欄上のチップ表示を更新する。
function renderSelectedItemChip() {
  if (!selectedItemChip) return;
  selectedItemChip.hidden = !selectedItem;
  if (!selectedItem) return;
  selectedItemIcon.src = selectedItem.iconUrl ?? "";
  selectedItemName.textContent = selectedItem.name ?? "";
}

// アイテム一覧側の選択表示（aria-pressed）をすべて解除する。
// チップの状態変数(selectedItem)とアイテムボタンのDOM表示は別物のため、両方合わせて戻す必要がある。
function clearItemButtonSelection() {
  document
    .querySelectorAll(".item-button[aria-pressed='true']")
    .forEach((button) => button.setAttribute("aria-pressed", "false"));
}

// アイテム選択を解除する（チップの×ボタン・送信完了時の両方から呼ぶ共通処理）。
function deselectItem() {
  selectedItem = null;
  renderSelectedItemChip();
  clearItemButtonSelection();
}

if (selectedItemRemove) {
  selectedItemRemove.addEventListener("click", deselectItem);
}

if (
  itemToggle &&
  itemPriceFilter &&
  itemListRow &&
  itemList &&
  itemPagePrev &&
  itemPageNext
) {
  // 開閉ボタン：押すたびに一覧（絞り込みボタン＋アイテム）の表示・非表示を切り替える。
  itemToggle.addEventListener("click", () => {
    const isExpanded = itemToggle.getAttribute("aria-expanded") === "true";
    itemToggle.setAttribute("aria-expanded", String(!isExpanded));
    itemPriceFilter.hidden = isExpanded; // 開いていたら隠す、隠れていたら表示する
    itemListRow.hidden = isExpanded;
  });

  // APIから取得した全アイテム。表示中の絞り込み・ページに応じて、この中から表示分だけをDOMに追加する。
  let allItems = [];
  let currentFilter = "all";
  let currentPage = 0;

  // 値段データがAPIから届かないため、id文字列からダミーの値段を決定的に算出する。
  // （同じidなら常に同じ値段になるようにする）
  const DUMMY_PRICE_TIERS = [1000, 5000, 10000];
  function dummyPrice(item) {
    const id = item.id ?? item.name ?? "";
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = (hash * 31 + id.charCodeAt(i)) % DUMMY_PRICE_TIERS.length;
    }
    return DUMMY_PRICE_TIERS[hash];
  }

  // 絞り込み条件（すべて／1000円／5000円／10000円）に合うアイテムだけを返す。
  function filterItems(items, filter) {
    if (filter === "low") return items.filter((item) => item.price === 1000);
    if (filter === "mid") return items.filter((item) => item.price === 5000);
    if (filter === "high")
      return items.filter((item) => item.price === 10000);
    return items;
  }

  // 1件分のアイテムを表示するボタン要素を作る（アイコン＋下に小さく名前・値段）。
  function createItemButton(item) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "item-button";
    button.setAttribute(
      "aria-pressed",
      String(selectedItem?.id === item.id),
    );

    // クリックするたびに選択/解除をトグルする（同時に選択できるアイテムは1つまで）。
    button.addEventListener("click", () => {
      const isSameItem = selectedItem?.id === item.id;
      clearItemButtonSelection();
      if (isSameItem) {
        selectedItem = null;
      } else {
        selectedItem = item;
        button.setAttribute("aria-pressed", "true");
      }
      renderSelectedItemChip();
    });

    const img = document.createElement("img");
    img.className = "item-button-icon";
    img.src = item.iconUrl ?? "";
    img.alt = item.name ?? "";

    const name = document.createElement("span");
    name.className = "item-button-name";
    name.textContent = item.name ?? "";

    const price = document.createElement("span");
    price.className = "item-button-price";
    // 値段が算出できなかった場合は「価格不明」と表示する。
    price.textContent =
      typeof item.price === "number" ? `${item.price}円` : "価格不明";

    button.append(img, name, price);
    return button;
  }

  // 指定ページ分のアイテムだけをDOMに追加し直す。
  // 表示していないページのアイコン画像はDOMに存在しないため読み込まれず、通信量が抑えられる。
  function renderPage(page) {
    const filteredItems = filterItems(allItems, currentFilter);

    itemList.innerHTML = "";

    // 絞り込み条件に合うアイテムが1件もない場合は、その旨を表示してページ送りを無効にする。
    if (filteredItems.length === 0) {
      const empty = document.createElement("p");
      empty.className = "item-list-empty";
      empty.textContent = "該当する値段のアイテムがありません";
      itemList.appendChild(empty);

      currentPage = 0;
      itemPagePrev.disabled = true;
      itemPageNext.disabled = true;
      return;
    }

    const maxPage = Math.max(
      0,
      Math.ceil(filteredItems.length / ITEMS_PER_PAGE) - 1,
    );
    currentPage = Math.min(Math.max(page, 0), maxPage);

    const start = currentPage * ITEMS_PER_PAGE;
    const pageItems = filteredItems.slice(start, start + ITEMS_PER_PAGE);
    for (const item of pageItems) {
      itemList.appendChild(createItemButton(item));
    }

    itemPagePrev.disabled = currentPage === 0;
    itemPageNext.disabled = currentPage >= maxPage;
  }

  itemPagePrev.addEventListener("click", () => renderPage(currentPage - 1));
  itemPageNext.addEventListener("click", () => renderPage(currentPage + 1));

  // 絞り込みボタン：押されたボタンをアクティブにし、1ページ目から表示し直す。
  itemPriceFilter.addEventListener("click", (event) => {
    const button = event.target.closest(".item-price-button");
    if (!button) return;

    for (const other of itemPriceFilter.querySelectorAll(
      ".item-price-button",
    )) {
      other.setAttribute("aria-pressed", String(other === button));
    }

    currentFilter = button.dataset.priceFilter;
    renderPage(0);
  });

  const ITEMS_POLLING_INTERVAL = 60 * 1000; // 1分ごとにアイテム一覧を取得し直す

  // アイテム一覧を取得し、現在の絞り込み・ページを維持したまま表示を更新する。
  function fetchItems() {
    fetch(ITEMS_URL)
      .then((response) => response.json())
      .then((data) => {
        const items = data.items ?? [];
        allItems = items.map((item) => ({
          ...item,
          price: dummyPrice(item),
        }));
        renderPage(currentPage);
      })
      .catch((error) => {
        console.error("アイテム一覧の取得に失敗しました", error);
      });
  }

  fetchItems(); // 初回はページ読み込み時に取得する
  setInterval(fetchItems, ITEMS_POLLING_INTERVAL); // 以降は1分ごとにポーリングする
}

/**
 * コメント送信（POST）
 * フォーム送信時に入力欄のテキストをサーバーへ送信する。
 * 送信したコメント自体は、上のSSE受信処理経由で画面に反映される。
 */
const COMMENT_POST_URL =
  "https://intern-comment-server.intern-comment-server.deno.net/messages";
const sendArea = document.querySelector(".send-area");
const commentInput = document.querySelector(".comment-input");
const sendButton = document.querySelector(".send-button");
const sendError = document.querySelector(".send-error");

if (sendArea && commentInput && sendButton && sendError) {
  // 入力内容の行数に合わせて高さを自動調整する。
  // CSS側で.comment-input-rowをflex-end揃えにしているため、高さが増えるとテキストエリアは下端を基準に上方向へ伸びる。
  const resizeCommentInput = () => {
    commentInput.style.height = "auto"; // 一度リセットしてscrollHeightを正しく測る
    commentInput.style.height = `${commentInput.scrollHeight}px`;
  };
  commentInput.addEventListener("input", resizeCommentInput);


  commentInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.isComposing) return; // IME変換確定のEnterは無視する
    if (event.shiftKey) return; // Shift+Enterは改行のまま何もしない

    event.preventDefault(); // 通常のEnterによる改行入力を防ぐ
    sendArea.requestSubmit(); // フォームのsubmitイベントを発火させる
  });

  // 送信ボタンの見た目を「送信前／送信中」で切り替える。
  function setSending(isSending) {
    sendButton.disabled = isSending;
    sendButton.classList.toggle("is-sending", isSending);
  }

  function showSendError(message) {
    sendError.textContent = message;
    sendError.hidden = false;
  }

  function hideSendError() {
    sendError.hidden = true;
  }

  sendArea.addEventListener("submit", async (event) => {
    event.preventDefault(); // フォームの通常送信（ページ再読み込み）を防ぐ。
    //これをしないとJavaScriptでの処理より先にページ遷移が起きる。
    //htmlのformはデフォルトで「今表示しているページ自身」に送信されるので、押すたびリロードされてしまう

    const text = commentInput.value.trim(); //前後の空白を除いたテキストを取得

    // bodyを作り、要素として追加していく
    //両方空なら送信しない
    const body = {};
    if (text) body.text = text;
    if (selectedItem) body.itemId = selectedItem.id;
    if (!body.text && !body.itemId) return;

    hideSendError();
    setSending(true);

    try {
      await fetch(COMMENT_POST_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" }, //jsonで送ることを伝えている
        body: JSON.stringify(body),
      });
    } catch (error) {
      console.error("送信に失敗しました", error);
      showSendError("送信に失敗しました。もう一度お試しください。");
      setSending(false);
      return;
    }

    setSending(false);

    // 送信成功時のみ、入力欄・アイテム選択・アイテム一覧をリセットする。
    commentInput.value = "";
    resizeCommentInput(); // 高さも1行分に戻す
    deselectItem();
    if (itemToggle && itemToggle.getAttribute("aria-expanded") === "true") {
      itemToggle.click(); // 一覧を閉じる（開閉トグルの処理をそのまま流用する）
    }
  });
}

/**
 * 通常のコメント（テキストのみ、コメント1行分）を画面に追加する。
 */
function addComment(text) {
  const li = document.createElement("li"); //まだどこにも表示されていない状態で<li></li>を作る
  li.className = "comment-item"; //属性を設定する。今で言えば、<li class="coment-item"></li>

  // コメント投稿者のアイコンは届かないため、見た目確認用のダミーアイコンを表示する。
  const img = document.createElement("img");
  img.className = "comment-icon";
  img.alt = "";

  const p = document.createElement("p");
  p.className = "comment-text";
  p.textContent = text;

  li.append(img, p);//liにimgとpを追加

  appendCommentItem(li);
  spawnDanmakuComment(text);
}

/**
 * アイテム（コメント2行分の大きさで画像を表示し、その下にコメント1行分で名前を表示）を画面に追加する。
 */
function addItem(iconUrl, name) {
  const li = document.createElement("li"); //まだどこにも表示されていない状態で<li></li>を作る
  li.className = "comment-item item-comment"; //属性を設定する。今で言えば、<li class="coment-item item-comment"></li>

  const img = document.createElement("img");
  img.className = "item-icon";
  img.src = iconUrl;
  img.alt = name;

  const caption = `${name}が送られました！`;
  const p = document.createElement("p");
  p.className = "comment-text";
  p.textContent = caption;

  li.append(img, p);//liにimgとpを追加

  appendCommentItem(li);
  // 全画面時は「〇〇が送られました！」の文字は出さず、アイコンだけを流す
  spawnDanmakuItem(iconUrl);
}

/**
 * コメント付きで届いたアイテムを画面に追加する。
 * アイコンの大きさはaddItemと同じまま、実際のコメント本文を主役にして表示する。
 */
function addItemWithComment(iconUrl, name, text) {
  const li = document.createElement("li");
  li.className = "comment-item item-comment item-comment-message";

  const img = document.createElement("img");
  img.className = "item-icon";
  img.src = iconUrl;
  img.alt = name;

  const p = document.createElement("p");
  p.className = "comment-text";
  p.textContent = text;

  const caption = document.createElement("p");
  caption.className = "item-comment-caption";
  caption.textContent = `${name}が送られました！`;

  li.append(img, p, caption);

  appendCommentItem(li);
  spawnDanmakuItemComment(iconUrl, text);
}
