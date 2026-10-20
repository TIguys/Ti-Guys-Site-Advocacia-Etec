import unittest
from unittest.mock import patch

from ai_legal_research import OfficialLawResearch, SOURCES
from ai_test import LEGAL_RESEARCH_UNAVAILABLE_RESPONSE, SYSTEM_INSTRUCTIONS


class OfficialLawResearchTests(unittest.TestCase):
    def setUp(self):
        self.research = OfficialLawResearch()

    def test_only_fetches_for_penalty_or_penal_execution_requests(self):
        self.assertTrue(
            self.research.is_penalty_request("Qual seria a pena em tese?")
        )
        self.assertTrue(
            self.research.is_penalty_request("Como funciona progressão de regime?")
        )
        self.assertFalse(
            self.research.is_penalty_request("Revise este e-mail para o cliente.")
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
            "_fetch_text",
            side_effect=OSError("offline"),
        ):
            result = self.research.pesquisar("Qual a pena em tese para roubo?")

        self.assertIn("PESQUISA AUTOMATIZADA", result)
        self.assertIn(SOURCES[0].url, result)
        self.assertIn("FONTE NÃO ACESSADA", result)
        self.assertIn("não há consulta de jurisprudência", result.lower())

    def test_marks_official_source_and_matched_article(self):
        with patch.object(
            self.research,
            "_fetch_text",
            return_value="Art. 155. Subtrair coisa alheia móvel. Pena: reclusão.",
        ):
            result = self.research.pesquisar(
                "Qual a pena prevista no art. 155 do Código Penal?"
            )

        self.assertIn("FONTE OFICIAL: Código Penal", result)
        self.assertIn("Art. 155.", result)
        self.assertIn(SOURCES[0].url, result)

    def test_failed_lookup_does_not_claim_to_verify_penalty_limits(self):
        self.assertIn("não vou estimar esses dados", LEGAL_RESEARCH_UNAVAILABLE_RESPONSE)
        self.assertIn(
            "não tente completar de memória",
            SYSTEM_INSTRUCTIONS,
        )


if __name__ == "__main__":
    unittest.main()
