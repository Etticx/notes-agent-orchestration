# Butter

A local Next.js frontend for the Notes → Writer → Reviewer learning project.

Run from this directory:

```powershell
npm install
npm run dev
```

Use the Local URL in the terminal, normally http://127.0.0.1:3000.
The parent directory must have `.venv` and a configured `.env` containing the Groq
API key. There is no API key in the frontend and no second key to configure.

- `app/page.tsx`: chatbot.
- `app/overview/page.tsx`: orchestrator map and live activity.
- `components/workspace-provider.tsx`: shared conversation and run state.
- `app/api/chat/route.ts`: streaming connection to the Python workflow.
- `app/api/info/route.ts`: local note filenames and configuration readiness.
- `../web_runner.py`: Python JSON event bridge.

Use `npm run typecheck` to check TypeScript and `npm run build` for a production
build. Run `npm start` to serve the production build locally.

Conversation display is temporary. Agent context starts fresh for each request.
