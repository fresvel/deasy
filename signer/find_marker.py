import pdfplumber
import sys

if len(sys.argv) < 3:
    print("Usage: python3 find_marker.py <pdf_path> <token>")
    sys.exit(1)

PDF = sys.argv[1]
PATTERN = sys.argv[2]

with pdfplumber.open(PDF) as pdf:
    for page_number, page in enumerate(pdf.pages, start=1):
        words = page.extract_words(use_text_flow=True)

        for w in words:
            if PATTERN in w["text"]:
                x0 = w["x0"]
                top = w["top"]

                page_height = page.height
                y_pdf = page_height - top + 25

                print(f"{page_number},{int(x0)},{int(y_pdf)}")
                sys.exit(0)

print("NOT_FOUND")