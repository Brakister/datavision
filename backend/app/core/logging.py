"""Configuração de logging estruturado."""
import logging
import sys
from pythonjsonlogger import jsonlogger


def setup_logging() -> logging.Logger:
    """Configura logging JSON estruturado para auditoria."""
    logger = logging.getLogger("datavision")
    logger.setLevel(logging.INFO)

    handler = logging.StreamHandler(sys.stdout)
    formatter = jsonlogger.JsonFormatter(
        "%(asctime)s %(name)s %(levelname)s %(message)s %(pathname)s %(lineno)d"
    )
    handler.setFormatter(formatter)
    logger.addHandler(handler)

    return logger


logger = setup_logging()
