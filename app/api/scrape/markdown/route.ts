import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const OUTPUT_DIR = join(process.cwd(), "output");
const LATEST_MARKDOWN_OUTPUT_FILE = join(OUTPUT_DIR, "markdown_latest.md");

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const markdown = await readFile(LATEST_MARKDOWN_OUTPUT_FILE, "utf8");

    return new NextResponse(markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (message.includes("ENOENT")) {
      return NextResponse.json(
        {
          error:
            "No markdown output found yet. Enable the scheduler and wait for the first run to generate output/markdown_latest.md.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
