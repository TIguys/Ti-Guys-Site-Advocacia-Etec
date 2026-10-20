"""Retrieval of excerpts from official Brazilian legislation on Planalto."""

import argparse
import hashlib
import json
import os
import re
import sqlite3
import unicodedata
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterator, Optional
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
        "Código Civil (Lei nº 10.406/2002)",
        "https://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm",
        ("código civil", "codigo civil", "direito civil", "obrigações", "obrigacoes",
         "contratos", "responsabilidade civil", "família", "familia", "sucessões",
         "sucessoes", "direitos reais"),
    ),
    LegalSource(
        "Código de Processo Civil (Lei nº 13.105/2015)",
        "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13105.htm",
        ("código de processo civil", "codigo de processo civil", "processo civil",
         "tutela de urgência", "tutela de urgencia", "recursos cíveis",
         "recursos civeis"),
    ),
    LegalSource(
        "Código de Defesa do Consumidor (Lei nº 8.078/1990)",
        "https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm",
        ("código de defesa do consumidor", "codigo de defesa do consumidor",
         "consumidor", "relação de consumo", "relacao de consumo",
         "direito do consumidor"),
    ),
    LegalSource(
        "Consolidação das Leis do Trabalho (Decreto-Lei nº 5.452/1943)",
        "https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452compilado.htm",
        ("clt", "direito do trabalho", "trabalhista", "empregado", "empregador",
         "verbas rescisórias", "verbas rescisorias", "férias", "ferias"),
    ),
    LegalSource(
        "Lei Geral de Proteção de Dados (Lei nº 13.709/2018)",
        "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm",
        ("lgpd", "proteção de dados", "protecao de dados", "dados pessoais",
         "dados sensíveis", "dados sensiveis"),
    ),
    LegalSource(
        "Constituição Federal de 1988",
        "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm",
        ("constituição federal", "constituicao federal", "garantia penal",
         "presunção de inocência", "presuncao de inocencia",
         "individualização da pena", "individualizacao da pena",
         "constituição", "constituicao", "direitos fundamentais",
         "direitos e deveres", "direitos", "deveres", "garantias fundamentais"),
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
_LEGAL_INTENT = re.compile(
    r"\b(direito|direitos|dever|deveres|constitui[cç][aã]o|"
    r"garantia|garantias|lei|legal|legisla[cç][aã]o|artigo|art\.|"
    r"c[oó]digo|jur[ií]dic[oa]|penal|crime|crimes|pena|penas|"
    r"processo|contrato|trabalhista|empregado|empregador|consumidor|"
    r"fam[ií]lia|div[oó]rcio|alimentos|heran[cç]a|sucess[aã]o|"
    r"prote[cç][aã]o de dados|lgpd|pris[aã]o|execu[cç][aã]o penal)\b",
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
    # Repair common replacement-character damage in the legacy trigger list.
    # New queries are normalized from proper UTF-8, while these aliases keep
    # old source labels and keywords usable during migration.
    damaged = {
        "c\ufff3digo": "codigo",
        "tr\ufffdfico": "trafico",
        "execu\ufffd\ufffdo": "execucao",
        "viol\ufffdncia": "violencia",
        "audi\ufffdncia": "audiencia",
        "prescri\ufffd\ufffdo": "prescricao",
        "detra\ufffd\ufffdo": "detracao",
        "remi\ufffd\ufffdo": "remicao",
        "constitui\ufffd\ufffdo": "constituicao",
        "crian\ufffda": "crianca",
        "hediondo": "hediondo",
    }
    value = value.casefold()
    for broken, repaired in damaged.items():
        value = value.replace(broken, repaired)
    decomposed = unicodedata.normalize("NFD", value)
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
    """Persist official Planalto texts and retrieve relevant legal excerpts."""

    def __init__(
        self,
        timeout: float = 5.0,
        max_bytes: int = 12_000_000,
        db_path: Optional[str | Path] = None,
    ) -> None:
        self.timeout = timeout
        self.max_bytes = max_bytes
        configured_path = db_path or os.getenv("AI_KNOWLEDGE_DB")
        self.db_path = (
            Path(configured_path)
            if configured_path
            else Path(__file__).with_name("data") / "legal_knowledge.sqlite3"
        )
        if str(self.db_path) != ":memory:":
            self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize_database()

    @staticmethod
    def is_penalty_request(message: str) -> bool:
        return bool(_PENAL_INTENT.search(message))

    @staticmethod
    def is_legal_request(message: str) -> bool:
        return bool(_LEGAL_INTENT.search(message))

    @staticmethod
    def _source_key(source: LegalSource) -> str:
        return re.sub(r"[^a-z0-9]+", "-", _normalize(source.name)).strip("-")

    @contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
        connection = sqlite3.connect(str(self.db_path), timeout=30)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        try:
            yield connection
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    def _initialize_database(self) -> None:
        with self._connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS legal_sources (
                    source_key TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    url TEXT NOT NULL,
                    fetched_at TEXT NOT NULL,
                    sha256 TEXT NOT NULL,
                    chunk_count INTEGER NOT NULL
                );
                CREATE TABLE IF NOT EXISTS legal_chunks (
                    id INTEGER PRIMARY KEY,
                    source_key TEXT NOT NULL REFERENCES legal_sources(source_key)
                        ON DELETE CASCADE,
                    article_number TEXT NOT NULL,
                    text TEXT NOT NULL
                );
                CREATE VIRTUAL TABLE IF NOT EXISTS legal_chunks_fts USING fts5(
                    source_key UNINDEXED,
                    article_number UNINDEXED,
                    text,
                    tokenize='unicode61 remove_diacritics 2'
                );
                """
            )

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
    def select_sources(message: str, limit: int = 4) -> list[LegalSource]:
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
        if not selected and OfficialLawResearch.is_legal_request(message):
            selected = [SOURCES[-1], SOURCES[0]]
        return selected[:limit]

    def _download_text(self, source: LegalSource) -> str:
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
        text = text.strip()
        if len(text) < 500:
            raise ValueError(f"A fonte retornou texto insuficiente: {source.url}")
        return text

    @staticmethod
    def _split_into_chunks(text: str, max_chunk_chars: int = 4000) -> list[tuple[str, str]]:
        chunks: list[tuple[str, str]] = []
        for section in _ARTICLE_SPLIT.split(text):
            if not section.strip():
                continue
            article_match = _ARTICLE_NUMBER.search(section)
            article_number = article_match.group(1) if article_match else "Geral"
            content = re.sub(r"\s+", " ", section).strip()
            start = 0
            while start < len(content):
                end = min(start + max_chunk_chars, len(content))
                if end < len(content):
                    boundary = content.rfind(" ", start + max_chunk_chars // 2, end)
                    if boundary > start:
                        end = boundary
                chunk = content[start:end].strip()
                if chunk:
                    chunks.append((article_number, chunk))
                if end == len(content):
                    break
                start = max(start + 1, end - 200)
        return chunks

    def _store_source(self, source: LegalSource, text: str) -> dict[str, str | int]:
        source_key = self._source_key(source)
        chunks = self._split_into_chunks(text)
        fetched_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
        digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO legal_sources
                    (source_key, name, url, fetched_at, sha256, chunk_count)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(source_key) DO UPDATE SET
                    name = excluded.name,
                    url = excluded.url,
                    fetched_at = excluded.fetched_at,
                    sha256 = excluded.sha256,
                    chunk_count = excluded.chunk_count
                """,
                (source_key, source.name, source.url, fetched_at, digest, len(chunks)),
            )
            connection.execute(
                "DELETE FROM legal_chunks_fts WHERE source_key = ?",
                (source_key,),
            )
            connection.execute(
                "DELETE FROM legal_chunks WHERE source_key = ?",
                (source_key,),
            )
            for article_number, chunk in chunks:
                cursor = connection.execute(
                    "INSERT INTO legal_chunks (source_key, article_number, text) "
                    "VALUES (?, ?, ?)",
                    (source_key, article_number, chunk),
                )
                connection.execute(
                    "INSERT INTO legal_chunks_fts "
                    "(rowid, source_key, article_number, text) VALUES (?, ?, ?, ?)",
                    (cursor.lastrowid, source_key, article_number, chunk),
                )
        return {
            "source": source.name,
            "fetched_at": fetched_at,
            "chunk_count": len(chunks),
            "sha256": digest,
        }

    def _source_metadata(self, source: LegalSource) -> Optional[sqlite3.Row]:
        with self._connect() as connection:
            return connection.execute(
                "SELECT * FROM legal_sources WHERE source_key = ?",
                (self._source_key(source),),
            ).fetchone()

    def _refresh_if_needed(
        self, source: LegalSource, force: bool = False
    ) -> Optional[str]:
        metadata = self._source_metadata(source)
        if metadata and not force:
            try:
                age = datetime.now(timezone.utc) - datetime.fromisoformat(
                    metadata["fetched_at"]
                )
            except ValueError:
                age = None
            if age is not None and age.total_seconds() < 24 * 60 * 60:
                return None

        try:
            text = self._download_text(source)
            self._store_source(source, text)
            return None
        except (OSError, URLError, TimeoutError, ValueError) as error:
            return str(error)

    def sincronizar_todas(self) -> list[dict[str, str | int | bool]]:
        results: list[dict[str, str | int | bool]] = []
        for source in SOURCES:
            error = self._refresh_if_needed(source, force=True)
            metadata = self._source_metadata(source)
            result: dict[str, str | int | bool] = {
                "source": source.name,
                "url": source.url,
                "success": error is None,
            }
            if error:
                result["error"] = error
            if metadata:
                result["fetched_at"] = metadata["fetched_at"]
                result["chunk_count"] = metadata["chunk_count"]
            results.append(result)
        if not any(item["success"] for item in results):
            errors = "; ".join(
                f'{item["source"]}: {item.get("error", "sem dados armazenados")}'
                for item in results
            )
            raise RuntimeError(f"Nenhuma fonte oficial foi sincronizada. {errors}")
        return results

    def status(self) -> dict[str, int | str | None]:
        with self._connect() as connection:
            source_count = connection.execute(
                "SELECT COUNT(*) FROM legal_sources"
            ).fetchone()[0]
            chunk_count = connection.execute(
                "SELECT COUNT(*) FROM legal_chunks"
            ).fetchone()[0]
            latest = connection.execute(
                "SELECT MAX(fetched_at) FROM legal_sources"
            ).fetchone()[0]
        return {
            "source_count": source_count,
            "chunk_count": chunk_count,
            "latest_sync": latest,
        }

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
        if not self.is_legal_request(message):
            return ""

        selected = self.select_sources(message)
        if not selected:
            return (
                "PESQUISA OFICIAL: não foi identificada uma norma específica "
                "para consulta automatizada."
            )

        refresh_errors: dict[str, str] = {}
        for source in selected:
            error = self._refresh_if_needed(source)
            if error:
                refresh_errors[self._source_key(source)] = error

        source_keys = [self._source_key(source) for source in selected]
        requested_articles = self.requested_articles(message)
        terms = [
            _normalize(term)
            for term in re.findall(r"[A-Za-zÀ-ÿ]{3,}", message)
            if _normalize(term) not in _STOP_WORDS
        ]
        terms = list(dict.fromkeys(terms))[:16]
        rows: list[sqlite3.Row] = []
        with self._connect() as connection:
            if requested_articles:
                article_values = list(requested_articles)
                placeholders = ",".join("?" for _ in article_values)
                source_placeholders = ",".join("?" for _ in source_keys)
                rows.extend(
                    connection.execute(
                        f"""
                        SELECT c.id, c.source_key, c.article_number, c.text,
                               s.name, s.url, s.fetched_at
                        FROM legal_chunks c
                        JOIN legal_sources s ON s.source_key = c.source_key
                        WHERE c.source_key IN ({source_placeholders})
                          AND lower(c.article_number) IN ({placeholders})
                        LIMIT 8
                        """,
                        (*source_keys, *article_values),
                    ).fetchall()
                )
            if terms:
                search_expression = " OR ".join(f'"{term}"' for term in terms)
                remaining = 8 - len(rows)
                if remaining > 0:
                    source_placeholders = ",".join("?" for _ in source_keys)
                    candidates = connection.execute(
                        f"""
                        SELECT c.id, c.source_key, c.article_number, c.text,
                               s.name, s.url, s.fetched_at
                        FROM legal_chunks_fts f
                        JOIN legal_chunks c ON c.id = f.rowid
                        JOIN legal_sources s ON s.source_key = c.source_key
                        WHERE legal_chunks_fts MATCH ?
                          AND c.source_key IN ({source_placeholders})
                        ORDER BY bm25(legal_chunks_fts, 0, 0, 1)
                        LIMIT ?
                        """,
                        (search_expression, *source_keys, remaining + 8),
                    ).fetchall()
                    seen = {row["id"] for row in rows}
                    rows.extend(row for row in candidates if row["id"] not in seen)
                    rows = rows[:8]

        if not rows:
            unavailable = [
                f"FONTE NÃO ACESSADA: {source.name} — {source.url}"
                for source in selected
                if self._source_metadata(source) is None
            ]
            if unavailable:
                return (
                    "PESQUISA OFICIAL INDISPONÍVEL: não há texto legal armazenado "
                    "e não foi possível acessar a fonte oficial. Nenhum artigo, "
                    "prazo ou limite foi confirmado.\n"
                    + "\n".join(unavailable)
                )
            return (
                "PESQUISA OFICIAL: a base consultada não localizou trecho "
                "pertinente. Isso não prova que a norma inexiste; confira o "
                "texto integral e a pesquisa por outros termos."
            )

        results: list[str] = []
        included_sources: set[str] = set()
        for row in rows:
            if row["source_key"] not in included_sources:
                stale_notice = (
                    " (a atualização mais recente da base falhou)"
                    if row["source_key"] in refresh_errors
                    else ""
                )
                results.append(
                    f"FONTE OFICIAL: {row['name']}\n"
                    f"URL: {row['url']}\n"
                    f"Texto obtido em: {row['fetched_at']}{stale_notice}"
                )
                included_sources.add(row["source_key"])
            excerpt = row["text"]
            if len(excerpt) > 1800:
                excerpt = excerpt[:1800].rsplit(" ", 1)[0] + " [...]"
            results.append(
                f"Art. {row['article_number']} (trecho): {excerpt}"
            )

        return (
            "Trechos localizados na base de legislação oficial. "
            "Use apenas como referência, confirme o texto integral, a vigência "
            "e a lei aplicável à data dos fatos. A busca é lexical e pode não "
            "ser completa; não há pesquisa de jurisprudência.\n\n"
            + "\n\n".join(results)
        )


def _run_cli() -> int:
    parser = argparse.ArgumentParser(
        description="Gerencia a base persistente de legislação oficial."
    )
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument("--sync", action="store_true", help="Sincroniza as leis.")
    action.add_argument("--status", action="store_true", help="Mostra o estado da base.")
    args = parser.parse_args()
    research = OfficialLawResearch()
    if args.status:
        print(json.dumps(research.status(), ensure_ascii=False, indent=2))
        return 0
    try:
        results = research.sincronizar_todas()
    except RuntimeError as error:
        print(str(error))
        return 1
    print(json.dumps(results, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(_run_cli())
