"""Configuracao de logging estruturado."""
from __future__ import annotations

import logging
import sys

from pythonjsonlogger import jsonlogger


def setup_logging() -> logging.Logger:
    """Configura logging JSON estruturado para auditoria."""
    logger = logging.getLogger("datavision")
    logger.setLevel(logging.INFO)
    logger.propagate = False

    if logger.handlers:
        return logger

    handler = logging.StreamHandler(sys.stdout)
    formatter = jsonlogger.JsonFormatter(
        "%(asctime)s %(name)s %(levelname)s %(message)s %(pathname)s %(lineno)d"
    )
    handler.setFormatter(formatter)
    logger.addHandler(handler)

    return logger


logger = setup_logging()
