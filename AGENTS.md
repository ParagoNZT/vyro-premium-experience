<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Reseller workspace
- Store reseller branding and XC base URLs in owner-scoped Cloud tables and private logo storage; the existing demo client session must never authorize Cloud data.
- APK compilation remains external and unavailable until Android sources and a signing/build service are provided; never label configuration exports as APKs.
- Keep reseller configuration validation in a shared browser-safe module with database validation as the write boundary; never store end-customer XC credentials in branding configuration.
