-- Filtro de Pandoc: adapta el AST de `arquitectura-deasy.tex` a las convenciones de Starlight.
--
-- Corre DESPUES del pre-procesador (`pre-tex.pl`) y DENTRO de pandoc, sobre el arbol ya
-- parseado. Esa es la diferencia que importa: aqui los nodos estan TIPADOS, asi que se puede
-- tocar el codigo en linea (`Code`) sin rozar los bloques (`CodeBlock`).
--
-- Un `sed` sobre el Markdown de salida no puede hacer esa distincion: los 15 diagramas ASCII
-- estan llenos de `|`, `---`, `-->` y `+--`, y cualquier regla de arreglo entraria ahi y
-- destrozaria justo lo que estamos rescatando.

local TIPO = { concepto = "tip", aviso = "caution", nota = "note" }

local n_asides, n_diagramas, n_divs, n_code = 0, 0, 0, 0

-- ── Cajas -> asides de Starlight ────────────────────────────────────────────────────────
-- `pre-tex.pl` bajo el titulo al cuerpo como \textbf{...} porque pandoc descarta el argumento
-- opcional de un entorno que no conoce. Aqui lo volvemos a subir a `:::caution[Titulo]`.
function Div(el)
  -- Los 25 <div class="center"> son maquetacion del PDF: fuera, dejando el contenido.
  if el.classes:includes("center") then
    n_divs = n_divs + 1
    return el.content
  end

  local tipo = TIPO[el.classes[1]]
  if not tipo then return nil end

  local cuerpo = pandoc.List(el.content)
  local titulo = ""
  local primero = cuerpo[1]
  if primero and primero.t == "Para" and #primero.content == 1
     and primero.content[1].t == "Strong" then
    titulo = pandoc.write(
      pandoc.Pandoc({ pandoc.Plain(primero.content[1].content) }), "gfm"
    ):gsub("%s+$", "")
    -- Starlight parsea la etiqueta de la directiva como Markdown en linea, pero los
    -- backticks dentro de `:::caution[...]` no siempre sobreviven: se quitan.
    titulo = titulo:gsub("`", "")
    cuerpo:remove(1)
  end

  local abre = titulo ~= "" and (":::" .. tipo .. "[" .. titulo .. "]") or (":::" .. tipo)
  local salida = pandoc.List({ pandoc.RawBlock("markdown", abre) })
  salida:extend(cuerpo)
  -- El \n final NO es cosmetico: sin el, dos asides seguidos salen pegados
  -- (`:::` y `:::caution[...]` en lineas contiguas) y MDX no lo acepta.
  salida:insert(pandoc.RawBlock("markdown", ":::\n"))
  n_asides = n_asides + 1
  return salida
end

-- ── Deshacer las ligaduras DENTRO de codigo en linea ────────────────────────────────────
-- `--` -> `–` y `---` -> `—` son ligaduras de LaTeX, no la extension `smart`, asi que se
-- aplican tambien dentro de \rt{}. Rompen `node --check`, `--ff-only`, `--keep-db`,
-- `--test-concurrency=1` y el marcador de comentario SQL `--`.
-- Desactivar `smart` NO lo arregla (y encima rompe las comillas): hay que deshacerlo aqui.
function Code(el)
  local antes = el.text
  el.text = el.text:gsub("\u{2014}", "---"):gsub("\u{2013}", "--")
  if el.text ~= antes then n_code = n_code + 1 end
  return el
end

-- ── Marcar los 15 diagramas ─────────────────────────────────────────────────────────────
-- Son los unicos CodeBlock SIN clase de todo el documento: los otros 11 llevan `language=`.
-- Ese es el identificador mecanico. El ancla es el marcador de progreso de la conversion a
-- Mermaid: mientras quede una, hay diagramas sin convertir.
function CodeBlock(el)
  if #el.classes == 0 then
    n_diagramas = n_diagramas + 1
    el.classes = { "text" }
    return {
      pandoc.RawBlock("markdown",
        string.format("<!-- diagrama %02d: PENDIENTE de pasar a Mermaid -->", n_diagramas)),
      el,
    }
  end
end

-- \textsc{Deasy} -> texto plano; el versalita es del PDF.
function Span(el)
  if el.classes:includes("smallcaps") then return el.content end
end

function Pandoc(doc)
  io.stderr:write(string.format(
    "  asides tipados   : %d\n  diagramas anclados: %d\n  divs .center fuera: %d\n  codigos reparados : %d\n",
    n_asides, n_diagramas, n_divs, n_code))
  return doc
end
