# Microsoft OAuth SSO Configuration Guide

This guide walks you through setting up Microsoft OAuth for Marvelops.

## Prerequisites

- Microsoft Azure account with active subscription
- Admin access to Azure Active Directory (AAD)

## Step 1: Register Application in Azure Portal

1. **Go to Azure Portal**: https://portal.azure.com
2. **Navigate to App Registrations**:
   - Search for "App registrations" in the top search bar
   - Click on "App registrations"
3. **Create New Registration**:
   - Click "+ New registration"
   - Enter name: `Marvelops TravelPro` (or your app name)
   - Select "Accounts in any organizational directory (Any Microsoft ID tenant) and personal Microsoft accounts"
   - Click "Register"

## Step 2: Configure Redirect URIs

1. **Go to Authentication tab** (left menu)
2. **Add Redirect URIs** for both development and production:
   - Click "Add a platform" → "Single-page application (SPA)"
   - Add these URIs:
     ```
     http://localhost:5173/mock-login
     https://yourdomain.com/mock-login
     ```
   - Click "Configure"

## Step 3: Get Credentials

1. **Go to Overview tab**
2. **Copy these values**:
   - **Application (client) ID** → Use as `VITE_MICROSOFT_CLIENT_ID`
   - **Directory (tenant) ID** → Use as `VITE_MICROSOFT_TENANT` (optional, defaults to "common")

## Step 4: Configure Environment Variables

### Local Development (.env)

Create or update `.env` file in project root:

```env
# Microsoft OAuth Configuration
VITE_MICROSOFT_CLIENT_ID=your-app-id-here
MICROSOFT_CLIENT_ID=your-app-id-here
VITE_MICROSOFT_TENANT=common
MICROSOFT_TENANT=common
VITE_MICROSOFT_REDIRECT_URI=http://localhost:5173/mock-login

# Other required vars
NODE_ENV=development
PORT=3001
CORS_ORIGIN=http://localhost:5173
JWT_SECRET=your-secret-key
```

### Production (Railway)

1. **Go to your Railway project → Variables**
2. **Add these variables**:
   ```
   VITE_MICROSOFT_CLIENT_ID=your-app-id
   MICROSOFT_CLIENT_ID=your-app-id
   VITE_MICROSOFT_TENANT=your-tenant-id
   MICROSOFT_TENANT=your-tenant-id
   VITE_MICROSOFT_REDIRECT_URI=https://yourdomain.com/mock-login
   ```

## Step 5: Test the Integration

### Local Testing

1. Start development server:
   ```bash
   npm install
   npm start
   ```

2. Navigate to login page:
   ```
   http://localhost:5173/mock-login
   ```

3. Click "Sign in with Microsoft" button

4. You should be redirected to Microsoft login

5. After successful login, you'll be redirected back to the app

### Debugging

If login fails, check:

1. **Browser Console** (F12):
   - Look for errors like "VITE_MICROSOFT_CLIENT_ID is missing"
   - Check if the OAuth flow URL is being called

2. **Server Logs** (`npm start` output):
   - Look for "Microsoft token verification failed"
   - Check audience and issuer mismatch errors

3. **Network Tab** (F12):
   - Check the `/api/auth/microsoft` request
   - Verify the response status and error message

### Common Issues

#### Issue: "Microsoft SSO is not configured"

**Solution**: 
- Verify `.env` file has `VITE_MICROSOFT_CLIENT_ID` set
- Restart the dev server after adding env vars
- Check that the value is not empty or a placeholder

#### Issue: "Invalid redirect_uri"

**Solution**:
- Ensure redirect URI in `.env` matches exactly one registered in Azure
- For localhost, use `http://localhost:5173/mock-login` (not https)
- For production, use your exact domain: `https://yourdomain.com/mock-login`

#### Issue: "Invalid or expired Microsoft token"

**Solution**:
- Verify `MICROSOFT_CLIENT_ID` matches your Azure app ID
- Check that your app hasn't been deleted in Azure
- Try clearing browser cache and cookies
- Restart both frontend and backend servers

#### Issue: "Microsoft token verification failed" (server logs)

**Solution**:
- Verify `MICROSOFT_CLIENT_ID` is set in `.env`
- Check that the tenant ID is correct (defaults to "common" for multi-tenant)
- Verify the token endpoint URL is reachable
- Check server logs for detailed error message
- Enable debug logging with `LOG_LEVEL=debug` in `.env`

## Step 6: First-Time User Flow

When a user logs in via Microsoft OAuth:

1. Their Microsoft identity is verified
2. If no account exists, a new user is created with:
   - **Tier**: `agent` (default, can be changed by admin)
   - **Status**: `active` (immediately accessible)
   - **Email**: From Microsoft profile
   - **Name**: From Microsoft profile
3. If account exists, Microsoft ID is linked to the existing account
4. User is issued a JWT token and redirected to dashboard

## Additional Notes

- Users created via Microsoft SSO can also set a password later if needed
- Admin can still manage user tiers and permissions
- Multiple users can be invited via email invitations
- Microsoft tokens are exchanged server-side (secure PKCE flow)

## Support

For issues:

1. Check the [Microsoft Identity Platform docs](https://docs.microsoft.com/en-us/azure/active-directory/develop/)
2. Review server logs for detailed error messages
3. Check browser DevTools Network tab for API responses
4. Verify all environment variables are set correctly
