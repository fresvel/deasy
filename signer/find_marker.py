import sys

import pdfplumber


def find_all_marker_coordinates(pdf_path: str, pattern: str):
    matches = []
    with pdfplumber.open(pdf_path) as pdf:
        for page_number, page in enumerate(pdf.pages, start=1):
            words = page.extract_words(use_text_flow=True)

            for word in words:
                if pattern in word["text"]:
                    x0 = word["x0"]
                    bottom = word.get("bottom", word["top"])
                    page_height = page.height
                    y_pdf = page_height - bottom - 6
                    matches.append(
                        {
                            "page": page_number,
                            "x": int(x0),
                            "y": int(y_pdf),
                        }
                    )
    return matches


def find_marker_coordinates(pdf_path: str, pattern: str):
    matches = find_all_marker_coordinates(pdf_path, pattern)
    return matches[0] if matches else None


def main():
    if len(sys.argv) < 3:
        print("Usage: python3 find_marker.py <pdf_path> <token>")
        sys.exit(1)

    result = find_marker_coordinates(sys.argv[1], sys.argv[2])
    if result is None:
        print("NOT_FOUND")
        return

    print(f"{result['page']},{result['x']},{result['y']}")


if __name__ == "__main__":
    main()
