# Cross-Domain Session Token Exchange Implementation Plan

## Executive Summary

Enable seamless authentication between two frontend domains (`trades.flexfoxfantasy.com` and `ffftemp.akosua.xyz`) by implementing a token exchange system. Users authenticated on one frontend can be automatically authenticated on the other without re-entering credentials.

## Current Architecture Analysis

### Session Management (src/bootstrap/express.ts:40-86)
- **Storage**: Redis via `connect-redis`
- **Duration**: 7 days (604,800 seconds)
- **Cookie Name**: `trades.sid` (prod) or `staging_trades.sid` (staging)
- **Cookie Config**:
  - `secure`: true in production
  - `httpOnly`: true
  - `sameSite`: "none" in production, "lax" in dev/test
  - `domain`: Configurable via `COOKIE_DOMAIN` env var (currently `.akosua.xyz`)
- **Session Prefix**: `sess:` (prod) or `stg_sess:` (staging)

### Authentication System
- **Auth Router**: `src/api/routes/v2/routers/auth.ts` (tRPC)
- **Auth Functions**: `src/authentication/auth.ts`
  - `serializeUser()`: Converts user to session string (user ID)
  - `deserializeUser()`: Retrieves user from session string
  - `signInAuthentication()`: Validates credentials
- **Session Field**: `request.session.user` stores user ID as string

### CORS Configuration (src/bootstrap/app.ts:53-67)
- **Already Whitelisted**:
  - `trades.flexfoxfantasy.com`
  - `ffftemp.akosua.xyz`
  - `ffftemp.netlify.app`
  - Other staging/dev domains
- **Credentials**: Enabled (`credentials: true`)

### Redis Access
- **Client**: Exported from `src/bootstrap/express.ts`
- **Type**: `redis` v4 with legacy mode for connect-redis compatibility
- **Methods Available**: All standard Redis commands via `redisClient`

## Implementation Strategy

### Option Selected: Token Exchange Flow (SSO-style)

**Why this approach:**
1. Leverages existing Redis infrastructure
2. Minimal changes to current architecture
3. No domain restructuring required
4. Secure with short-lived tokens
5. One-time use tokens prevent replay attacks

## Implementation Plan

### Phase 1: Backend Implementation ✅ COMPLETE

**Files Implemented**:
- `src/utils/transferTokens.ts` - Redis token storage utilities
- `src/api/routes/v2/routers/client.ts` - SSO endpoints:
  - `POST /v2/client.createRedirectToken` - Creates short-lived redirect tokens
  - `POST /v2/client.exchangeRedirectToken` - Exchanges tokens for new sessions

**Key Features**:
- 60-second token expiration
- Single-use tokens (consumed after exchange)
- Allowed host validation
- Comprehensive error handling and metrics
- Cross-domain session creation

**Status**: ✅ **COMPLETE** - Ready for frontend integration

---

### Phase 2: Frontend Implementation - New App (Vue 3) ✅ COMPLETE

**Target**: TradeMachineClientV3 (`ffftemp.akosua.xyz`)

**Objective**: Add token creation and redirect logic after successful login

#### Task 2.1: Create tRPC Client API Composable ✅ COMPLETE
**File**: `src/composables/api/useTrpcClientApi.ts` (NEW)

```typescript
import { useTrpc } from '@/composables/useTrpc'
import type { RouterInputs, RouterOutputs } from '@akosasante/trpc-types'

export type CreateRedirectTokenInput = RouterInputs['client']['createRedirectToken']
export type CreateRedirectTokenResponse = RouterOutputs['client']['createRedirectToken']

export function useTrpcClientApi() {
  const { trpc, isLoading } = useTrpc()

  const getIP = async () => {
    try {
      return await trpc.client.getIP.query()
    } catch (error) {
      console.error('tRPC getIP error:', error)
      throw error
    }
  }

  const createRedirectToken = async (input: CreateRedirectTokenInput): Promise<CreateRedirectTokenResponse> => {
    try {
      return await trpc.client.createRedirectToken.mutate(input)
    } catch (error) {
      console.error('tRPC createRedirectToken error:', error)
      throw error
    }
  }

  return { 
    getIP, 
    createRedirectToken, 
    isLoading 
  }
}
```

#### Task 2.2: Add SSO Redirect Logic to Auth Store ✅ COMPLETE
**File**: `src/stores/auth.ts` (MODIFY)

```typescript
import { useTrpcClientApi } from '@/composables/api/useTrpcClientApi'

export const useAuthStore = defineStore('auth', () => {
  // ... existing state and composables
  const trpcClientApi = useTrpcClientApi()

  // NEW: SSO redirect after successful login
  async function redirectToOldApp(targetPath: string = '/make_trade'): Promise<void> {
    try {
      // Only redirect if user is authenticated
      if (!currentUser.value) {
        throw new Error('User must be logged in to redirect')
      }

      // Determine old app URL based on environment
      const oldAppUrl = import.meta.env.VITE_OLD_CLIENT_URL || 'https://trades.flexfoxfantasy.com'
      const redirectTo = `${oldAppUrl}${targetPath}`
      const origin = window.location.origin

      // Always use SSO token exchange (even in staging for consistency)
      console.debug('Creating SSO redirect token for:', redirectTo)

      // Create redirect token
      const tokenResponse = await trpcClientApi.createRedirectToken({
        redirectTo,
        origin
      })

      // Redirect with token in URL fragment
      const redirectUrl = `${redirectTo}#sso_token=${tokenResponse.token}`
      
      console.debug('Redirecting to old app with SSO token:', redirectUrl)
      window.location.href = redirectUrl
    } catch (error) {
      console.error('Failed to redirect to old app:', error)
      throw error
    }
  }

  return {
    // ... existing returns
    redirectToOldApp // NEW
  }
})
```

#### Task 2.3: Update Login Form with Post-Login SSO Redirect ✅ COMPLETE
**File**: `src/components/forms/auth/LoginForm/LoginForm.vue` (MODIFY)

```typescript
// In the onSubmit function, after successful login:
const onSubmit = async (values: LoginFormValues) => {
  // ... existing validation logic

  try {
    await authStore.login(values)
    
    // Check if we should redirect to old app based on feature flags
    const shouldRedirectToOldApp = import.meta.env.VITE_ENABLE_SSO_REDIRECT === 'true'
    
    if (shouldRedirectToOldApp) {
      // Feature-flagged user logging in - redirect to old app with SSO token
      push.success(`Welcome back, ${authStore.currentUser?.email}! Redirecting...`)
      await authStore.redirectToOldApp('/make_trade')
    } else {
      // Stay in new app
      push.success(`Welcome back, ${authStore.currentUser?.email}!`)
      await router.push(redirectTo)
    }
  } catch (error) {
    // ... existing error handling
  }
}
```

#### Task 2.4: Environment Configuration ✅ COMPLETE
**File**: `.env` (UPDATE)

```bash
# SSO Configuration
VITE_ENABLE_SSO_REDIRECT=true
VITE_OLD_CLIENT_URL=https://trades.flexfoxfantasy.com

# Staging environment
VITE_OLD_CLIENT_URL=https://staging.trades.akosua.xyz
```

### Phase 3: Frontend Implementation - Old App (Vue 2) ✅ COMPLETE

**Target**: TradeMachineClient (`trades.flexfoxfantasy.com` / `staging.trades.akosua.xyz`)

**Objective**: Add token detection and exchange logic to automatically authenticate users with SSO tokens

#### Task 3.1: Add Token Exchange to tRPC Client ✅ COMPLETE
**File**: `src/utils/trpcClient.js` (MODIFY)

```javascript
// Add token exchange helper function
export async function exchangeRedirectToken(token) {
  try {
    console.debug('Exchanging SSO redirect token:', token.slice(0, 8))
    return await trpcClient.client.exchangeRedirectToken.mutate({ token })
  } catch (error) {
    console.error('Token exchange failed:', error)
    throw error
  }
}
```

#### Task 3.2: Add Token Exchange Action to Store ✅ COMPLETE
**File**: `src/store/actions/auth.js` (MODIFY)

```javascript
import { exchangeRedirectToken } from '@/utils/trpcClient'

export default {
  // ... existing actions

  // NEW: Exchange SSO token for session
  async exchangeSSOToken({ commit }, { token }) {
    try {
      console.debug('Exchanging SSO token:', token.slice(0, 8))
      
      const response = await exchangeRedirectToken(token)
      
      if (response.success && response.user) {
        // Use existing saveCurrentUser helper
        saveCurrentUser(commit, response.user, 'exchangeSSOToken')
        return response.user
      } else {
        throw new Error('Invalid token exchange response')
      }
    } catch (error) {
      console.error('SSO token exchange failed:', error)
      throw error
    }
  },

  // ... rest of existing actions
}
```

#### Task 3.3: Add SSO Token Detection to Router Guards ✅ COMPLETE
**File**: `src/router/guards.js` (MODIFY)

```javascript
import store from '@/store'
import { saveCurrentUser } from '@/store/actions/auth'

// NEW: Extract and exchange SSO token from URL fragment
async function handleSSOToken() {
  // Check for SSO token in URL fragment
  const fragment = window.location.hash
  const tokenMatch = fragment.match(/sso_token=([a-f0-9]{64})/)
  
  if (!tokenMatch) {
    return null // No token found
  }

  const token = tokenMatch[1]
  console.debug('SSO token detected in URL fragment:', token.slice(0, 8))

  try {
    // Exchange token for session
    const user = await store.dispatch('exchangeSSOToken', { token })
    
    // Clear token from URL immediately (prevent back button reuse)
    const cleanUrl = window.location.href.replace(/#sso_token=[a-f0-9]{64}/, '')
    window.history.replaceState({}, document.title, cleanUrl)
    
    console.debug('SSO token exchange successful for user:', user.email)
    return user
  } catch (error) {
    console.error('SSO token exchange failed:', error)
    
    // Clear invalid token from URL
    const cleanUrl = window.location.href.replace(/#sso_token=[a-f0-9]{64}/, '')
    window.history.replaceState({}, document.title, cleanUrl)
    
    return null // Silent failure - user can login normally
  }
}

// MODIFIED: Update globalSessionCheck to handle SSO tokens first
export async function globalSessionCheck(to, from, next) {
  const timerId = 'guards.globalSessionCheck'
  console.time(timerId)
  console.debug('ROUTER GUARD: checking `globalSessionCheck`')

  // NEW: Check for SSO token first before session check
  const ssoUser = await handleSSOToken()
  if (ssoUser) {
    console.debug('ROUTER GUARD: SSO token authenticated user successfully')
    console.timeEnd(timerId)
    return next()
  }

  // Continue with existing session check logic
  if (!to.matched.some(record => record.meta.auth)) {
    console.debug('ROUTER GUARD: entering non-auth page - checking session')
    const sessionUser = await store.dispatch('checkSession')
    if (sessionUser) {
      console.debug('ROUTER GUARD: session was valid - continue')
      saveCurrentUser(store.commit, sessionUser, timerId)
      console.timeEnd(timerId)
      next()
    } else {
      console.debug('ROUTER GUARD: session was expired - redirect to login')
      console.timeEnd(timerId)
      next({ name: 'login', query: { redirectPath: to.fullPath } })
    }
  } else {
    console.debug('ROUTER GUARD: entering auth page - continue')
    console.timeEnd(timerId)
    next()
  }
}
```

### Phase 4: Error Handling & User Experience

#### Task 4.1: Comprehensive Error Handling

**New App Error Handling**:
```typescript
// Enhanced error handling in redirectToOldApp
async function redirectToOldApp(targetPath: string = '/make_trade'): Promise<void> {
  try {
    // ... token creation logic
  } catch (error: any) {
    // Show user-friendly error messages
    if (error.data?.code === 'BAD_REQUEST') {
      push.error('Unable to redirect. Please try logging in again.')
    } else if (error.data?.code === 'UNAUTHORIZED') {
      push.error('Session expired. Please log in again.')
      await logout()
    } else {
      push.error('Redirect failed. You can continue here or try the main app.')
    }
    throw error
  }
}
```

**Old App Error Handling**:
```javascript
// Silent error handling in handleSSOToken
try {
  const user = await store.dispatch('exchangeSSOToken', { token })
  // ... success handling
} catch (error) {
  // Silent failure - don't show error to user
  console.error('SSO login failed, user can login manually:', error)
  return null // Let normal session check continue
}
```

#### Task 4.2: Loading States and Visual Feedback

**New App**:
- Add loading state during redirect: "Redirecting to TradeMachine..."
- Disable form during redirect process
- Show success message before redirect

**Old App**:
- Silent background processing
- No loading spinners (should appear instant)
- Show welcome message on successful SSO: "Welcome back!"

### Phase 5: Testing Strategy

#### Task 5.1: Manual Testing Checklist

**End-to-End Flow**:
1. ✅ User visits new app login page
2. ✅ User logs in successfully  
3. ✅ New app creates redirect token via tRPC
4. ✅ User redirected to old app with token in URL fragment
5. ✅ Old app detects token in URL fragment
6. ✅ Old app exchanges token for session via tRPC
7. ✅ Token cleared from URL
8. ✅ User lands on `/make_trade` page, fully authenticated

**Error Scenarios**:
- ❌ Expired token (60+ seconds old)
- ❌ Invalid token format
- ❌ Already consumed token
- ❌ Network errors during token creation
- ❌ Network errors during token exchange
- ❌ User not authenticated in new app

**Environment Testing**:
- 🧪 Development: localhost → localhost
- 🧪 Staging: ffftemp.akosua.xyz → staging.trades.akosua.xyz
- 🧪 Production: ffftemp.akosua.xyz → trades.flexfoxfantasy.com

#### Task 5.2: Unit Tests

**New App Tests** (`src/stores/auth.test.ts`):
```typescript
describe('SSO redirect functionality', () => {
  it('should create redirect token and redirect to old app', async () => {
    // Mock tRPC client response
    mockClientApi.createRedirectToken.mockResolvedValue({
      token: 'abc123def456...64chars',
      redirectTo: 'https://trades.flexfoxfantasy.com/make_trade',
      expiresIn: 60
    })

    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: { href: '', origin: 'https://ffftemp.akosua.xyz' },
      writable: true
    })

    await store.redirectToOldApp('/make_trade')

    expect(mockClientApi.createRedirectToken).toHaveBeenCalledWith({
      redirectTo: 'https://trades.flexfoxfantasy.com/make_trade',
      origin: 'https://ffftemp.akosua.xyz'
    })
    expect(window.location.href).toContain('sso_token=abc123def456')
  })
})
```

**Old App Tests** (`src/router/guards.test.js`):
```javascript
describe('SSO token handling', () => {
  it('should exchange valid SSO token for user session', async () => {
    // Mock URL with SSO token
    Object.defineProperty(window, 'location', {
      value: { 
        hash: '#sso_token=abc123def456...',
        href: 'https://trades.flexfoxfantasy.com/make_trade#sso_token=abc123def456...'
      }
    })

    // Mock successful token exchange
    mockTrpcClient.exchangeRedirectToken.mockResolvedValue({
      success: true,
      user: mockUser
    })

    const user = await handleSSOToken()

    expect(user).toEqual(mockUser)
    expect(mockTrpcClient.exchangeRedirectToken).toHaveBeenCalledWith({
      token: 'abc123def456...'
    })
  })
})
```

### Phase 6: Deployment & Monitoring

#### Task 6.1: Staging Deployment

**Prerequisites**:
1. ✅ Backend SSO endpoints deployed to staging
2. ✅ Environment variables configured
3. ✅ CORS settings allow both domains

**Deployment Order**:
1. **New App**: Deploy SSO redirect functionality to ffftemp.akosua.xyz
2. **Old App**: Deploy SSO token handling to staging.trades.akosua.xyz  
3. **Test**: Complete end-to-end SSO flow
4. **Monitor**: Check logs for successful token exchanges

#### Task 6.2: Production Deployment

**Deployment Order**:
1. **Old App**: Deploy SSO token handling to trades.flexfoxfantasy.com
2. **New App**: Deploy SSO redirect functionality (already live)
3. **Enable**: Set `VITE_ENABLE_SSO_REDIRECT=true` for new app
4. **Monitor**: Track SSO success rates and errors

#### Task 6.3: Monitoring & Analytics

**Backend Metrics** (already implemented):
- `transfer_token_generated_total` - Tokens created
- `transfer_token_exchanged_total` - Successful exchanges
- `transfer_token_failed_total` - Failed exchanges with reasons

**Frontend Analytics**:
```typescript
// New App: Track SSO redirect attempts
trackEvent('sso_redirect_initiated', {
  targetApp: 'old_app',
  targetPath: targetPath,
  userRole: currentUser.value?.role
})

// Old App: Track SSO authentication success
console.debug('SSO authentication successful', { 
  userId: user.id, 
  userEmail: user.email,
  fromDomain: document.referrer
})
```

**Success Metrics**:
- SSO redirect success rate > 95%
- Token exchange success rate > 98%
- Time between token creation and exchange < 10 seconds
- Zero infinite redirect loops

### Phase 7: Feature Flag & Gradual Rollout

#### Task 7.1: Feature Flag Implementation

**Environment-Based Control**:
```bash
# Enable SSO for specific environments
VITE_ENABLE_SSO_REDIRECT=true  # Production
VITE_ENABLE_SSO_REDIRECT=false # Disable if issues arise
```

**IP-Based Control** (already implemented):
- Existing IP feature flag controls who sees new app
- SSO only affects users already on new app
- Natural gradual rollout as IP allowlist expands

#### Task 7.2: Rollback Plan

**If SSO Issues Arise**:
1. **Immediate**: Set `VITE_ENABLE_SSO_REDIRECT=false`
2. **Impact**: Users stay in new app after login
3. **Fallback**: Users can manually navigate to old app
4. **Resolution**: Fix issues and re-enable gradually

## Summary & Next Steps

### Implementation Status

**Backend**: ✅ **COMPLETE**
- SSO endpoints implemented and tested
- Token storage and management ready
- CORS and security configured
- Metrics and monitoring in place

**Frontend**: 🚧 **READY FOR IMPLEMENTATION**

### Phase Timeline

**Phase 2: New App Implementation** (Estimated: 2-3 hours)
- Create tRPC client API composable
- Add SSO redirect logic to auth store  
- Update login form with redirect flow
- Configure environment variables

**Phase 3: Old App Implementation** (Estimated: 2-3 hours)
- Add token exchange to tRPC client
- Add SSO action to Vuex store
- Update router guards for token detection
- Test end-to-end flow

**Phase 4-7: Polish & Deploy** (Estimated: 1-2 hours)
- Error handling and UX improvements
- Testing and validation
- Staging deployment
- Production rollout

### Key Implementation Notes

1. **Consistent SSO Flow**: Always use token exchange (even in staging) to exercise endpoints
2. **Silent Fallback**: Failed SSO attempts don't block normal login flow
3. **URL Fragment Strategy**: Prevents server-side processing and enables client-side handling
4. **Environment-Based Rollout**: Feature flag enables gradual deployment
5. **Comprehensive Testing**: Cover both success and failure scenarios

### Expected User Experience

**Successful SSO Flow**:
1. User logs into new app (`ffftemp.akosua.xyz`)
2. Shows success message: "Welcome back! Redirecting..."
3. Seamless redirect to old app (`trades.flexfoxfantasy.com/make_trade`)
4. User lands authenticated and ready to trade

**Fallback Experience**:
- Any SSO failures are silent
- User stays in new app or can manually navigate
- No broken workflows or error messages to end users

This implementation provides a robust, user-friendly SSO experience while maintaining system reliability and enabling gradual migration between the two frontend applications.