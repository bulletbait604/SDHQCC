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

    // Add prompt text
    const promptText = imageBase64
      ? `You are a professional YouTube thumbnail designer.

An image has been provided. Use it as the main subject/focal point of the thumbnail.

Task: ${prompt}

Design rules:
- Output a 1280x720 landscape thumbnail
- High contrast, bold colours that pop on dark and light backgrounds
- Clear visual hierarchy — the subject should be immediately obvious
- Leave space for text overlays if the prompt mentions titles or text
- Professional, eye-catching composition that maximises click-through rate`
      : `You are a professional YouTube thumbnail designer.

Task: ${prompt}

Design rules:
- Output a 1280x720 landscape thumbnail
- High contrast, bold colours that pop on dark and light backgrounds
- Clear visual hierarchy with an obvious focal point
- Leave space for text overlays if the prompt mentions titles or text
- Professional, eye-catching composition that maximises click-through rate`;

    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
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

    await r2.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: imgBuffer,
      ContentType: imgPart.inlineData.mimeType,
      Metadata: { prompt: prompt.slice(0, 1024) },
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
    return NextResponse.json({ error: `Gemini error: ${err.message}` }, { status: 500 });
  }
}
