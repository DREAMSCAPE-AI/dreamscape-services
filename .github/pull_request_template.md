<!--

Modèle de Pull Request – adaptez chaque section à votre contexte

-->



\# Objet de la PR



<!-- Expliquez brièvement \*pourquoi\* ce changement est nécessaire et

&nbsp;    résumez le résultat attendu. Gardez le paragraphe concis. -->



\# Liens / Références



\- Ticket JIRA / GitHub Issue : <!-- ABC‑123 -->

\- Documentation mise à jour : <!-- lien vers le MD ou Confluence -->



\# Type de changement



\- \[ ] \*\*Feature\*\* – nouvelle fonctionnalité

\- \[ ] \*\*Fix\*\* – correction de bug

\- \[ ] \*\*Refactor\*\* – réorganisation du code sans changement fonctionnel

\- \[ ] \*\*Breaking change\*\* – impacte l’API ou les contrats existants

\- \[ ] \*\*Docs\*\* – mise à jour de la documentation

\- \[ ] \*\*Other\*\* – précisez :



\# Checklist avant revue



\- \[ ] Le code compile/local tests passent

\- \[ ] L’image Docker est buildée et poussée (`docker buildx build --push`)

\- \[ ] Déploiement validé sur le cluster \*\*dev K3s\*\*

\- \[ ] `terraform plan` sans diff inattendu (si dossier \*infra\* impacté)

\- \[ ] Les logs Loki/Promtail sont exempts d’erreurs

\- \[ ] La documentation (README, ADR, etc.) est à jour



\# Description détaillée des changements



<!-- Fournissez des détails techniques : fichiers clefs, patterns, impact

&nbsp;    sur les performances, risques, etc. Utilisez des listes ou sections

&nbsp;    si nécessaire. -->



\# Notes de déploiement



<!-- Indiquez les étapes manuelles éventuelles : migration DB, purge de

&nbsp;    cache, feature flag à activer, rollback plan. -->



\# Approche pour la QA



<!-- Donnez des instructions de test ou une checklist QA pour valider

&nbsp;    la PR en staging. -->



\# Checklist du relecteur



\- \[ ] Le code suit les guidelines (formatage, lint)

\- \[ ] Les tests couvrent les nouveaux chemins critiques

\- \[ ] Aucun secret/clé n’est committé

\- \[ ] Les ressources Kubernetes sont correctement dimensionnées



> \_N’oubliez pas de convertir les cases pertinentes en \*\*\[x]\*\* avant de

> demander la revue.\_

