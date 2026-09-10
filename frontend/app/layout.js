import "./globals.css";

export const metadata = {
  other: { "google": "notranslate" },
  title: "MedDiag IA",
  description: "Pipeline de diagnostic médical assisté",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr" translate="no">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
          rel="stylesheet"
        />
        <style dangerouslySetInnerHTML={{ __html: `
          .material-symbols-rounded {
            font-family: 'Material Symbols Rounded' !important;
            font-weight: normal;
            font-style: normal;
            line-height: 1;
            letter-spacing: normal;
            text-transform: none;
            display: inline-block;
            white-space: nowrap;
            word-wrap: normal;
            direction: ltr;
            -webkit-font-smoothing: antialiased;
            font-feature-settings: 'liga';
            font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 20;
          }
        `}} />
      </head>
      <body style={{ margin: 0, padding: 0 }}><div style={{background:"#fff3cd",color:"#553c00",padding:"10px 20px",textAlign:"center",fontFamily:"sans-serif",fontSize:14}}>Prototype académique. Cas fictifs uniquement. Aucune utilisation clinique.</div>{children}</body>
    </html>
  );
}