import io
import unittest
from contextlib import redirect_stderr
from types import SimpleNamespace

from tools.convert_salary_excel import (
    INDEX_PATTERNS,
    detect_column_type,
    header_matches,
    parse_numeric_cell,
    parse_sheet,
)


class FakeWorksheet:
    title = "Sheet1"

    def __init__(self, rows):
        self.rows = rows

    def iter_rows(self, min_row=1, max_row=None, values_only=False):
        rows = self.rows[min_row - 1:max_row]
        for row in rows:
            if values_only:
                yield row
            else:
                yield [SimpleNamespace(value=value) for value in row]

    def __getitem__(self, row_number):
        return [SimpleNamespace(value=value) for value in self.rows[row_number - 1]]


class DetectColumnTypeTests(unittest.TestCase):
    def test_index_headers_are_not_misclassified_as_count(self):
        for header in ("Index", "Salary Index", "Engineering Index", "Median salary"):
            with self.subTest(header=header):
                self.assertEqual(detect_column_type(header), "index")

    def test_single_letter_n_only_matches_as_a_token(self):
        self.assertEqual(detect_column_type("Employee n"), "count")
        self.assertEqual(detect_column_type("Engineering"), None)

    def test_count_headers_still_match_common_labels(self):
        for header in ("Count", "Engineering Count", "Employee Count"):
            with self.subTest(header=header):
                self.assertEqual(detect_column_type(header), "count")

    def test_count_inside_word_does_not_make_count_header(self):
        self.assertIsNone(detect_column_type("Accounting Total"))
        self.assertEqual(detect_column_type("Accounting Index"), "index")

    def test_glued_headers_do_not_match(self):
        # English uses separate words; glued headers must not match.
        self.assertEqual(detect_column_type("Salaryindex"), None)

    def test_compound_patterns_match_as_substring_but_others_do_not(self):
        # No compound tokens in English mode: glued words never match.
        self.assertFalse(header_matches("salaryindex", INDEX_PATTERNS))
        # A pattern only matches as a whole token.
        self.assertFalse(header_matches("salaryindex", INDEX_PATTERNS))
        self.assertTrue(header_matches("salary index", INDEX_PATTERNS))

    def test_parse_sheet_preserves_category_name_with_letter_n(self):
        ws = FakeWorksheet([
            ("Company", "Engineering Count", "Engineering Index"),
            ("Example Corp", 12, 105.5),
        ])

        companies = parse_sheet(ws)

        self.assertEqual(companies[0]["categories"]["engineering"], {"count": 12, "index": 105.5})

    def test_parse_sheet_groups_accounting_count_index_pair(self):
        ws = FakeWorksheet([
            ("Company", "Accounting Count", "Accounting Index"),
            ("Example Corp", 12, 105.5),
        ])

        companies = parse_sheet(ws)

        self.assertEqual(companies[0]["categories"]["accounting"], {"count": 12, "index": 105.5})

    def test_parse_sheet_normalizes_paired_category_name_with_underscores(self):
        ws = FakeWorksheet([
            ("Company", "Software Engineering Count", "Software Engineering Index"),
            ("Example Corp", 8, 110.0),
        ])

        companies = parse_sheet(ws)

        self.assertEqual(companies[0]["categories"]["software_engineering"], {"count": 8, "index": 110.0})

    def test_parse_sheet_detects_company_column_with_token_header(self):
        # Real-world salary sheets rarely use the bare token "Company";
        # headers like "Company Name" / "Employer Name" must still be
        # detected as the company column (previously silently skipped -> []).
        for header in ("Company", "Company Name", "Employer Name"):
            with self.subTest(header=header):
                ws = FakeWorksheet([
                    (header, "Salary"),
                    ("Example Corp", 105.5),
                ])
                companies = parse_sheet(ws)
                self.assertEqual(len(companies), 1)
                self.assertEqual(companies[0]["company"], "Example Corp")
                self.assertEqual(
                    companies[0]["categories"]["salary"], {"index": 105.5}
                )

    def test_parse_sheet_detects_city_column_with_token_header(self):
        # City headers are matched with the same token-based header_matches()
        # used for the company column, not exact string equality.
        for header in ("City", "City Name", "Location"):
            with self.subTest(header=header):
                ws = FakeWorksheet([
                    ("Company", header, "Salary"),
                    ("Example Corp", "Jaipur", 105.5),
                ])
                companies = parse_sheet(ws)
                self.assertEqual(len(companies), 1)
                self.assertEqual(companies[0]["city"], "Jaipur")

    def test_parse_sheet_handles_ragged_rows(self):
        # openpyxl's read_only mode yields ragged tuples for dimension-less
        # workbooks: a row can be shorter than the header. A company row that
        # omits its city and category cells must parse without an IndexError,
        # be retained, and get an empty city.
        ws = FakeWorksheet([
            ("Company", "City", "Engineering Count", "Engineering Index"),
            ("Example Corp",),
            ("Other Corp", "Jaipur", 12, 105.5),
        ])

        companies = parse_sheet(ws)

        self.assertEqual(len(companies), 2)
        self.assertEqual(companies[0]["company"], "Example Corp")
        self.assertEqual(companies[0]["city"], "")
        self.assertEqual(companies[0]["categories"], {})
        self.assertEqual(companies[1]["categories"]["engineering"], {"count": 12, "index": 105.5})

    def test_parse_sheet_skips_row_shorter_than_company_column(self):
        # A ragged row that ends before the company column has no company cell
        # at all; it must be skipped, not crash the parse.
        ws = FakeWorksheet([
            ("Notes", "Company", "Salary Index"),
            ("stray",),
            ("", "Example Corp", 105.5),
        ])

        companies = parse_sheet(ws)

        self.assertEqual(len(companies), 1)
        self.assertEqual(companies[0]["company"], "Example Corp")

    def test_skips_free_text_column(self):
        # A free-text "Notes" column must not become a bogus salary category.
        ws = FakeWorksheet([
            ("Company", "Salary Index", "Notes"),
            ("Example Corp", 105.5, "good"),
        ])

        companies = parse_sheet(ws)

        self.assertIn("salary_index", companies[0]["categories"])
        self.assertNotIn("notes", companies[0]["categories"])

    def test_skips_numeric_identifier_column(self):
        # A numeric "Id" column (employee id) must not be treated as a salary index.
        ws = FakeWorksheet([
            ("Company", "Salary Index", "Id"),
            ("Example Corp", 105.5, 7),
        ])

        companies = parse_sheet(ws)

        self.assertIn("salary_index", companies[0]["categories"])
        self.assertNotIn("id", companies[0]["categories"])

    def test_keeps_numeric_salary_column(self):
        # A genuine numeric salary column still produces a salary category.
        ws = FakeWorksheet([
            ("Company", "Salary Index"),
            ("Example Corp", 105.5),
        ])

        companies = parse_sheet(ws)

        self.assertIn("salary_index", companies[0]["categories"])
        self.assertEqual(companies[0]["categories"]["salary_index"], {"index": 105.5})

    def test_parse_sheet_accepts_comma_decimal_string_values(self):
        # Locale-formatted Excel exports can carry numeric cells as strings.
        ws = FakeWorksheet([
            ("Company", "Engineering Count", "Engineering Index"),
            ("Example Corp", "12,0", "108,5"),
        ])

        companies = parse_sheet(ws)

        self.assertEqual(
            companies[0]["categories"]["engineering"],
            {"count": 12, "index": 108.5},
        )

    def test_parse_sheet_accepts_thousands_and_decimal_string(self):
        ws = FakeWorksheet([
            ("Company", "Salary Index"),
            ("Example Corp", "1.234,5"),
        ])

        companies = parse_sheet(ws)

        self.assertEqual(
            companies[0]["categories"]["salary_index"],
            {"index": 1234.5},
        )

    def test_parse_sheet_skips_ambiguous_single_comma_thousands_string(self):
        # In an English-locale export, "1,234" is probably 1234, but in a
        # decimal-comma locale it could be 1.234. Preserve the old safe-skip
        # behavior instead of guessing and writing a 1000x-wrong salary value.
        ws = FakeWorksheet([
            ("Company", "Salary Index"),
            ("Example Corp", "1,234"),
        ])

        companies = parse_sheet(ws)

        self.assertEqual(companies[0]["categories"], {})

    def test_parse_sheet_skips_ambiguous_single_dot_thousands_string(self):
        # "1.234" is the dot-side mirror of the comma guard above.
        # float() used to write the 1000x-smaller value silently - the
        # same never-guess policy must apply to both separators.
        ws = FakeWorksheet([
            ("Company", "Salary Index"),
            ("Example Corp", "1.234"),
        ])

        companies = parse_sheet(ws)

        self.assertEqual(companies[0]["categories"], {})

    def test_parse_sheet_pairs_interleaved_count_index_columns_by_name(self):
        ws = FakeWorksheet([
            ("Company", "Women Count", "Men Count", "Women Index", "Men Index"),
            ("Example Corp", 15, 20, 95.0, 108.0),
        ])

        companies = parse_sheet(ws)

        categories = companies[0]["categories"]
        self.assertEqual(categories["women"], {"count": 15, "index": 95.0})
        self.assertEqual(categories["men"], {"count": 20, "index": 108.0})

    def test_standalone_count_column_is_stored_as_count_not_index(self):
        # A count column with no matching index column (e.g. a lone total
        # headcount) is still count data. It must not be emitted as a salary
        # index, which salary_lookup would render with a bogus "vs baseline"
        # percentage. The paired category alongside it is unaffected.
        ws = FakeWorksheet([
            ("Company", "Total Count", "IT Count", "IT Index"),
            ("Example Corp", 250, 30, 108.5),
        ])

        companies = parse_sheet(ws)

        categories = companies[0]["categories"]
        self.assertEqual(categories["total_count"], {"count": 250})
        self.assertEqual(categories["it"], {"count": 30, "index": 108.5})

    def test_parse_sheet_non_adjacent_columns_no_cross_match(self):
        ws = FakeWorksheet([
            ("Company", "Count_A", "Count_B", "Index_A", "Index_B"),
            ("Example Corp", 10, 20, 100.0, 200.0),
        ])

        companies = parse_sheet(ws)

        categories = companies[0]["categories"]
        self.assertEqual(categories["a"], {"count": 10, "index": 100.0})
        self.assertEqual(categories["b"], {"count": 20, "index": 200.0})

    def test_parse_sheet_ignores_citation_row_mentioning_company_pattern_word(self):
        # A title/source-citation row above the real header can contain a stray
        # company-pattern word ("employer") in running prose.
        # It must not be mistaken for the header: that misreads the real
        # header row as data and drops every real company's salary data.
        ws = FakeWorksheet([
            ("Salary Statistics 2025",),
            ("Source: member survey by employer and industry",),
            (),
            ("Company", "City", "All Count", "All Index"),
            ("Razorpay Pvt Ltd", "Bengaluru", 500, 108.5),
            ("Flipkart Private Limited", "Bengaluru", 200, 105.2),
        ])

        companies = parse_sheet(ws)

        self.assertEqual(len(companies), 2)
        self.assertEqual(companies[0]["company"], "Razorpay Pvt Ltd")
        self.assertEqual(companies[0]["city"], "Bengaluru")
        self.assertEqual(companies[0]["categories"]["all"], {"count": 500, "index": 108.5})
        self.assertEqual(companies[1]["company"], "Flipkart Private Limited")

    def test_parse_sheet_rejects_citation_row_with_count_word_in_same_cell(self):
        # Corroboration must come from a DIFFERENT cell than the company
        # match. A single free-text sentence can pack both a company-pattern
        # word and a count-pattern word together - same-cell corroboration
        # must not be enough, or this citation row reintroduces the bogus-header bug.
        ws = FakeWorksheet([
            ("Salary Statistics 2025",),
            ("Source: survey by employer, 1234 responses",),
            (),
            ("Company", "City", "All Count", "All Index"),
            ("Razorpay Pvt Ltd", "Bengaluru", 500, 108.5),
        ])

        companies = parse_sheet(ws)

        self.assertEqual(len(companies), 1)
        self.assertEqual(companies[0]["company"], "Razorpay Pvt Ltd")
        self.assertEqual(companies[0]["categories"]["all"], {"count": 500, "index": 108.5})

    def test_parse_sheet_falls_back_when_no_row_has_cross_cell_corroboration(self):
        # A header with only untyped salary columns (no header matches a
        # known city/count/index pattern - "Base pay"/"Bonus" don't) has
        # nothing to corroborate against in any row. The strict cross-cell
        # check must fall back to the original any-cell-mentions-company
        # rule rather than failing to find a header at all.
        ws = FakeWorksheet([
            ("Company", "Base pay 2025", "Bonus 2025"),
            ("Example Corp", 55000, 5000),
        ])

        companies = parse_sheet(ws)

        self.assertEqual(len(companies), 1)
        self.assertEqual(companies[0]["company"], "Example Corp")
        self.assertEqual(companies[0]["categories"]["base_pay_2025"], {"index": 55000.0})
        self.assertEqual(companies[0]["categories"]["bonus_2025"], {"index": 5000.0})

    def test_parse_sheet_warns_when_no_salary_columns_detected(self):
        # A header row with only company/city columns and no salary data
        # is a strong signal something is wrong (a misdetected header row,
        # or a sheet with no salary data at all) - it should be flagged,
        # not silently reported as a successful conversion.
        ws = FakeWorksheet([
            ("Company", "City"),
            ("Example Corp", "Jaipur"),
        ])

        stderr = io.StringIO()
        with redirect_stderr(stderr):
            companies = parse_sheet(ws)

        self.assertEqual(companies[0]["categories"], {})
        self.assertIn("No salary data columns detected", stderr.getvalue())


if __name__ == "__main__":
    unittest.main()


class ParseNumericCellLocaleTests(unittest.TestCase):
    # The separator that appears LAST is the decimal separator. Assuming
    # European ("." thousands, "," decimal) for every both-separator string
    # turned a US "1,234.56" into 1.23456 - a silent 1000x corruption that
    # flowed into salary_data.json and negotiation advice.

    def test_us_thousands_and_decimal_string(self):
        self.assertEqual(parse_numeric_cell("1,234.56"), 1234.56)

    def test_us_multiple_thousands_groups(self):
        self.assertEqual(parse_numeric_cell("1,234,567.89"), 1234567.89)

    def test_european_thousands_and_decimal_string(self):
        self.assertEqual(parse_numeric_cell("1.234,56"), 1234.56)

    def test_european_multiple_thousands_groups(self):
        self.assertEqual(parse_numeric_cell("1.234.567,89"), 1234567.89)


class CompoundCategoryPairingTests(unittest.TestCase):
    def test_parse_sheet_pairs_count_index_by_category_name(self):
        ws = FakeWorksheet([
            ("Company", "All Count", "All Index"),
            ("Example Corp", 12, 118.0),
        ])

        companies = parse_sheet(ws)

        self.assertEqual(
            companies[0]["categories"]["all"],
            {"count": 12, "index": 118.0},
        )

    def test_parse_sheet_sheet_level_us_locale_value(self):
        ws = FakeWorksheet([
            ("Company", "Salary Index"),
            ("Example Corp", "1,234.56"),
        ])

        companies = parse_sheet(ws)

        self.assertEqual(
            companies[0]["categories"]["salary_index"],
            {"index": 1234.56},
        )
