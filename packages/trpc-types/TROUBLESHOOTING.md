# IDE Autocomplete Troubleshooting

If type checking works (`npm run type-check` passes) but your IDE doesn't show autocomplete or type hints:

## Quick Fixes

### 1. Restart TypeScript Language Server
**VS Code:**
- Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
- Type "TypeScript: Restart TS Server"
- Press Enter

**WebStorm/IntelliJ:**
- File → Invalidate Caches → Restart

### 2. Check tsconfig.json
Add `skipLibCheck: true` to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "skipLibCheck": true,  // Add this
    // ... other options
  }
}
```

### 3. Verify Package Installation
```bash
# In your Vue project
npm list @akosasante/trpc-types

# Should show the installed version
# If not found, reinstall:
npm install @akosasante/trpc-types@latest
```

### 4. Check Import Path
Make sure you're importing from the correct path:

```typescript
// ✅ Correct
import type { AppRouter, RouterInputs, RouterOutputs } from '@akosasante/trpc-types'

// ❌ Wrong
import type { AppRouter } from '@akosasante/trpc-types/dist/index'
```

### 5. Explicit Type Annotations
If hover tooltips don't work, try explicit type annotations:

```typescript
// Instead of:
const input = { email: 'test@example.com', password: 'pass' }

// Use:
type LoginInput = RouterInputs['auth']['login']['authenticate']
const input: LoginInput = { email: 'test@example.com', password: 'pass' }
//            ^^^^^^^^^^^ This makes the type explicit for IDE
```

## Testing Type Resolution

Create a test file in your Vue project:

```typescript
// test-trpc-types.ts
import type { RouterInputs, RouterOutputs } from '@akosasante/trpc-types'

// Test that types resolve
type LoginInput = RouterInputs['auth']['login']['authenticate']
type LoginOutput = RouterOutputs['auth']['login']['authenticate']

// Try to assign - IDE should show errors if fields are wrong
const test: LoginInput = {
  email: 'test@example.com',
  password: 'password',
  // wrongField: 'test' // Should show error
}
```

Then run:
```bash
npx vue-tsc --noEmit test-trpc-types.ts
# or
npx tsc --noEmit test-trpc-types.ts
```

If this works but IDE still doesn't show hints, it's likely an IDE/language server issue.

## Common Issues

### Issue: "Cannot find module '@akosasante/trpc-types'"
**Solution:** The package isn't installed or npm didn't create the symlink
```bash
npm install
# or
npm install @akosasante/trpc-types@latest --force
```

### Issue: Types work in .ts files but not .vue files
**Solution:**
1. Make sure you have Volar extension installed (not Vetur)
2. Check that `<script setup lang="ts">` is used
3. Try restarting the Volar language server

### Issue: Autocomplete shows "any" type
**Solution:** The types are too complex for the IDE to infer in real-time
- Use explicit type annotations (see #5 above)
- Types still work for type checking even if IDE can't show them

### Issue: Can't hover over RouterOutputs to see type
**Solution:** This is expected for complex utility types. Instead:

```typescript
// Extract the specific type you want to see:
type LoginOutput = RouterOutputs['auth']['login']['authenticate']
//   ^^^^^^^^^^^ Now hover over this, IDE can show it
```

## Still Not Working?

If none of the above helps:

1. **Check TypeScript version compatibility:**
   ```bash
   # In your Vue project
   npm list typescript

   # Should be TypeScript 4.9 or higher
   ```

2. **Try using the types in a regular function:**
   ```typescript
   import type { RouterInputs } from '@akosasante/trpc-types'

   function login(input: RouterInputs['auth']['login']['authenticate']) {
     //           ^^^^^ Should show autocomplete here
     console.log(input.email)
     //               ^^^^^ Should show autocomplete here too
   }
   ```

3. **Check if the issue is specific to tRPC client:**
   ```typescript
   // If this shows autocomplete but trpc.auth.login doesn't,
   // the issue is with tRPC client type inference, not this package
   const { trpc } = useTrpc()
   type Test = typeof trpc.auth.login.authenticate
   ```

## Last Resort: Use Type Helpers

If IDE autocomplete never works but type checking does, create helper functions:

```typescript
// composables/useTrpcTypes.ts
import type { RouterInputs, RouterOutputs } from '@akosasante/trpc-types'

export function createTypedInput<T extends keyof RouterInputs>(
  _path: T,
  data: RouterInputs[T]
): RouterInputs[T] {
  return data
}

// Usage:
const loginData = createTypedInput('auth.login.authenticate', {
  email: 'test@example.com',
  password: 'password'
})
```

This gives you runtime type safety even if IDE hints don't work.