# Notes Agent Orchestration

A small learning project to understand how AI agents connect, pass information
around, and work together. Using a chatbot for local notes as the starting point.

The idea is pretty simple: one agent finds the notes, another writes the answer,
and a third checks it. Python handles the handoffs between them.

## Stack

[![Python](https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat-square&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
<a href="https://groq.com/"><img src="https://raw.githubusercontent.com/lobehub/lobe-icons/master/packages/static-svg/icons/groq.svg" width="20" height="20" alt="Groq logo" /> Groq</a>

Python runs the agents. Next.js, React, and TypeScript handle the frontend.
Groq provides the LLM through its API.

## How it works

**Your request → Notes → Writer → Reviewer → Answer**

- **Notes agent** reads relevant `.md` and `.txt` files from the local notes folder.
- **Writer agent** turns those notes into an answer with source references.
- **Reviewer agent** checks the draft against the notes and sends back feedback.

If changes are needed, the Writer gets up to two revision rounds. All three roles
use the same Groq key and model, with different instructions and context.

The frontend has a soft yellow chat page and an agent overview where you can watch
the workflow's live statuses, revisions, and activity.

## Run locally

For a fresh checkout, set up Python from the project root:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Add your Groq API key to `.env`, then start the frontend:

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

## Still learning

Each request starts fresh. Persistent memory and vector search haven't been added.
The Reviewer can miss things too, so this is a project to experiment with and learn
from.
