declare module "html2pdf.js" {
  interface Html2PdfWorker {
    set: (options: Record<string, unknown>) => Html2PdfWorker;
    from: (element: HTMLElement | string) => Html2PdfWorker;
    save: () => Promise<void>;
  }

  interface Html2PdfStatic {
    (): Html2PdfWorker;
  }

  const html2pdf: Html2PdfStatic;
  export default html2pdf;
}
