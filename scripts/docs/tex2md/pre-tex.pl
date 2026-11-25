#!/usr/bin/perl
#
# Pre-procesador de `docs/arquitectura-deasy.tex` para que Pandoc no destruya el 26% del
# contenido. Se ejecuta ANTES de pandoc; su salida es un .tex temporal, nunca se escribe
# sobre el original.
#
# ── Por que hace falta ──────────────────────────────────────────────────────────────────
# Pandoc convierte este fichero SIN EMITIR UN SOLO AVISO y pierde, en silencio:
#
#   · los 15 diagramas ASCII  -> reflowados a un parrafo, con los `---` convertidos en
#                                rayas tipograficas. Irreversible.
#   · las 21 tablas           -> la especificacion de columnas se filtra como texto
#                                (`@P4.2cmP3.1cmL@`) y los `&` quedan literales.
#   · las 40 cajas            -> las tres (concepto/aviso/nota) colapsan al mismo div.
#
# El fallo silencioso es lo peligroso: parece que ha funcionado.
#
# ── Por que AQUI y no con sed sobre el Markdown de salida ───────────────────────────────
# Porque el Markdown de salida contiene 15 bloques ASCII llenos de `|`, `---`, `-->` y `+--`.
# Cualquier sed que arregle flechas o guiones en la prosa entraria tambien ahi y destrozaria
# justo lo que estamos rescatando. Aqui, en cambio, sabemos que hay dentro de cada entorno.
#
# El resto del dano (ligaduras dentro de codigo, divs de ruido, tipado de las cajas) se
# arregla en `starlight.lua`, sobre el AST, donde los nodos estan tipados.

use strict;
use warnings;
use utf8;
binmode(STDIN,  ':encoding(UTF-8)');
binmode(STDOUT, ':encoding(UTF-8)');
binmode(STDERR, ':encoding(UTF-8)');

my @lineas = <STDIN>;

# ── R0. Fuera las tres \newenvironment ─────────────────────────────────────────────────
# Si Pandoc las ve, EXPANDE la macro y las tres cajas acaban en el mismo `shaded`.
# Si NO las ve, deja el entorno sin expandir y emite <div class="concepto|aviso|nota">,
# que es justo lo que `starlight.lua` necesita para saber de que tipo es cada una.
#
# LINEA A LINEA, contando llaves. La primera version de esto usaba un regex con /s y el
# `.*?` cruzo saltos de linea hasta encontrar un `}` 450 lineas mas abajo: se comio 382
# lineas del cuerpo EN SILENCIO. Un borrado acotado no puede desbordarse, y ademas el
# contador de lineas de `verificar.sh` lo detectaria.
my @limpias;
my $borrando = 0;
my $llaves   = 0;
my $n_env    = 0;
for my $l (@lineas) {
    if (!$borrando && $l =~ /^\\newenvironment\{(?:concepto|aviso|nota)\}/) {
        $borrando = 1; $llaves = 0; $n_env++;
    }
    if ($borrando) {
        my $abre  = () = $l =~ /(?<!\\)\{/g;
        my $cierra= () = $l =~ /(?<!\\)\}/g;
        $llaves += $abre - $cierra;
        $borrando = 0 if $llaves <= 0;
        next;
    }
    push @limpias, $l;
}
die "R0: esperaba borrar 3 \\newenvironment, borre $n_env\n" unless $n_env == 3;
my $texto = join '', @limpias;

my $n_cajas_titulo = 0;
my $n_cajas_sin    = 0;
my $n_diagramas    = 0;
my $n_tablas       = 0;
my $n_java         = 0;
my $n_flechas      = 0;
my $n_interr       = 0;
my $n_paragraph    = 0;

# ── R1. Izar el titulo de las cajas al cuerpo ──────────────────────────────────────────
# Pandoc DESCARTA el argumento opcional de un entorno que no conoce, asi que
# `\begin{aviso}[El SQL no lo valida nadie]` perderia el titulo. Lo bajamos al cuerpo como
# \textbf{...} y `starlight.lua` lo vuelve a subir a `:::caution[...]`.
# El orden importa y la segunda regla lleva un centinela: sin el, reprocesa las cajas que
# la primera acaba de reescribir (que ya son `\begin{aviso}\n`) y el conteo se dispara.
$texto =~ s/\\begin\{(concepto|aviso|nota)\}\[(.*?)\]/$n_cajas_titulo++; "\\begin{$1}\nTITULOIZADO\n\n\\textbf{$2}\n"/ge;
$texto =~ s/\\begin\{(concepto|aviso|nota)\}[ \t]*\n(?!TITULOIZADO)/$n_cajas_sin++; "\\begin{$1}\n\n\\textbf{Nota}\n"/ge;
$texto =~ s/^TITULOIZADO\n//gm;

# ── R2. Los 15 diagramas: `diagrama` -> `verbatim` ─────────────────────────────────────
# verbatim y NO lstlisting: lstlisting recorta los espacios iniciales de la primera linea,
# y estos dibujos empiezan sangrados. Con verbatim, Pandoc emite un CodeBlock sin clase,
# que ademas es el identificador que usa el filtro Lua para localizarlos (los otros 11
# bloques de codigo si llevan `language=`).
$n_diagramas += ($texto =~ s/\\begin\{diagrama\}/\\begin{verbatim}/g);
$texto        =~ s/\\end\{diagrama\}/\\end{verbatim}/g;

# ── R3. Las 21 tablas: `tabularx` -> `tabular{lll...}` ─────────────────────────────────
# El problema NO es tabularx: es que `\newcolumntype{L}` y `{P}` (definidos en el preambulo)
# Pandoc no los expande, y entonces vuelca la especificacion entera como texto. Sustituyendo
# la spec por N columnas `l`, Pandoc entiende la tabla, consume \toprule/\midrule/\bottomrule,
# parte por `&` y expande los \rt{} de cada celda.
#
# El ancho relativo (`P{4.2cm}`) se pierde: da igual, en HTML lo decide el CSS. Para el PDF
# de vuelta se recupera desde el .tex archivado.
sub spec_a_tabular {
    my ($spec) = @_;
    # Cuenta las columnas de la especificacion original: P{4.2cm}P{3.1cm}L -> 3
    my $p     = () = $spec =~ /P\{[^{}]*\}/g;
    my $ele   = () = $spec =~ /L/g;
    my $otras = () = $spec =~ /(?<![A-Za-z])[clr](?![A-Za-z])/g;
    my $n = $p + $ele + $otras;
    $n = 2 if $n < 1;            # jamas una tabla de 0 columnas
    $n_tablas++;
    return '\begin{tabular}{' . ('l' x $n) . '}';
}
$texto =~ s/\\begin\{tabularx\}\{\\textwidth\}\{\@\{\}(.*?)\@\{\}\}/spec_a_tabular($1)/gse;
$texto =~ s/\\end\{tabularx\}/\\end{tabular}/g;

# ── R5. El lenguaje mentiroso ──────────────────────────────────────────────────────────
# Cinco listados declaran `language=Java` sobre codigo que es JavaScript. Shiki no falla
# (java es valido) pero colorea mal.
$n_java += ($texto =~ s/language=Java\b/language=javascript/g);

# ── R6. \paragraph -> \subsubsection ───────────────────────────────────────────────────
# Los 7 \paragraph son de la seccion "Tabla por tabla". Como \paragraph, Pandoc los emite
# sin nivel de cabecera y no entran en el indice lateral de Starlight.
$n_paragraph += ($texto =~ s/\\paragraph\{/\\subsubsection{/g);

# ── R4. Interrogacion espanola y flechas — SOLO FUERA DE VALLAS ────────────────────────
# `?\`` es la ligadura de `¿` en LaTeX; Pandoc la traduce a `?'`, texto visiblemente roto.
# `$\rightarrow$` sobrevive como literal y en MDX puede activar el parser de matematicas.
#
# La maquina de estados no es paranoia: un `->` o un `?` dentro de un diagrama ASCII no debe
# tocarse. Hoy los 8 `?\`` son prosa, pero la comprobacion cuesta cuatro lineas y elimina
# la clase entera de fallo para siempre.
my @salida;
my $dentro = 0;
for my $l (split /\n/, $texto, -1) {
    $dentro++ if $l =~ /\\begin\{(verbatim|lstlisting)\}/;
    if (!$dentro) {
        $n_interr  += ($l =~ s/\?`/¿/g);
        $n_flechas += ($l =~ s/\$\\longrightarrow\$/⟶/g);
        $n_flechas += ($l =~ s/\$\\rightarrow\$/→/g);
    }
    $dentro-- if $l =~ /\\end\{(verbatim|lstlisting)\}/ && $dentro > 0;
    push @salida, $l;
}

print join("\n", @salida);

print STDERR <<"FIN";
  cajas con titulo izado : $n_cajas_titulo
  cajas sin titulo       : $n_cajas_sin
  diagramas -> verbatim  : $n_diagramas
  tablas normalizadas    : $n_tablas
  language=Java -> js    : $n_java
  \\paragraph -> subsub   : $n_paragraph
  flechas sustituidas    : $n_flechas
  ¿ restauradas          : $n_interr
FIN
