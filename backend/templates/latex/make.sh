#! /bin/bash
docker run -it --rm -v $(pwd):/workdir texlive/texlive:latest pdflatex main.tex
docker run -it --rm -v $(pwd):/workdir texlive/texlive:latest bibtex main
docker run -it --rm -v $(pwd):/workdir texlive/texlive:latest pdflatex main.tex
docker run -it --rm -v $(pwd):/workdir texlive/texlive:latest pdflatex main.tex
