<template>
  
<h1>Fimar Documento</h1>
<div class="ui fluid centered grid">
  <div class="row">
    <div class="column">
      <button @click="prevPageBtn" class="btnedit">
        <font-awesome-icon icon="backward" class="icon" />
        <span class="tooltip">Página Anterior</span>
      </button>
    </div>
    <div class="column" style="display: flex; justify-content: center; align-items: center;">
      <span id="pageInfo" class="ui button" style="background-color: rgba(0, 110, 220, 0.1);"></span>
    </div>
    <div class="column">
      <button @click="nextPageBtn" class="btnedit">
        <font-awesome-icon icon="forward" class="icon" />
        <span class="tooltip">Página Siguiente</span>
      </button>
    </div>
  </div>
</div>

<div class="ui grid">
    <div class="row">
        <div class="segment ui column fluid centered" id="col-pdf">
          <div style="position: relative;" id="v-pdf">
            <canvas  id="pdfCanvas" style="cursor: crosshair;"></canvas>
          </div>
        </div>        
    </div>
    <div class="row">
        <p class="column" id="coordinates">Haz clic y arrastra para dibujar cuadros. Cada cuadro queda fijado.</p>
    </div>
</div>


  </template>
  
  <script setup>
  import { onMounted } from 'vue';
  import * as pdfjsLib from "pdfjs-dist/webpack"; // Usa esta línea para Webpack
  
  let canvas, pdfViewer, ctx, pageInfo, colPdf;
  let pdfDoc = null;
  let currentPage = 1;
  let viewport = null;
  let pdfScale = 1.75; 


  
  const pdfUrl = 'http://localhost:8080/pdf/ejemplo.pdf';
  
  onMounted(() => {
    // Asegurarse de que los elementos están disponibles en el DOM
    canvas = document.getElementById('pdfCanvas');
    pdfViewer = document.getElementById('v-pdf');
    ctx = canvas.getContext('2d');
    const coordinatesDisplay = document.getElementById('coordinates');
    pageInfo = document.getElementById('pageInfo');
    colPdf=document.getElementById("col-pdf");


    const loadingTask = pdfjsLib.getDocument(pdfUrl);
    loadingTask.promise.then(pdf => {
      pdfDoc = pdf;
      renderPage(currentPage);
    }).catch(err => {
      console.error('Error al cargar el PDF:', err);
    });

    let isDragging = false;
    let startX, startY;

    pdfViewer.addEventListener('mousedown', event => {
     
    const rect = pdfViewer.getBoundingClientRect();

    console.log("Vw"+pdfViewer.offsetWidth);
    console.log("Cv"+canvas.offsetWidth); 
      console.log(rect)

      const ofx=rect.left + window.scrollX;
      const ofy=rect.top + window.scrollY;
      console.log(ofx, ofy);

      startX = event.pageX - ofx;
      startY = event.pageY - ofy;

      const signbox=document.getElementById('signbox');
      if (signbox)
      signbox.remove()

      const box = document.createElement('div');
      box.classList.add('box');
      box.style.left = `${startX}px`;
      box.style.top = `${startY}px`;
      box.style.width = `0px`;
      box.id="signbox";
      box.style.height = `0px`;
      box.style.position='absolute'
      box.style.border= "2px dashed blue";
      box.style.position= "absolute";
      box.style.background="rgba(0, 255, 0, 0.3)";
    

      pdfViewer.appendChild(box);
      

      isDragging = true;

      pdfViewer.addEventListener('mousemove', function onMove(event) {
        if (!isDragging) return;
        const currentX = event.pageX-ofx;
        const currentY = event.pageY-ofy;

        const left = Math.min(currentX, startX);
        const top = Math.min(currentY, startY);
        const right = Math.max(currentX,startX);
        const bottom = Math.max(currentY, startY);

        console.log(rect.height, top, bottom);
        const width = Math.min((right - left), (canvas.width-left));
        const height = Math.min((bottom - top),(canvas.height-top));




        box.style.left = `${left}px`;
        box.style.top = `${top}px`;
        box.style.width = `${width}px`;
        box.style.height = `${height}px`;

        
        const x1 = left/pdfScale;
        const y1 = (rect.height-top)/pdfScale; // Ajuste para coordenada cartesiana
        const x2 = right/pdfScale;
        const y2 = (rect.height-bottom)/pdfScale;

        coordinatesDisplay.textContent = `Coordenadas Cartesianas: Superior Izquierda (x1=${x1}, y1=${y1}), Inferior Derecha (x2=${x2}, y2=${y2})`;
      });

      pdfViewer.addEventListener('mouseup', function onUp() {
        isDragging = false;
        //canvas.removeEventListener('mousemove', onMove);
        canvas.removeEventListener('mouseup', onUp);
      });
    })

  });
  


  const  renderPage=(pageNum)=> {
    pdfDoc.getPage(pageNum).then(page => {

      viewport = page.getViewport({ scale: pdfScale });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      colPdf.style.width=`fit-content`
      pdfViewer.style.width = `${viewport.width}px`;
      pdfViewer.style.height = `${viewport.height}px`;
      



      const renderContext = {
        canvasContext: ctx,
        viewport: viewport,
      };
      page.render(renderContext);
  
      pageInfo.textContent = `Página ${pageNum} de ${pdfDoc.numPages}`;
    });
  }


    const prevPageBtn= () => {
      if (currentPage <= 1) return;
      currentPage--;
      renderPage(currentPage);
    }

    const nextPageBtn=() => {
      if (currentPage >= pdfDoc.numPages) return;
      currentPage++;
      renderPage(currentPage);
    }

  </script>
  
  <style scoped>

    canvas {
      border: 1px solid black;
      cursor: pointer;
      position: relative;
    }
    .box {
      border: 2px dashed blue;
      position: absolute;
      background-color: rgba(0, 255, 0, 0.3);
    }

  .btnedit {
    position: relative; /* Necesario para posicionar el tooltip */
    margin-left: 5px;
    margin-top: 5px;
    padding: 0;
    background-color: transparent;
    border: none;
    cursor: pointer;
    font-size: 2em;
    font-weight: bold;
    color: rgba(34, 150, 243, 0.9);
    transition: color 0.3s ease-in-out;
    position: relative; /* Necesario para posicionar el tooltip */
}

.tooltip {
  visibility: hidden; /* Inicialmente oculto */
  position: absolute;
  bottom: 100%; /* Lo coloca justo encima del botón */
  left: 50%;
  transform: translateX(-50%);
  background-color: rgba(34, 150, 243, 0.9);
  color: #fff;
  padding: 5px;
  height:100%;
  font-family: Arial, sans-serif; /* Aquí defines la fuente */
  border-radius: 3px;
  font-size: 16px;
  white-space: nowrap;
  opacity: 0;
  transition: opacity 0.3s;
}

.btnedit:hover .tooltip {
  visibility: visible;
  opacity: 1; /* Lo hace visible cuando el hover es activado */
}
  </style>
  