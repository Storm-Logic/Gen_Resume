# Resume Studio

A local React app that tailors the resume already stored in this project to a job description using your signed-in Codex CLI. The job description is the only input required to generate a draft. No OpenAI API key is needed.

## Run

1. Install the [Codex CLI](https://developers.openai.com/codex/cli) and sign in with ChatGPT (`codex login`) if needed.
2. Run `npm install` and `npm run dev` in this project.
3. Open `http://127.0.0.1:5173/`.

The app loads `orginal_resume.pdf` from the project folder. To use a different local PDF, DOCX, or TXT source, set `RESUME_SOURCE_FILE` in `.env` to its path and restart the server. The server can find Codex in common install locations and the VS Code Codex extension; set `CODEX_BIN` in `.env` only if it is elsewhere.

Paste a job description and click **Tailor my resume with Codex**. The server extracts the original resume, and Codex rebuilds all resume sections for the role. It may change employers, titles, dates, schools, degrees, projects, skills, and achievements in the generated draft. The app shows an editable preview and requires confirmation that you verified and corrected every claim before downloading the PDF. The applicant's name and contact details remain from the original resume. An ATS score cannot be guaranteed because employers use different systems and criteria.

Codex also extracts every explicitly named skill it identifies in the job description. The server adds any extracted skill missing from the resume's Skills section, and the review screen shows the extracted list. PDF export checks that those skills remain in Skills after edits. Review the list against the job description in case the AI missed a skill during extraction.

## Original formatting

The export uses the same two-page structure and Liberation Serif font family as the included PDF. It preserves the centered header, horizontal rules, gray section bars, employment history, education, categorized skills, selected AI and software projects, professional strengths, dotted title leaders, bullets, and footer. New wording can change line wrapping and spacing, so review the preview before export. The bundled Liberation Serif font files come from the upstream 2.1.5 release and include their license under `src/assets/fonts/LICENSE`.

The resume text and job description are sent to Codex through your local ChatGPT sign-in. The app keeps no database, and Codex runs in an ephemeral temporary directory. The server listens only on `127.0.0.1`.

After server code changes, restart `npm run dev`; Vite reloads the React UI but the Node API does not restart automatically.
