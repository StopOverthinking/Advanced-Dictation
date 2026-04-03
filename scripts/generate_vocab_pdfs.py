from __future__ import annotations

import argparse
import hashlib
import json
import random
from pathlib import Path
from xml.sax.saxutils import escape

import fitz
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4, A5, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph


ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "vocabularies.txt"
OUTPUT_DIR = ROOT / "output" / "pdf"
TMP_DIR = ROOT / "tmp" / "pdfs"

ORDERED_PDF = OUTPUT_DIR / "vocab-a5-ordered.pdf"
BOOKLET_PDF = OUTPUT_DIR / "vocab-a4-booklet.pdf"
DICTATION_WORKSHEET_PDF = OUTPUT_DIR / "dictation-a4-shuffled.pdf"
DICTATION_ANSWER_KEY_PDF = OUTPUT_DIR / "dictation-a4-answer-key.pdf"
DICTATION_ORDER_MAP = OUTPUT_DIR / "dictation-order-map.json"

FONT_REGULAR = "MalgunGothic"
FONT_BOLD = "MalgunGothicBold"
FONT_PATH_REGULAR = Path(r"C:\Windows\Fonts\malgun.ttf")
FONT_PATH_BOLD = Path(r"C:\Windows\Fonts\malgunbd.ttf")

VOCAB_PAGE_WIDTH, VOCAB_PAGE_HEIGHT = A5
BOOKLET_PAGE_WIDTH, BOOKLET_PAGE_HEIGHT = landscape(A4)
DICT_PAGE_WIDTH, DICT_PAGE_HEIGHT = A4

VOCAB_TOP_MARGIN = 24
VOCAB_BOTTOM_MARGIN = 16
VOCAB_OUTER_MARGIN = 32
VOCAB_INNER_MARGIN = 36
VOCAB_ENTRY_PADDING_X = 14
VOCAB_ENTRY_PADDING_TOP = 10
VOCAB_ENTRY_PADDING_BOTTOM = 10
VOCAB_ENTRY_SPACING = 8
TEXT_GAP_SMALL = 4
TEXT_GAP_MEDIUM = 5
ROUNDING = 8
VOCAB_SET_TITLE_FONT_SIZE = 14
VOCAB_SET_TITLE_GAP = 8
ENTRIES_PER_VOCAB_PAGE = 5

DICT_MARGIN_X = 44
DICT_TOP_MARGIN = 42
DICT_BOTTOM_MARGIN = 34
DICT_HEADER_HEIGHT = 78
DICT_BOX_GAP = 8
DICT_NUMBERS_PER_PAGE = 10
DICT_BOX_ROUNDING = 10
DICT_LINE_GAP = 18

COLOR_NAVY = colors.HexColor("#24344D")
COLOR_GOLD = colors.HexColor("#D7A35C")
COLOR_ROSE = colors.HexColor("#D48A73")
COLOR_SAGE = colors.HexColor("#A9B59D")
COLOR_MUTED = colors.HexColor("#6E6258")
COLOR_SOFT_BG = colors.HexColor("#F4EFE7")
COLOR_PANEL = colors.HexColor("#FFFDF8")
COLOR_HEADER_FILL = colors.HexColor("#F3F6F1")
COLOR_ENTRY_BORDER = colors.HexColor("#D9D9D9")
COLOR_LIGHT_LINE = colors.HexColor("#C8D0D9")
COLOR_BOX_FILL = colors.HexColor("#FCFBF8")

WORD_STYLE = ParagraphStyle(
    "word",
    fontName=FONT_BOLD,
    fontSize=13.4,
    leading=15.2,
    alignment=TA_LEFT,
    textColor=COLOR_NAVY,
    wordWrap="CJK",
)

DEF_STYLE = ParagraphStyle(
    "definition",
    fontName=FONT_REGULAR,
    fontSize=9.2,
    leading=12.0,
    alignment=TA_LEFT,
    textColor=colors.HexColor("#2E2B28"),
    wordWrap="CJK",
)

EX_STYLE = ParagraphStyle(
    "example",
    fontName=FONT_REGULAR,
    fontSize=8.8,
    leading=11.4,
    alignment=TA_LEFT,
    textColor=COLOR_MUTED,
    wordWrap="CJK",
)

COVER_TITLE_STYLE = ParagraphStyle(
    "cover_title",
    fontName=FONT_BOLD,
    fontSize=24,
    leading=30,
    alignment=TA_CENTER,
    textColor=COLOR_NAVY,
    wordWrap="CJK",
)

COVER_SUBTITLE_STYLE = ParagraphStyle(
    "cover_subtitle",
    fontName=FONT_REGULAR,
    fontSize=10.4,
    leading=14,
    alignment=TA_CENTER,
    textColor=COLOR_MUTED,
)

ANSWER_KEY_STYLE = ParagraphStyle(
    "answer_key",
    fontName=FONT_REGULAR,
    fontSize=11,
    leading=15,
    alignment=TA_LEFT,
    textColor=colors.HexColor("#2E2B28"),
    wordWrap="CJK",
)


def register_fonts() -> None:
    if FONT_REGULAR not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont(FONT_REGULAR, str(FONT_PATH_REGULAR)))
    if FONT_BOLD not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont(FONT_BOLD, str(FONT_PATH_BOLD)))


def load_data() -> dict[str, list[dict[str, str]]]:
    return json.loads(DATA_PATH.read_text(encoding="utf-8"))


def select_sets(
    data: dict[str, list[dict[str, str]]],
    set_limit: int | None = None,
) -> list[tuple[str, list[dict[str, str]]]]:
    selected_sets = list(data.items())
    if set_limit is not None:
        selected_sets = selected_sets[:set_limit]
    return selected_sets


def load_entries(set_limit: int | None = None) -> list[dict[str, str]]:
    data = load_data()
    entries: list[dict[str, str]] = []
    for set_name, items in select_sets(data, set_limit):
        for item in items:
            entries.append(
                {
                    "set": set_name,
                    "word": item["word"].strip(),
                    "definition": item["definition"].strip(),
                    "example": item["example"].strip(),
                }
            )
    return entries


def build_paragraph(
    text: str,
    style: ParagraphStyle,
    width: float,
    page_height: float,
) -> tuple[Paragraph, float]:
    para = Paragraph(text, style)
    _, height = para.wrap(width, page_height)
    return para, height


def format_set_label(set_name: str) -> str:
    return f"{set_name.removeprefix('set')}세트"


def chunked(items: list[dict[str, str]], size: int) -> list[list[dict[str, str]]]:
    return [items[index : index + size] for index in range(0, len(items), size)]


def build_vocab_pages(entries: list[dict[str, str]]) -> list[dict[str, object]]:
    grouped_entries: dict[str, list[dict[str, str]]] = {}
    for entry in entries:
        grouped_entries.setdefault(entry["set"], []).append(entry)

    pages: list[dict[str, object]] = [{"type": "cover"}]
    content_page_number = 1

    for set_name, set_entries in grouped_entries.items():
        for page_entries in chunked(set_entries, ENTRIES_PER_VOCAB_PAGE):
            pages.append(
                {
                    "type": "set",
                    "set": set_name,
                    "entries": page_entries,
                    "display_page": content_page_number,
                }
            )
            content_page_number += 1

    pages.append({"type": "back_cover"})
    return pages


def draw_vocab_cover(pdf: canvas.Canvas) -> None:
    panel_x = 60
    panel_y = 58
    panel_width = VOCAB_PAGE_WIDTH - 120
    panel_height = VOCAB_PAGE_HEIGHT - 116
    content_x = panel_x + 26
    content_width = panel_width - 52

    pdf.setFillColor(COLOR_SOFT_BG)
    pdf.rect(0, 0, VOCAB_PAGE_WIDTH, VOCAB_PAGE_HEIGHT, fill=1, stroke=0)

    pdf.setFillColor(COLOR_SAGE)
    pdf.circle(-14, VOCAB_PAGE_HEIGHT - 38, 74, stroke=0, fill=1)
    pdf.setFillColor(COLOR_ROSE)
    pdf.circle(VOCAB_PAGE_WIDTH - 34, 72, 54, stroke=0, fill=1)
    pdf.setFillColor(COLOR_GOLD)
    pdf.circle(VOCAB_PAGE_WIDTH - 76, VOCAB_PAGE_HEIGHT - 92, 24, stroke=0, fill=1)

    pdf.setFillColor(COLOR_NAVY)
    pdf.roundRect(34, 42, 18, VOCAB_PAGE_HEIGHT - 84, 9, stroke=0, fill=1)

    pdf.setFillColor(COLOR_PANEL)
    pdf.roundRect(panel_x, panel_y, panel_width, panel_height, 18, stroke=0, fill=1)
    pdf.setStrokeColor(COLOR_NAVY)
    pdf.setLineWidth(1.2)
    pdf.roundRect(panel_x, panel_y, panel_width, panel_height, 18, stroke=1, fill=0)

    pdf.setStrokeColor(COLOR_GOLD)
    pdf.setLineWidth(1.3)
    divider_y = panel_y + panel_height - 72
    pdf.line(content_x + 24, divider_y, content_x + 104, divider_y)
    pdf.line(content_x + content_width - 104, divider_y, content_x + content_width - 24, divider_y)

    title, title_h = build_paragraph(
        "심화 받아쓰기 어휘장",
        COVER_TITLE_STYLE,
        content_width,
        VOCAB_PAGE_HEIGHT,
    )
    subtitle, subtitle_h = build_paragraph(
        "Advanced Dictation Vocabulary Booklet",
        COVER_SUBTITLE_STYLE,
        content_width,
        VOCAB_PAGE_HEIGHT,
    )

    title_y = panel_y + (panel_height * 0.58)
    title.drawOn(pdf, content_x, title_y - title_h)
    subtitle.drawOn(pdf, content_x, title_y - title_h - subtitle_h - 14)


def draw_vocab_back_cover(pdf: canvas.Canvas) -> None:
    pdf.setFillColor(colors.white)
    pdf.rect(0, 0, VOCAB_PAGE_WIDTH, VOCAB_PAGE_HEIGHT, fill=1, stroke=0)


def draw_vocab_entry(
    pdf: canvas.Canvas,
    entry: dict[str, str],
    x: float,
    top_y: float,
    width: float,
    box_height: float,
) -> float:
    content_width = width - (VOCAB_ENTRY_PADDING_X * 2)
    word_para, word_h = build_paragraph(entry["word"], WORD_STYLE, content_width, VOCAB_PAGE_HEIGHT)
    def_para, def_h = build_paragraph(entry["definition"], DEF_STYLE, content_width, VOCAB_PAGE_HEIGHT)
    ex_para, ex_h = build_paragraph(
        f'"{entry["example"]}"',
        EX_STYLE,
        content_width,
        VOCAB_PAGE_HEIGHT,
    )
    natural_height = (
        VOCAB_ENTRY_PADDING_TOP
        + word_h
        + TEXT_GAP_SMALL
        + def_h
        + TEXT_GAP_MEDIUM
        + ex_h
        + VOCAB_ENTRY_PADDING_BOTTOM
    )
    actual_box_height = max(box_height, natural_height)

    bottom_y = top_y - actual_box_height
    pdf.setFillColor(colors.white)
    pdf.setStrokeColor(COLOR_ENTRY_BORDER)
    pdf.setLineWidth(0.75)
    pdf.roundRect(x, bottom_y, width, actual_box_height, ROUNDING, stroke=1, fill=1)

    extra_vertical = max(0, actual_box_height - natural_height)
    text_x = x + VOCAB_ENTRY_PADDING_X
    cursor_y = top_y - VOCAB_ENTRY_PADDING_TOP - (extra_vertical / 2)
    word_para.drawOn(pdf, text_x, cursor_y - word_h)
    cursor_y -= word_h + TEXT_GAP_SMALL
    def_para.drawOn(pdf, text_x, cursor_y - def_h)
    cursor_y -= def_h + TEXT_GAP_MEDIUM
    ex_para.drawOn(pdf, text_x, cursor_y - ex_h)
    return actual_box_height


def draw_vocab_set_page(pdf: canvas.Canvas, page: dict[str, object], page_index: int) -> None:
    left_margin = VOCAB_INNER_MARGIN if page_index % 2 == 0 else VOCAB_OUTER_MARGIN
    right_margin = VOCAB_OUTER_MARGIN if page_index % 2 == 0 else VOCAB_INNER_MARGIN
    box_width = VOCAB_PAGE_WIDTH - left_margin - right_margin
    cursor_y = VOCAB_PAGE_HEIGHT - VOCAB_TOP_MARGIN
    title_block_height = VOCAB_SET_TITLE_FONT_SIZE + VOCAB_SET_TITLE_GAP + 14
    available_entry_height = (
        VOCAB_PAGE_HEIGHT - VOCAB_TOP_MARGIN - VOCAB_BOTTOM_MARGIN - title_block_height
    )
    box_height = (
        available_entry_height - (VOCAB_ENTRY_SPACING * (ENTRIES_PER_VOCAB_PAGE - 1))
    ) / ENTRIES_PER_VOCAB_PAGE

    pdf.setFillColor(colors.white)
    pdf.rect(0, 0, VOCAB_PAGE_WIDTH, VOCAB_PAGE_HEIGHT, fill=1, stroke=0)

    header_y = cursor_y - 16
    header_height = 22
    header_width = min(118, box_width * 0.5)
    pdf.setFillColor(COLOR_HEADER_FILL)
    pdf.roundRect(left_margin, header_y, header_width, header_height, 8, stroke=0, fill=1)
    pdf.setStrokeColor(COLOR_NAVY)
    pdf.setLineWidth(0.7)
    pdf.roundRect(left_margin, header_y, header_width, header_height, 8, stroke=1, fill=0)

    pdf.setFont(FONT_BOLD, VOCAB_SET_TITLE_FONT_SIZE)
    pdf.setFillColor(COLOR_NAVY)
    pdf.drawString(left_margin + 10, header_y + 6, format_set_label(str(page["set"])))
    cursor_y -= title_block_height

    for idx, entry in enumerate(page["entries"]):
        if idx > 0:
            cursor_y -= VOCAB_ENTRY_SPACING
        used_box_height = draw_vocab_entry(pdf, entry, left_margin, cursor_y, box_width, box_height)
        cursor_y -= used_box_height

    pdf.setFont(FONT_REGULAR, 8)
    pdf.setFillColor(COLOR_NAVY)
    pdf.drawCentredString(VOCAB_PAGE_WIDTH / 2, 12, str(page["display_page"]))


def create_ordered_pdf(entries: list[dict[str, str]]) -> int:
    pages = build_vocab_pages(entries)
    pdf = canvas.Canvas(str(ORDERED_PDF), pagesize=A5)
    pdf.setTitle("심화 받아쓰기 어휘장")
    pdf.setAuthor("OpenAI Codex")
    pdf.setSubject("A5 printable vocabulary book")

    for page_index, page in enumerate(pages):
        page_type = page["type"]
        if page_type == "cover":
            draw_vocab_cover(pdf)
        elif page_type == "back_cover":
            draw_vocab_back_cover(pdf)
        else:
            draw_vocab_set_page(pdf, page, page_index)
        pdf.showPage()

    pdf.save()
    return len(pages)


def booklet_pairs(page_count: int) -> list[tuple[int, int]]:
    pairs: list[tuple[int, int]] = []
    left = page_count
    right = 1

    while right < left:
        pairs.append((left, right))
        pairs.append((right + 1, left - 1))
        left -= 2
        right += 2

    return pairs


def create_booklet_pdf(ordered_page_count: int) -> int:
    blank_count = (4 - (ordered_page_count % 4)) % 4
    total_pages = ordered_page_count + blank_count
    ordered_doc = fitz.open(ORDERED_PDF)
    booklet_doc = fitz.open()

    for left_num, right_num in booklet_pairs(total_pages):
        sheet = booklet_doc.new_page(width=BOOKLET_PAGE_WIDTH, height=BOOKLET_PAGE_HEIGHT)

        if left_num <= ordered_page_count:
            sheet.show_pdf_page(
                fitz.Rect(0, 0, VOCAB_PAGE_WIDTH, VOCAB_PAGE_HEIGHT),
                ordered_doc,
                left_num - 1,
            )

        if right_num <= ordered_page_count:
            sheet.show_pdf_page(
                fitz.Rect(VOCAB_PAGE_WIDTH, 0, BOOKLET_PAGE_WIDTH, VOCAB_PAGE_HEIGHT),
                ordered_doc,
                right_num - 1,
            )

    booklet_doc.save(BOOKLET_PDF)
    booklet_doc.close()
    ordered_doc.close()
    return total_pages


def stable_seed(text: str) -> int:
    digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
    return int(digest[:16], 16)


def load_dictation_sets(
    set_limit: int | None = None,
    shuffle_seed: str = "advanced-dictation",
) -> tuple[list[dict[str, object]], dict[str, object]]:
    data = load_data()
    pages: list[dict[str, object]] = []
    order_map: dict[str, object] = {"seed": shuffle_seed, "sets": {}}

    for page_number, (set_name, items) in enumerate(select_sets(data, set_limit), start=1):
        entries = [
            {
                "word": item["word"].strip(),
                "dictation": item["dictation"].strip(),
            }
            for item in items
        ]
        rng = random.Random(stable_seed(f"{shuffle_seed}:{set_name}"))
        shuffled_entries = entries[:]
        rng.shuffle(shuffled_entries)

        numbered_entries: list[dict[str, object]] = []
        order_entries: list[dict[str, object]] = []
        for index, entry in enumerate(shuffled_entries, start=1):
            numbered_entry = {
                "number": index,
                "word": entry["word"],
                "dictation": entry["dictation"],
            }
            numbered_entries.append(numbered_entry)
            order_entries.append(numbered_entry)

        pages.append(
            {
                "set": set_name,
                "entries": numbered_entries,
                "display_page": page_number,
            }
        )
        order_map["sets"][set_name] = order_entries

    return pages, order_map


def draw_dictation_header(pdf: canvas.Canvas, set_name: str, page_number: int, total_pages: int) -> float:
    top_y = DICT_PAGE_HEIGHT - DICT_TOP_MARGIN
    left_x = DICT_MARGIN_X
    right_x = DICT_PAGE_WIDTH - DICT_MARGIN_X

    pdf.setFillColor(colors.white)
    pdf.rect(0, 0, DICT_PAGE_WIDTH, DICT_PAGE_HEIGHT, fill=1, stroke=0)

    pdf.setStrokeColor(COLOR_NAVY)
    pdf.setLineWidth(1.8)
    pdf.line(left_x, top_y, right_x, top_y)

    pdf.setFont(FONT_BOLD, 18)
    pdf.setFillColor(COLOR_NAVY)
    pdf.drawString(left_x, top_y - 26, "받아쓰기")

    pdf.setFont(FONT_REGULAR, 9.5)
    pdf.setFillColor(COLOR_MUTED)
    pdf.drawString(left_x, top_y - 41, "들려주는 문장을 듣고 문장 전체를 정확하게 적어 보세요.")

    set_badge_width = 72
    set_badge_height = 22
    badge_y = top_y - 63
    pdf.setFillColor(COLOR_HEADER_FILL)
    pdf.roundRect(left_x, badge_y, set_badge_width, set_badge_height, 8, stroke=0, fill=1)
    pdf.setStrokeColor(COLOR_NAVY)
    pdf.setLineWidth(0.8)
    pdf.roundRect(left_x, badge_y, set_badge_width, set_badge_height, 8, stroke=1, fill=0)

    pdf.setFillColor(COLOR_NAVY)
    pdf.setFont(FONT_BOLD, 11.5)
    pdf.drawCentredString(left_x + (set_badge_width / 2), badge_y + 6.5, format_set_label(set_name))

    meta_y = top_y - 29
    pdf.setFont(FONT_REGULAR, 10)
    pdf.setFillColor(COLOR_MUTED)
    pdf.drawRightString(right_x, meta_y, "날짜 ____________________")
    pdf.drawRightString(right_x, meta_y - 22, "이름 ____________________")
    pdf.drawRightString(right_x, badge_y + 7, f"{page_number} / {total_pages}")

    return DICT_PAGE_HEIGHT - DICT_TOP_MARGIN - DICT_HEADER_HEIGHT


def draw_dictation_box(
    pdf: canvas.Canvas,
    number: int,
    x: float,
    top_y: float,
    width: float,
    box_height: float,
) -> None:
    bottom_y = top_y - box_height
    badge_size = 22
    line_start_x = x + 42
    line_end_x = x + width - 18

    pdf.setFillColor(COLOR_BOX_FILL)
    pdf.setStrokeColor(COLOR_ENTRY_BORDER)
    pdf.setLineWidth(0.75)
    pdf.roundRect(x, bottom_y, width, box_height, DICT_BOX_ROUNDING, stroke=1, fill=1)

    badge_x = x + 12
    badge_y = top_y - 25
    pdf.setFillColor(colors.white)
    pdf.circle(badge_x + (badge_size / 2), badge_y + (badge_size / 2), badge_size / 2, stroke=1, fill=1)
    pdf.setFillColor(COLOR_NAVY)
    pdf.setFont(FONT_BOLD, 10.5)
    pdf.drawCentredString(badge_x + (badge_size / 2), badge_y + 6.5, str(number))

    first_line_y = top_y - 24
    second_line_y = first_line_y - DICT_LINE_GAP
    pdf.setStrokeColor(COLOR_LIGHT_LINE)
    pdf.setLineWidth(0.8)
    pdf.line(line_start_x, first_line_y, line_end_x, first_line_y)
    pdf.line(line_start_x, second_line_y, line_end_x, second_line_y)

    pdf.setFillColor(COLOR_MUTED)
    pdf.setFont(FONT_REGULAR, 8.2)
    pdf.drawRightString(line_end_x, bottom_y + 10, "문장 전체를 또박또박 적기")


def create_dictation_worksheet_pdf(dictation_pages: list[dict[str, object]]) -> int:
    pdf = canvas.Canvas(str(DICTATION_WORKSHEET_PDF), pagesize=A4)
    pdf.setTitle("심화 받아쓰기 문제지")
    pdf.setAuthor("OpenAI Codex")
    pdf.setSubject("A4 dictation worksheet")

    box_width = DICT_PAGE_WIDTH - (DICT_MARGIN_X * 2)
    box_area_height = (
        DICT_PAGE_HEIGHT
        - DICT_TOP_MARGIN
        - DICT_BOTTOM_MARGIN
        - DICT_HEADER_HEIGHT
    )
    box_height = (
        box_area_height - (DICT_BOX_GAP * (DICT_NUMBERS_PER_PAGE - 1))
    ) / DICT_NUMBERS_PER_PAGE

    total_pages = len(dictation_pages)
    for page in dictation_pages:
        cursor_y = draw_dictation_header(
            pdf,
            str(page["set"]),
            int(page["display_page"]),
            total_pages,
        )
        for idx, entry in enumerate(page["entries"]):
            if idx > 0:
                cursor_y -= DICT_BOX_GAP
            draw_dictation_box(
                pdf,
                int(entry["number"]),
                DICT_MARGIN_X,
                cursor_y,
                box_width,
                box_height,
            )
            cursor_y -= box_height
        pdf.showPage()

    pdf.save()
    return total_pages


def draw_answer_key_page(
    pdf: canvas.Canvas,
    page: dict[str, object],
    page_number: int,
    total_pages: int,
) -> None:
    left_x = DICT_MARGIN_X
    right_x = DICT_PAGE_WIDTH - DICT_MARGIN_X
    top_y = DICT_PAGE_HEIGHT - DICT_TOP_MARGIN

    pdf.setFillColor(colors.white)
    pdf.rect(0, 0, DICT_PAGE_WIDTH, DICT_PAGE_HEIGHT, fill=1, stroke=0)

    pdf.setStrokeColor(COLOR_NAVY)
    pdf.setLineWidth(1.8)
    pdf.line(left_x, top_y, right_x, top_y)

    pdf.setFillColor(COLOR_NAVY)
    pdf.setFont(FONT_BOLD, 17)
    pdf.drawString(left_x, top_y - 24, "받아쓰기 정답")

    pdf.setFont(FONT_REGULAR, 10)
    pdf.setFillColor(COLOR_MUTED)
    pdf.drawString(left_x, top_y - 42, format_set_label(str(page["set"])))
    pdf.drawRightString(right_x, top_y - 42, f"{page_number} / {total_pages}")

    text_width = DICT_PAGE_WIDTH - (DICT_MARGIN_X * 2)
    cursor_y = top_y - 68

    for entry in page["entries"]:
        sentence = escape(str(entry["dictation"]))
        word = escape(str(entry["word"]))
        paragraph_text = f"<b>{entry['number']}.</b> {sentence}<br/><font color='#6E6258'>핵심어: {word}</font>"
        para, para_h = build_paragraph(paragraph_text, ANSWER_KEY_STYLE, text_width, DICT_PAGE_HEIGHT)

        block_height = para_h + 12
        if cursor_y - block_height < DICT_BOTTOM_MARGIN:
            pdf.showPage()
            top_y = DICT_PAGE_HEIGHT - DICT_TOP_MARGIN
            pdf.setFillColor(colors.white)
            pdf.rect(0, 0, DICT_PAGE_WIDTH, DICT_PAGE_HEIGHT, fill=1, stroke=0)
            pdf.setStrokeColor(COLOR_NAVY)
            pdf.setLineWidth(1.8)
            pdf.line(left_x, top_y, right_x, top_y)
            pdf.setFillColor(COLOR_NAVY)
            pdf.setFont(FONT_BOLD, 17)
            pdf.drawString(left_x, top_y - 24, "받아쓰기 정답")
            pdf.setFont(FONT_REGULAR, 10)
            pdf.setFillColor(COLOR_MUTED)
            pdf.drawString(left_x, top_y - 42, f"{format_set_label(str(page['set']))} (계속)")
            cursor_y = top_y - 68

        para.drawOn(pdf, left_x, cursor_y - para_h)
        cursor_y -= block_height


def create_dictation_answer_key_pdf(dictation_pages: list[dict[str, object]]) -> int:
    pdf = canvas.Canvas(str(DICTATION_ANSWER_KEY_PDF), pagesize=A4)
    pdf.setTitle("심화 받아쓰기 정답")
    pdf.setAuthor("OpenAI Codex")
    pdf.setSubject("A4 dictation answer key")

    total_pages = len(dictation_pages)
    for page_number, page in enumerate(dictation_pages, start=1):
        draw_answer_key_page(pdf, page, page_number, total_pages)
        pdf.showPage()

    pdf.save()
    return total_pages


def write_dictation_order_map(order_map: dict[str, object]) -> None:
    DICTATION_ORDER_MAP.write_text(
        json.dumps(order_map, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate vocabulary and dictation PDFs for the vocabulary sets."
    )
    parser.add_argument(
        "--set-limit",
        type=int,
        default=None,
        help="Only include the first N sets from vocabularies.txt.",
    )
    parser.add_argument(
        "--shuffle-seed",
        default="advanced-dictation",
        help="Seed text used to deterministically shuffle dictation items within each set.",
    )
    output_group = parser.add_mutually_exclusive_group()
    output_group.add_argument(
        "--dictation-only",
        action="store_true",
        help="Only generate the dictation worksheet, answer key, and order map.",
    )
    output_group.add_argument(
        "--vocab-only",
        action="store_true",
        help="Only generate the existing vocabulary booklet PDFs.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    register_fonts()

    if not args.dictation_only:
        entries = load_entries(set_limit=args.set_limit)
        ordered_pages = create_ordered_pdf(entries)
        booklet_total_pages = create_booklet_pdf(ordered_pages)
        print(f"entries={len(entries)}")
        print(f"ordered_pages={ordered_pages}")
        print(f"booklet_total_pages={booklet_total_pages}")
        print(f"ordered_pdf={ORDERED_PDF}")
        print(f"booklet_pdf={BOOKLET_PDF}")

    if not args.vocab_only:
        dictation_pages, order_map = load_dictation_sets(
            set_limit=args.set_limit,
            shuffle_seed=args.shuffle_seed,
        )
        worksheet_pages = create_dictation_worksheet_pdf(dictation_pages)
        answer_key_pages = create_dictation_answer_key_pdf(dictation_pages)
        write_dictation_order_map(order_map)
        print(f"dictation_set_count={len(dictation_pages)}")
        print(f"dictation_shuffle_seed={args.shuffle_seed}")
        print(f"dictation_worksheet_pages={worksheet_pages}")
        print(f"dictation_answer_key_pages={answer_key_pages}")
        print(f"dictation_pdf={DICTATION_WORKSHEET_PDF}")
        print(f"dictation_answer_key_pdf={DICTATION_ANSWER_KEY_PDF}")
        print(f"dictation_order_map={DICTATION_ORDER_MAP}")

    print(f"set_limit={args.set_limit}")


if __name__ == "__main__":
    main()
