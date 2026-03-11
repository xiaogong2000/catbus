"""
CatBus 内置 Skill

用于 Demo 和测试。
"""


def echo(text: str = "", **kwargs) -> dict:
    """Echo back the input — simplest possible skill for testing."""
    return {"echo": text, "extra": kwargs}


def translate(text: str = "", target_lang: str = "en", **kwargs) -> dict:
    """
    简单翻译 Demo（硬编码几个常见翻译）。
    真实场景应调用翻译 API。
    """
    translations = {
        "zh": {
            "hello": "你好",
            "hello world": "你好世界",
            "hello, world!": "你好，世界！",
            "good morning": "早上好",
            "thank you": "谢谢",
            "how are you": "你好吗",
            "goodbye": "再见",
        },
        "en": {
            "你好": "hello",
            "你好世界": "hello world",
            "谢谢": "thank you",
            "再见": "goodbye",
        },
        "ja": {
            "hello": "こんにちは",
            "hello world": "こんにちは世界",
            "thank you": "ありがとう",
        },
    }

    lang_map = translations.get(target_lang, {})
    result = lang_map.get(text.lower(), f"[translated to {target_lang}] {text}")

    return {
        "translated_text": result,
        "source_text": text,
        "target_lang": target_lang,
    }


def json_format(text: str = "", indent: int = 2, **kwargs) -> dict:
    """格式化 JSON 字符串。"""
    import json
    try:
        parsed = json.loads(text)
        formatted = json.dumps(parsed, indent=indent, ensure_ascii=False)
        return {"formatted": formatted}
    except json.JSONDecodeError as e:
        return {"error": f"Invalid JSON: {e}"}


def text_stats(text: str = "", **kwargs) -> dict:
    """统计文本的字数、行数、字符数。"""
    lines = text.split("\n")
    words = text.split()
    return {
        "characters": len(text),
        "words": len(words),
        "lines": len(lines),
    }
