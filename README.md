# JReader

## Creating update_at column in Supabase
source:
https://dev.to/paullaros/updating-timestamps-automatically-in-supabase-5f5o


1. Navigate to Database -> Extensions in your Supabase dashboard
2. Enable the MODDATETIME extension
3. Add a new column to your table named created_at, with type timestamptz, and default value now()
4. Add a new column to your table named updated_at, with type timestamptz
5. Go to the SQL editor and run the following query (replace YOUR_TABLE_NAME with the name of your table):
```
create trigger handle_updated_at before update on YOUR_TABLE_NAME
  for each row execute procedure moddatetime (updated_at);
```


Sync dicts to render
```
rsync -avz ~/code/rs/jreader/jreader-rs/jreader-service/data/dicts/db/* srv-cuneotggph6c73erq910@ssh.oregon.render.com:/persistent/dicts/db/
```

## Serving HTTPS traffic from Tailscale

Must have done `tailscale cert` to provision.
Check Machines tab in Tailscale dashboard and click on the machine you provisioned cert for (check the TLS Certificate section)

In local machine again, do `tailscale serve 3000`. This will forward requests coming to your machine from other devices in the tailnet, to the port you specify.
Example output:

```
Available within your tailnet:

https://waiwais-macbook-pro-2.unicorn-lime.ts.net/
|-- proxy http://127.0.0.1:3000

Press Ctrl+C to exit.
```


But in actuality, since we have 2 open ports, I choose to serve it like this
```
tailscale serve --bg 3000
tailscale serve --bg --set-path=/jreader-service 3001

% tailscale serve status
https://waiwais-macbook-pro-2.unicorn-lime.ts.net (tailnet only)
|-- /                proxy http://127.0.0.1:3000
|-- /jreader-service proxy http://127.0.0.1:3001
```

## How do I delete local branches that I have already merged into github?

The standard way is:

1. Fetch the latest state from GitHub (to know what’s merged):

```
git fetch -p
```

(`-p` prunes remote-tracking branches that no longer exist)

2. Delete all local branches already merged into your current branch (usually main):

```
git branch --merged main | grep -vE '(^\*|main|master|develop)' | xargs git branch -d
```

- `git branch --merged main`: lists all branches fully merged into main.
- `grep -vE '...'`: keeps you from deleting main, master, develop, or your current branch.
- `git branch -d`: deletes them safely (will refuse if not fully merged).

---

💡 Quick check first:
```
git branch --merged main
```
so you can review the list before deleting.

## Stripe local dev
```
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

## Example of how to run frontend tests
```
# Run all ext-auth tests
npm test -- --testPathPatterns="ext-auth"

# Run specific test file
npm test -- app/api/ext-auth/start/route.test.ts

# Run with coverage
npm test -- --testPathPatterns="ext-auth" --coverage
```

## Building extension

Examples:
```
npm run build:quick && npm run test:e2e -- --project=chromium
npm run build:quick && npm run test:e2e -- e2e/pagination-reset.spec.ts --project=chromium
```
