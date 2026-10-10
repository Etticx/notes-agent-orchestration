import { startPython } from "@/lib/python";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // This local endpoint is intended for the app's own browser tab.
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      // Next's internal URL can use localhost even when the browser uses 127.0.0.1.
      const browserOrigin = new URL(origin);
      const host = request.headers.get("host") || new URL(request.url).host;
      if (browserOrigin.host !== host || browserOrigin.protocol !== "http:") {
        return Response.json({ error: "Use the local app to send requests." }, { status: 403 });
      }
    } catch {
      return Response.json({ error: "Use the local app to send requests." }, { status: 403 });
    }
  }
  let body: { message?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Enter a message." }, { status: 400 });
  }
  if (!body || typeof body.message !== "string" || !body.message.trim() || body.message.length > 4000) {
    return Response.json({ error: "Enter a request between 1 and 4,000 characters." }, { status: 400 });
  }

  const child = startPython();
  const encoder = new TextEncoder();
  let closed = false;
  let timer: ReturnType<typeof setTimeout>;
  let abort: () => void;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const close = () => {
        if (closed) return;
        closed = true;
        clearTimeout(timer);
        request.signal.removeEventListener("abort", abort);
        controller.close();
      };
      const fail = (message: string) => {
        if (closed) return;
        controller.enqueue(encoder.encode(JSON.stringify({ type: "error", message }) + "\n"));
        close();
        child.kill();
      };
      abort = () => { close(); child.kill(); };
      request.signal.addEventListener("abort", abort, { once: true });
      timer = setTimeout(() => fail("The workflow took too long. Try a narrower request."), 360_000);
      child.stdout.on("data", (chunk: Buffer) => {
        if (!closed) controller.enqueue(new Uint8Array(chunk));
      });
      // Drain learning logs; raw provider errors and credentials are never sent to the browser.
      child.stderr.resume();
      child.stdin.on("error", () => {});
      child.on("error", () => fail("Could not start Python. Check that the project's .venv is installed."));
      child.on("close", (code) => {
        if (code && !closed) fail("The Python workflow stopped. Check your local setup.");
        else close();
      });
      if (request.signal.aborted) abort();
      else child.stdin.end(JSON.stringify({ message: body.message }) + "\n");
    },
    cancel() {
      closed = true;
      clearTimeout(timer);
      request.signal.removeEventListener("abort", abort);
      child.kill();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
