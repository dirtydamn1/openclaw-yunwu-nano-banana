import {ImageGenerationProviderPlugin, OpenClawPluginApi} from 'openclaw/plugin-sdk/plugin-runtime'
import {postJsonRequest} from 'openclaw/plugin-sdk/provider-http'
import {normalizeLowercaseStringOrEmpty} from 'openclaw/plugin-sdk/text-runtime'
import {ImageGenerationRequest, ImageGenerationResult} from 'openclaw/plugin-sdk/image-generation'

type GoogleInlineDataPart = {
  mimeType?: string;
  mime_type?: string;
  data?: string;
};

type GoogleGenerateImageResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        inlineData?: GoogleInlineDataPart;
        inline_data?: GoogleInlineDataPart;
      }>;
    };
  }>;
};

const DEFAULT_MODEL = "gemini-3.1-flash-image-preview";
const DEFAULT_OUTPUT_MIME = "image/png";
const GOOGLE_SUPPORTED_SIZES = [
  "1024x1024",
  "1024x1536",
  "1536x1024",
  "1024x1792",
  "1792x1024",
] as const;
const GOOGLE_SUPPORTED_ASPECT_RATIOS = [
  "1:1",
  "2:3",
  "3:2",
  "3:4",
  "4:3",
  "4:5",
  "5:4",
  "9:16",
  "16:9",
  "21:9",
] as const;

function mapSizeToImageConfig(
  size: string | undefined,
): { aspectRatio?: string; imageSize?: "2K" | "4K" } | undefined {
  const trimmed = size?.trim();
  if (!trimmed) {
    return undefined;
  }

  const normalized = normalizeLowercaseStringOrEmpty(trimmed);
  const mapping = new Map<string, string>([
    ["1024x1024", "1:1"],
    ["1024x1536", "2:3"],
    ["1536x1024", "3:2"],
    ["1024x1792", "9:16"],
    ["1792x1024", "16:9"],
  ]);
  const aspectRatio = mapping.get(normalized);

  const [widthRaw, heightRaw] = normalized.split("x");
  const width = Number.parseInt(widthRaw ?? "", 10);
  const height = Number.parseInt(heightRaw ?? "", 10);
  const longestEdge = Math.max(width, height);
  const imageSize = longestEdge >= 3072 ? "4K" : longestEdge >= 1536 ? "2K" : undefined;

  if (!aspectRatio && !imageSize) {
    return undefined;
  }

  return {
    ...(aspectRatio ? { aspectRatio } : {}),
    ...(imageSize ? { imageSize } : {}),
  };
}

export function buildImageGenerationProvider(api: OpenClawPluginApi): ImageGenerationProviderPlugin {
  return {
    id: "yunwu-nano-banana",
    label: "YunWu API Nano Banana",
    defaultModel: DEFAULT_MODEL,
    models: [DEFAULT_MODEL],
    isConfigured: ({ agentDir }) => true,
    capabilities: {
      generate: {
        maxCount: 4,
        supportsSize: true,
        supportsAspectRatio: true,
        supportsResolution: true,
      },
      edit: {
        enabled: true,
        maxCount: 4,
        maxInputImages: 5,
        supportsSize: true,
        supportsAspectRatio: true,
        supportsResolution: true,
      },
      geometry: {
        sizes: [...GOOGLE_SUPPORTED_SIZES],
        aspectRatios: [...GOOGLE_SUPPORTED_ASPECT_RATIOS],
        resolutions: ["1K", "2K", "4K"],
      },
    },
    async generateImage(req: ImageGenerationRequest) {
      api.logger.info(`yunwu api generate image=${req.prompt}`);
      // 获取api
      let pluginConfig = req.cfg.plugins?.entries?.["yunwu-nano-banana"]?.config
      const apiKey = pluginConfig?.["apiKey"];
      if (!apiKey) {
        throw new Error("Missing yunwu-nano-banana plugin configuration");
      }
      // 获取模型
      const model = pluginConfig?.["model"];
      // 输入图片如果存在
      const inputParts = (req.inputImages ?? []).map((image) => ({
        inlineData: {
          mimeType: image.mimeType,
          data: image.buffer.toString("base64"),
        },
      }));
      // 生成图片的配置，比例和清晰度(2K或4K)
      const imageConfig = mapSizeToImageConfig(req.size);
      const resolvedImageConfig = {
        ...imageConfig,
        ...(req.aspectRatio?.trim() ? { aspectRatio: req.aspectRatio.trim() } : {}),
        ...(req.resolution ? { imageSize: req.resolution } : {}),
      };
      // 发起生图请求
      const { response: res, release } = await postJsonRequest({
        url: `https://yunwu.ai/v1beta/models/${model}:generateContent`,
        headers: new Headers({
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        }),
        body: {
          contents: [
            {
              role: "user",
              parts: [...inputParts, { text: req.prompt }],
            },
          ],
          generationConfig: {
            responseModalities: ["IMAGE"],
            ...(Object.keys(resolvedImageConfig).length > 0
              ? { imageConfig: resolvedImageConfig }
              : {}),
          },
        },
        timeoutMs: req.timeoutMs ?? 120_000,
        fetchFn: fetch
      });
      try {
        const payload = (await res.json()) as GoogleGenerateImageResponse;
        let imageIndex = 0;
        // 构造images
        const images = (payload.candidates ?? [])
          .flatMap((candidate) => candidate.content?.parts ?? [])
          .map((part) => {
            const inline = part.inlineData ?? part.inline_data;
            const data = inline?.data?.trim();
            if (!data) {
              return null;
            }
            const mimeType = inline?.mimeType ?? inline?.mime_type ?? DEFAULT_OUTPUT_MIME;
            const extension = mimeType.includes("jpeg") ? "jpg" : (mimeType.split("/")[1] ?? "png");
            imageIndex += 1;
            return {
              buffer: Buffer.from(data, "base64"),
              mimeType,
              fileName: `image-${imageIndex}.${extension}`,
            };
          })
          .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
        if (images.length === 0) {
          throw new Error("yunwu api generate image response missing image data");
        }
        return {
          images,
          model,
        } as ImageGenerationResult;
      } finally {
        await release();
      }
    }
  };
} 