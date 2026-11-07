import { extractText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";
import { scanOperations } from "@/lib/onboarding";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const form = await request.formData(),
      file = form.get("file");
    if (!(file instanceof File))
      return Response.json(
        { error: "Choose a document to scan." },
        { status: 400 },
      );
    if (file.size > 8 * 1024 * 1024)
      return Response.json(
        { error: "Please use a document under 8 MB." },
        { status: 400 },
      );
    const extension = file.name.split(".").pop()?.toLowerCase();
    let text = "";
    if (extension === "pdf") {
      const pdf = await getDocumentProxy(
        new Uint8Array(await file.arrayBuffer()),
        { maxImageSize: 16777216 },
      );
      try {
        if (pdf.numPages > 30)
          return Response.json(
            { error: "Please upload a PDF with 30 pages or fewer." },
            { status: 400 },
          );
        const result = await extractText(pdf, { mergePages: true });
        text = result.text;
      } finally {
        await pdf.cleanup();
      }
    } else if (extension === "docx") {
      text = (
        await mammoth.extractRawText({
          buffer: Buffer.from(await file.arrayBuffer()),
        })
      ).value;
    } else if (["txt", "md", "csv", "json"].includes(extension ?? ""))
      text = await file.text();
    else
      return Response.json(
        { error: "Use PDF, DOCX, TXT, Markdown, CSV, or JSON." },
        { status: 400 },
      );
    if (!text.trim())
      return Response.json(
        {
          error:
            "No readable text found. Image-only scans need OCR, which this demo does not include. Upload a text-based document or enter the details manually.",
        },
        { status: 422 },
      );
    return Response.json({
      ...scanOperations(text.slice(0, 200000)),
      name: file.name,
    });
  } catch {
    return Response.json(
      {
        error:
          "This document could not be read. Try another file or enter the missing information manually.",
      },
      { status: 422 },
    );
  }
}
