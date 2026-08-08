"""Dobles de prueba mínimos para no depender de pyHanko ni de la red.

Son objetos "pato": solo exponen los atributos que `app.py` consulta por
`getattr`. Están aquí para que las pruebas describan comportamiento y no
construcción de andamiaje.
"""

from typing import Any


class AtributoNombre:
    """Un atributo de un Distinguished Name (lo que itera `cert.subject`)."""

    def __init__(self, dotted_string: str | None, value: Any):
        self.oid = TipoOid(dotted_string) if dotted_string is not None else None
        self.value = value


class TipoOid:
    def __init__(self, dotted_string: str):
        self.dotted_string = dotted_string


class NombreDistinguido:
    """Doble de un `Name` de cryptography/asn1crypto."""

    def __init__(self, atributos: list[AtributoNombre], rfc4514: str | None = None,
                 human_friendly: str | None = None, native: Any = None):
        self._atributos = atributos
        self._rfc4514 = rfc4514
        if human_friendly is not None:
            self.human_friendly = human_friendly
        if native is not None:
            self.native = native

    def __iter__(self):
        return iter(self._atributos)

    def rfc4514_string(self):
        if self._rfc4514 is None:
            raise ValueError("sin representación rfc4514")
        return self._rfc4514


class NombreNoIterable:
    """Un `Name` que revienta al iterarlo: fuerza los caminos de respaldo."""

    def __init__(self, texto: str):
        self._texto = texto

    def __iter__(self):
        raise TypeError("este nombre no es iterable")

    def __str__(self):
        return self._texto


class Certificado:
    """Doble de un certificado; solo lo que `normalize_certificate_info` mira."""

    def __init__(self, subject=None, issuer=None, serial_number=None,
                 not_valid_before=None, not_valid_after=None, extensions=None):
        self.subject = subject
        self.issuer = issuer
        if serial_number is not None:
            self.serial_number = serial_number
        if not_valid_before is not None:
            self.not_valid_before_utc = not_valid_before
        if not_valid_after is not None:
            self.not_valid_after_utc = not_valid_after
        if extensions is not None:
            self.extensions = extensions


class DiccionarioPdf:
    """Doble del diccionario /Sig de un PDF: las claves llevan barra inicial."""

    def __init__(self, entradas: dict[str, Any]):
        self._entradas = dict(entradas)

    def get(self, clave, por_defecto=None):
        return self._entradas.get(clave, por_defecto)

    def keys(self):
        return self._entradas.keys()


class FirmaEmbebida:
    """Doble de un `EmbeddedPdfSignature` de pyHanko."""

    def __init__(self, field_name=None, sig_object=None, signer_cert=None):
        self.field_name = field_name
        if sig_object is not None:
            self.sig_object = sig_object
        if signer_cert is not None:
            self.signer_cert = signer_cert


class EstadoValidacion:
    """Doble del resultado de `validate_pdf_signature`."""

    def __init__(self, detalles="detalles", **atributos):
        self._detalles = detalles
        for nombre, valor in atributos.items():
            setattr(self, nombre, valor)

    def pretty_print_details(self):
        return self._detalles


class ValorNativo:
    """Objeto con `.native`, como los de asn1crypto."""

    def __init__(self, native):
        self.native = native


class ValorVolcable:
    """Objeto con `.dump()`, como los de asn1crypto."""

    def __init__(self, datos: bytes):
        self._datos = datos

    def dump(self):
        return self._datos
