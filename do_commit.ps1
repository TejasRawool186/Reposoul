Set-Location d:\kraven
$env:GIT_AUTHOR_NAME = 'TejasRawool186'
$env:GIT_AUTHOR_EMAIL = 'tejasrawool186@gmail.com'
$env:GIT_COMMITTER_NAME = 'TejasRawool186'
$env:GIT_COMMITTER_EMAIL = 'tejasrawool186@gmail.com'

git add README.md TECH-DEBT-METRICS.md 'assets/social-preview.svg' '.kiro/steering/product.md' '.kiro/steering/licensing-and-attribution.md'
git commit -m 'docs: rewrite README as professional standalone documentation'
git add .
git commit -m 'chore: clean up repository metadata and project-origin references'
git log --oneline -4
