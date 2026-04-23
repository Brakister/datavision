"""Exceções customizadas da aplicação."""


class DataVisionException(Exception):
    """Exceção base da aplicação."""
    pass


class IngestionException(DataVisionException):
    """Erro durante ingestão de dados."""
    pass


class ValidationException(DataVisionException):
    """Erro de validação estrutural."""
    pass


class InconsistencyException(DataVisionException):
    """Inconsistência detectada entre engines de leitura."""
    pass


class UnsupportedFormatException(DataVisionException):
    """Formato de arquivo não suportado."""
    pass


class FileTooLargeException(DataVisionException):
    """Arquivo excede tamanho máximo permitido."""
    pass
