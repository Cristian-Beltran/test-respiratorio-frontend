import jsPDF from "jspdf";
import { toPng } from "html-to-image";

type ExportPdfOptions = {
  filename?: string;
  marginMm?: number;
  pixelRatio?: number; // calidad
};

export async function exportElementToPdf(
  element: HTMLElement,
  {
    filename = "reporte.pdf",
    marginMm = 8,
    pixelRatio = 2,
  }: ExportPdfOptions = {},
) {
  // Asegura fondo blanco (si no, sale transparente)
  const dataUrl = await toPng(element, {
    cacheBust: true,
    pixelRatio,
    backgroundColor: "#ffffff",
  });

  const pdf = new jsPDF("p", "mm", "a4");
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  const contentW = pageW - marginMm * 2;
  const contentH = pageH - marginMm * 2;

  // Necesitamos dimensiones reales de la imagen
  const img = new Image();
  img.src = dataUrl;
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error("No se pudo cargar la imagen"));
  });

  const imgW = contentW;
  const imgH = (img.height * imgW) / img.width;

  // Si cabe en 1 página
  if (imgH <= contentH) {
    pdf.addImage(
      dataUrl,
      "PNG",
      marginMm,
      marginMm,
      imgW,
      imgH,
      undefined,
      "FAST",
    );
    pdf.save(filename);
    return;
  }

  // Multipágina: recorte vertical sobre un canvas temporal
  const pxPerMm = img.width / imgW;
  const pageContentPxH = Math.floor(contentH * pxPerMm);

  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = img.width;
  sourceCanvas.height = img.height;
  const sctx = sourceCanvas.getContext("2d");
  if (!sctx) throw new Error("No canvas context");

  sctx.drawImage(img, 0, 0);

  const tmp = document.createElement("canvas");
  tmp.width = img.width;
  tmp.height = pageContentPxH;
  const tctx = tmp.getContext("2d");
  if (!tctx) throw new Error("No canvas context");

  let y = 0;
  let pageIndex = 0;

  while (y < img.height) {
    tctx.clearRect(0, 0, tmp.width, tmp.height);
    tctx.drawImage(
      sourceCanvas,
      0,
      y,
      img.width,
      pageContentPxH,
      0,
      0,
      img.width,
      pageContentPxH,
    );

    const pageDataUrl = tmp.toDataURL("image/png");
    const pageImgH = (tmp.height * imgW) / tmp.width;

    if (pageIndex > 0) pdf.addPage();
    pdf.addImage(
      pageDataUrl,
      "PNG",
      marginMm,
      marginMm,
      imgW,
      pageImgH,
      undefined,
      "FAST",
    );

    y += pageContentPxH;
    pageIndex++;
  }

  pdf.save(filename);
}
