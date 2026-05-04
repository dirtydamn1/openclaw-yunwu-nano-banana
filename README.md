# 基于云雾API-NanoBanana的OpenClaw原生生图插件

向gateway注册ImageGeneration提供商，当OpenClaw调用原生生图工具时使用当前注册的插件进行生图。

## 功能

- 使用云雾Api提供商的NanoBanana模型，以降低生图成本。 
- 插件独立，不依赖当前正在使用的提供商或模型。

## 版本要求

> OpenClaw版本不低于**v2026.3.24**

## 安装说明

```bash
openclaw plugins install .
```

## 配置步骤

> 前往控制台获取模型token：https://yunwu.ai/console/token
> 
> 支持的模型：https://yunwu.ai/pricing?provider=Google&category=图像
> 
> - gemini-3.1-flash-image-preview
> - gemini-3-pro-image-preview
> - gemini-2.5-flash-image

### 交互式配置

```bash
openclaw configure
# 选择Plugins
# 选择@dirtydamn/openclaw-yunwu-nano-banana
# 按要求输入apiKey和model
```

### 手动配置

- 手动修改 ~/.openclaw/openclaw.json 配置

```json
{
  "plugins": {
    "enabled": true,
    "entries": {
      "yunwu-nano-banana": {
        "enabled": true,
        "config": {
          "apiKey": "sk-xxxx",
          "model": "gemini-3.1-flash-image-preview"
        }
      }
    }
  }
}
```

## ImageGeneration优先级

如果你的OpenClaw注册了多个原生ImageGeneration，例如使用了Google提供商、MiniMax提供商等，这些提供商除了注册文本推理模型外还会额外注册ImageGeneration，可以通过如下方式，配置默认的生图模型，手动让ImageGeneration走当前插件。

- 修改 ~/.openclaw/openclaw.json 配置，新增imageGenerationModel

```json
{
  "agents": {
    "defaults": {
      "imageGenerationModel": "yunwu-nano-banana/gemini-3.1-flash-image-preview"
    }
  }
}
```

