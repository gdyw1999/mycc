/**
 * 微信通道
 *
 * 通过微信 iLink Bot API 实现双向通信：
 * - 接收：long-poll getUpdates 接收微信消息
 * - 发送：sendMessage 发送回复
 *
 * 基于微信 iLink Bot HTTP API，直接集成到 mycc 体系。
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { MessageChannel } from "./interface.js";
import type { SSEEvent } from "../adapters/interface.js";

// ── 常量 ──────────────────────────────────────────────────────────────────

const DEFAULT_BASE_URL = "https://ilinkai.weixin.qq.com";
const DEFAULT_BOT_TYPE = "3";
const LONG_POLL_TIMEOUT_MS = 35_000;
const API_TIMEOUT_MS = 15_000;
const MAX_CONSECUTIVE_FAILURES = 3;
const BACKOFF_DELAY_MS = 30_000;
const RETRY_DELAY_MS = 2_000;
const SESSION_EXPIRED_ERRCODE = -14;
const SESSION_PAUSE_MS = 10 * 60_000;

// ── 类型 ──────────────────────────────────────────────────────────────────

/** 消息项类型 */
const MessageItemType = { NONE: 0, TEXT: 1, IMAGE: 2, VOICE: 3, FILE: 4, VIDEO: 5 } as const;
const MessageType = { NONE: 0, USER: 1, BOT: 2 } as const;
const MessageState = { NEW: 0, GENERATING: 1, FINISH: 2 } as const;

interface MessageItem {
  type?: number;
  text_item?: { text?: string };
  image_item?: { media?: { encrypt_query_param?: string; aes_key?: string }; url?: string };
  voice_item?: { media?: { encrypt_query_param?: string }; text?: string };
  file_item?: { media?: { encrypt_query_param?: string }; file_name?: string };
  video_item?: { media?: { encrypt_query_param?: string } };
  ref_msg?: { message_item?: MessageItem; title?: string };
}

interface WeixinMessage {
  seq?: number;
  message_id?: number;
  from_user_id?: string;
  to_user_id?: string;
  create_time_ms?: number;
  session_id?: string;
  message_type?: number;
  message_state?: number;
  item_list?: MessageItem[];
  context_token?: string;
}

interface GetUpdatesResp {
  ret?: number;
  errcode?: number;
  errmsg?: string;
  msgs?: WeixinMessage[];
  get_updates_buf?: string;
  longpolling_timeout_ms?: number;
}

/** 账号数据（持久化） */
interface WeixinAccountData {
  token?: string;
  baseUrl?: string;
  userId?: string;
  accountId?: string;
  savedAt?: string;
}

/** 微信通道配置 */
export interface WeixinChannelConfig {
  /** 数据存储目录 */
  stateDir: string;
  /** 自定义 API 基地址 */
  baseUrl?: string;
}

// ── API 层 ────────────────────────────────────────────────────────────────

function randomWechatUin(): string {
  const uint32 = crypto.randomBytes(4).readUInt32BE(0);
  return Buffer.from(String(uint32), "utf-8").toString("base64");
}

function buildHeaders(opts: { token?: string; body: string }): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    AuthorizationType: "ilink_bot_token",
    "Content-Length": String(Buffer.byteLength(opts.body, "utf-8")),
    "X-WECHAT-UIN": randomWechatUin(),
  };
  if (opts.token?.trim()) {
    headers.Authorization = `Bearer ${opts.token.trim()}`;
  }
  return headers;
}

async function apiFetch(params: {
  baseUrl: string;
  endpoint: string;
  body: string;
  token?: string;
  timeoutMs: number;
  label: string;
}): Promise<string> {
  const base = params.baseUrl.endsWith("/") ? params.baseUrl : `${params.baseUrl}/`;
  const url = new URL(params.endpoint, base);
  const hdrs = buildHeaders({ token: params.token, body: params.body });

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), params.timeoutMs);
  try {
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: hdrs,
      body: params.body,
      signal: controller.signal,
    });
    clearTimeout(t);
    const rawText = await res.text();
    if (!res.ok) {
      throw new Error(`${params.label} ${res.status}: ${rawText}`);
    }
    return rawText;
  } catch (err) {
    clearTimeout(t);
    throw err;
  }
}

async function apiGetUpdates(params: {
  baseUrl: string;
  token?: string;
  getUpdatesBuf: string;
  timeoutMs?: number;
}): Promise<GetUpdatesResp> {
  const timeout = params.timeoutMs ?? LONG_POLL_TIMEOUT_MS;
  try {
    const rawText = await apiFetch({
      baseUrl: params.baseUrl,
      endpoint: "ilink/bot/getupdates",
      body: JSON.stringify({ get_updates_buf: params.getUpdatesBuf }),
      token: params.token,
      timeoutMs: timeout,
      label: "getUpdates",
    });
    return JSON.parse(rawText);
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { ret: 0, msgs: [], get_updates_buf: params.getUpdatesBuf };
    }
    throw err;
  }
}

async function apiSendMessage(params: {
  baseUrl: string;
  token?: string;
  to: string;
  text: string;
  contextToken?: string;
}): Promise<string> {
  const clientId = `mycc-wx-${crypto.randomUUID()}`;
  const items: Array<{ type: number; text_item: { text: string } }> = params.text
    ? [{ type: MessageItemType.TEXT, text_item: { text: params.text } }]
    : [];

  await apiFetch({
    baseUrl: params.baseUrl,
    endpoint: "ilink/bot/sendmessage",
    body: JSON.stringify({
      msg: {
        from_user_id: "",
        to_user_id: params.to,
        client_id: clientId,
        message_type: MessageType.BOT,
        message_state: MessageState.FINISH,
        item_list: items.length ? items : undefined,
        context_token: params.contextToken,
      },
    }),
    token: params.token,
    timeoutMs: API_TIMEOUT_MS,
    label: "sendMessage",
  });
  return clientId;
}

// ── QR 登录 ───────────────────────────────────────────────────────────────

async function fetchQRCode(apiBaseUrl: string): Promise<{ qrcode: string; qrcodeUrl: string }> {
  const base = apiBaseUrl.endsWith("/") ? apiBaseUrl : `${apiBaseUrl}/`;
  const url = new URL(`ilink/bot/get_bot_qrcode?bot_type=${DEFAULT_BOT_TYPE}`, base);
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`获取二维码失败: ${response.status}`);
  }
  const data = await response.json() as { qrcode: string; qrcode_img_content: string };
  return { qrcode: data.qrcode, qrcodeUrl: data.qrcode_img_content };
}

async function pollQRStatus(apiBaseUrl: string, qrcode: string): Promise<{
  status: "wait" | "scaned" | "confirmed" | "expired";
  bot_token?: string;
  ilink_bot_id?: string;
  baseurl?: string;
  ilink_user_id?: string;
}> {
  const base = apiBaseUrl.endsWith("/") ? apiBaseUrl : `${apiBaseUrl}/`;
  const url = new URL(`ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(qrcode)}`, base);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LONG_POLL_TIMEOUT_MS);
  try {
    const response = await fetch(url.toString(), {
      headers: { "iLink-App-ClientVersion": "1" },
      signal: controller.signal,
    });
    clearTimeout(timer);
    const rawText = await response.text();
    if (!response.ok) {
      throw new Error(`轮询二维码状态失败: ${response.status}`);
    }
    return JSON.parse(rawText);
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") {
      return { status: "wait" };
    }
    throw err;
  }
}

// ── 消息解析 ──────────────────────────────────────────────────────────────

function extractTextFromItems(itemList?: MessageItem[]): string {
  if (!itemList?.length) return "";
  for (const item of itemList) {
    if (item.type === MessageItemType.TEXT && item.text_item?.text != null) {
      const text = String(item.text_item.text);
      const ref = item.ref_msg;
      if (!ref) return text;
      const parts: string[] = [];
      if (ref.title) parts.push(ref.title);
      if (ref.message_item?.text_item?.text) parts.push(ref.message_item.text_item.text);
      if (!parts.length) return text;
      return `[引用: ${parts.join(" | ")}]\n${text}`;
    }
    // 语音转文字
    if (item.type === MessageItemType.VOICE && item.voice_item?.text) {
      return item.voice_item.text;
    }
  }
  return "";
}

/** 去除 markdown 格式（微信纯文本） */
function stripMarkdown(text: string): string {
  let result = text;
  result = result.replace(/```[^\n]*\n?([\s\S]*?)```/g, (_, code: string) => code.trim());
  result = result.replace(/!\[[^\]]*\]\([^)]*\)/g, "");
  result = result.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  result = result.replace(/^\|[\s:|-]+\|$/gm, "");
  result = result.replace(/^\|(.+)\|$/gm, (_, inner: string) =>
    inner.split("|").map((cell) => cell.trim()).join("  "),
  );
  // 基础 markdown 去除
  result = result.replace(/\*\*(.+?)\*\*/g, "$1");
  result = result.replace(/\*(.+?)\*/g, "$1");
  result = result.replace(/__(.+?)__/g, "$1");
  result = result.replace(/_(.+?)_/g, "$1");
  result = result.replace(/~~(.+?)~~/g, "$1");
  result = result.replace(/`(.+?)`/g, "$1");
  result = result.replace(/^#{1,6}\s+/gm, "");
  result = result.replace(/^>\s?/gm, "");
  result = result.replace(/^[-*+]\s/gm, "• ");
  return result;
}

// ── 微信通道 ──────────────────────────────────────────────────────────────

export class WeixinChannel implements MessageChannel {
  readonly id = "weixin";

  private config: WeixinChannelConfig;
  private account: WeixinAccountData | null = null;
  private abortController: AbortController | null = null;
  private messageCallback: ((message: string) => void) | null = null;
  private contextTokenStore = new Map<string, string>();
  private getUpdatesBuf = "";
  private sessionPausedUntil = 0;
  private lastFromUserId: string | null = null;

  constructor(config: WeixinChannelConfig) {
    this.config = config;
  }

  // ── MessageChannel 接口 ──

  /**
   * 过滤器：微信通道不处理 SSE 事件广播
   * 微信回复通过 messageCallback → adapter.chat() → sendReply 的方式发送，
   * 不走 ChannelManager.broadcast()
   */
  filter(_event: SSEEvent): boolean {
    return false;
  }

  async send(_event: SSEEvent): Promise<void> {
    // 微信通道不通过 broadcast 发送消息
    // 回复通过 sendReply() 方法直接发送
  }

  // ── 消息回调 ──

  onMessage(callback: (message: string) => void): void {
    this.messageCallback = callback;
  }

  // ── 生命周期 ──

  async start(): Promise<void> {
    // 加载已保存的账号
    this.account = this.loadAccount();
    if (!this.account?.token) {
      console.log("[WeixinChannel] 未登录，请使用 /mycc-weixin 扫码登录");
      return;
    }

    // 加载 sync buf
    this.getUpdatesBuf = this.loadSyncBuf();

    console.log(`[WeixinChannel] 已加载账号: ${this.account.accountId}`);
    console.log("[WeixinChannel] 启动消息监听...");

    // 启动 long-poll 循环
    this.abortController = new AbortController();
    this.runMonitorLoop().catch((err) => {
      if (!this.abortController?.signal.aborted) {
        console.error("[WeixinChannel] 监听循环异常退出:", err);
      }
    });
  }

  stop(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    console.log("[WeixinChannel] 已停止");
  }

  // ── QR 登录流程 ──

  async login(): Promise<boolean> {
    const baseUrl = this.config.baseUrl || DEFAULT_BASE_URL;
    console.log("[WeixinChannel] 正在获取登录二维码...");

    const { qrcode, qrcodeUrl } = await fetchQRCode(baseUrl);

    // 打印二维码到终端
    console.log("\n使用微信扫描以下二维码：\n");
    try {
      const qrterm = await import("qrcode-terminal");
      await new Promise<void>((resolve) => {
        qrterm.default.generate(qrcodeUrl, { small: true }, (qr: string) => {
          console.log(qr);
          resolve();
        });
      });
    } catch {
      console.log(`二维码链接: ${qrcodeUrl}`);
    }

    // 轮询登录状态
    console.log("\n等待扫码...\n");
    const deadline = Date.now() + 480_000; // 8 分钟超时
    let scannedPrinted = false;

    while (Date.now() < deadline) {
      const status = await pollQRStatus(baseUrl, qrcode);

      switch (status.status) {
        case "wait":
          break;
        case "scaned":
          if (!scannedPrinted) {
            console.log("已扫码，在微信中确认...");
            scannedPrinted = true;
          }
          break;
        case "expired":
          console.log("二维码已过期，请重新登录");
          return false;
        case "confirmed": {
          if (!status.ilink_bot_id || !status.bot_token) {
            console.error("登录失败：服务器未返回必要信息");
            return false;
          }
          // 规范化 accountId
          const accountId = status.ilink_bot_id
            .replace(/@/g, "-")
            .replace(/\./g, "-");

          this.account = {
            token: status.bot_token,
            baseUrl: status.baseurl || baseUrl,
            userId: status.ilink_user_id,
            accountId,
            savedAt: new Date().toISOString(),
          };
          this.saveAccount(this.account);
          console.log("\n与微信连接成功！");
          return true;
        }
      }

      await sleep(1000);
    }

    console.log("登录超时，请重试");
    return false;
  }

  /** 检查是否已登录 */
  isLoggedIn(): boolean {
    if (!this.account) {
      this.account = this.loadAccount();
    }
    return Boolean(this.account?.token);
  }

  // ── 发送回复 ──

  /**
   * 发送回复给最近消息的发送者
   */
  async sendLastReply(text: string): Promise<void> {
    if (!this.lastFromUserId) {
      console.warn("[WeixinChannel] 无法回复：没有最近的发送者");
      return;
    }
    await this.sendReply(this.lastFromUserId, text);
  }

  /**
   * 发送回复到微信用户
   * @param to - 微信用户 ID
   * @param text - 回复文本（会自动去除 markdown）
   */
  async sendReply(to: string, text: string): Promise<void> {
    if (!this.account?.token) {
      throw new Error("微信未登录");
    }
    const contextToken = this.contextTokenStore.get(to);
    if (!contextToken) {
      console.warn(`[WeixinChannel] 无法回复 ${to}：缺少 contextToken`);
      return;
    }
    const plainText = stripMarkdown(text);
    await apiSendMessage({
      baseUrl: this.account.baseUrl || DEFAULT_BASE_URL,
      token: this.account.token,
      to,
      text: plainText,
      contextToken,
    });
  }

  // ── 内部：long-poll 监听循环 ──

  private async runMonitorLoop(): Promise<void> {
    const signal = this.abortController?.signal;
    let consecutiveFailures = 0;
    let nextTimeoutMs = LONG_POLL_TIMEOUT_MS;

    console.log("[WeixinChannel] 消息监听已启动");

    while (!signal?.aborted) {
      // session 暂停检查
      if (Date.now() < this.sessionPausedUntil) {
        const waitMs = this.sessionPausedUntil - Date.now();
        console.log(`[WeixinChannel] session 暂停中，等待 ${Math.ceil(waitMs / 60000)} 分钟`);
        await sleep(waitMs, signal);
        continue;
      }

      try {
        const resp = await apiGetUpdates({
          baseUrl: this.account!.baseUrl || DEFAULT_BASE_URL,
          token: this.account!.token,
          getUpdatesBuf: this.getUpdatesBuf,
          timeoutMs: nextTimeoutMs,
        });

        // 更新超时
        if (resp.longpolling_timeout_ms != null && resp.longpolling_timeout_ms > 0) {
          nextTimeoutMs = resp.longpolling_timeout_ms;
        }

        // 错误处理
        const isApiError =
          (resp.ret !== undefined && resp.ret !== 0) ||
          (resp.errcode !== undefined && resp.errcode !== 0);

        if (isApiError) {
          const isExpired = resp.errcode === SESSION_EXPIRED_ERRCODE || resp.ret === SESSION_EXPIRED_ERRCODE;
          if (isExpired) {
            this.sessionPausedUntil = Date.now() + SESSION_PAUSE_MS;
            console.error(`[WeixinChannel] session 过期，暂停 ${SESSION_PAUSE_MS / 60000} 分钟`);
            consecutiveFailures = 0;
            continue;
          }

          consecutiveFailures++;
          console.error(`[WeixinChannel] getUpdates 失败: ret=${resp.ret} errcode=${resp.errcode} (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES})`);
          if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            consecutiveFailures = 0;
            await sleep(BACKOFF_DELAY_MS, signal);
          } else {
            await sleep(RETRY_DELAY_MS, signal);
          }
          continue;
        }

        consecutiveFailures = 0;

        // 保存 sync buf
        if (resp.get_updates_buf) {
          this.getUpdatesBuf = resp.get_updates_buf;
          this.saveSyncBuf(resp.get_updates_buf);
        }

        // 处理消息
        const msgs = resp.msgs ?? [];
        for (const msg of msgs) {
          await this.processInboundMessage(msg);
        }
      } catch (err) {
        if (signal?.aborted) return;
        consecutiveFailures++;
        console.error(`[WeixinChannel] getUpdates 异常 (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}):`, err);
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          consecutiveFailures = 0;
          await sleep(BACKOFF_DELAY_MS, signal);
        } else {
          await sleep(RETRY_DELAY_MS, signal);
        }
      }
    }
  }

  private async processInboundMessage(msg: WeixinMessage): Promise<void> {
    const fromUserId = msg.from_user_id ?? "";
    const text = extractTextFromItems(msg.item_list);

    if (!text && !msg.item_list?.some(i =>
      i.type === MessageItemType.IMAGE ||
      i.type === MessageItemType.VOICE ||
      i.type === MessageItemType.FILE ||
      i.type === MessageItemType.VIDEO
    )) {
      return; // 空消息
    }

    // 缓存 contextToken
    if (msg.context_token) {
      this.contextTokenStore.set(fromUserId, msg.context_token);
    }

    console.log(`[WeixinChannel] 收到消息 from=${fromUserId}: ${text.substring(0, 50)}${text.length > 50 ? "..." : ""}`);

    // 记录最近发送者
    this.lastFromUserId = fromUserId;

    // 触发消息回调
    if (this.messageCallback && text) {
      this.messageCallback(text);
    }
  }

  // ── 持久化 ──

  private getStateDir(): string {
    const dir = path.join(this.config.stateDir, "weixin");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  private loadAccount(): WeixinAccountData | null {
    const filePath = path.join(this.getStateDir(), "account.json");
    try {
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, "utf-8"));
      }
    } catch {
      // ignore
    }
    return null;
  }

  private saveAccount(data: WeixinAccountData): void {
    const filePath = path.join(this.getStateDir(), "account.json");
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    try { fs.chmodSync(filePath, 0o600); } catch { /* best-effort */ }
  }

  private loadSyncBuf(): string {
    const filePath = path.join(this.getStateDir(), "sync-buf.txt");
    try {
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, "utf-8");
      }
    } catch {
      // ignore
    }
    return "";
  }

  private saveSyncBuf(buf: string): void {
    const filePath = path.join(this.getStateDir(), "sync-buf.txt");
    fs.writeFileSync(filePath, buf, "utf-8");
  }
}

// ── 辅助 ──

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new Error("aborted"));
    }, { once: true });
  });
}
