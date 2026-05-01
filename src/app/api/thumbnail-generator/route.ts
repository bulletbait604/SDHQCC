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
    const { imageBase64, mimeType, prompt, sessionId } = await req.json();

    if (!imageBase64 || !prompt) {
      return NextResponse.json({ error: "Missing imageBase64 or prompt" }, { status: 400 });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { data: imageBase64, mimeType: mimeType || "image/jpeg" } },
            { text: `You are a professional thumbnail designer. Transform this image into a striking YouTube/social media thumbnail.\n\nInstructions: ${prompt}\n\nRequirements:\n- High contrast, eye-catching composition\n- Bold visual hierarchy\n- Optimised for 1280x720 landscape format\n- Vibrant colours that pop on both dark and light backgrounds` },
          ],
        },
      ],
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
      },
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const imgPart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith("image/"));

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

    const textPart = parts.find((p: any) => p.text);

    return NextResponse.json({
      url: `/api/image?key=${key}`,
      key,
      description: textPart?.text || "",
    });

  } catch (err: any) {
    console.error("[Thumbnail] Gemini API error:", err);
    return NextResponse.json({ error: `Gemini error: ${err.message}` }, { status: 500 });
  }
}
