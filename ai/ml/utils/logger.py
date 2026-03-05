"""
Logging utility
"""

from config.logging_config import setup_logging, logger

def get_logger(name):
    """
    Get logger instance for a module

    Args:
        name: Module name (typically __name__)

    Returns:
        logger instance
    """
    # Setup logging on first import
    if not hasattr(get_logger, '_initialized'):
        setup_logging()
        get_logger._initialized = True

    return logger.bind(module=name)
