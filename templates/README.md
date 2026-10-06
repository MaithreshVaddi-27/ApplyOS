# Custom Templates

This folder holds user-registered templates (LaTeX, Typst, or any other toolchain with a declared compile command), managed by the `/add-template` command. The framework works out of the box with its two stock templates (moderncv, in `templates/cv-stock/main_example.tex` for a CV and `templates/cv-stock/resume_example.tex` for a resume) — this folder only gets content when you register your own.

## Layout

```
templates/
├── cv/
│   └── <template-name>/
│       ├── template.<ext>  # Profile-agnostic skeleton ([PLACEHOLDER] tokens), e.g. template.tex or template.typ
│       ├── TEMPLATE.md      # Manifest: source extension, compile command, fonts, page limit, style rules, pitfalls
│       ├── *.cls / *.sty    # Custom class/style files, or Typst packages (if the template needs them)
│       └── fonts/           # Bundled font files (if not using system fonts)
└── resume/
    └── <template-name>/
        └── (same layout)
```

The two folders are independent: register a custom CV and keep the stock resume, or
customize both. Each carries its own `ACTIVE-TEMPLATE` block in `05-cv-templates.md`,
so `/apply` picks up the template for whichever document type a run is producing.

## How it works

- `/add-template` interviews you for the template's instructions (source extension, compile command, fonts, style rules, page limit), stores the files here, and runs a mandatory test compile before registering anything.
- Activating a template adds a managed block to `05-cv-templates.md` (tagged `CV` or `Resume`), which is what `/apply` reads when drafting and compiling — no other wiring needed.
- `/add-template --list` shows registered templates; `/add-template --use <name>` switches; `/add-template --use default` reverts to the stock templates.

Templates are stored with `[PLACEHOLDER]` tokens instead of personal data, so they are safe to commit and share.
