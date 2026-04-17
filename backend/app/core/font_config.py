"""
字体配置 - 支持 Docker 和本地环境
"""

import os
import platform

# 根据环境判断字体路径
IS_DOCKER = os.path.exists('/.dockerenv') or os.environ.get('DOCKER_ENV') == 'true'
IS_WINDOWS = platform.system() == 'Windows'

# 字体映射配置
if IS_DOCKER:
    # Docker 环境使用 Linux 字体路径
    FONT_MAPPING = {
        'simhei': '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',
        'simsun': '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
        'simkai': '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc',
        'simfang': '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',
        'msyh': '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc',
        'noto': '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
        'wqy': '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',
    }
    
    DEFAULT_FONTS = [
        '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',
        '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc',
        '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
    ]
else:
    # Windows 本地环境
    FONT_MAPPING = {
        'simhei': 'C:/Windows/Fonts/simhei.ttf',
        'simsun': 'C:/Windows/Fonts/simsun.ttc',
        'simkai': 'C:/Windows/Fonts/simkai.ttf',
        'simfang': 'C:/Windows/Fonts/simfang.ttf',
        'lishu': 'C:/Windows/Fonts/simsun.ttf',
        'stxingkai': 'C:/Windows/Fonts/stxingkai.ttf',
        'stcaiyun': 'C:/Windows/Fonts/stcaiyun.ttf',
        'sthuapo': 'C:/Windows/Fonts/sthuapo.ttf',
        'msyh': 'C:/Windows/Fonts/msyh.ttc',
    }
    
    DEFAULT_FONTS = [
        'C:/Windows/Fonts/msyh.ttc',
        'C:/Windows/Fonts/simhei.ttf',
        'C:/Windows/Fonts/simkai.ttf',
    ]


def get_font_mapping():
    """获取当前环境的字体映射"""
    return FONT_MAPPING


def get_default_fonts():
    """获取默认字体列表"""
    return DEFAULT_FONTS


def is_docker():
    """检查是否在 Docker 环境中"""
    return IS_DOCKER
