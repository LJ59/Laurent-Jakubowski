# CV statique depuis Markdown

Ce projet genere deux pages statiques a partir de `index.md` :

- `dist/index.html` : rendu Markdown fidele ;
- `dist/enrichi.html` : rendu enrichi, sobre et professionnel.

## Utilisation locale

```bash
npm install
npm run build
```

Pour tester localement :

```bash
npm start
```

Puis ouvrir `http://localhost:8080`.

## Cloudflare Pages

Parametres recommandes :

- Framework preset : None
- Build command : `npm run build`
- Build output directory : `dist`
- Root directory : `/`
- Node.js : 18 ou plus

A chaque commit sur la branche principale, Cloudflare Pages relance le build et publie le contenu de `dist`.

## Modifier le CV

Le contenu principal se trouve dans `index.md`.

Le generateur reconnait les sections francaises courantes :

- Profil
- Experiences professionnelles
- Competences
- Formations
- Langues
- Centres d'interets

La version enrichie conserve le texte source, mais met en forme les experiences sous forme de timeline.

## Photo optionnelle

Ajouter une image dans le Markdown si necessaire :

```markdown
![Photo de profil](images/photo.jpg)
```

Sans image, aucun emplacement vide n'est affiche.
