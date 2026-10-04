"""Tests for salary_lookup.py — format_entry, match_score, and search_company."""

import io
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from unittest import mock

import salary_lookup
from salary_lookup import (
    format_entry,
    normalize,
    anglicize,
    extract_core_words,
    match_score,
    search_company,
    validate_data,
    collect_validation_issues,
)


# ---------------------------------------------------------------------------
# format_entry tests (from #75 / #98)
# ---------------------------------------------------------------------------

class FormatEntryTests(unittest.TestCase):
    def test_zero_count_is_displayed_as_zero(self):
        entry = {
            "company": "Example Corp",
            "city": "",
            "categories": {
                "public_data": {
                    "count": 0,
                    "index": 100.0,
                },
            },
        }

        rendered = format_entry(entry, {"index_baseline": 100, "index_label": "Index"})

        self.assertRegex(rendered, r"Public Data\s+0\s+100\.0")

    def test_text_index_does_not_crash(self):
        entry = {
            "company": "Example Corp",
            "city": "",
            "categories": {
                "sample": {
                    "count": 3,
                    "index": "private",
                },
            },
        }

        rendered = format_entry(entry, {"index_baseline": 100, "index_label": "Index"})

        self.assertIn("private", rendered)

    def test_format_entry_with_zero_baseline(self):
        entry = {
            "company": "Example Corp",
            "city": "",
            "categories": {
                "it": {
                    "count": None,
                    "index": 45000.0,
                },
            },
        }
        rendered = format_entry(entry, {"index_baseline": 0, "index_label": "Salary"})
        self.assertIn("45000.0", rendered)
        self.assertNotIn("%", rendered)

    def test_format_entry_with_custom_baseline(self):
        entry = {
            "company": "Example Corp",
            "city": "",
            "categories": {
                "it": {
                    "count": None,
                    "index": 45000.0,
                },
            },
        }
        rendered = format_entry(entry, {"index_baseline": 40000, "index_label": "Salary"})
        self.assertIn("45000.0", rendered)
        self.assertIn("+12.5%", rendered)

    def test_null_categories_with_sibling_dict_does_not_crash(self):
        # --validate accepts "categories": null, so format_entry must not crash
        # on it. entry.get("categories", {}) returns None (not {}) for an
        # explicit null, and the numeric-field fallback then did None[key] = ....
        entry = {
            "company": "Example Corp",
            "city": "",
            "categories": None,
            "engineering": {"count": 10, "index": 105.0},
        }

        rendered = format_entry(entry, {"index_baseline": 100, "index_label": "Index"})

        self.assertRegex(rendered, r"Engineering\s+10\s+105\.0")

    def test_null_metadata_does_not_crash(self):
        # --validate accepts "metadata": null the same way; format_entry then did
        # None.get("index_label", ...) -> AttributeError.
        entry = {
            "company": "Example Corp",
            "city": "",
            "categories": {"eng": {"count": 5, "index": 108.0}},
        }

        rendered = format_entry(entry, None)

        self.assertRegex(rendered, r"Eng\s+5\s+108\.0")


# ---------------------------------------------------------------------------
# match_score tests (from #106)
# ---------------------------------------------------------------------------

class TestMatchScoreExactMatch(unittest.TestCase):
    def test_exact_match_returns_100(self):
        self.assertEqual(match_score("Razorpay", "Razorpay"), 100)

    def test_exact_match_case_insensitive(self):
        self.assertEqual(match_score("RAZORPAY", "Razorpay"), 100)

    def test_exact_match_after_suffix_stripping(self):
        self.assertEqual(match_score("Razorpay", "Razorpay Pvt Ltd"), 100)

    def test_exact_match_after_dotted_suffix_stripping(self):
        # Dotted suffix variants must strip just as cleanly.
        self.assertEqual(match_score("Acme Corp", "Acme Corp."), 100)

    def test_exact_match_after_indian_suffix_stripping(self):
        self.assertEqual(match_score("Razorpay", "Razorpay Pvt Ltd"), 100)
        self.assertEqual(match_score("Flipkart", "Flipkart India Private Limited"), 100)
        self.assertEqual(match_score("Tech Mahindra", "Tech Mahindra LLP"), 100)


class TestMatchScoreSubstring(unittest.TestCase):
    def test_query_contained_in_entry_gives_high_score(self):
        score = match_score("Flipkart", "Flipkart India Private Limited")
        self.assertGreaterEqual(score, 80)

    def test_entry_contained_in_query_gives_high_score(self):
        score = match_score("Flipkart India", "Flipkart")
        self.assertGreaterEqual(score, 80)


class TestMatchScoreShortQuery(unittest.TestCase):
    def test_short_query_no_word_overlap_returns_zero(self):
        score = match_score("ab", "Something Unrelated Company")
        self.assertEqual(score, 0)

    def test_short_query_with_word_overlap_scores(self):
        score = match_score("IBM", "IBM Corporation")
        self.assertGreater(score, 0)


class TestMatchScoreAnglicize(unittest.TestCase):
    def test_legacy_variant_still_matches(self):
        # Backward compatibility: old Nordic fixtures still resolve.
        score = match_score("Maersk", "Maersk Pvt Ltd")
        self.assertGreater(score, 0)

    def test_aa_variant_matches_aa(self):
        self.assertEqual(match_score("Aarsleff", "Aarsleff"), 100)

    def test_legacy_characters_roundtrip(self):
        score = match_score("Maersk", "Maersk Pvt Ltd")
        self.assertGreater(score, 0)


class TestMatchScoreNoOverlap(unittest.TestCase):
    def test_completely_unrelated_names_return_zero(self):
        self.assertEqual(match_score("Apple", "Zomato Media"), 0)

    def test_empty_query_returns_zero(self):
        self.assertEqual(match_score("", "Razorpay"), 0)

    def test_empty_entry_returns_zero(self):
        self.assertEqual(match_score("Razorpay", ""), 0)


# ---------------------------------------------------------------------------
# search_company tests (from #75 / #98 and #106)
# ---------------------------------------------------------------------------

def _make_data(*entries):
    return {"companies": list(entries)}


def _entry(company, city=""):
    return {"company": company, "city": city}


class SearchCompanyTests(unittest.TestCase):
    def test_search_company_with_none_city(self):
        data = {
            "companies": [
                {
                    "company": "Acme",
                    "city": None,
                }
            ]
        }
        results = search_company(data, "Acme", city="Jaipur")
        self.assertEqual(results, [])


class ValidateDataTests(unittest.TestCase):
    def assert_invalid_data(self, data, expected_message):
        stderr = io.StringIO()
        with self.assertRaises(SystemExit) as raised:
            with redirect_stderr(stderr):
                validate_data(data)

        self.assertEqual(raised.exception.code, 1)
        self.assertIn("Error: invalid salary_data.json", stderr.getvalue())
        self.assertIn(expected_message, stderr.getvalue())
        self.assertIn("tools/README_SALARY_TOOL.md", stderr.getvalue())

    def test_valid_minimal_data_is_returned(self):
        data = {"metadata": {}, "companies": [{"company": "Example Corp"}]}

        self.assertIs(validate_data(data), data)

    def test_top_level_value_must_be_object(self):
        self.assert_invalid_data([], "top-level JSON value must be an object")

    def test_companies_must_be_list(self):
        self.assert_invalid_data({"companies": {"company": "Example Corp"}}, "'companies' must be a list")

    def test_metadata_must_be_object_when_provided(self):
        self.assert_invalid_data(
            {"metadata": [], "companies": [{"company": "Example Corp"}]},
            "'metadata' must be an object when provided",
        )

    def test_load_data_reports_json_parse_errors_without_traceback(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            data_file = Path(tmpdir) / "salary_data.json"
            data_file.write_text('{"companies": [', encoding="utf-8")

            original_data_file = salary_lookup.DATA_FILE
            salary_lookup.DATA_FILE = data_file
            try:
                stderr = io.StringIO()
                with self.assertRaises(SystemExit) as raised:
                    with redirect_stderr(stderr):
                        salary_lookup.load_data()
            finally:
                salary_lookup.DATA_FILE = original_data_file

        self.assertEqual(raised.exception.code, 1)
        self.assertIn("invalid JSON at line", stderr.getvalue())
        self.assertIn("tools/README_SALARY_TOOL.md", stderr.getvalue())

    def test_company_entry_must_be_object(self):
        self.assert_invalid_data({"companies": ["Example Corp"]}, "companies[1] must be an object")

    def test_company_name_is_required(self):
        self.assert_invalid_data({"companies": [{"city": "Jaipur"}]}, "companies[1].company must be a non-empty string")

    def test_company_name_must_not_be_blank(self):
        self.assert_invalid_data({"companies": [{"company": "  "}]}, "companies[1].company must be a non-empty string")

    def test_city_must_be_string_when_provided(self):
        self.assert_invalid_data(
            {"companies": [{"company": "Example Corp", "city": 123}]},
            "companies[1].city must be a string when provided",
        )

    def test_categories_must_be_object_when_provided(self):
        self.assert_invalid_data(
            {"companies": [{"company": "Example Corp", "categories": []}]},
            "companies[1].categories must be an object when provided",
        )


class ValidateDataShapeTests(ValidateDataTests):
    """Category-shape and duplicate-name checks (reuses assert_invalid_data)."""

    def test_malformed_category_value_rejected(self):
        data = {"companies": [{"company": "Acme", "categories": {"eng": "not_a_dict"}}]}
        self.assert_invalid_data(data, "must be an object with 'count' and/or 'index'")

    def test_non_numeric_count_rejected(self):
        data = {
            "companies": [
                {"company": "Acme", "categories": {"eng": {"count": "many"}}}
            ]
        }
        self.assert_invalid_data(data, "count must be a number")

    def test_duplicate_company_name_is_warning(self):
        data = {
            "companies": [
                {"company": "Acme"},
                {"company": "Other Corp"},
                {"company": "Acme"},
            ]
        }
        errors, warnings = collect_validation_issues(data)
        self.assertEqual(errors, [])
        self.assertEqual(len(warnings), 1)
        self.assertIn("Duplicate company name 'Acme'", warnings[0])

    def test_valid_categories_have_no_issues(self):
        data = {
            "companies": [
                {"company": "Acme", "categories": {"eng": {"count": 5, "index": 108.5}}}
            ]
        }
        errors, warnings = collect_validation_issues(data)
        self.assertEqual(errors, [])
        self.assertEqual(warnings, [])


class ValidateFlagTests(unittest.TestCase):
    """End-to-end checks for the --validate pre-flight flow."""

    def _run_validate(self, payload):
        with tempfile.TemporaryDirectory() as tmpdir:
            data_file = Path(tmpdir) / "salary_data.json"
            data_file.write_text(payload, encoding="utf-8")
            original_data_file = salary_lookup.DATA_FILE
            salary_lookup.DATA_FILE = data_file
            argv_patch = mock.patch("sys.argv", ["salary_lookup.py", "--validate"])
            argv_patch.start()
            try:
                stdout = io.StringIO()
                with self.assertRaises(SystemExit) as raised:
                    with redirect_stdout(stdout):
                        salary_lookup.main()
                return raised.exception.code, stdout.getvalue()
            finally:
                argv_patch.stop()
                salary_lookup.DATA_FILE = original_data_file

    def test_validate_flag_exits_1_on_errors(self):
        code, out = self._run_validate(
            '{"companies": [{"company": "Acme", "categories": {"eng": "not_a_dict"}}]}'
        )
        self.assertEqual(code, 1)
        self.assertIn("must be an object with 'count' and/or 'index'", out)

    def test_validate_flag_exits_0_on_clean(self):
        code, out = self._run_validate(
            '{"companies": [{"company": "Acme", "categories": {"eng": {"count": 5}}}]}'
        )
        self.assertEqual(code, 0)
        self.assertIn("OK", out)

    def test_validate_flag_exits_0_on_duplicates_only(self):
        code, out = self._run_validate(
            '{"companies": [{"company": "Acme"}, {"company": "Acme"}]}'
        )
        self.assertEqual(code, 0)
        self.assertIn("Duplicate company name", out)


class NullShapeEndToEndTests(unittest.TestCase):
    """The disagreement in full: --validate blesses a file with a null
    metadata/categories, then the lookup path must render it, not crash.

    Both payloads pass --validate on master; the second command then dies
    (TypeError in the categories fallback, AttributeError on metadata.get).
    """

    def _run_main(self, payload, *argv_tail):
        """Run main() against `payload` with the given argv. Returns
        (exit_code_or_None, stdout). main() returns normally on a successful
        render, so a missing SystemExit is success, not an error."""
        with tempfile.TemporaryDirectory() as tmpdir:
            data_file = Path(tmpdir) / "salary_data.json"
            data_file.write_text(payload, encoding="utf-8")
            original_data_file = salary_lookup.DATA_FILE
            salary_lookup.DATA_FILE = data_file
            argv_patch = mock.patch("sys.argv", ["salary_lookup.py", *argv_tail])
            argv_patch.start()
            try:
                stdout = io.StringIO()
                try:
                    with redirect_stdout(stdout):
                        salary_lookup.main()
                    return None, stdout.getvalue()
                except SystemExit as exc:
                    return exc.code, stdout.getvalue()
            finally:
                argv_patch.stop()
                salary_lookup.DATA_FILE = original_data_file

    def test_null_categories_passes_validate_then_renders(self):
        payload = (
            '{"metadata": {"index_label": "Index", "index_baseline": 100},'
            ' "companies": [{"company": "Foo Pvt Ltd", "city": "Jaipur",'
            ' "categories": null,'
            ' "engineering": {"count": 10, "index": 105}}]}'
        )

        code, out = self._run_main(payload, "--validate")
        self.assertEqual(code, 0)
        self.assertIn("OK", out)

        code, out = self._run_main(payload, "Foo")
        self.assertIsNone(code)
        self.assertIn("Foo Pvt Ltd", out)
        self.assertRegex(out, r"Engineering\s+10\s+105")

    def test_null_metadata_passes_validate_then_renders(self):
        payload = (
            '{"metadata": null,'
            ' "companies": [{"company": "Foo Pvt Ltd", "city": "Jaipur",'
            ' "categories": {"engineering": {"count": 10, "index": 105}}}]}'
        )

        code, out = self._run_main(payload, "--validate")
        self.assertEqual(code, 0)
        self.assertIn("OK", out)

        code, out = self._run_main(payload, "Foo")
        self.assertIsNone(code)
        self.assertRegex(out, r"Engineering\s+10\s+105")


class UtilityTests(unittest.TestCase):
    def test_normalize_strips_suffix_and_noise(self):
        self.assertEqual(normalize("Razorpay Pvt Ltd"), "razorpay")
        self.assertEqual(normalize("Flipkart Holding"), "flipkart")
        self.assertEqual(normalize("Chr. Hansen, India Division"), "chrhansen")
        self.assertEqual(normalize("Simple Corp Pvt Ltd"), "simple")
        self.assertEqual(normalize("Flipkart Private Limited"), "flipkart")
        self.assertEqual(normalize("Razorpay Software Pvt Ltd"), "razorpaysoftware")
        self.assertEqual(normalize("Google India"), "google")
        self.assertEqual(normalize("Zomato Media Pvt. Ltd."), "zomatomedia")
        self.assertEqual(normalize("Tech Mahindra LLP"), "techmahindra")

    def test_normalize_strips_english_suffix_variants(self):
        self.assertEqual(
            normalize("Acme Pvt. Ltd."), normalize("Acme private limited")
        )
        self.assertEqual(normalize("Acme Pvt. Ltd."), "acme")

    def test_anglicize_backward_compatibility(self):
        # Kept for old datasets; English input passes through unchanged.
        self.assertEqual(anglicize("orsted"), "orsted")
        self.assertEqual(anglicize("maersk"), "maersk")
        self.assertEqual(anglicize("aalborg"), "aalborg")

    def test_extract_core_words(self):
        self.assertEqual(extract_core_words("Razorpay Pvt Ltd"), ["razorpay"])
        self.assertEqual(extract_core_words("Pvt Ltd"), [])
        self.assertEqual(extract_core_words("Test Company (Sub-entity)"), ["test", "company"])


class MatchScoreTests(unittest.TestCase):
    def test_exact_match_score(self):
        self.assertEqual(match_score("Razorpay", "Razorpay"), 100)
        self.assertEqual(match_score("razorpay", "Razorpay Pvt Ltd"), 100)

    def test_partial_match_score(self):
        self.assertGreater(match_score("Razor", "Razorpay Pvt Ltd"), 80)
        self.assertGreaterEqual(match_score("Razorpay", "Razor"), 80)

    def test_legacy_match_score(self):
        self.assertEqual(match_score("Orsted", "Orsted Pvt Ltd"), 100)

    def test_overlap_match_score(self):
        # Overlap of multiple words
        self.assertGreater(match_score("Razor Tech", "Razor Technologies Pvt Ltd"), 30)

    def test_no_match_score(self):
        self.assertEqual(match_score("Google", "Microsoft"), 0)


class SearchCompanyRefactoredTests(unittest.TestCase):
    def setUp(self):
        self.data = {
            "companies": [
                {"company": "Razorpay Pvt Ltd", "city": "Bengaluru"},
                {"company": "Flipkart", "city": "Bengaluru"},
                {"company": "Zoho Corp", "city": "Chennai"},
            ]
        }

    def test_search_by_name(self):
        results = search_company(self.data, "Razor")
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["company"], "Razorpay Pvt Ltd")

    def test_search_with_city_filter(self):
        results = search_company(self.data, "Flipkart", city="Bengaluru")
        self.assertEqual(len(results), 1)

        # Mismatching city
        results_wrong_city = search_company(self.data, "Flipkart", city="Chennai")
        self.assertEqual(len(results_wrong_city), 0)


class TestSearchCompanyBasicMatch(unittest.TestCase):
    def test_exact_name_returns_match(self):
        data = _make_data(_entry("Razorpay", "Bengaluru"))
        results = search_company(data, "Razorpay")
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["company"], "Razorpay")

    def test_no_match_returns_empty_list(self):
        data = _make_data(_entry("Zoho Corp", "Chennai"))
        results = search_company(data, "Apple")
        self.assertEqual(results, [])

    def test_multiple_candidates_all_returned(self):
        data = _make_data(
            _entry("Acme Pvt Ltd", "Bengaluru"),
            _entry("Acme India", "Hyderabad"),
            _entry("Unrelated Corp", "Jaipur"),
        )
        results = search_company(data, "Acme")
        companies = [r["company"] for r in results]
        self.assertIn("Acme Pvt Ltd", companies)
        self.assertIn("Acme India", companies)
        self.assertNotIn("Unrelated Corp", companies)


class TestSearchCompanyCityFilter(unittest.TestCase):
    def test_matching_city_is_included(self):
        data = _make_data(
            _entry("Razorpay", "Bengaluru"),
            _entry("Razorpay", "Jaipur"),
        )
        results = search_company(data, "Razorpay", city="Jaipur")
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["city"], "Jaipur")

    def test_non_matching_city_is_excluded(self):
        data = _make_data(_entry("Razorpay", "Bengaluru"))
        results = search_company(data, "Razorpay", city="Chennai")
        self.assertEqual(results, [])

    def test_no_city_filter_returns_all_cities(self):
        data = _make_data(
            _entry("Razorpay", "Bengaluru"),
            _entry("Razorpay", "Jaipur"),
        )
        results = search_company(data, "Razorpay")
        self.assertEqual(len(results), 2)

    def test_city_filter_case_insensitive(self):
        data = _make_data(_entry("Razorpay", "Bengaluru"))
        results = search_company(data, "Razorpay", city="bengaluru")
        self.assertEqual(len(results), 1)

    def test_city_partial_match(self):
        data = _make_data(_entry("Razorpay", "Bengaluru"))
        results = search_company(data, "Razorpay", city="bengal")
        self.assertEqual(len(results), 1)


class TestSearchCompanyScoreThreshold(unittest.TestCase):
    def test_low_score_matches_excluded(self):
        data = _make_data(_entry("Razorpay", "Bengaluru"))
        results = search_company(data, "xyz")
        self.assertEqual(results, [])

    def test_results_sorted_by_relevance_descending(self):
        data = _make_data(
            _entry("Razorpay International", "Bengaluru"),
            _entry("Razorpay", "Bengaluru"),
        )
        results = search_company(data, "Razorpay")
        self.assertEqual(results[0]["company"], "Razorpay")


class TestIndiaExampleTemplate(unittest.TestCase):
    def test_example_template_validates_with_no_errors(self):
        import json

        example = Path(__file__).resolve().parent.parent / "salary_data.example.json"
        data = json.loads(example.read_text(encoding="utf-8"))
        errors, _ = salary_lookup.collect_validation_issues(data)
        self.assertEqual(errors, [], f"salary_data.example.json must validate cleanly: {errors}")

    def test_example_uses_lpa_label_and_zero_placeholders(self):
        import json

        example = Path(__file__).resolve().parent.parent / "salary_data.example.json"
        data = json.loads(example.read_text(encoding="utf-8"))
        self.assertEqual(data["metadata"]["index_label"], "CTC (LPA)")
        for entry in data["companies"]:
            for cat in entry["categories"].values():
                self.assertEqual(cat["index"], 0, "template ships placeholders, never fabricated figures")


if __name__ == "__main__":
    unittest.main()
