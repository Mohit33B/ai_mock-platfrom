from django.test import SimpleTestCase
from .views import normalize_hindi_spacing, normalize_options


class QuestionNormalizationTests(SimpleTestCase):
    def test_repairs_split_hindi_fragments_and_preserves_word_spaces(self):
        text = "भारत में कु ल कृ षि-क्षेत्र और आर्क टिक महासागर"

        self.assertEqual(
            normalize_hindi_spacing(text),
            "भारत में कुल कृषि-क्षेत्र और आर्कटिक महासागर",
        )

    def test_merges_options_from_sibling_fields_and_normalizes_labels(self):
        options = normalize_options(
            {"Option A": "First", "B)": "Second"},
            {"option_c": "Third", "Option 4": "Fourth"},
        )

        self.assertEqual(options, {
            "A": "First",
            "B": "Second",
            "C": "Third",
            "D": "Fourth",
        })
