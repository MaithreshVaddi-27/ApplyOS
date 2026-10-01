#!/usr/bin/env python3
"""Verify that a generated PDF has the expected pages and extractable text.

Text-layer extraction tries pypdf (BSD, optional `pip install pypdf`) first,
then Poppler `pdftotext` if pypdf is missing, raises, or returns zero
extractable characters. Poppler remains the fallback.
"""

import argparse
import re
import subprocess
import sys
from pathlib import Path


class VerificationError(Exception):
    """Raised when a generated PDF does not satisfy its checks."""


def run_tool(command):
    try:
        return subprocess.run(
            command,
            check=True,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        ).stdout
    except FileNotFoundError as exc:
        raise VerificationError(
            f"required command '{command[0]}' was not found. "
            "Install pypdf (`pip install pypdf`) or poppler-utils "
            "(macOS: brew install poppler, Debian/Ubuntu: apt install poppler-utils, "
            "Windows: choco install poppler)"
        ) from exc
    except subprocess.CalledProcessError as exc:
        detail = (exc.stderr or "").strip() or (exc.stdout or "").strip()
        detail = detail or "command failed"
        raise VerificationError(f"{command[0]} could not read the PDF: {detail}") from exc


def parse_page_count(pdfinfo_output):
    match = re.search(r"^Pages:\s+(\d+)\s*$", pdfinfo_output, re.MULTILINE)
    if not match:
        raise VerificationError("pdfinfo output did not contain a page count")
    return int(match.group(1))


def normalize_text(text):
    return " ".join(text.split())


def _extract_pypdf(pdf_path):
    """Return (text, pages) or None if pypdf is unavailable, raises, or yields no text."""
    try:
        from pypdf import PdfReader
    except ImportError:
        return None
    try:
        reader = PdfReader(str(pdf_path))
        pages = len(reader.pages)
        text = "\n".join((page.extract_text() or "") for page in reader.pages)
    except Exception:
        return None
    # Harden: treat empty/degraded extraction as failure so we fall back
    if len(normalize_text(text)) == 0:
        return None
    return text, pages


def _extract_pdftotext(pdf_path):
    text = run_tool(["pdftotext", "-layout", "-enc", "UTF-8", str(pdf_path), "-"])
    # Always call pdfinfo here so the fallback path returns a page count
    # even when the caller did not request --pages (same Poppler package).
    pages = parse_page_count(run_tool(["pdfinfo", str(pdf_path)]))
    return text, pages


def extract_text_layer(pdf_path):
    """Extract ATS-readable text. Returns (text, pages, extractor_name)."""
    pypdf_result = _extract_pypdf(pdf_path)
    if pypdf_result is not None:
        text, pages = pypdf_result
        return text, pages, "pypdf"
    text, pages = _extract_pdftotext(pdf_path)
    return text, pages, "pdftotext"


def check_ats_rules(extracted_text, extractor):
    """Run automated ATS hygiene checks on the extracted text layer."""
    issues = []

    # 1. Check for replacement / garbled characters
    if "\ufffd" in extracted_text:
        issues.append("contains replacement characters (U+FFFD), indicating missing font Unicode mappings")

    # 2. Check for unresolved font CID markers
    cid_match = re.search(r"\(cid:\d+\)", extracted_text)
    if cid_match:
        issues.append(f"contains unresolved font CID markers (e.g. '{cid_match.group(0)}')")

    # 3. Check for unescaped LaTeX bracket trap or macro leaks
    if re.search(r"\\item\s*\[", extracted_text):
        issues.append("contains leaked unescaped LaTeX bullet bracket trap '\\item ['")
    macro_match = re.search(r"\\(cventry|makecvtitle|moderncvstyle|sectionstyle)\b", extracted_text)
    if macro_match:
        issues.append(f"contains raw uncompiled LaTeX macro '\\{macro_match.group(1)}'")

    # 4. Check for contact info: email
    has_email = bool(re.search(r"[\w\.-]+@[\w\.-]+\.\w+|\[your\.email@example\.com\]", extracted_text))
    if not has_email:
        issues.append("missing recognizable email address in extractable text layer")

    # 5. Check for phone number (supporting +91 India, international prefixes, or standard digits)
    has_phone = bool(re.search(r"(?:\+[0-9X]{1,3}[\s-]?)?\(?[0-9X]{2,5}\)?[\s.-]?[0-9X]{2,5}[\s.-]?[0-9X]{2,5}|\[\+XX[^\]]+\]", extracted_text))
    if not has_phone:
        issues.append("missing recognizable phone number in extractable text layer")

    # 6. Check for standard ATS section headings
    standard_sections = [
        "experience", "erfaring", "experiencia",
        "education", "uddannelse", "educaci",
        "skill", "competenc", "f\u00e6rdighed",
        "project", "projekt"
    ]
    lowered = extracted_text.lower()
    matched_sections = [s for s in standard_sections if s in lowered]
    if len(matched_sections) < 2:
        issues.append("fewer than 2 standard ATS section headings detected (e.g., Experience, Education, Skills, Projects)")

    if issues:
        detail = "; ".join(issues)
        raise VerificationError(f"ATS parseability check failed: {detail} (extractor: {extractor})")


def verify_pdf(pdf_path, expected_pages=None, min_chars=1, required_text=(), dump_text=None, check_ats=False):
    pdf_path = Path(pdf_path)
    if not pdf_path.is_file():
        raise VerificationError(f"PDF does not exist: {pdf_path}")

    extracted_text, actual_pages, extractor = extract_text_layer(pdf_path)

    # Write dump *before* the checks so a failed verification still leaves a .txt
    if dump_text is not None:
        dump_path = Path(dump_text)
        try:
            dump_path.parent.mkdir(parents=True, exist_ok=True)
            dump_path.write_text(
                extracted_text if extracted_text.endswith("\n") else extracted_text + "\n",
                encoding="utf-8",
            )
        except OSError as exc:
            raise VerificationError(
                f"could not write --dump-text to {dump_path}: {exc}"
            ) from exc

    if expected_pages is not None and actual_pages != expected_pages:
        raise VerificationError(
            f"expected {expected_pages} page(s), found {actual_pages} (extractor: {extractor})"
        )

    normalized = normalize_text(extracted_text)
    if len(normalized) < min_chars:
        raise VerificationError(
            f"text layer has {len(normalized)} character(s); expected at least {min_chars} "
            f"(extractor: {extractor})"
        )

    for required in required_text:
        if normalize_text(required) not in normalized:
            raise VerificationError(
                f"text layer is missing required text: {required!r} (extractor: {extractor})"
            )

    if check_ats:
        check_ats_rules(extracted_text, extractor)

    return extractor, extracted_text, actual_pages


def build_parser():
    parser = argparse.ArgumentParser(
        description="Verify a PDF's page count and ATS-readable text layer."
    )
    parser.add_argument("pdf", type=Path, help="PDF file to verify")
    parser.add_argument("--pages", type=int, help="required exact page count")
    parser.add_argument(
        "--min-chars",
        type=int,
        default=1,
        help="minimum non-whitespace text-layer characters (default: 1)",
    )
    parser.add_argument(
        "--contains",
        action="append",
        default=[],
        help="text that must appear after whitespace normalization; repeatable",
    )
    parser.add_argument(
        "--dump-text",
        type=Path,
        help="write the extracted text layer to this path (UTF-8)",
    )
    parser.add_argument(
        "--check-ats",
        action="store_true",
        help="run automated ATS hygiene checks (clean fonts, email, phone, standard section headers, no macro leaks)",
    )
    return parser


def main(argv=None):
    args = build_parser().parse_args(argv)
    try:
        extractor, text, pages = verify_pdf(
            args.pdf,
            args.pages,
            args.min_chars,
            args.contains,
            dump_text=args.dump_text,
            check_ats=args.check_ats,
        )
    except VerificationError as exc:
        print(f"Error: {args.pdf}: {exc}", file=sys.stderr)
        return 1
    print(f"Verified {args.pdf} (extractor: {extractor}, pages: {pages})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
