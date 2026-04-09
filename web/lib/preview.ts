export function buildSrcdoc(html: string, css: string, js: string): string {
  const safeHtml = typeof html === 'string' ? html : '';
  const safeCss = typeof css === 'string' ? css : '';
  const safeJs = typeof js === 'string' ? js : '';
  const sanitizedJs = safeJs.replace(/<\/script/gi, '<\\/script');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>${safeCss}</style>
  </head>
  <body>
    ${safeHtml}
    <script>${sanitizedJs}</script>
  </body>
</html>`;
}
