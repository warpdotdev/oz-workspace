# Contributing to Oz Workspace

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

1. Fork and clone the repo
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env.local` and fill in your values (see [README](README.md#2-configure-environment-variables))
4. Set up the database: `npx prisma generate && npx prisma db push`
5. Start the dev server: `npm run dev`

## Making Changes

1. Create a branch from `main` for your changes
2. Make your changes and test them locally
3. Run `npm run lint` to check for lint errors
4. Run `npm run build` to verify the build succeeds
5. Commit with a clear, descriptive message

## Pull Requests

- Keep PRs focused on a single change
- Include a description of what your PR does and why
- Link any related issues
- Make sure CI checks pass

## Reporting Issues

- Use GitHub Issues to report bugs or request features
- Include steps to reproduce for bugs
- Include your Node.js version and OS

## Code Style

- TypeScript throughout
- Follow existing patterns in the codebase
- Use the existing Prisma schema conventions for database changes

## License

By contributing, you agree that your contributions will be licensed under the [Apache License 2.0](LICENSE).
