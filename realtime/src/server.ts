import http from "node:http";
import { PrismaClient } from "@prisma/client";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { Server, type Socket } from "socket.io";

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 4001;
const webOrigin = process.env.WEB_ORIGIN || "http://localhost:3000";
const prisma = new PrismaClient();

app.use(cors({ origin: webOrigin, credentials: true }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "duskforge-realtime" });
});

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: webOrigin,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

io.on("connection", (socket) => {
  console.log(`[socket] connected: ${socket.id}`);

  socket.on("chat:world:send", async (payload: unknown) => {
    if (!isValidChatPayload(payload)) {
      return;
    }

    try {
      const parsedText = payload.text.trim();
      const wantsGuildScope = payload.scope === "guild";
      const isGuildCommand = parsedText === "/g" || parsedText.startsWith("/g ");

      if (wantsGuildScope || isGuildCommand) {
        const guildText = isGuildCommand ? parsedText.replace(/^\/g\s*/, "").trim() : parsedText;
        if (!guildText) {
          socket.emit("chat:error", "Use /g <message> for guild chat.");
          return;
        }
        if (!payload.userId) {
          socket.emit("chat:error", "Guild chat requires a signed-in user.");
          return;
        }
        const guildId = await getGuildIdForUser(payload.userId);
        if (!guildId) {
          socket.emit("chat:error", "You must be in a guild to use /g.");
          return;
        }

        await ensureSocketGuildRoom(socket, payload.userId);

        const message = await prisma.guildChatMessage.create({
          data: {
            guildId,
            userId: payload.userId,
            username: payload.username.trim(),
            text: guildText,
          },
          select: {
            id: true,
            username: true,
            text: true,
            createdAt: true,
          },
        });

        io.to(guildRoom(guildId)).emit("chat:world:new", {
          id: message.id,
          username: message.username,
          text: message.text,
          createdAt: message.createdAt.toISOString(),
          scope: "guild" as const,
        });
        return;
      }

      // TODO: Replace client-provided identity with authenticated socket session userId.
      const message = await prisma.chatMessage.create({
        data: {
          channel: "world",
          userId: payload.userId ?? null,
          username: payload.username.trim(),
          text: parsedText,
        },
        select: {
          id: true,
          username: true,
          text: true,
          createdAt: true,
        },
      });

      io.emit("chat:world:new", {
        id: message.id,
        username: message.username,
        text: message.text,
        createdAt: message.createdAt.toISOString(),
        scope: "world" as const,
      });
    } catch (error) {
      console.error("[chat] failed to persist message", error);
    }
  });

  socket.on("chat:init", async (payload: unknown, callback?: (messages: WorldChatMessage[]) => void) => {
    if (typeof callback !== "function") return;
    try {
      const userId = parseInitUserId(payload);
      if (userId) {
        await ensureSocketGuildRoom(socket, userId);
      }
      const worldMessages = await prisma.chatMessage.findMany({
        where: { channel: "world" },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          username: true,
          text: true,
          createdAt: true,
        },
      });
      const guildId = userId ? await getGuildIdForUser(userId) : null;
      const guildMessages = guildId
        ? await prisma.guildChatMessage.findMany({
            where: { guildId },
            orderBy: { createdAt: "desc" },
            take: 50,
            select: {
              id: true,
              username: true,
              text: true,
              createdAt: true,
            },
          })
        : [];
      const combined = [
        ...worldMessages.map((message) => ({ ...message, scope: "world" as const })),
        ...guildMessages.map((message) => ({ ...message, scope: "guild" as const })),
      ]
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .slice(-100);

      callback(
        combined.map(
          (message: {
            id: string;
            username: string;
            text: string;
            createdAt: Date;
            scope: "world" | "guild";
          }) => ({
            ...message,
            createdAt: message.createdAt.toISOString(),
          }),
        ),
      );
    } catch (error) {
      console.error("[chat] failed to load history", error);
      callback([]);
    }
  });

  socket.on("disconnect", (reason) => {
    console.log(`[socket] disconnected: ${socket.id} (${reason})`);
  });
});

httpServer.listen(port, () => {
  console.log(`[realtime] duskforge-realtime listening on port ${port}`);
  console.log(`[realtime] allowed web origin: ${webOrigin}`);
});

type WorldChatSendPayload = {
  username: string;
  text: string;
  userId?: string;
  scope?: "world" | "guild";
};

function isValidChatPayload(payload: unknown): payload is WorldChatSendPayload {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as Record<string, unknown>;
  const username = candidate.username;
  const text = candidate.text;
  const userId = candidate.userId;
  const scope = candidate.scope;

  if (typeof username !== "string" || typeof text !== "string") {
    return false;
  }
  if (userId !== undefined && typeof userId !== "string") {
    return false;
  }
  if (scope !== undefined && scope !== "world" && scope !== "guild") {
    return false;
  }

  if (!username.trim() || username.trim().length > 24) {
    return false;
  }

  const trimmedText = text.trim();
  if (!trimmedText || trimmedText.length > 300) {
    return false;
  }

  return true;
}

type WorldChatMessage = {
  id: string;
  username: string;
  text: string;
  createdAt: string;
  scope: "world" | "guild";
};

function parseInitUserId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const userId = (payload as Record<string, unknown>).userId;
  if (typeof userId !== "string") return null;
  const trimmed = userId.trim();
  return trimmed ? trimmed : null;
}

function guildRoom(guildId: string) {
  return `guild:${guildId}`;
}

async function getGuildIdForUser(userId: string): Promise<string | null> {
  const membership = await prisma.guildMember.findUnique({
    where: { userId },
    select: { guildId: true },
  });
  return membership?.guildId ?? null;
}

async function ensureSocketGuildRoom(socket: Socket, userId: string) {
  const guildId = await getGuildIdForUser(userId);
  const currentGuildRoom = [...socket.rooms].find((room) => room.startsWith("guild:"));
  if (currentGuildRoom && currentGuildRoom !== guildRoom(guildId ?? "")) {
    socket.leave(currentGuildRoom);
  }
  if (guildId) {
    socket.join(guildRoom(guildId));
  }
}
