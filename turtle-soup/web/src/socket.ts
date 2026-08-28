import { io, type Socket } from "socket.io-client";

const TOKEN_KEY = "turtle-soup-user-token";
const NAME_KEY = "turtle-soup-user-name";

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) || "";
}
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  window.dispatchEvent(new Event("turtle-soup-auth"));
}
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new Event("turtle-soup-auth"));
}
export function getUsername(): string {
  return localStorage.getItem(NAME_KEY) || "";
}
export function setUsername(name: string): void {
  localStorage.setItem(NAME_KEY, name);
}
export function clearUsername(): void {
  localStorage.removeItem(NAME_KEY);
}

// 全局唯一 socket;连接时必须携带玩家 token(服务端握手鉴权,否则拒绝连接)
export const socket: Socket = io({
  autoConnect: false,
  transports: ["websocket", "polling"],
  auth: { token: getToken() },
});

export function connectSocket(): Socket {
  if (!socket.connected) {
    socket.auth = { token: getToken() };
    socket.connect();
  }
  return socket;
}

/** emit + ack 回调封装;未连接时先尝试建立连接,带超时保护,避免界面永久卡"处理中" */
export function emitAck<T = { ok?: boolean; error?: string }>(
  event: string,
  payload?: unknown,
): Promise<T> {
  return new Promise((resolve) => {
    const timeout = (ms: number, msg: string) =>
      setTimeout(() => resolve({ error: msg } as T), ms);

    function send() {
      const t = timeout(8000, "请求超时,请重试");
      const cb = (res: T) => {
        clearTimeout(t);
        resolve(res);
      };
      if (payload === undefined) socket.emit(event, cb);
      else socket.emit(event, payload, cb);
    }

    if (!socket.connected) {
      // 尝试(重新)连接;1.5 秒内未连上则报错,避免一直转圈
      const t = timeout(1500, "无法连接到服务器,请检查登录状态后刷新页面");
      const onConnect = () => {
        clearTimeout(t);
        socket.off("connect", onConnect);
        send();
      };
      socket.once("connect", onConnect);
      socket.connect();
      return;
    }
    send();
  });
}

/** 监听连接失败(如 token 过期),返回取消函数 */
export function onSocketError(cb: (msg: string) => void): () => void {
  const onError = (e: Error) => cb(e.message || "连接失败");
  socket.on("connect_error", onError);
  return () => socket.off("connect_error", onError);
}
