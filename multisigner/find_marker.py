import pdfplumber
import sys

PDF = sys.argv[1]
PATTERN = "!-1804326534-!"

with pdfplumber.open(PDF) as pdf:
    for page_number, page in enumerate(pdf.pages, start=1):
        words = page.extract_words(use_text_flow=True)

        for w in words:
            if PATTERN in w["text"]:
                x0 = w["x0"]
                top = w["top"]
                x1 = w["x1"]
                bottom = w["bottom"]

                # Convertir a coordenadas PDF (origen abajo-izquierda)
                page_height = page.height
                y_pdf = page_height - top + 25

                print(f"{page_number},{int(x0)},{int(y_pdf)}")
                sys.exit(0)

print("NOT_FOUND")
