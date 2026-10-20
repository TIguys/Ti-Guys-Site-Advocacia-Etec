import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from ai_legal_research import OfficialLawResearch, SOURCES
from ai_test import LEGAL_RESEARCH_UNAVAILABLE_RESPONSE, SYSTEM_INSTRUCTIONS


class OfficialLawResearchTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)
        self.db_path = Path(self.temp_dir.name) / "legal.sqlite3"
        self.research = OfficialLawResearch(db_path=self.db_path)

    def test_recognizes_general_legal_topics_without_researching_nonlegal_requests(self):
        self.assertTrue(
            self.research.is_penalty_request("Qual seria a pena em tese?")
        )
        self.assertTrue(
            self.research.is_penalty_request("Como funciona progressão de regime?")
        )
        self.assertFalse(
            self.research.is_penalty_request("Revise este e-mail para o cliente.")
        )
        self.assertTrue(
            self.research.is_legal_request("Quais são os direitos fundamentais?")
        )
        self.assertTrue(
            self.research.is_legal_request("Quais são os direitos trabalhistas?")
        )
        self.assertFalse(
            self.research.is_legal_request("Revise este e-mail para o cliente.")
        )
        self.assertEqual(
            self.research.pesquisar("Revise este e-mail para o cliente."),
            "",
        )

    def test_selects_penal_code_special_law_and_constitution(self):
        selected = self.research.select_sources(
            "Qual a pena em tese para tráfico de drogas?"
        )

        self.assertEqual(selected[0], SOURCES[0])
        self.assertEqual(selected[1], SOURCES[4])
        self.assertEqual(selected[-1], SOURCES[-1])

    def test_accented_user_query_matches_legacy_special_law_triggers(self):
        query = "Qual a pena em tese para tr\u00e1fico de drogas?"
        selected = self.research.select_sources(query)
        self.assertIn(SOURCES[4], selected)

    def test_extracts_requested_article_and_relevant_text(self):
        text = (
            "Introdução do Código.\n"
            "Art. 33. Importar, exportar, remeter, preparar, produzir, "
            "fabricar, adquirir, vender drogas. Pena: reclusão de cinco "
            "a quinze anos e pagamento de quinhentos a mil e quinhentos dias-multa.\n"
            "Art. 34. Fabricar ou adquirir maquinário para drogas."
        )

        excerpts = self.research._matching_excerpts(text, "pena do art. 33 tráfico")

        self.assertEqual(len(excerpts), 1)
        self.assertIn("Art. 33.", excerpts[0])
        self.assertIn("quinhentos a mil e quinhentos", excerpts[0])

    def test_requires_every_requested_article_to_be_present_in_research(self):
        self.assertTrue(
            self.research.contains_requested_articles(
                "Compare art. 155 e art. 59 do Código Penal.",
                "Trechos localizados: Art. 155. ... Art. 59. ...",
            )
        )
        self.assertFalse(
            self.research.contains_requested_articles(
                "Compare art. 155 e art. 59 do Código Penal.",
                "Trechos localizados: Art. 155. ...",
            )
        )

    def test_includes_official_url_and_marks_unavailable_source(self):
        with patch.object(
            self.research,
            "_download_text",
            side_effect=OSError("offline"),
        ):
            result = self.research.pesquisar("Qual a pena em tese para roubo?")

        self.assertIn("PESQUISA OFICIAL INDISPONÍVEL", result)
        self.assertIn(SOURCES[0].url, result)
        self.assertIn("FONTE NÃO ACESSADA", result)

    def test_persists_official_source_and_retrieves_requested_article(self):
        text = (
            "Código Penal compilado. "
            + ("Texto introdutório da norma. " * 30)
            + "Art. 155. Subtrair coisa alheia móvel. "
            + ("A pena é definida conforme a lei aplicável. " * 20)
            + "Art. 156. Outro tipo penal."
        )
        with patch.object(
            self.research,
            "_download_text",
            return_value=text,
        ):
            result = self.research.pesquisar(
                "Qual a pena prevista no art. 155 do Código Penal?"
            )

        restarted = OfficialLawResearch(db_path=self.db_path)
        self.assertGreaterEqual(restarted.status()["source_count"], 1)
        self.assertGreater(restarted.status()["chunk_count"], 0)
        self.assertIn("FONTE OFICIAL: Código Penal", result)
        self.assertIn("Art. 155.", result)
        self.assertIn(SOURCES[0].url, result)
        self.assertIn("Texto obtido em:", result)
        self.assertIn("confirme o texto integral", result)

    def test_legal_question_searches_constitution_and_returns_relevant_source(self):
        self.research._store_source(
            SOURCES[-1],
            "Constituição Federal. "
            + ("Texto de apresentação da Constituição. " * 20)
            + "Art. 5º Todos são iguais perante a lei, sem distinção de qualquer natureza. "
            + ("São assegurados direitos e garantias fundamentais. " * 20),
        )

        result = self.research.pesquisar(
            "Quais são os direitos fundamentais previstos no art. 5 da Constituição?"
        )

        self.assertIn("FONTE OFICIAL: Constituição Federal", result)
        self.assertIn("Art. 5", result)
        self.assertIn(SOURCES[-1].url, result)

    def test_failed_lookup_still_allows_general_answers_without_unverified_limits(self):
        self.assertIn("Responda \u00e0 parte conceitual", LEGAL_RESEARCH_UNAVAILABLE_RESPONSE)
        self.assertIn("n\u00e3o afirme como confirmado", LEGAL_RESEARCH_UNAVAILABLE_RESPONSE)
        self.assertIn("n\u00e3o encerre a resposta apenas", LEGAL_RESEARCH_UNAVAILABLE_RESPONSE)
        self.assertIn("n\u00e3o apresente artigos, limites", SYSTEM_INSTRUCTIONS)


if __name__ == "__main__":
    unittest.main()
