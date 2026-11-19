export const css = `
:root {
  color-scheme: dark;
  --bg: #101216;
  --panel: #1b1f26;
  --ink: #f6f4ed;
  --muted: #b3bac6;
  --lime: #d8ff65;
}
* {
  box-sizing: border-box;
}
body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font:
    16px/1.6 system-ui,
    sans-serif;
}
a {
  color: inherit;
}
header,
main,
footer {
  max-width: 1120px;
  margin: auto;
  padding: 24px;
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #343942;
}
.brand {
  font-size: 25px;
  font-weight: 950;
  text-decoration: none;
  letter-spacing: -1px;
}
.brand span {
  color: var(--lime);
}
nav {
  display: flex;
  gap: 18px;
}
nav a {
  text-decoration: none;
}
h1 {
  font-size: clamp(36px, 7vw, 76px);
  line-height: 1.05;
  letter-spacing: -0.055em;
  max-width: 850px;
  margin: 22px 0;
}
h2 {
  line-height: 1.2;
  font-size: 26px;
}
.eyebrow {
  color: var(--lime);
  font-weight: 750;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-size: 12px;
}
.lead {
  font-size: 20px;
  color: var(--muted);
  max-width: 700px;
}
.hero {
  padding: 36px 0;
}
.notice {
  background: #313724;
  border-left: 3px solid var(--lime);
  padding: 14px 18px;
  margin: 20px 0;
}
.filters {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin: 26px 0;
}
.filters a,
.button,
button {
  border: 1px solid #46505b;
  background: var(--panel);
  border-radius: 8px;
  padding: 10px 16px;
  color: var(--ink);
  font: inherit;
  text-decoration: none;
  cursor: pointer;
}
.filters a[aria-current],
.primary {
  background: var(--lime);
  color: #101216;
  border-color: var(--lime);
}
.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}
.clip {
  position: relative;
  background: var(--panel);
  padding: 26px;
  border: 1px solid #343942;
  border-radius: 16px;
  scroll-margin-top: 20px;
  overflow-wrap: anywhere;
}
.clip.featured {
  border-color: var(--lime);
  grid-column: 1/-1;
  background: linear-gradient(120deg, #293021, #1b1f26);
}
.clip:target {
  outline: 3px solid var(--lime);
  outline-offset: 4px;
}
.rank {
  font: 900 42px/1 system-ui;
  color: #808c69;
}
.meta {
  color: var(--muted);
  font-size: 14px;
}
.source {
  display: inline-block;
  margin-top: 12px;
  color: var(--lime);
  font-weight: 700;
}
footer {
  color: var(--muted);
  font-size: 13px;
  border-top: 1px solid #343942;
  margin-top: 50px;
}
.editor {
  max-width: 850px;
}
.fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
label {
  display: block;
  font-size: 14px;
  margin: 12px 0;
}
input,
textarea,
select {
  display: block;
  width: 100%;
  padding: 12px;
  background: #101216;
  color: var(--ink);
  border: 1px solid #5a6470;
  border-radius: 6px;
  font: inherit;
  margin-top: 5px;
}
input[type="checkbox"],
input[type="radio"] {
  display: inline;
  width: auto;
  margin-right: 8px;
}
textarea {
  min-height: 90px;
  resize: vertical;
}
.toolbar {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin: 20px 0;
}
fieldset {
  border: 1px solid #454d58;
  border-radius: 12px;
  padding: 18px;
  margin: 24px 0;
}
legend {
  color: var(--lime);
  font-weight: 700;
}
#status {
  position: sticky;
  bottom: 10px;
  background: #293021;
  padding: 12px;
  border-radius: 8px;
}
button:disabled {
  opacity: 0.4;
}
a:focus-visible,
button:focus-visible {
  outline: 3px solid var(--lime);
  outline-offset: 3px;
}
.archive {
  list-style: none;
  padding: 0;
}
.archive li {
  border-bottom: 1px solid #343942;
  padding: 20px 0;
}
.archive a {
  font-size: 23px;
}
@media (max-width: 650px) {
  header,
  main,
  footer {
    padding: 18px;
  }
  .grid,
  .fields {
    grid-template-columns: 1fr;
  }
  .hero {
    padding: 18px 0;
  }
  .clip {
    padding: 22px;
  }
  h1 {
    font-size: 44px;
  }
  nav {
    gap: 12px;
    font-size: 14px;
  }
  .toolbar button {
    flex: 1;
  }
  header .brand {
    font-size: 23px;
  }
}

.candidate .toolbar { display: flex; flex-wrap: wrap; }
.candidate .toolbar button { flex: 1 0 auto; white-space: nowrap; overflow-wrap: normal; }
.import-run { margin-bottom: 1rem; }
`;
