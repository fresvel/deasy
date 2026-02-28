# Seed LaTeX (slides)

Seed Jinja2 para generar:
- `modes/system/jinja2/src` (plantilla fuente)
- `modes/user/latex/src` (renderizado con defaults)

Archivo de configuración:
- `defaults.yaml` (se copia como `data.yaml` al crear un template)

Notas:
- Basado en Beamer + XeLaTeX. El `make.sh` usa `-shell-escape` por `minted`.
- Requiere la fuente configurada en `defaults.yaml` (por defecto `Josefin Sans`) dentro del entorno LaTeX.
- Los contenidos viven en `src/Contenido/slides.tex.j2`.
- `show_title` controla la diapositiva de portada generada con `\titlepage`.

Uso recomendado:

```tex
\begin{frame}[fragile, plain]
\begin{core}{3}{Arquitectura de firewalld}
Contenido del frame...
\end{core}
\end{frame}
```

```tex
\begin{codeblock}[bash]{Permitir un servicio}
firewall-cmd --add-service=http --permanent
firewall-cmd --reload
\end{codeblock}
```

Nota: Beamer no permite envolver `frame` en otro entorno cuando hay contenido verbatim (`minted`). Por eso el `frame` debe quedar explícito.
