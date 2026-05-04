import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import {buildImageGenerationProvider} from './generate/image-generation.js'

export default definePluginEntry({
  id: "yunwu-nano-banana",
  name: "YunWu Nano Banana",
  description: "OpenClaw native image generation plugin based on YunWu API NanoBanana",
  register(api) {
    api.registerImageGenerationProvider(buildImageGenerationProvider(api));
  }
});