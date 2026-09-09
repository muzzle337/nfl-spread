export function withV019PolishUi(html){
  if(typeof html!=="string")return html;
  const ext=`<style>
/* v0.19 makes the all-game history board and complete dossier canonical. */
[data-hist16-board]{display:none!important}
.detail-content>[data-pool17-detail],.detail-content>[data-hist16-detail]{display:none!important}
</style>`;
  return html.includes('</head>')?html.replace('</head>',ext+'</head>'):ext+html;
}
