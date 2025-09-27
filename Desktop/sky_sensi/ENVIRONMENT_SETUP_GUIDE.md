# Sky Sensi Environment Setup & Troubleshooting Guide

This comprehensive guide helps you set up and troubleshoot the Sky Sensi aviation weather briefing system development environment. For basic setup instructions, see [SETUP_INSTRUCTIONS.md](./SETUP_INSTRUCTIONS.md).

## 🔧 Prerequisites Verification

### Node.js Version Requirements

Sky Sensi requires **Node.js ≥18.0.0** due to the Google Generative AI SDK dependency.

**Check your current version:**
```bash
node --version
npm --version
```

**Upgrade Node.js if needed:**
- **macOS (via Homebrew):** `brew install node`
- **macOS/Linux (via Node Version Manager):**
  ```bash
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
  nvm install 18
  nvm use 18
  ```
- **Windows:** Download from [nodejs.org](https://nodejs.org/) (LTS version)

**Verify compatibility:**
```bash
npm run verify-setup
```

### Environment Variables Validation

Both backend and frontend require properly configured `.env` files.

**Backend (.env) Required Variables:**
- `GEMINI_API_KEY` - Google Gemini API key (starts with "AIzaSy")
- `PORT` - Backend server port (default: 3001)
- `NODE_ENV` - Environment mode (development/production)
- `CORS_ORIGINS` - Frontend URLs for CORS policy

**Frontend (.env) Required Variables:**
- `VITE_API_BASE_URL` - Backend API endpoint URL
- `VITE_ENV` - Frontend environment mode
- `VITE_API_TIMEOUT` - API request timeout (milliseconds)
- `VITE_ENABLE_DEBUG_LOGS` - Debug logging flag

**Quick validation:**
```bash
# Check if .env files exist and are valid
ls -la backend/.env frontend/.env
npm run verify-setup
```

## 🚨 Common Issues & Solutions

### 1. Node.js Version Compatibility

**Error:** `TypeError: Class extends value undefined is not a constructor`
**Cause:** Node.js version < 18.0.0
**Solution:**
```bash
# Check version
node --version
# If < 18.0.0, upgrade:
# macOS with Homebrew
brew install node
# Or use NVM
nvm install 18 && nvm use 18
```

### 2. Google Gemini API Key Issues

**Error:** `400 Bad Request` or `Invalid API key`
**Cause:** Missing or invalid `GEMINI_API_KEY`

**Solution:**
1. Get API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Ensure key starts with `AIzaSy`
3. Update `backend/.env`:
   ```env
   GEMINI_API_KEY=AIzaSyYourActualAPIKeyHere
   ```

**Validation:**
```bash
# Test API key format
grep "GEMINI_API_KEY" backend/.env
# Should show: GEMINI_API_KEY=AIzaSy...
```

### 3. Port Conflicts

**Error:** `EADDRINUSE: address already in use :::3000` or `:::3001`
**Cause:** Ports 3000/3001 already occupied

**Solution:**
```bash
# Cross-platform: Use kill-port package
npx kill-port 3000
npx kill-port 3001

# macOS/Linux: Find and kill processes
lsof -ti:3000
lsof -ti:3001
kill -9 <PID>
# Or kill all on port
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9

# Windows PowerShell: Find and kill processes
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process -Force
Get-Process -Id (Get-NetTCPConnection -LocalPort 3001).OwningProcess | Stop-Process -Force
# Or use netstat
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

**Alternative ports:**
- Change `PORT=3002` in `backend/.env`
- Update `VITE_API_BASE_URL=http://localhost:3002/api` in `frontend/.env`

### 4. Dependency Installation Failures

**Error:** `npm ERR! peer dep missing` or package conflicts
**Cause:** Corrupted node_modules or version conflicts

**Solution:**
```bash
# Clean install (removes all dependencies)
npm run clean-install

# Or manual cleanup
rm -rf node_modules backend/node_modules frontend/node_modules
rm package-lock.json backend/package-lock.json frontend/package-lock.json
npm run bootstrap
```

### 5. Module Loading Errors

**Error:** `Cannot find module '@google/generative-ai'`
**Cause:** Missing backend dependencies

**Solution:**
```bash
# Install backend dependencies
cd backend && npm install

# Verify Google AI SDK installation
node -e "console.log(require('@google/generative-ai'))"
```

**Error:** `Cannot resolve module` in frontend
**Cause:** Missing frontend dependencies

**Solution:**
```bash
# Install frontend dependencies
cd frontend && npm install

# Check for missing peer dependencies
npm ls
```

### 6. CORS Policy Errors

**Error:** `Access to fetch at 'localhost:3001' from origin 'localhost:3000' has been blocked by CORS policy`
**Cause:** Incorrect CORS configuration

**Solution:**
1. Verify `backend/.env` has correct origins:
   ```env
   CORS_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:3001
   ```
2. Restart backend server:
   ```bash
   cd backend && npm run dev
   ```

### 7. Vite Environment Variable Issues

**Error:** `undefined` for environment variables in frontend
**Cause:** Variables not prefixed with `VITE_`

**Solution:**
1. Ensure all frontend env vars start with `VITE_`:
   ```env
   VITE_API_BASE_URL=http://localhost:3001/api
   VITE_ENV=development
   ```
2. Restart frontend server:
   ```bash
   cd frontend && npm run dev
   ```

## 🔍 Diagnostic Commands

### Environment Verification
```bash
# Run comprehensive environment check
npm run verify-setup

# Check individual components
node --version                    # Node.js version
npm --version                     # npm version
ls -la backend/.env frontend/.env # .env files exist
curl http://localhost:3001/health # Backend health
curl http://localhost:3000        # Frontend health
```

### Dependency Status
```bash
# Check backend dependencies
cd backend && npm ls

# Check frontend dependencies  
cd frontend && npm ls

# Check for outdated packages
npm outdated
```

### Server Testing
```bash
# Test backend server startup
cd backend && npm run dev

# Test frontend server startup
cd frontend && npm run dev

# Run health ping (after servers are started)
npm run health-ping
```

## 🖥️ Platform-Specific Instructions

### macOS
```bash
# Install Xcode Command Line Tools (required for npm packages)
xcode-select --install

# Using Homebrew (recommended)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install node

# Grant permissions if needed
sudo chown -R $(whoami) ~/.npm
```

### Windows
```powershell
# Install via Chocolatey
choco install nodejs

# Or install via Scoop
scoop install nodejs

# Windows-specific: Run as Administrator if permission errors
# Use PowerShell or Git Bash for better terminal experience

# Port management with PowerShell:
# Find process using port
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess
# Kill process by PID
Stop-Process -Id <PID> -Force
# Or use netstat + taskkill
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Dependency cleanup (PowerShell alternative to rm -rf)
Remove-Item -Recurse -Force node_modules, package-lock.json -ErrorAction SilentlyContinue
```

### Linux (Ubuntu/Debian)
```bash
# Install via NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Or via Snap
sudo snap install node --classic
```

## 🚀 Development Workflow

### First-Time Setup
```bash
# 1. Clone and navigate
git clone <repository-url>
cd sky-sensi

# 2. Verify environment
npm run verify-setup

# 3. Install dependencies
npm run bootstrap

# 4. Configure environment files
# Edit backend/.env with your GEMINI_API_KEY
# Verify frontend/.env points to correct backend URL

# 5. Start development servers
npm run dev
# Or start individually:
# cd backend && npm run dev
# cd frontend && npm run dev
```

### Regular Development
```bash
# Start both servers
npm run dev

# Health ping (run after servers are started)
npm run health-ping

# Clean reinstall if issues
npm run clean-install
```

### Troubleshooting Workflow
```bash
# 1. Run diagnostics
npm run verify-setup

# 2. Start servers first, then check health
npm run dev
# In another terminal:
npm run health-ping

# 3. If issues, clean reinstall
npm run clean-install

# 4. Restart servers
npm run dev
```

## 📋 Environment Checklist

Before starting development, ensure:

- [ ] Node.js ≥18.0.0 installed
- [ ] npm ≥9.0.0 installed  
- [ ] `backend/.env` exists with valid `GEMINI_API_KEY`
- [ ] `frontend/.env` exists with correct `VITE_API_BASE_URL`
- [ ] Ports 3000 and 3001 are available
- [ ] Dependencies installed (`npm run bootstrap`)
- [ ] Backend starts without errors (`cd backend && npm run dev`)
- [ ] Frontend starts without errors (`cd frontend && npm run dev`)
- [ ] API connectivity works (`curl http://localhost:3001/health`)

## 🆘 Still Having Issues?

1. **Run the verification script:** `npm run verify-setup`
2. **Check the debugging notes:** [DEBUGGING_NOTES.md](./DEBUGGING_NOTES.md)
3. **Review setup instructions:** [SETUP_INSTRUCTIONS.md](./SETUP_INSTRUCTIONS.md)
4. **Clean slate approach:**
   ```bash
   npm run clean-install
   npm run verify-setup
   npm run dev
   ```

## 📚 Additional Resources

- [Node.js Installation Guide](https://nodejs.org/en/download/)
- [Google AI Studio](https://makersuite.google.com/app/apikey) - API Key
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- [CORS Documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)

---

**Quick Start Summary:**
```bash
npm run verify-setup  # Check environment
npm run bootstrap     # Install dependencies  
npm run dev          # Start both servers
```

Open [http://localhost:3000](http://localhost:3000) to access Sky Sensi!