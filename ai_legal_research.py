"""Retrieval of excerpts from official Brazilian legislation on Planalto."""

import re
import time
import unicodedata
from dataclasses import dataclass
from html.parser import HTMLParser
from threading import Lock
from typing import Optional
from urllib.error import URLError
from urllib.request import Request, urlopen


@dataclass(frozen=True)
class LegalSource:
    name: str
    url: str
    triggers: tuple[str, ...]


SOURCES = (
    LegalSource(
        "Código Penal (Decreto-Lei nº 2.848/1940)",
        "https://www.planalto.gov.br/ccivil_03/decreto-lei/del2848compilado.htm",
        ("código penal", "art. 121", "artigo 121", "homicídio", "homicidio",
         "furto", "roubo", "estelionato", "pena-base", "dosimetria",
         "agravante", "atenuante", "concurso de crimes", "prescrição penal"),
    ),
    LegalSource(
        "Código de Processo Penal (Decreto-Lei nº 3.689/1941)",
        "https://www.planalto.gov.br/ccivil_03/decreto-lei/del3689compilado.htm",
        ("código de processo penal", "processo penal", "prisão preventiva",
         "prisao preventiva", "audiência de custódia", "audiencia de custodia"),
    ),
    LegalSource(
        "Lei de Execução Penal (Lei nº 7.210/1984)",
        "https://www.planalto.gov.br/ccivil_03/leis/l7210.htm",
        ("execução penal", "execucao penal", "progressão de regime",
         "progressao de regime", "remição", "remicao", "livramento condicional",
         "detração", "detração penal", "detraçao"),
    ),
    LegalSource(
        "Lei dos Crimes Hediondos (Lei nº 8.072/1990)",
        "https://www.planalto.gov.br/ccivil_03/leis/l8072.htm",
        ("crime hediondo", "crimes hediondos", "hediondo"),
    ),
    LegalSource(
        "Lei de Drogas (Lei nº 11.343/2006)",
        "https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2006/lei/l11343.htm",
        ("lei de drogas", "tráfico de drogas", "trafico de drogas",
         "porte de drogas", "art. 33", "artigo 33", "art. 28", "artigo 28"),
    ),
    LegalSource(
        "Estatuto do Desarmamento (Lei nº 10.826/2003)",
        "https://www.planalto.gov.br/ccivil_03/leis/2003/l10.826.htm",
        ("estatuto do desarmamento", "arma de fogo", "porte ilegal de arma",
         "posse ilegal de arma", "desarmamento"),
    ),
    LegalSource(
        "Lei Maria da Penha (Lei nº 11.340/2006)",
        "https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2006/lei/l11340.htm",
        ("lei maria da penha", "violência doméstica", "violencia domestica",
         "violência contra a mulher", "violencia contra a mulher"),
    ),
    LegalSource(
        "Estatuto da Criança e do Adolescente (Lei nº 8.069/1990)",
        "https://www.planalto.gov.br/ccivil_03/leis/l8069.htm",
        ("estatuto da criança", "estatuto da crianca", "eca",
         "ato infracional", "adolescente infrator"),
    ),
    LegalSource(
        "Constituição Federal de 1988",
        "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm",
        ("constituição federal", "constituicao federal", "garantia penal",
         "presunção de inocência", "presuncao de inocencia",
         "individualização da pena", "individualizacao da pena"),
    ),
)

_PENAL_INTENT = re.compile(
    r"\b(pena|penal|crime|crimes|dosimetria|condena[cç][aã]o|"
    r"execu[cç][aã]o penal|regime inicial|progress[aã]o|"
    r"livramento condicional|prescri[cç][aã]o penal|"
    r"lei de drogas|tr[aá]fico de drogas|arma de fogo|"
    r"viol[eê]ncia dom[eé]stica|lei maria da penha|ato infracional)\b",
    re.IGNORECASE,
)
_ARTICLE_SPLIT = re.compile(r"(?=\bArt\.\s*\d+)", re.IGNORECASE)
_ARTICLE_NUMBER = re.compile(
    r"\bArt\.\s*(\d+[A-Za-z]?(?:-[A-Za-z])?)", re.IGNORECASE
)
_ARTICLE_REQUEST = re.compile(
    r"\bart(?:igo)?\.?\s*(\d+[A-Za-z]?(?:-[A-Za-z])?)", re.IGNORECASE
)
_STOP_WORDS = {
    "analise", "análise", "pena", "penal", "crime", "crimes", "qual",
    "quais", "sobre", "conforme", "caso", "pode", "possivel", "possível",
    "previsto", "prevista", "artigo", "art", "lei", "codigo", "código",
}


def _normalize(value: str) -> str:
    decomposed = unicodedata.normalize("NFD", value.casefold())
    return "".join(character for character in decomposed if not unicodedata.combining(character))


class _TextExtractor(HTMLParser):
    _BLOCK_TAGS = {
        "address", "article", "br", "dd", "div", "dt", "h1", "h2", "h3",
        "li", "p", "section", "td", "th", "tr",
    }
    _IGNORED_TAGS = {"script", "style", "noscript"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self._ignored_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, Optional[str]]]) -> None:
        if tag in self._IGNORED_TAGS:
            self._ignored_depth += 1
        elif not self._ignored_depth and tag in self._BLOCK_TAGS:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in self._IGNORED_TAGS and self._ignored_depth:
            self._ignored_depth -= 1
        elif not self._ignored_depth and tag in self._BLOCK_TAGS:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if not self._ignored_depth:
            self.parts.append(data)


class OfficialLawResearch:
    """Fetch only fixed Planalto URLs and return matching statutory excerpts."""

    def __init__(self, timeout: float = 5.0, max_bytes: int = 2_000_000) -> None:
        self.timeout = timeout
        self.max_bytes = max_bytes
        self._cache: dict[str, tuple[float, str]] = {}
        self._cache_lock = Lock()

    @staticmethod
    def is_penalty_request(message: str) -> bool:
        return bool(_PENAL_INTENT.search(message))

    @staticmethod
    def requested_articles(message: str) -> set[str]:
        return {
            _normalize(match) for match in _ARTICLE_REQUEST.findall(message)
        }

    @classmethod
    def contains_requested_articles(cls, message: str, context: str) -> bool:
        requested = cls.requested_articles(message)
        if not requested:
            return True
        found = {
            _normalize(match) for match in _ARTICLE_NUMBER.findall(context)
        }
        return requested.issubset(found)

    @staticmethod
    def select_sources(message: str, limit: int = 3) -> list[LegalSource]:
        normalized = _normalize(message)
        selected = [
            source for source in SOURCES
            if any(_normalize(trigger) in normalized for trigger in source.triggers)
        ]
        if _PENAL_INTENT.search(message):
            penal_code = SOURCES[0]
            constitution = SOURCES[-1]
            selected = [
                penal_code,
                *(source for source in selected if source not in {penal_code, constitution}),
                constitution,
            ]
        return selected[:limit]

    def _fetch_text(self, source: LegalSource) -> str:
        now = time.monotonic()
        with self._cache_lock:
            cached = self._cache.get(source.url)
            if cached and now - cached[0] < 6 * 60 * 60:
                return cached[1]

        request = Request(
            source.url,
            headers={"User-Agent": "AdvocaciaETEC-LawAI/1.0 (official-law lookup)"},
        )
        with urlopen(request, timeout=self.timeout) as response:
            raw = response.read(self.max_bytes + 1)
            charset = response.headers.get_content_charset() or "utf-8"
        if len(raw) > self.max_bytes:
            raw = raw[: self.max_bytes]
        html = raw.decode(charset, errors="replace")
        parser = _TextExtractor()
        parser.feed(html)
        text = re.sub(r"[ \t]+", " ", "".join(parser.parts))
        text = re.sub(r"\n\s*\n+", "\n", text)

        with self._cache_lock:
            self._cache[source.url] = (now, text)
        return text

    @staticmethod
    def _matching_excerpts(text: str, message: str, limit: int = 5) -> list[str]:
        requested_articles = OfficialLawResearch.requested_articles(message)
        terms = {
            _normalize(term)
            for term in re.findall(r"[A-Za-zÀ-ÿ]{4,}", message)
            if _normalize(term) not in _STOP_WORDS
        }
        sections = _ARTICLE_SPLIT.split(text)
        ranked: list[tuple[int, int, str]] = []
        for section in sections:
            article_match = _ARTICLE_NUMBER.search(section)
            article_number = _normalize(article_match.group(1)) if article_match else ""
            article_score = int(
                any(article_number == requested.rstrip("º°") for requested in requested_articles)
            )
            normalized_section = _normalize(section)
            term_score = sum(normalized_section.count(term) for term in terms)
            if article_score or term_score:
                excerpt = re.sub(r"\s+", " ", section).strip()
                if len(excerpt) > 1600:
                    excerpt = excerpt[:1600].rsplit(" ", 1)[0] + " [...]"
                ranked.append((article_score, term_score, excerpt))

        ranked.sort(key=lambda item: (item[0], item[1]), reverse=True)
        excerpts: list[str] = []
        seen: set[str] = set()
        for _, _, excerpt in ranked:
            if excerpt not in seen:
                excerpts.append(excerpt)
                seen.add(excerpt)
            if len(excerpts) == limit:
                break
        return excerpts

    def pesquisar(self, message: str) -> str:
        if not self.is_penalty_request(message):
            return ""

        selected = self.select_sources(message)
        if not selected:
            return (
                "PESQUISA OFICIAL: não foi identificada uma norma específica "
                "para consulta automatizada."
            )

        results: list[str] = []
        for source in selected:
            try:
                text = self._fetch_text(source)
            except (OSError, URLError, TimeoutError, ValueError):
                results.append(
                    f"FONTE NÃO ACESSADA: {source.name} — {source.url}"
                )
                continue
            excerpts = self._matching_excerpts(text, message)
            if excerpts:
                result = "\n".join(f"- {excerpt}" for excerpt in excerpts)
                results.append(
                    f"FONTE OFICIAL: {source.name}\nURL: {source.url}\n"
                    f"Trechos localizados (confira o texto integral e a vigência):\n{result}"
                )
            else:
                results.append(
                    f"FONTE OFICIAL CONSULTADA, mas sem trecho pertinente "
                    f"localizado: {source.name} — {source.url}"
                )

        return (
            "PESQUISA AUTOMATIZADA DE LEGISLAÇÃO OFICIAL DO PLANALTO. "
            "Os trechos abaixo são material de referência, não substituem a "
            "conferência do texto integral, da vigência e da lei temporalmente aplicável. "
            "Não há consulta de jurisprudência neste recurso.\n\n"
            + "\n\n".join(results)
        )
