export function withSurvivorV0111Ui(html) {
  if (typeof html !== "string") return html;
  const extension = `
<style>
  /* v0.11.1 Survivor readability hotfix */
  .survivor-body{max-width:620px}
  .survivor-add{display:none!important}
  .survivor-entry-row{padding-bottom:2px;margin-bottom:12px}
  .survivor-entry{min-height:36px;padding:8px 11px;font-size:11px}
  .survivor-card{padding:14px 15px;margin-bottom:10px}
  .survivor-rank{grid-template-columns:88px minmax(0,1fr) auto;gap:14px;align-items:start}
  .survivor-rank>div:first-child{min-width:0;padding-top:1px}
  .survivor-num{text-align:left;font-size:10px;margin:0 0 5px;color:#718091}
  .survivor-pct{text-align:left;font-size:25px;line-height:1;font-weight:950;letter-spacing:-.025em;white-space:nowrap}
  .survivor-team{font-size:15px;line-height:1.2;margin-top:1px}
  .survivor-market{font-size:11px;line-height:1.45;margin-top:6px;white-space:normal}
  .survivor-market strong{font-size:12px}
  .survivor-side{font-size:9px;margin-top:5px}
  .survivor-pick{min-width:54px;min-height:38px;margin-top:2px}
  .survivor-used{min-width:54px;margin-top:7px}
  .survivor-toolbar{margin-top:2px}
  .survivor-note{margin-bottom:13px}
  @media (max-width:430px){
    .survivor-body{padding:12px}
    .survivor-card{padding:13px}
    .survivor-rank{grid-template-columns:78px minmax(0,1fr);gap:11px 12px}
    .survivor-rank>div:last-child{grid-column:2;justify-self:start}
    .survivor-pct{font-size:23px}
    .survivor-team{font-size:14px}
    .survivor-toolbar{align-items:stretch;flex-direction:column}
    .survivor-sort{width:100%}
  }
</style>`;
  return html.replace("</body>", `${extension}\n</body>`);
}
