// Usage: node migrate_executions_add_userid.js <userId>
// Adds a userId field to all executions in executions.json that do not have one.

const fs = require('fs');
const path = require('path');

const EXECUTIONS_FILE = path.join(__dirname, 'executions.json');

const userId = process.argv[2] || 'REPLACE_WITH_USER_ID';

if (!userId || userId === 'REPLACE_WITH_USER_ID') {
  console.error('Please provide a userId as an argument: node migrate_executions_add_userid.js <userId>');
  process.exit(1);
}

if (!fs.existsSync(EXECUTIONS_FILE)) {
  console.error('executions.json not found!');
  process.exit(1);
}

const data = fs.readFileSync(EXECUTIONS_FILE, 'utf-8');
let executions = [];
try {
  executions = JSON.parse(data);
} catch (e) {
  console.error('Failed to parse executions.json:', e);
  process.exit(1);
}

let updated = false;
for (const exec of executions) {
  if (!('userId' in exec)) {
    exec.userId = userId;
    updated = true;
  }
}

if (updated) {
  fs.writeFileSync(EXECUTIONS_FILE, JSON.stringify(executions, null, 2));
  console.log('Updated executions.json: added userId to records without it.');
} else {
  console.log('No records needed updating.');
} 