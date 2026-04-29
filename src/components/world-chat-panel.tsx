"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { io, type Socket } from "socket.io-client";

type WorldChatMessage = {
  id: string;
  username: string;
  text: string;
  createdAt: string;
  scope: "world" | "guild";
};

const REALTIME_URL = process.env.NEXT_PUBLIC_REALTIME_URL || "http://localhost:4001";

export function WorldChatPanel({
  compact = false,
  username,
  userId,
}: {
  compact?: boolean;
  username?: string;
  userId?: string;
}) {
  const [activeChannel, setActiveChannel] = useState<"world" | "guild">("world");
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<WorldChatMessage[]>([]);
  const [chatError, setChatError] = useState<string | null>(null);
  const [isPinnedToBottom, setIsPinnedToBottom] = useState(true);
  const [pendingNewCount, setPendingNewCount] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const previousMessageCountRef = useRef(0);

  const chatUsername = useMemo(() => {
    const value = username?.trim();
    if (!value) return null;
    return value.slice(0, 24);
  }, [username]);
  const canChat = Boolean(chatUsername);
  const canUseGuildChannel = Boolean(userId);
  const filteredMessages =
    activeChannel === "guild" ? messages.filter((m) => m.scope === "guild") : messages;

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    // On channel switch, always snap to newest message for that channel.
    container.scrollTop = container.scrollHeight;
    setIsPinnedToBottom(true);
    setPendingNewCount(0);
  }, [activeChannel]);

  useEffect(() => {
    const socket = io(REALTIME_URL, {
      transports: ["websocket", "polling"],
      withCredentials: true,
    });
    socketRef.current = socket;

    const handleConnect = () => setStatus("connected");
    const handleDisconnect = () => setStatus("disconnected");
    const handleConnectError = () => setStatus("disconnected");
    const handleChatMessage = (message: WorldChatMessage) => {
      setMessages((prev) => [...prev, message].slice(-100));
    };
    const handleHistory = (history: WorldChatMessage[]) => {
      setMessages(history);
    };
    const handleChatError = (error: unknown) => {
      if (typeof error === "string") setChatError(error);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("chat:world:new", handleChatMessage);
    socket.on("chat:error", handleChatError);
    socket.emit("chat:init", { userId }, handleHistory);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off("chat:world:new", handleChatMessage);
      socket.off("chat:error", handleChatError);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [userId]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const previousCount = previousMessageCountRef.current;
    const hasNewMessages = messages.length > previousCount;

    if (isPinnedToBottom) {
      container.scrollTop = container.scrollHeight;
    } else if (hasNewMessages) {
      setPendingNewCount((count) => count + (messages.length - previousCount));
    }

    previousMessageCountRef.current = messages.length;
  }, [messages, isPinnedToBottom]);

  function isNearBottom(container: HTMLDivElement): boolean {
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    return distanceFromBottom <= 24;
  }

  function handleMessagesScroll() {
    const container = messagesContainerRef.current;
    if (!container) return;
    const nearBottom = isNearBottom(container);
    setIsPinnedToBottom(nearBottom);
    if (nearBottom) {
      setPendingNewCount(0);
    }
  }

  function jumpToLatest() {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
    setIsPinnedToBottom(true);
    setPendingNewCount(0);
  }

  function sendMessage() {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 300) {
      return;
    }

    if (!chatUsername) {
      return;
    }

    // TODO: Replace client-provided userId/username with server-verified socket auth identity.
    socketRef.current?.emit("chat:world:send", {
      userId,
      username: chatUsername,
      text: trimmed,
      scope: activeChannel,
    });
    setChatError(null);
    setText("");
  }

  const statusLabel =
    status === "connected" ? "Connected" : status === "connecting" ? "Connecting" : "Disconnected";
  const statusClass =
    status === "connected"
      ? "border-emerald-900/50 bg-emerald-950/30 text-emerald-300/90"
      : status === "connecting"
        ? "border-amber-900/50 bg-amber-950/30 text-amber-300/90"
        : "border-rose-900/50 bg-rose-950/30 text-rose-300/90";

  return (
    <aside className="rounded-2xl border border-white/20 bg-zinc-950/45 bg-linear-to-b from-black/62 via-black/78 to-black/95 p-4 shadow-md backdrop-blur-[1px]">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-white/85">World chat</h2>
        <span className={`rounded border px-2 py-0.5 text-[10px] uppercase tracking-wider ${statusClass}`}>
          {statusLabel}
        </span>
      </div>
      <p className="mt-1 text-xs text-zinc-200/90">
        {canChat ? `Signed in as ${chatUsername}` : "Log in to chat."}
      </p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => setActiveChannel("world")}
          className={`rounded border px-2 py-1 text-[11px] font-semibold ${
            activeChannel === "world"
              ? "border-white/35 bg-black/70 text-zinc-100"
              : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
          }`}
        >
          All chat
        </button>
        <button
          type="button"
          onClick={() => setActiveChannel("guild")}
          disabled={!canUseGuildChannel}
          className={`rounded border px-2 py-1 text-[11px] font-semibold ${
            activeChannel === "guild"
              ? "border-emerald-700/60 bg-emerald-950/30 text-emerald-200"
              : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          Guild
        </button>
      </div>

      <div
        ref={messagesContainerRef}
        onScroll={handleMessagesScroll}
        className={`mt-3 space-y-2 overflow-y-auto rounded-lg border border-white/15 bg-black/50 p-3 text-xs text-zinc-100 ${compact ? "max-h-56" : "max-h-72"}`}
      >
        {filteredMessages.length === 0 ? (
          <p className="text-zinc-400">
            {activeChannel === "guild" ? "No guild messages yet." : "No messages yet. Say hi in chat."}
          </p>
        ) : null}
        {filteredMessages.map((line) => (
          <p
            key={line.id}
            className={`border-b border-zinc-700/60 pb-2 last:border-0 last:pb-0 ${
              line.scope === "guild" ? "text-emerald-300/95" : "text-zinc-100"
            }`}
          >
            <span className="text-zinc-300">[{new Date(line.createdAt).toLocaleTimeString()}]</span>{" "}
            {line.scope === "guild" ? <span className="mr-1 text-emerald-400/90">[Guild]</span> : null}
            <Link
              href={`/player/${encodeURIComponent(line.username)}`}
              className="font-semibold text-zinc-100 underline decoration-white/25 underline-offset-2 hover:text-white hover:decoration-white/60"
            >
              {line.username}
            </Link>
            : {line.text}
          </p>
        ))}
      </div>

      {!isPinnedToBottom && pendingNewCount > 0 ? (
        <button
          type="button"
          onClick={jumpToLatest}
          className="mt-2 w-full rounded-md border border-white/20 bg-black/55 px-3 py-1.5 text-xs font-semibold text-zinc-100 hover:border-white/35 hover:bg-black/70"
        >
          Jump to latest ({pendingNewCount} new)
        </button>
      ) : null}

      <div className="mt-3 flex items-center gap-2">
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              sendMessage();
            }
          }}
          maxLength={300}
          placeholder={activeChannel === "guild" ? "Message your guild" : "Type an all-chat message"}
          disabled={!canChat}
          className="min-h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={sendMessage}
          disabled={!canChat || !text.trim() || status !== "connected"}
          className="min-h-10 shrink-0 rounded-md border border-white/20 bg-black/55 px-3 text-xs font-semibold uppercase tracking-wide text-zinc-100 hover:border-white/35 hover:bg-black/70 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Send
        </button>
      </div>
      <p className="mt-2 text-[11px] text-zinc-500">
        Channel: {activeChannel === "guild" ? "Guild (members only)" : "All chat"}
      </p>
      {chatError ? <p className="mt-1 text-xs text-red-400">{chatError}</p> : null}
    </aside>
  );
}
