// SSE チャット サーバー
//
// 起動方法やしくみの解説は同じディレクトリの README.md を参照。
//
//   起動:  deno run --allow-net --allow-read main.js
//   確認:  ブラウザで http://localhost:8000 を開く
//
// エンドポイント:
//   GET  /       … クライアント（public/index.html）を配信
//   GET  /events … text/event-stream で SSE を配信
//   POST /send   … ボディの文字列を接続中の全クライアントにブロードキャスト
//
// ハンズオン受講者は handson/ の HTML を file:// で開いて接続してくるため、
// 全レスポンスに CORS ヘッダーを付けている。

const clients = new Set();
const encoder = new TextEncoder();

// Deno Deploy はアクセス状況に応じてこのサーバーを複数のインスタンスに複製する。
// clients はインスタンスごとに別々のメモリ上にあるため、そのままだと
// 別インスタンスに接続した相手へメッセージが届かない。
// BroadcastChannel で全インスタンスにメッセージを中継してこれを防ぐ。
// （ローカル実行ではインスタンスが1つなので、単に何も中継しないだけ）
const channel = new BroadcastChannel("chat");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// 接続中の全クライアントにメッセージを配信する
function broadcast(message) {
  // SSE のフォーマット: "data: <本文>\n\n"（空行が1件の区切り）
  // 本文に改行が含まれていても壊れないよう、行ごとに data: を付ける
  const lines = message.split("\n").map((line) => `data: ${line}`).join("\n");
  const payload = encoder.encode(`${lines}\n\n`);
  for (const client of clients) {
    try {
      client.enqueue(payload);
    } catch {
      clients.delete(client);
    }
  }
}

// 他のインスタンスが中継してきたメッセージも、自分の clients に配信する
channel.onmessage = (event) => broadcast(event.data);

Deno.serve((req) => {
  const { pathname } = new URL(req.url);

  // CORS プリフライトリクエスト
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // SSE エンドポイント: 接続しっぱなしのレスポンスを返す
  if (pathname === "/events") {
    let controller;
    const body = new ReadableStream({
      start(c) {
        controller = c;
        clients.add(controller);
        // 接続直後に1件送ると、受講者が「つながった」ことを確認しやすい
        controller.enqueue(encoder.encode("data: 接続しました！\n\n"));
      },
      cancel() {
        // クライアントが切断したら一覧から外す
        clients.delete(controller);
      },
    });
    return new Response(body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        ...corsHeaders,
      },
    });
  }

  // メッセージ送信: 受け取った本文を全員に配信する
  if (pathname === "/send" && req.method === "POST") {
    return req.text().then((message) => {
      if (message.trim()) {
        broadcast(message); // 自分のインスタンスに接続中のクライアントへ
        channel.postMessage(message); // 他のインスタンスへ中継
      }
      return new Response("ok", { headers: corsHeaders });
    });
  }

  // トップページ: 完成版クライアントを配信
  if (pathname === "/") {
    return new Response(
      Deno.readTextFileSync(new URL("./public/index.html", import.meta.url)),
      { headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders } },
    );
  }

  return new Response("Not Found", { status: 404, headers: corsHeaders });
});
