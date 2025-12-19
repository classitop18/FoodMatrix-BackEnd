# Email Templates Build Fix - Backend

## Problem
Email layouts were not being copied to the `dist` folder during the build process, causing the application to fail when trying to send emails in production.

### Issues Found:
1. **Incorrect Path**: `email.service.ts` was looking for templates at `dist/email/email/layouts` (double "email")
2. **Missing Files**: `.hbs` template files were not being copied to `dist` folder during build

## Solution

### 1. Fixed Path in `email.service.ts`
**File**: `backend/src/email/email.service.ts`

**Changed**:
```typescript
// Before (WRONG - adds 'email' twice)
const BASE_DIR = path.join(__dirname, "email", "layouts");

// After (CORRECT - __dirname is already 'dist/email/')
const BASE_DIR = path.join(__dirname, "layouts");
```

**Explanation**: 
- In development with `tsx`, `__dirname` = `src/email/`
- In production with compiled code, `__dirname` = `dist/email/`
- So we only need to add `"layouts"`, not `"email/layouts"`

### 2. Updated Build Configuration
**File**: `backend/tsup.config.ts`

**Added**:
- Filesystem imports for copying files
- `onSuccess` hook to copy `.hbs` files after build
- Creates `dist/email/layouts/` directory structure
- Copies all `.hbs` template files

**Implementation**:
```typescript
import { defineConfig } from "tsup";
import * as fs from "fs";
import * as path from "path";

export default defineConfig({
    // ... existing config ...
    onSuccess: async () => {
        const sourceDir = "src/email/layouts";
        const destDir = "dist/email/layouts";
        
        // Create destination directory
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }
        
        // Copy all .hbs files
        const files = fs.readdirSync(sourceDir);
        files.forEach((file: string) => {
            if (file.endsWith(".hbs")) {
                fs.copyFileSync(
                    path.join(sourceDir, file),
                    path.join(destDir, file)
                );
            }
        });
        
        console.log("✅ Email templates copied to dist/email/layouts");
    },
});
```

## Email Templates Copied

The following templates are now automatically copied during build:
- `footer.hbs` - Email footer template
- `main.hbs` - Main email layout wrapper
- `member-invitation.hbs` - Member invitation email
- `otp.hbs` - OTP verification email
- `reset-password.hbs` - Password reset email
- `verification.hbs` - Email verification template

## Verification

### Build Output:
```bash
$ npm run build
...
ESM ⚡️ Build success in 159ms
✅ Email templates copied to dist/email/layouts
```

### Files Verified:
```bash
$ ls -la dist/email/layouts/
total 32
-rw-rw-r-- 1 ubuntu ubuntu  111 Dec 19 12:09 footer.hbs
-rw-rw-r-- 1 ubuntu ubuntu  715 Dec 19 12:09 main.hbs
-rw-rw-r-- 1 ubuntu ubuntu 1089 Dec 19 12:09 member-invitation.hbs
-rw-rw-r-- 1 ubuntu ubuntu  398 Dec 19 12:09 otp.hbs
-rw-rw-r-- 1 ubuntu ubuntu  189 Dec 19 12:09 reset-password.hbs
-rw-rw-r-- 1 ubuntu ubuntu  861 Dec 19 12:09 verification.hbs
```

## How It Works

### Development Mode (`npm run dev`):
- Uses `tsx` which runs TypeScript directly
- Templates loaded from: `src/email/layouts/`
- No build step needed

### Production Mode (`npm run build` + `npm start`):
- TypeScript compiled to `dist/`
- Templates copied to: `dist/email/layouts/`
- Compiled JS loads templates from: `dist/email/layouts/`

## Path Resolution

```
Development:
src/email/email.service.ts
  __dirname = src/email/
  BASE_DIR = src/email/ + layouts = src/email/layouts/ ✅

Production:
dist/email/email.service.js
  __dirname = dist/email/
  BASE_DIR = dist/email/ + layouts = dist/email/layouts/ ✅
```

## Testing

To test the fix:

1. **Build the project**:
   ```bash
   npm run build
   ```

2. **Verify templates exist**:
   ```bash
   ls -la dist/email/layouts/
   ```

3. **Run in production mode**:
   ```bash
   npm start
   ```

4. **Test email sending**:
   - Try user registration (verification email)
   - Try password reset (reset email)
   - Try OTP generation (OTP email)
   - Try member invitation (invitation email)

All emails should now work correctly in production! ✅

## Note on TypeScript Errors

The config file may show TypeScript linting errors for the `fs` and `path` imports. This is expected and doesn't affect functionality because:
- Config files run in Node.js context (not compiled TypeScript)
- These are build-time operations only
- The build succeeds and copies files correctly
