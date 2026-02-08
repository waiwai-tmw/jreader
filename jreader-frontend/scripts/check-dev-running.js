#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function checkDevRunning() {
  let devServerFound = false;
  
  try {
    // Check for Next.js dev server processes
    // Look for processes that contain "next dev"
    const { stdout: processCheck } = await execAsync('ps aux | grep "next dev" | grep -v grep');
    
    if (processCheck.trim()) {
      devServerFound = true;
      console.error('❌ Error: Development server is currently running!');
      console.error('Please stop the dev server (Ctrl+C) before running build.');
      console.error('\nRunning processes:');
      console.error(processCheck);
    }
  } catch (error) {
    // No processes found, which is good
  }
  
  try {
    // Also check if port 3000 is in use
    const { stdout: portCheck } = await execAsync('lsof -ti:3000');
    if (portCheck.trim()) {
      devServerFound = true;
      console.error('❌ Error: Port 3000 is in use!');
      console.error('This might indicate a development server is running.');
      console.error('Please stop any processes using port 3000 before running build.');
    }
  } catch (portError) {
    // Port 3000 is not in use, which is good
  }
  
  if (devServerFound) {
    process.exit(1);
  }
  
  console.log('✅ No development server detected. Proceeding with build...');
  process.exit(0);
}

checkDevRunning();
