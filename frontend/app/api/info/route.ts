import { startPython } from "@/lib/python";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return new Promise<Response>((resolve) => {
    const child = startPython(["--info"]);
    let output = "";
    let finished = false;
    const finish = (response: Response) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve(response);
    };
    const timer = setTimeout(() => {
      child.kill();
      finish(Response.json({ error: "Python did not respond. Check your environment." }, { status: 503 }));
    }, 15_000);
    child.stdin.end();
    child.stderr.resume();
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => { output += chunk; });
    child.on("error", () => finish(Response.json({ error: "Install the project's Python .venv first." }, { status: 503 })));
    child.on("close", () => {
      try {
        const info = JSON.parse(output);
        finish(Response.json(info, { status: info.error ? 503 : 200 }));
      } catch {
        finish(Response.json({ error: "Could not read your local notes." }, { status: 503 }));
      }
    });
  });
}
