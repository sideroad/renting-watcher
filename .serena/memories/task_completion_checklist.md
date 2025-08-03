# Task Completion Checklist

When completing any development task in this project:

## Required Steps
1. **Type Check**: Run `npm run typecheck` to ensure no TypeScript errors
2. **Lint**: Run `npm run lint` to check code style compliance
3. **Build**: Run `npm run build` to ensure compilation works
4. **Test Run**: Consider running `npm run dev` to test functionality locally

## Environment Requirements
For full functionality testing, ensure these environment variables are set:
- `SLACK_WEBHOOK_URL` - Slack webhook for notifications
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key

## GitHub Actions
The project automatically runs on schedule, but changes can be tested manually via workflow dispatch in the GitHub Actions tab.

## Database Considerations
- Be aware that the scraper stores data in Supabase
- Use `--delete-all` flag cautiously as it removes all existing property data