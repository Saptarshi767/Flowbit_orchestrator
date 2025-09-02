import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id;
  const logPath = path.join(process.cwd(), "logs", `${id}.log`);

  if (!fs.existsSync(logPath)) {
    return new Response("Log not found", { status: 404 });
  }

  const encoder = new TextEncoder();
  const readableStream = new ReadableStream({
    start(controller) {
      const stream = fs.createReadStream(logPath, { encoding: "utf-8" });
      stream.on("data", chunk => controller.enqueue(encoder.encode(chunk.toString())));
      stream.on("end", () => controller.close());
    }
  });

  return new Response(readableStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    }
  });
}