# Code Style & Conventions

## TypeScript Configuration
- ES2022 features enabled
- Strict TypeScript configuration
- Module-based imports using ES6 syntax

## ESLint Rules
- Extends `eslint:recommended` and `@typescript-eslint/recommended`
- Console warnings allowed (warn level)
- Unused variables error (except those prefixed with _)
- No explicit any warnings

## File Structure
- `src/` - All TypeScript source files
- `dist/` - Compiled JavaScript output
- Configuration files in root directory

## Naming Conventions
- Classes use PascalCase (e.g., `SuumoScraper`, `Database`)
- Constants use UPPER_SNAKE_CASE (e.g., `URLS`)
- Functions and variables use camelCase
- Environment functions prefixed with `get` (e.g., `getSlackWebhookUrl`)

## Code Organization
- Separate concerns into different files (scraper, database, slack, config)
- Export constants and functions from dedicated config file
- Use async/await pattern consistently
- Error handling with try-catch blocks