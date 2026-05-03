import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { GoogleGenAI, Modality } from "@google/genai";
import { fal } from "@fal-ai/client";
import { v4 as uuidv4 } from "uuid";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

/** Fal FLUX.1 [schnell] — text-to-image */
const FAL_MODEL_TXT2IMG = "fal-ai/flux-1/schnell";
/** Fal FLUX.1 [schnell] Redux — image-to-image (remix; typed API has no separate text prompt) */
const FAL_MODEL_IMG2IMG = "fal-ai/flux-1/schnell/redux";

function thumbnailProvider(): "fal" | "gemini" {
  const p = (process.env.THUMBNAIL_GENERATOR_PROVIDER || "gemini").trim().toLowerCase();
  return p === "fal" || p === "flux" ? "fal" : "gemini";
}

function falApiKey(): string | undefined {
  const k =
    process.env.SCHNELL_API_KEY?.trim() ||
    process.env.FAL_KEY?.trim() ||
    process.env.FAL_API_KEY?.trim();
  return k || undefined;
}

function configureFal(): void {
  const key = falApiKey();
  if (!key) {
    throw new Error(
      "Fal API key missing: set SCHNELL_API_KEY or FAL_KEY when THUMBNAIL_GENERATOR_PROVIDER=fal"
    );
  }
  fal.config({ credentials: key });
}

/** Aspect / pixel hints per platform (vertical shorts vs horizontal vs Instagram) */
function thumbnailSpecFromPlatforms(platforms: string[] | undefined): {
  label: string;
  pixels: string;
  aspectNote: string;
} {
  const ids = Array.isArray(platforms) ? platforms : [];
  const wantsPortrait =
    ids.some((id) =>
      ["youtube-shorts", "tiktok", "facebook-reels"].includes(id)
    ) && !ids.some((id) => id === "youtube-long");
  const wantsInstagram = ids.includes("instagram");
  const wantsLandscape =
    ids.includes("youtube-long") ||
    ids.includes("twitter") ||
    (!wantsPortrait && !wantsInstagram && ids.length > 0);

  if (wantsInstagram && !wantsPortrait && !ids.includes("youtube-long")) {
    return {
      label: "Instagram",
      pixels: "1080×1350 pixels (4:5 portrait feed)",
      aspectNote:
        "Portrait 4:5 ratio optimized for Instagram feed; safe margins for UI overlays.",
    };
  }
  if (wantsInstagram && wantsLandscape) {
    return {
      label: "Mixed / Instagram + horizontal",
      pixels: "1280×720 pixels (16:9)",
      aspectNote:
        "16:9 landscape; strong focal subject centered for cross-posting.",
    };
  }
  if (wantsPortrait || (wantsInstagram && !wantsLandscape)) {
    return {
      label: "Vertical (9:16)",
      pixels: "1080×1920 pixels (9:16)",
      aspectNote:
        "Full vertical 9:16 for TikTok, YouTube Shorts, Facebook Reels; leave headroom for mobile UI.",
    };
  }
  if (wantsLandscape) {
    return {
      label: "Horizontal (16:9)",
      pixels: "1280×720 pixels (16:9)",
      aspectNote:
        "Classic widescreen YouTube thumbnail; bold readable title zones.",
    };
  }
  return {
    label: "Horizontal (16:9)",
    pixels: "1280×720 pixels (16:9)",
    aspectNote: "Balanced 16:9 thumbnail composition.",
  };
}

type FalImageSize =
  | "square_hd"
  | "square"
  | "portrait_4_3"
  | "portrait_16_9"
  | "landscape_4_3"
  | "landscape_16_9"
  | { width: number; height: number };

function falImageSizeFromPlatforms(platforms: string[] | undefined): FalImageSize {
  const ids = Array.isArray(platforms) ? platforms : [];
  const wantsPortrait =
    ids.some((id) =>
      ["youtube-shorts", "tiktok", "facebook-reels"].includes(id)
    ) && !ids.some((id) => id === "youtube-long");
  const wantsInstagram = ids.includes("instagram");
  const wantsLandscape =
    ids.includes("youtube-long") ||
    ids.includes("twitter") ||
    (!wantsPortrait && !wantsInstagram && ids.length > 0);

  if (wantsInstagram && !wantsPortrait && !ids.includes("youtube-long")) {
    return { width: 1080, height: 1350 };
  }
  if (wantsPortrait || (wantsInstagram && !wantsLandscape)) {
    return "portrait_16_9";
  }
  return "landscape_16_9";
}

function buildPromptText(
  truncatedPrompt: string,
  spec: ReturnType<typeof thumbnailSpecFromPlatforms>,
  hasImage: boolean
): string {
  return hasImage
    ? `You are a professional multi-platform thumbnail designer. An image is provided - use it as the focal point.

Instructions: ${truncatedPrompt}

Output dimensions: ${spec.pixels} (${spec.label}). ${spec.aspectNote}
High contrast, bold colors, clear visual hierarchy, space for text overlays.`
    : `You are a professional multi-platform thumbnail designer.

Instructions: ${truncatedPrompt}

Output dimensions: ${spec.pixels} (${spec.label}). ${spec.aspectNote}
High contrast, bold colors, clear visual hierarchy, space for text overlays.`;
}

async function fetchImageBufferFromUrl(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download generated image: HTTP ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") || "image/jpeg";
  return { buffer: buf, contentType };
}

type ThumbnailGenResult = {
  key: string;
  imageBase64: string;
  mimeType: string;
  description: string;
};

async function generateThumbnailFal(params: {
  prompt: string;
  imageBase64: string | null;
  mimeType: string;
  platforms: string[] | undefined;
  sessionId: string | undefined;
}): Promise<ThumbnailGenResult> {
  configureFal();

  const maxPromptLength = 500;
  const truncatedPrompt =
    params.prompt.length > maxPromptLength
      ? params.prompt.slice(0, maxPromptLength) + "..."
      : params.prompt;

  const spec = thumbnailSpecFromPlatforms(params.platforms);
  const promptText = buildPromptText(truncatedPrompt, spec, !!params.imageBase64);
  const imageSize = falImageSizeFromPlatforms(params.platforms);

  let imageUrlForDownload: string;
  let description: string;

  if (params.imageBase64) {
    const mime = params.mimeType || "image/jpeg";
    const dataUri = `data:${mime};base64,${params.imageBase64}`;

    const result = await fal.subscribe(FAL_MODEL_IMG2IMG, {
      input: {
        image_url: dataUri,
        image_size: imageSize,
        num_inference_steps: 4,
        num_images: 1,
        enable_safety_checker: true,
        output_format: "png",
        acceleration: "regular",
      },
      logs: false,
    });

    const data = result.data as {
      images?: Array<{ url: string }>;
      prompt?: string;
    };
    const first = data.images?.[0]?.url;
    if (!first) {
      throw new Error("Fal redux did not return an image URL");
    }
    imageUrlForDownload = first;
    description =
      data.prompt ||
      "FLUX Schnell Redux (image remix — include layout details in your prompt when possible).";
  } else {
    const result = await fal.subscribe(FAL_MODEL_TXT2IMG, {
      input: {
        prompt: promptText,
        image_size: imageSize,
        num_inference_steps: 4,
        guidance_scale: 3.5,
        num_images: 1,
        enable_safety_checker: true,
        output_format: "png",
        acceleration: "regular",
      },
      logs: false,
    });

    const data = result.data as {
      images?: Array<{ url: string }>;
      prompt?: string;
    };
    const first = data.images?.[0]?.url;
    if (!first) {
      throw new Error("Fal schnell did not return an image URL");
    }
    imageUrlForDownload = first;
    description = data.prompt || "";
  }

  const { buffer, contentType } = await fetchImageBufferFromUrl(imageUrlForDownload);
  const ext =
    contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpeg";
  const key = `thumbnails/${params.sessionId || uuidv4()}/${uuidv4()}.${ext}`;

  const sanitizedPrompt = params.prompt
    .replace(/[\r\n]+/g, " ")
    .replace(/[^\x20-\x7E]/g, "")
    .slice(0, 512);

  await r2.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      Metadata: { prompt: sanitizedPrompt },
    })
  );

  return {
    key,
    imageBase64: buffer.toString("base64"),
    mimeType: contentType,
    description,
  };
}

async function generateThumbnailGemini(params: {
  prompt: string;
  imageBase64: string | null;
  mimeType: string;
  platforms: string[] | undefined;
  sessionId: string | undefined;
}): Promise<ThumbnailGenResult> {
  const geminiApiKey = process.env.GEMINI_API;
  if (!geminiApiKey) {
    throw new Error("GEMINI_API not configured");
  }

  const ai = new GoogleGenAI({ apiKey: geminiApiKey });
  const maxPromptLength = 500;
  const truncatedPrompt =
    params.prompt.length > maxPromptLength
      ? params.prompt.slice(0, maxPromptLength) + "..."
      : params.prompt;

  const spec = thumbnailSpecFromPlatforms(params.platforms);
  const parts: unknown[] = [];

  if (params.imageBase64) {
    parts.push({
      inlineData: {
        data: params.imageBase64,
        mimeType: params.mimeType || "image/jpeg",
      },
    });
  }

  parts.push({
    text: buildPromptText(truncatedPrompt, spec, !!params.imageBase64),
  });

  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-image-preview",
    contents: [{ role: "user", parts: parts as never }],
    config: {
      responseModalities: [Modality.TEXT, Modality.IMAGE],
    },
  });

  const responseParts = response.candidates?.[0]?.content?.parts ?? [];
  const imgPart = responseParts.find(
    (p: { inlineData?: { mimeType?: string; data?: string } }) =>
      p.inlineData?.mimeType?.startsWith("image/")
  );

  if (!imgPart?.inlineData?.data) {
    throw new Error(
      "Gemini did not return an image. Try rephrasing your prompt."
    );
  }

  const imgBuffer = Buffer.from(imgPart.inlineData.data, "base64");
  const ext =
    imgPart.inlineData.mimeType!.split("/")[1]?.split(";")[0] || "png";
  const key = `thumbnails/${params.sessionId || uuidv4()}/${uuidv4()}.${ext}`;

  const sanitizedPrompt = params.prompt
    .replace(/[\r\n]+/g, " ")
    .replace(/[^\x20-\x7E]/g, "")
    .slice(0, 512);

  await r2.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: imgBuffer,
      ContentType: imgPart.inlineData.mimeType!,
      Metadata: { prompt: sanitizedPrompt },
    })
  );

  const textPart = responseParts.find((p: { text?: string }) => p.text);

  return {
    key,
    imageBase64: imgPart.inlineData.data,
    mimeType: imgPart.inlineData.mimeType!,
    description: textPart?.text || "",
  };
}

export async function POST(req: NextRequest) {
  const provider = thumbnailProvider();
  try {
    const { prompt, imageBase64, mimeType, sessionId, platforms } =
      await req.json();

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    const out =
      provider === "fal"
        ? await generateThumbnailFal({
            prompt,
            imageBase64: imageBase64 || null,
            mimeType: mimeType || "image/jpeg",
            platforms,
            sessionId,
          })
        : await generateThumbnailGemini({
            prompt,
            imageBase64: imageBase64 || null,
            mimeType: mimeType || "image/jpeg",
            platforms,
            sessionId,
          });

    return NextResponse.json({
      url: `/api/image?key=${out.key}`,
      key: out.key,
      imageBase64: out.imageBase64,
      description: out.description,
      provider,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Thumbnail] Error:", err);

    const isTimeout =
      message.includes("timeout") ||
      message.includes("aborted") ||
      message.includes("fetch failed");

    if (isTimeout) {
      return NextResponse.json(
        {
          error:
            "Generation timed out. Try a shorter prompt or try again.",
        },
        { status: 504 }
      );
    }

    const prefix = provider === "fal" ? "Fal" : "Gemini";
    return NextResponse.json(
      { error: `${prefix} error: ${message}` },
      { status: 500 }
    );
  }
}
