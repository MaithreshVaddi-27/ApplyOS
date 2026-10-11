"""Tests for salary_lookup.py — match_score and search_company matching."""

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


