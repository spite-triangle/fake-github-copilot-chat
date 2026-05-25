const fs = require('fs');

const srcPath = 'src/platform/endpoint/node/modelMetadataFetcher.ts';
let content = fs.readFileSync(srcPath, 'utf8');

const ctrl = JSON.parse(fs.readFileSync('_replace_ctrl.json', 'utf8'));
const oldFunc = content.substring(ctrl.start, ctrl.end);

// Read new func
const newFunc = fs.readFileSync('_newFetchModels.txt', 'utf8');

content = content.replace(oldFunc, newFunc);
fs.writeFileSync(srcPath, content, 'utf8');
console.log('SUCCESS: _fetchModels replaced');
