import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { GoogleGenAI, Modality } from "@google/genai";
import { v4 as uuidv4 } from "uuid";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API! });

export async function POST(req: NextRequest) {
  try {
    const { prompt, imageBase64, mimeType, sessionId } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const parts: any[] = [];

    // Add image if provided
    if (imageBase64) {
      parts.push({
        inlineData: {
          data: imageBase64,
          mimeType: mimeType || "image/jpeg",
        },
      });
    }

    // Truncate very long prompts to avoid timeout
    const maxPromptLength = 500;
    const truncatedPrompt = prompt.length > maxPromptLength 
      ? prompt.slice(0, maxPromptLength) + "..." 
      : prompt;

    // Add prompt text - keep it concise for faster generation
    const promptText = imageBase64
      ? `You are a professional YouTube thumbnail designer. An image is provided - use it as the focal point.

Instructions: ${truncatedPrompt}

Output: 1280x720 landscape thumbnail. High contrast, bold colors, clear visual hierarchy, space for text overlays.`
      : `You are a professional YouTube thumbnail designer.

Instructions: ${truncatedPrompt}

Output: 1280x720 landscape thumbnail. High contrast, bold colors, clear visual hierarchy, space for text overlays.`;

    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: "imagen-4.0-fast-generate-001",
      contents: [{ role: "user", parts }],
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
      },
    });

    const responseParts = response.candidates?.[0]?.content?.parts ?? [];
    const imgPart = responseParts.find((p: any) => p.inlineData?.mimeType?.startsWith("image/"));

    if (!imgPart?.inlineData) {
      return NextResponse.json({ error: "Gemini did not return an image. Try rephrasing your prompt." }, { status: 500 });
    }

    const imgBuffer = Buffer.from(imgPart.inlineData.data!, "base64");
    const ext = imgPart.inlineData.mimeType!.split("/")[1]?.split(";")[0] || "png";
    const key = `thumbnails/${sessionId || uuidv4()}/${uuidv4()}.${ext}`;

    // Sanitize prompt for metadata header (remove newlines, control chars)
    const sanitizedPrompt = prompt
      .replace(/[\r\n]+/g, ' ')  // Replace newlines with spaces
      .replace(/[^\x20-\x7E]/g, '') // Remove non-printable ASCII
      .slice(0, 512); // Limit length

    await r2.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: imgBuffer,
      ContentType: imgPart.inlineData.mimeType,
      Metadata: { prompt: sanitizedPrompt },
    }));

    const textPart = responseParts.find((p: any) => p.text);

    return NextResponse.json({
      url: `/api/image?key=${key}`,
      key,
      imageBase64: imgPart.inlineData.data!,
      description: textPart?.text || "",
    });

  } catch (err: any) {
    console.error("[Thumbnail] Gemini API error:", err);
    
    // Check for timeout or connection errors
    const isTimeout = err.message?.includes("timeout") || 
                      err.message?.includes("aborted") ||
                      err.message?.includes("fetch failed");
    
    if (isTimeout) {
      return NextResponse.json({ 
        error: "Generation timed out. Try a shorter prompt or try again." 
      }, { status: 504 });
    }
    
    return NextResponse.json({ error: `Gemini error: ${err.message}` }, { status: 500 });
  }
}
