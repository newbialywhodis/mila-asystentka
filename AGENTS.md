<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Mila Development Guide

This is the Mila repository - Mila is a HackNation MVP for the challenge „Przewodnik przyszłej mamy”. It is a conversational guide that asks short, adaptive questions and creates a personalized plan of benefits, deadlines and parental formalities. Mila is represented by an expressive mascot built using [Mascotz](https://www.mascotz.dev/).

## Architecture

- Use Next.js App Router, TypeScript and CSS Modules. No Tailwind CSS or shadcn/ui.
- Build screens through composition of small, reusable, semantic React components.
- Keep shared UI in `src/components/ui`, product features in `src/features`, and routing in `src/app`.
- Colocate components with their `.module.css` files. Define semantic UI colors in `src/app/tokens.css` and reference them from CSS Modules.
- Reuse `Button`, `IconButton`, and `Sheet` from `src/components/ui` when they fit. Features choose the variant and position the control. The shared component owns its appearance and interaction states.
- Add interface glyphs to the typed registry in `src/components/ui/Icon.tsx`. Give icon-only actions an accessible name through `IconButton`.
- Prefer native HTML. Wrap Base UI primitives in Mila components when interactions such as dialogs or menus need focus or keyboard management.
- Keep UI, conversation state and eligibility rules separate. Avoid premature abstractions and unnecessary dependencies.
- Prioritize a polished, responsive and accessible MVP. Use deterministic flows and mock data where needed; no database or authentication.

## Commands

- Use Bun for dependency management and scripts. Install with `bun install --frozen-lockfile`.
- Run `bun run check` for formatting, lint, types, tests and catalog validation. For interaction changes, exercise the changed flow in a browser, including keyboard and focus behavior where relevant.

## Writing Code

- Keep shared application and domain logic portable across Node.js, Bun, and Cloudflare Workers. Browser interactions can use DOM APIs on the client. Development scripts and tests can use APIs provided by their configured runtime.
- Before changing a shared component or token, inspect its callers. Preserve behavior outside the requested change and review the final diff for unrelated edits.
- NEVER use `any`. NEVER use classes.
- Use `import type` for type-only imports

## Important Development Notes

- Conventional Commits: `feat(scope):`, `fix(scope):`, `docs:`, `chore:`. Use `!` for breaking changes (e.g. `feat(auth)!:`)
